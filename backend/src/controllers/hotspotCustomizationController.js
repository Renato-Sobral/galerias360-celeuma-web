const Hotspot = require('../models/hotspot');
const HotspotUserCustomization = require('../models/hotspot_user_customization');

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toFiniteNumber(value, fallback = null) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return value;
  if (Number.isFinite(min)) value = Math.max(min, value);
  if (Number.isFinite(max)) value = Math.min(max, value);
  return value;
}

function normalizeOverridesInput(overrides) {
  if (!isPlainObject(overrides)) return {};

  const out = {};

  if (typeof overrides.conteudo === 'string') {
    out.conteudo = overrides.conteudo;
  }

  for (const key of ['dx', 'dy', 'dz', 'scale', 'rot_yaw', 'rot_pitch']) {
    const num = toFiniteNumber(overrides[key], null);
    if (num == null) continue;
    out[key] = num;
  }

  return out;
}

function filterOverridesByConfig(overrides, customConfig) {
  const cfg = isPlainObject(customConfig) ? customConfig : {};
  if (!cfg.enabled) {
    return { allowed: false, filtered: {} };
  }

  const allowContent = Boolean(cfg?.allow_content?.enabled);
  const allowPosition = Boolean(cfg?.allow_position?.enabled);
  const allowTransform = Boolean(cfg?.allow_transform?.enabled);

  const filtered = {};

  if (allowContent && typeof overrides.conteudo === 'string') {
    const maxLength = Number.isFinite(Number(cfg?.allow_content?.maxLength)) ? Number(cfg.allow_content.maxLength) : 20000;
    filtered.conteudo = overrides.conteudo.slice(0, Math.max(0, maxLength));
  }

  if (allowPosition) {
    const range = Number.isFinite(Number(cfg?.allow_position?.range)) ? Math.max(0, Number(cfg.allow_position.range)) : 250;
    for (const key of ['dx', 'dy', 'dz']) {
      if (typeof overrides[key] === 'number') {
        filtered[key] = clamp(overrides[key], -range, range);
      }
    }
  }

  if (allowTransform) {
    const scaleMin = Number.isFinite(Number(cfg?.allow_transform?.scale?.min)) ? Number(cfg.allow_transform.scale.min) : 0.2;
    const scaleMax = Number.isFinite(Number(cfg?.allow_transform?.scale?.max)) ? Number(cfg.allow_transform.scale.max) : 50;
    if (typeof overrides.scale === 'number') {
      filtered.scale = clamp(overrides.scale, scaleMin, scaleMax);
    }

    const yawMin = Number.isFinite(Number(cfg?.allow_transform?.yaw?.min)) ? Number(cfg.allow_transform.yaw.min) : -360;
    const yawMax = Number.isFinite(Number(cfg?.allow_transform?.yaw?.max)) ? Number(cfg.allow_transform.yaw.max) : 360;
    if (typeof overrides.rot_yaw === 'number') {
      filtered.rot_yaw = clamp(overrides.rot_yaw, yawMin, yawMax);
    }

    const pitchMin = Number.isFinite(Number(cfg?.allow_transform?.pitch?.min)) ? Number(cfg.allow_transform.pitch.min) : -180;
    const pitchMax = Number.isFinite(Number(cfg?.allow_transform?.pitch?.max)) ? Number(cfg.allow_transform.pitch.max) : 180;
    if (typeof overrides.rot_pitch === 'number') {
      filtered.rot_pitch = clamp(overrides.rot_pitch, pitchMin, pitchMax);
    }
  }

  return { allowed: true, filtered };
}

exports.getMyHotspotCustomizations = async (req, res) => {
  try {
    const userId = Number(req.auth?.user);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({ success: false, message: 'Utilizador inválido.' });
    }

    const idPonto = req.query?.id_ponto != null ? Number(req.query.id_ponto) : null;
    const where = { id_user: userId };

    const include = [];
    if (Number.isInteger(idPonto) && idPonto > 0) {
      include.push({
        model: Hotspot,
        attributes: ['id_hotspot', 'id_ponto'],
        where: { id_ponto: idPonto },
        required: true,
      });
    }

    const rows = await HotspotUserCustomization.findAll({
      where,
      include,
      order: [['updatedAt', 'DESC']],
    });

    const data = {};
    for (const row of rows) {
      const hotspotId = Number(row.id_hotspot);
      if (!Number.isInteger(hotspotId)) continue;
      data[hotspotId] = row.overrides && typeof row.overrides === 'object' ? row.overrides : {};
    }

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Erro ao obter personalizações do utilizador:', error);
    return res.status(500).json({ success: false, message: 'Erro interno ao obter personalizações.' });
  }
};

exports.upsertMyHotspotCustomization = async (req, res) => {
  try {
    const userId = Number(req.auth?.user);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({ success: false, message: 'Utilizador inválido.' });
    }

    const hotspotId = Number(req.params?.id);
    if (!Number.isInteger(hotspotId) || hotspotId <= 0) {
      return res.status(400).json({ success: false, message: 'ID do hotspot inválido.' });
    }

    const hotspot = await Hotspot.findByPk(hotspotId);
    if (!hotspot) {
      return res.status(404).json({ success: false, message: 'Hotspot não encontrado.' });
    }

    const overridesRaw = normalizeOverridesInput(req.body?.overrides);
    const { allowed, filtered } = filterOverridesByConfig(overridesRaw, hotspot.custom_config);

    if (!allowed) {
      return res.status(403).json({ success: false, message: 'Este hotspot não permite personalização.' });
    }

    const hasAny = Object.keys(filtered).length > 0;

    const existing = await HotspotUserCustomization.findOne({
      where: { id_hotspot: hotspotId, id_user: userId },
    });

    if (!hasAny) {
      if (existing) {
        await existing.destroy();
      }
      return res.status(200).json({ success: true, data: {} });
    }

    if (existing) {
      existing.overrides = filtered;
      await existing.save();
      return res.status(200).json({ success: true, data: existing.overrides });
    }

    const created = await HotspotUserCustomization.create({
      id_hotspot: hotspotId,
      id_user: userId,
      overrides: filtered,
    });

    return res.status(201).json({ success: true, data: created.overrides });
  } catch (error) {
    console.error('Erro ao guardar personalização do utilizador:', error);
    return res.status(500).json({ success: false, message: 'Erro interno ao guardar personalização.' });
  }
};
