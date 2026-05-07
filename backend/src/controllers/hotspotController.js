const Hotspot = require('../models/hotspot');
const logger = require('../models/logger');

exports.createHotspot = async (req, res) => {
  const { id_ponto, x, y, z, hide_icon } = req.body;

  if (!id_ponto || x == null || y == null || z == null) {
    return res.status(400).json({ error: 'Dados incompletos para criar hotspot.' });
  }

  try {
    const novoHotspot = await Hotspot.create({ id_ponto, x, y, z, hide_icon: Boolean(hide_icon) });

    const logMessage = `Hotspot criado para ponto ID ${id_ponto} nas coordenadas (${x}, ${y}, ${z})`;
    logger.info(logMessage);

    return res.status(201).json({
      message: 'Hotspot criado com sucesso',
      hotspot: novoHotspot,
    });
  } catch (error) {
    console.error('Erro ao criar hotspot:', error);
    const errorMessage = error?.message || 'Erro interno ao criar hotspot';
    return res.status(500).json({ 
      error: errorMessage,
      details: error?.original?.message || null
    });
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
  const { tipo, conteudo, x, y, z, icon_type, icon_color, hide_icon } = req.body;

  if (!tipo || typeof tipo !== "string") {
    return res.status(400).json({
      error: "O campo 'tipo' é obrigatório e deve ser uma string.",
    });
  }

  const hasAnyPosition = x != null || y != null || z != null;
  if (hasAnyPosition) {
    if (x == null || y == null || z == null) {
      return res.status(400).json({
        error: "Para atualizar posição é necessário enviar x, y e z.",
      });
    }

    const nx = Number(x);
    const ny = Number(y);
    const nz = Number(z);

    if (!Number.isFinite(nx) || !Number.isFinite(ny) || !Number.isFinite(nz)) {
      return res.status(400).json({
        error: "Os campos x, y e z devem ser números válidos.",
      });
    }
  }

  try {
    const hotspot = await Hotspot.findByPk(id);

    if (!hotspot) {
      return res.status(404).json({ error: "Hotspot não encontrado." });
    }

    hotspot.tipo = tipo;
    hotspot.conteudo = conteudo;
    if (hasAnyPosition) {
      hotspot.x = Number(x);
      hotspot.y = Number(y);
      hotspot.z = Number(z);
    }
    if (icon_type) {
      hotspot.icon_type = icon_type;
    }
    if (icon_color) {
      hotspot.icon_color = icon_color;
    }
    if (typeof hide_icon !== 'undefined') {
      hotspot.hide_icon = Boolean(hide_icon);
    }
    await hotspot.save();

    const logMessage = `Hotspot ID ${id} atualizado. Tipo: ${tipo}, Conteúdo: ${conteudo}, Posição: (${hotspot.x}, ${hotspot.y}, ${hotspot.z}), Ícone: ${icon_type}`;
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

exports.getHotspotIconConfig = async (req, res) => {
  const { id_ponto } = req.params;

  if (!id_ponto) {
    return res.status(400).json({ error: "ID do ponto não fornecido." });
  }

  try {
    const hotspots = await Hotspot.findAll({
      where: { id_ponto },
      attributes: ['id_hotspot', 'icon_type', 'icon_color', 'hide_icon'],
    });

    return res.status(200).json({
      message: "Configurações de ícones obtidas com sucesso.",
      data: hotspots,
    });
  } catch (error) {
    console.error("❌ Erro ao obter configurações de ícones:", error);
    return res.status(500).json({
      error: "Erro interno ao obter configurações de ícones.",
      details: error.message,
    });
  }
};

exports.updateHotspotIconConfig = async (req, res) => {
  const { id_ponto } = req.params;
  const { icon_type, icon_color, hide_icon } = req.body;

  if (!id_ponto) {
    return res.status(400).json({ error: "ID do ponto não fornecido." });
  }

  if (!icon_type) {
    return res.status(400).json({ error: "Tipo de ícone não fornecido." });
  }

  try {
    const hotspots = await Hotspot.findAll({
      where: { id_ponto },
    });

    for (const hotspot of hotspots) {
      hotspot.icon_type = icon_type;
      if (icon_color) {
        hotspot.icon_color = icon_color;
      }
      if (typeof hide_icon !== 'undefined') {
        hotspot.hide_icon = Boolean(hide_icon);
      }
      await hotspot.save();
    }

    const logMessage = `Configurações de ícones atualizadas para todos os hotspots do ponto ID ${id_ponto}. Tipo: ${icon_type}, Cor: ${icon_color}`;
    logger.info(logMessage);

    return res.status(200).json({
      message: "Configurações de ícones atualizadas com sucesso.",
      data: hotspots,
    });
  } catch (error) {
    console.error("❌ Erro ao atualizar configurações de ícones:", error);
    return res.status(500).json({
      error: "Erro interno ao atualizar configurações de ícones.",
      details: error.message,
    });
  }
};
