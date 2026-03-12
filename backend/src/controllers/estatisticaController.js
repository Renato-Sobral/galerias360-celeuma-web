const Visualizacao = require('../models/estatistica');
const Ponto = require('../models/ponto');
const Rota = require('../models/rota');
const Trajeto = require('../models/trajeto');
const { Sequelize, Op } = require('sequelize');
const UAParser = require('ua-parser-js');

const VALID_DEVICE_TYPES = new Set(['desktop', 'mobile', 'tablet']);

function normalizeDeviceType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return VALID_DEVICE_TYPES.has(normalized) ? normalized : null;
}

function normalizeTextValue(value) {
  const normalized = String(value || '').trim();
  return normalized ? normalized.slice(0, 50) : null;
}

function getClientOverrides(body = {}) {
  const clientInfo = body.clientInfo && typeof body.clientInfo === 'object' ? body.clientInfo : {};

  return {
    dispositivo: normalizeDeviceType(body.dispositivo || clientInfo.dispositivo || clientInfo.deviceType),
    browser: normalizeTextValue(body.browser || clientInfo.browser),
    sistema_operativo: normalizeTextValue(
      body.sistema_operativo || body.sistemaOperativo || clientInfo.sistema_operativo || clientInfo.sistemaOperativo || clientInfo.os
    ),
  };
}

function inferDeviceType(req, ua, parsedResult) {
  const hintedDevice = normalizeDeviceType(req.headers['x-device-type']);
  if (hintedDevice) return hintedDevice;

  const parsedDeviceType = normalizeDeviceType(parsedResult.device.type);
  if (parsedDeviceType) return parsedDeviceType;

  const mobileHint = req.headers['sec-ch-ua-mobile'];
  if (mobileHint === '?1') return 'mobile';

  const platformHint = String(req.headers['sec-ch-ua-platform'] || req.headers['x-device-platform'] || '').toLowerCase();
  if (platformHint.includes('ipad')) return 'tablet';
  if (platformHint.includes('android') || platformHint.includes('ios') || platformHint.includes('iphone')) return 'mobile';

  if (/ipad|tablet|kindle|silk|playbook|sm-t|tab/i.test(ua)) return 'tablet';

  if (/android|iphone|ipod|iemobile|opera mini|mobile|reactnative|react-native|expo|expogo|okhttp|cfnetwork|darwin/i.test(ua)) {
    return 'mobile';
  }

  return 'desktop';
}

async function buildReferenceNameMaps(entries) {
  const pontoIds = [...new Set(entries.filter((entry) => entry.tipo === 'ponto').map((entry) => entry.referencia_id))];
  const rotaIds = [...new Set(entries.filter((entry) => entry.tipo === 'rota').map((entry) => entry.referencia_id))];

  const [pontos, rotas] = await Promise.all([
    pontoIds.length
      ? Ponto.findAll({
        where: { id_ponto: pontoIds },
        attributes: ['id_ponto', 'name'],
        raw: true,
      })
      : [],
    rotaIds.length
      ? Rota.findAll({
        where: { id_rota: rotaIds },
        attributes: ['id_rota', 'name'],
        raw: true,
      })
      : [],
  ]);

  return {
    pontos: pontos.reduce((acc, ponto) => {
      acc[String(ponto.id_ponto)] = ponto.name;
      return acc;
    }, {}),
    rotas: rotas.reduce((acc, rota) => {
      acc[String(rota.id_rota)] = rota.name;
      return acc;
    }, {}),
  };
}

/**
 * Deteta dispositivo, browser e SO a partir do User-Agent
 */
function parseUserAgent(req) {
  const ua = req.headers['user-agent'] || '';
  const parser = new UAParser(ua);
  const result = parser.getResult();

  const overrides = getClientOverrides(req.body);
  const dispositivo = overrides.dispositivo || inferDeviceType(req, ua, result);
  const browser =
    overrides.browser ||
    normalizeTextValue(req.headers['x-client-browser']) ||
    result.browser.name ||
    'Desconhecido';
  const sistema_operativo =
    overrides.sistema_operativo ||
    normalizeTextValue(req.headers['x-client-os']) ||
    result.os.name ||
    'Desconhecido';

  return {
    dispositivo,
    browser,
    sistema_operativo,
  };
}

