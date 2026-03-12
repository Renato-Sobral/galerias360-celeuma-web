const Rota = require('../models/rota');
const Trajeto = require('../models/trajeto');
const Ponto = require('../models/ponto');
const PontoTrajeto = require('../models/ponto_trajeto');
const multer = require('multer');
const logger = require('../models/logger');
const path = require('path');
const fs = require('fs');
const { getPublicUploadUrl, normalizeUploadsRelativePath } = require('../utils/mediaLibrary');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '..', 'uploads', 'videos');
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}_${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });
exports.uploadVideoMiddleware = upload.single('video');

exports.uploadVideo = async (req, res) => {
  const { id } = req.params;
  const requestedVideoPath = normalizeUploadsRelativePath(req.body?.videoPath || '');

  if (!req.file && !requestedVideoPath) {
    return res.status(400).json({ error: 'Ficheiro de vídeo não enviado.' });
  }

  try {
    const trajeto = await Trajeto.findByPk(id);
    if (!trajeto) return res.status(404).json({ error: 'Trajeto não encontrado.' });

    const videoPath = req.file
      ? getPublicUploadUrl(`videos/${req.file.filename}`)
      : getPublicUploadUrl(requestedVideoPath);

    trajeto.video = videoPath;
    await trajeto.save();

    logger.info(`📹 Vídeo adicionado ao trajeto com ID ${id}`);
    res.json({ message: 'Vídeo carregado com sucesso.', videoPath });
  } catch (error) {
    console.error('Erro ao carregar vídeo:', error);
    res.status(500).json({ error: 'Erro interno ao carregar vídeo.' });
  }
};

exports.createTrajeto = async (req, res) => {
  const { pontos, description, video } = req.body;

  if (!pontos || !Array.isArray(pontos) || pontos.length < 2) {
    return res.status(400).json({ error: 'Mínimo de 2 pontos é obrigatório.' });
  }

  try {
    const pontosData = await Ponto.findAll({ where: { id_ponto: pontos } });

    if (pontosData.length !== pontos.length) {
      return res.status(404).json({ error: 'Um ou mais pontos são inválidos.' });
    }

    const pontoInicio = pontosData[0];
    const pontoFim = pontosData[pontosData.length - 1];

    const nomeRota = `${pontoInicio.name} a ${pontoFim.name}`;
    const descricaoRota = `Rota entre ${pontoInicio.name} a ${pontoFim.name}`;

    let rota = await Rota.findOne({ where: { name: nomeRota } });
    if (!rota) {
      rota = await Rota.create({ name: nomeRota, description: descricaoRota });
    }

    const trajeto = await Trajeto.create({
      id_rota: rota.id_rota,
      description,
      video
    });

    const associacoes = pontos.map((id_ponto) => ({
      id_trajeto: trajeto.id_trajeto,
      id_ponto
    }));

    await PontoTrajeto.bulkCreate(associacoes);

    logger.info(`🛣️ Trajeto criado com ID ${trajeto.id_trajeto} para rota '${rota.name}'`);
    res.status(201).json({ message: 'Trajeto criado com sucesso', trajeto });
  } catch (error) {
    console.error('Erro ao criar trajeto:', error);
    res.status(500).json({ error: 'Erro interno ao criar trajeto.' });
  }
};

exports.getTrajetoComPontos = async (req, res) => {
  try {
    const trajetos = await Trajeto.findAll({
      include: [
        { model: Ponto, through: { attributes: [] } },
        { model: Rota, attributes: ['id_rota', 'name'] }
      ]
    });

    res.json({ trajetos });
  } catch (err) {
    console.error("Erro ao buscar trajetos:", err);
    res.status(500).json({ error: "Erro ao obter trajetos" });
  }
};

exports.updateDescription = async (req, res) => {
  const { id } = req.params;
  const { description } = req.body;

  try {
    const trajeto = await Trajeto.findByPk(id);
    if (!trajeto) return res.status(404).json({ error: 'Trajeto não encontrado' });

    trajeto.description = description;
    await trajeto.save();

    logger.info(`📝 Descrição do trajeto com ID ${id} atualizada`);
    res.json({ message: 'Descrição atualizada com sucesso', trajeto });
  } catch (error) {
    console.error('Erro ao atualizar descrição:', error);
    res.status(500).json({ error: 'Erro interno ao atualizar descrição' });
  }
};

exports.deleteRotaComTrajetos = async (req, res) => {
  const { id } = req.params;

  try {
    const rota = await Rota.findByPk(id);
    if (!rota) return res.status(404).json({ error: 'Rota não encontrada' });

    await rota.destroy();

    logger.info(`🗑️ Rota com ID ${id} e os seus trajetos foram eliminados`);
    res.json({ message: 'Rota e trajetos apagados com sucesso' });
  } catch (error) {
    console.error('Erro ao apagar rota:', error);
    res.status(500).json({ error: 'Erro interno ao apagar rota' });
  }
};

exports.getVideoByTrajetoId = async (req, res) => {
  const { id } = req.params;

  try {
    const trajeto = await Trajeto.findByPk(id);

    if (!trajeto) {
      return res.status(404).json({ error: 'Trajeto não encontrado.' });
    }

    if (!trajeto.video) {
      return res.status(404).json({ error: 'Vídeo não encontrado para este trajeto.' });
    }

    res.json({ videoPath: trajeto.video });
  } catch (error) {
    console.error('Erro ao buscar vídeo do trajeto:', error);
    res.status(500).json({ error: 'Erro interno ao buscar vídeo do trajeto.' });
  }
};
