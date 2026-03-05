const Visualizacao = require('../models/estatistica');
const Ponto = require('../models/ponto');
const Rota = require('../models/rota');
const Trajeto = require('../models/trajeto');
const { Sequelize, Op } = require('sequelize');

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

      const novaVisualizacao = await Visualizacao.create({ tipo, referencia_id });

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

      res.json({
        totalVisualizacoes,
        totalPontos,
        totalTrajetos,
        novosPontos,
        novosTrajetos,
        percentagemVisualizacoes,
        pontoMaisVisto: ponto ? { nome: ponto.name, total: pontoRaw.total } : null,
        rotaMaisVista: rota ? { nome: rota.name, total: rotaRaw.total } : null
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao obter estatísticas.' });
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