module.exports = {
  adicionarVisualizacao: async (req, res) => {
    try {
      const { tipo, referencia_id } = req.body;

      if (!tipo || !referencia_id) {
        return res.status(400).json({ error: 'Campos "tipo" e "referencia_id" são obrigatórios.' });
      }

      if (!['ponto', 'rota'].includes(tipo)) {
        return res.status(400).json({ error: 'Tipo inválido. Deve ser "ponto" ou "rota".' });
      }

      const entidadeExiste = tipo === 'ponto'
        ? await Ponto.findByPk(referencia_id)
        : await Rota.findByPk(referencia_id);

      if (!entidadeExiste) {
        return res.status(404).json({ error: `O ${tipo} com ID ${referencia_id} não existe.` });
      }

      const { dispositivo, browser, sistema_operativo } = parseUserAgent(req);

      const novaVisualizacao = await Visualizacao.create({
        tipo,
        referencia_id,
        dispositivo,
        browser,
        sistema_operativo,
      });

      res.status(201).json({
        message: `Visualização de ${tipo} registada com sucesso.`,
        visualizacao: novaVisualizacao
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao registar visualização.' });
    }
  },

  estatisticasResumo: async (req, res) => {
    try {
      const totalVisualizacoes = await Visualizacao.count();
      const totalPontos = await Ponto.count();
      const totalTrajetos = await Trajeto.count();

      const pontoRaw = await Visualizacao.findOne({
        where: { tipo: 'ponto' },
        attributes: ['referencia_id', [Sequelize.fn('COUNT', Sequelize.col('referencia_id')), 'total']],
        group: ['referencia_id'],
        order: [[Sequelize.literal('total'), 'DESC']],
        raw: true
      });

      const ponto = pontoRaw ? await Ponto.findByPk(pontoRaw.referencia_id) : null;

      const rotaRaw = await Visualizacao.findOne({
        where: { tipo: 'rota' },
        attributes: ['referencia_id', [Sequelize.fn('COUNT', Sequelize.col('referencia_id')), 'total']],
        group: ['referencia_id'],
        order: [[Sequelize.literal('total'), 'DESC']],
        raw: true
      });

      const rota = rotaRaw ? await Rota.findByPk(rotaRaw.referencia_id) : null;

      const agora = new Date();
      const ha30Dias = new Date();
      ha30Dias.setDate(agora.getDate() - 30);

      const ultimos30Dias = await Visualizacao.count({
        where: { createdAt: { [Op.gte]: ha30Dias } }
      });

      const anteriores = await Visualizacao.count({
        where: {
          createdAt: {
            [Op.lt]: ha30Dias,
            [Op.gte]: new Date(ha30Dias.getTime() - 30 * 24 * 60 * 60 * 1000),
          }
        }
      });

      const percentagemVisualizacoes = anteriores === 0
        ? 100
        : Math.round(((ultimos30Dias - anteriores) / anteriores) * 100);

      const novosPontos = await Ponto.count({
        where: { createdAt: { [Op.gte]: ha30Dias } }
      });

      const novosTrajetos = await Trajeto.count({
        where: { createdAt: { [Op.gte]: ha30Dias } }
      });

      // Contagens por dispositivo
      const dispositivoCounts = await Visualizacao.findAll({
        attributes: ['dispositivo', [Sequelize.fn('COUNT', Sequelize.col('id_visualizacao')), 'total']],
        group: ['dispositivo'],
        raw: true,
      });

      const dispositivos = { desktop: 0, mobile: 0, tablet: 0 };
      dispositivoCounts.forEach(d => {
        if (d.dispositivo && dispositivos.hasOwnProperty(d.dispositivo)) {
          dispositivos[d.dispositivo] = parseInt(d.total);
        }
      });

      res.json({
        totalVisualizacoes,
        totalPontos,
        totalTrajetos,
        novosPontos,
        novosTrajetos,
        percentagemVisualizacoes,
        pontoMaisVisto: ponto ? { nome: ponto.name, total: pontoRaw.total } : null,
        rotaMaisVista: rota ? { nome: rota.name, total: rotaRaw.total } : null,
        dispositivos,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao obter estatísticas.' });
    }
  },

  /**
   * Distribuição de visualizações por dispositivo
   */
  estatisticasDispositivos: async (req, res) => {
    try {
      const { dias } = req.query;
      const where = {};

      if (dias) {
        const desde = new Date();
        desde.setDate(desde.getDate() - parseInt(dias));
        where.createdAt = { [Op.gte]: desde };
      }

      const resultados = await Visualizacao.findAll({
        where,
        attributes: ['dispositivo', [Sequelize.fn('COUNT', Sequelize.col('id_visualizacao')), 'total']],
        group: ['dispositivo'],
        raw: true,
      });

      const dispositivos = { desktop: 0, mobile: 0, tablet: 0 };
      resultados.forEach(r => {
        if (r.dispositivo && dispositivos.hasOwnProperty(r.dispositivo)) {
          dispositivos[r.dispositivo] = parseInt(r.total);
        }
      });

      res.json({ success: true, data: dispositivos });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao obter estatísticas de dispositivos.' });
    }
  },

  /**
   * Distribuição por browser
   */
  estatisticasBrowsers: async (req, res) => {
    try {
      const { dias } = req.query;
      const where = {};

      if (dias) {
        const desde = new Date();
        desde.setDate(desde.getDate() - parseInt(dias));
        where.createdAt = { [Op.gte]: desde };
      }

      const resultados = await Visualizacao.findAll({
        where,
        attributes: ['browser', [Sequelize.fn('COUNT', Sequelize.col('id_visualizacao')), 'total']],
        group: ['browser'],
        order: [[Sequelize.literal('total'), 'DESC']],
        limit: 10,
        raw: true,
      });

      const browsers = resultados.map(r => ({
        browser: r.browser || 'Desconhecido',
        total: parseInt(r.total),
      }));

      res.json({ success: true, data: browsers });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao obter estatísticas de browsers.' });
    }
  },

  /**
   * Distribuição por sistema operativo
   */
  estatisticasSO: async (req, res) => {
    try {
      const { dias } = req.query;
      const where = {};

      if (dias) {
        const desde = new Date();
        desde.setDate(desde.getDate() - parseInt(dias));
        where.createdAt = { [Op.gte]: desde };
      }

      const resultados = await Visualizacao.findAll({
        where,
        attributes: ['sistema_operativo', [Sequelize.fn('COUNT', Sequelize.col('id_visualizacao')), 'total']],
        group: ['sistema_operativo'],
        order: [[Sequelize.literal('total'), 'DESC']],
        limit: 10,
        raw: true,
      });

      const sistemas = resultados.map(r => ({
        so: r.sistema_operativo || 'Desconhecido',
        total: parseInt(r.total),
      }));

      res.json({ success: true, data: sistemas });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao obter estatísticas de sistemas operativos.' });
    }
  },

  /**
   * Visualizações ao longo do tempo (últimos N dias, agrupadas por dia)
   */
  estatisticasTimeline: async (req, res) => {
    try {
      const dias = parseInt(req.query.dias) || 30;
      const desde = new Date();
      desde.setDate(desde.getDate() - dias);

      const resultados = await Visualizacao.findAll({
        where: { createdAt: { [Op.gte]: desde } },
        attributes: [
          [Sequelize.fn('DATE', Sequelize.col('createdAt')), 'dia'],
          'dispositivo',
          [Sequelize.fn('COUNT', Sequelize.col('id_visualizacao')), 'total'],
        ],
        group: [Sequelize.fn('DATE', Sequelize.col('createdAt')), 'dispositivo'],
        order: [[Sequelize.fn('DATE', Sequelize.col('createdAt')), 'ASC']],
        raw: true,
      });

      // Preencher todos os dias, mesmo sem dados
      const timeline = [];
      const dataMap = {};

      for (let i = 0; i <= dias; i++) {
        const d = new Date(desde);
        d.setDate(desde.getDate() + i);
        const key = d.toISOString().split('T')[0];
        dataMap[key] = { dia: key, desktop: 0, mobile: 0, tablet: 0, total: 0 };
      }

      resultados.forEach(r => {
        const key = typeof r.dia === 'string' ? r.dia : new Date(r.dia).toISOString().split('T')[0];
        if (dataMap[key] && r.dispositivo) {
          dataMap[key][r.dispositivo] = parseInt(r.total);
          dataMap[key].total += parseInt(r.total);
        }
      });

      Object.keys(dataMap).sort().forEach(key => timeline.push(dataMap[key]));

      res.json({ success: true, data: timeline });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao obter timeline de visualizações.' });
    }
  },

  /**
   * Histórico recente de acessos
   */
  historicoAcessos: async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
      const { dias } = req.query;
      const where = {};

      if (dias) {
        const desde = new Date();
        desde.setDate(desde.getDate() - parseInt(dias, 10));
        where.createdAt = { [Op.gte]: desde };
      }

      const acessos = await Visualizacao.findAll({
        where,
        attributes: [
          'id_visualizacao',
          'tipo',
          'referencia_id',
          'dispositivo',
          'browser',
          'sistema_operativo',
          'createdAt',
        ],
        order: [['createdAt', 'DESC']],
        limit,
        raw: true,
      });

      const referenceMaps = await buildReferenceNameMaps(acessos);

      const historico = acessos.map((acesso) => ({
        id_visualizacao: acesso.id_visualizacao,
        tipo: acesso.tipo,
        referencia_id: acesso.referencia_id,
        referencia_nome: acesso.tipo === 'ponto'
          ? referenceMaps.pontos[String(acesso.referencia_id)] || `Ponto #${acesso.referencia_id}`
          : referenceMaps.rotas[String(acesso.referencia_id)] || `Rota #${acesso.referencia_id}`,
        dispositivo: acesso.dispositivo || 'desktop',
        browser: acesso.browser || 'Desconhecido',
        sistema_operativo: acesso.sistema_operativo || 'Desconhecido',
        data_hora: acesso.createdAt,
      }));

      res.json({ success: true, data: historico });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao obter histórico de acessos.' });
    }
  },

  /**
   * Top pontos mais visualizados
   */
  topPontos: async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const { dias } = req.query;
      const where = { tipo: 'ponto' };

      if (dias) {
        const desde = new Date();
        desde.setDate(desde.getDate() - parseInt(dias));
        where.createdAt = { [Op.gte]: desde };
      }

      const resultados = await Visualizacao.findAll({
        where,
        attributes: ['referencia_id', [Sequelize.fn('COUNT', Sequelize.col('id_visualizacao')), 'total']],
        group: ['referencia_id'],
        order: [[Sequelize.literal('total'), 'DESC']],
        limit,
        raw: true,
      });

      const top = [];
      for (const r of resultados) {
        const ponto = await Ponto.findByPk(r.referencia_id);
        if (ponto) {
          top.push({ id_ponto: r.referencia_id, nome: ponto.name, total: parseInt(r.total) });
        }
      }

      res.json({ success: true, data: top });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao obter top pontos.' });
    }
  },

  // Função para obter visualizações de um ponto específico
  visualizacoesPonto: async (req, res) => {
    try {
      const { id_ponto } = req.params;

      // Verifica se o ponto existe
      const ponto = await Ponto.findByPk(id_ponto);
      if (!ponto) {
        return res.status(404).json({ error: `Ponto com ID ${id_ponto} não encontrado.` });
      }

      const visualizacoes = await Visualizacao.count({
        where: { tipo: 'ponto', referencia_id: id_ponto }
      });

      res.json({
        id_ponto,
        nomePonto: ponto.name,
        visualizacoes
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao buscar visualizações do ponto.' });
    }
  }
};
