const Hotspot = require('../models/hotspot');
const logger = require('../models/logger');

exports.createHotspot = async (req, res) => {
  const { id_ponto, x, y, z } = req.body;

  if (!id_ponto || x == null || y == null || z == null) {
    return res.status(400).json({ error: 'Dados incompletos para criar hotspot.' });
  }

  try {
    const novoHotspot = await Hotspot.create({ id_ponto, x, y, z });

    const logMessage = `Hotspot criado para ponto ID ${id_ponto} nas coordenadas (${x}, ${y}, ${z})`;
    logger.info(logMessage);

    return res.status(201).json({
      message: 'Hotspot criado com sucesso',
      hotspot: novoHotspot,
    });
  } catch (error) {
    console.error('Erro ao criar hotspot:', error);
    return res.status(500).json({ error: 'Erro interno ao criar hotspot' });
  }
};

exports.getHotspots = async (req, res) => {
  try {
    const hotspots = await Hotspot.findAll();
    return res.status(200).json(hotspots);
  } catch (error) {
    console.error("Erro ao buscar hotspots:", error);
    return res.status(500).json({ error: "Erro ao buscar hotspots" });
  }
};

exports.updateHotspot = async (req, res) => {
  const { id } = req.params;
  const { tipo, conteudo } = req.body;

  if (!tipo || typeof tipo !== "string") {
    return res.status(400).json({
      error: "O campo 'tipo' é obrigatório e deve ser uma string.",
    });
  }

  try {
    const hotspot = await Hotspot.findByPk(id);

    if (!hotspot) {
      return res.status(404).json({ error: "Hotspot não encontrado." });
    }

    hotspot.tipo = tipo;
    hotspot.conteudo = conteudo;
    await hotspot.save();

    const logMessage = `Hotspot ID ${id} atualizado. Tipo: ${tipo}, Conteúdo: ${conteudo}`;
    logger.info(logMessage);

    return res.status(200).json({
      message: "Hotspot atualizado com sucesso.",
      hotspot,
    });
  } catch (error) {
    console.error("❌ Erro ao atualizar hotspot:", error);
    return res.status(500).json({
      error: "Erro interno ao atualizar hotspot.",
      details: error.message,
    });
  }
};

exports.deleteHotspot = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: "ID do hotspot não fornecido." });
  }

  try {
    const hotspot = await Hotspot.findByPk(id);

    if (!hotspot) {
      return res.status(404).json({ error: "Hotspot não encontrado." });
    }

    await hotspot.destroy();

    const logMessage = `Hotspot ID ${id} eliminado com sucesso`;
    logger.info(logMessage);

    return res.status(200).json({ message: "Hotspot eliminado com sucesso." });
  } catch (error) {
    console.error("❌ Erro ao eliminar hotspot:", error);
    return res.status(500).json({
      error: "Erro interno ao eliminar hotspot.",
      details: error.message,
    });
  }
};
