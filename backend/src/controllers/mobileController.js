const Hotspot = require('../models/hotspot');
const Ponto = require('../models/ponto');
const {
  normalizeUploadsRelativePath,
  getPublicUploadUrl,
  uploadFileExists,
} = require('../utils/mediaLibrary');

const LEGACY_POINT_PREFIX = 'ponto:';
const NAV_POINT_PREFIX = 'nav:ponto:';
const NAV_FILE_PREFIX = 'nav:file:';
const NAV_BACK_VALUE = 'nav:back';
const HOTSPOT_META_PREFIX = 'hsmeta:';
const INSPECT3D_PREFIX = 'insp3d:';
const HOTSPOT_SCALE_MIN = 0.2;

function toAbsoluteRequestUrl(req, urlPath) {
  if (!urlPath) return null;
  if (/^https?:\/\//i.test(urlPath)) return urlPath;

  const forwardedProto = req.headers['x-forwarded-proto'];
  const protocol = (typeof forwardedProto === 'string' && forwardedProto) || req.protocol || 'http';
  const host = req.get('host');

  if (!host) return urlPath;
  return `${protocol}://${host}${urlPath.startsWith('/') ? urlPath : `/${urlPath}`}`;
}

function normalizeViewPath(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';

  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      return normalizeUploadsRelativePath(parsed.pathname || '');
    } catch {
      return '';
    }
  }

  try {
    return normalizeUploadsRelativePath(raw);
  } catch {
    return '';
  }
}

function decodeHotspotContent(storedValue) {
  const value = String(storedValue || '');

  if (!value.startsWith(HOTSPOT_META_PREFIX)) {
    return {
      value,
      view: '',
      scale: 1,
      rotYaw: 0,
      rotPitch: 0,
      placement: '',
    };
  }

  try {
    const encoded = value.slice(HOTSPOT_META_PREFIX.length);
    const json = Buffer.from(encoded, 'base64').toString('utf8');
    const parsed = JSON.parse(json);

    return {
      value: String(parsed?.value || ''),
      view: normalizeViewPath(parsed?.view || ''),
      scale: Number.isFinite(Number(parsed?.scale))
        ? Math.max(HOTSPOT_SCALE_MIN, Number(parsed.scale))
        : 1,
      rotYaw: Number.isFinite(Number(parsed?.rotYaw)) ? Number(parsed.rotYaw) : 0,
      rotPitch: Number.isFinite(Number(parsed?.rotPitch)) ? Number(parsed.rotPitch) : 0,
      placement: String(parsed?.placement || ''),
    };
  } catch {
    return {
      value,
      view: '',
      scale: 1,
      rotYaw: 0,
      rotPitch: 0,
      placement: '',
    };
  }
}

function decodeNavigationContent(tipo, conteudo) {
  if (tipo !== 'link') return { mode: null, pointId: '', filePath: '' };

  const decoded = decodeHotspotContent(conteudo);
  const value = String(decoded.value || '').trim();
  if (!value) return { mode: null, pointId: '', filePath: '' };

  if (value.startsWith(NAV_POINT_PREFIX)) {
    const parsed = value.slice(NAV_POINT_PREFIX.length);
    return /^\d+$/.test(parsed)
      ? { mode: 'point', pointId: parsed, filePath: '' }
      : { mode: null, pointId: '', filePath: '' };
  }

  if (value.startsWith(NAV_FILE_PREFIX)) {
    const parsed = normalizeViewPath(value.slice(NAV_FILE_PREFIX.length));
    return parsed
      ? { mode: 'file', pointId: '', filePath: parsed }
      : { mode: null, pointId: '', filePath: '' };
  }

  if (value === NAV_BACK_VALUE) {
    return { mode: 'back', pointId: '', filePath: '' };
  }

  if (value.startsWith(LEGACY_POINT_PREFIX)) {
    const parsed = value.slice(LEGACY_POINT_PREFIX.length);
    return /^\d+$/.test(parsed)
      ? { mode: 'point', pointId: parsed, filePath: '' }
      : { mode: null, pointId: '', filePath: '' };
  }

  return { mode: null, pointId: '', filePath: '' };
}

function serializeHotspotForMobile(req, hotspot) {
  const decodedContent = decodeHotspotContent(hotspot.conteudo || '');
  const navigation = decodeNavigationContent(hotspot.tipo || '', hotspot.conteudo || '');
  const isNavigation = navigation.mode === 'point' || navigation.mode === 'file' || navigation.mode === 'back';

  return {
    id_hotspot: hotspot.id_hotspot,
    id_ponto: hotspot.id_ponto,
    tipo_original: hotspot.tipo || '',
    tipo: isNavigation
      ? 'navegacao'
      : (hotspot.tipo === 'modelo3d' && decodedContent.value.startsWith(INSPECT3D_PREFIX)
        ? 'modelo3d_inspect'
        : (hotspot.tipo || '')),
    conteudo_original: hotspot.conteudo || '',
    conteudo: isNavigation ? '' : decodedContent.value,
    x: Number(hotspot.x),
    y: Number(hotspot.y),
    z: Number(hotspot.z),
    scale: decodedContent.scale || 1,
    rot_yaw: decodedContent.rotYaw || 0,
    rot_pitch: decodedContent.rotPitch || 0,
    placement: String(decodedContent.placement || ''),
    view_path: normalizeViewPath(decodedContent.view || ''),
    navigation_mode: navigation.mode,
    id_ponto_destino: navigation.pointId ? Number(navigation.pointId) : null,
    navigation_file_path: navigation.filePath || '',
    navigation_file_url: navigation.filePath
      ? toAbsoluteRequestUrl(req, getPublicUploadUrl(navigation.filePath))
      : '',
  };
}

exports.getMobilePontoHotspots = async (req, res) => {
  try {
    const idPonto = Number(req.params.id_ponto);
    if (!Number.isInteger(idPonto) || idPonto <= 0) {
      return res.status(400).json({ error: 'id_ponto inválido.' });
    }

    const ponto = await Ponto.findByPk(idPonto, {
      attributes: ['id_ponto', 'name', 'description', 'imagePath'],
    });

    if (!ponto) {
      return res.status(404).json({ error: 'Ponto não encontrado.' });
    }

    const rawViewPath = String(req.query.viewPath || req.query.view_path || '');
    const viewPath = normalizeViewPath(rawViewPath);
    const includeAll = String(req.query.includeAll || '').toLowerCase() === 'true';

    const hotspots = await Hotspot.findAll({
      where: { id_ponto: idPonto },
      order: [['id_hotspot', 'ASC']],
    });

    const allHotspots = hotspots.map((hotspot) => serializeHotspotForMobile(req, hotspot));

    const initialViewPath = normalizeViewPath(ponto.imagePath || '');
    const visibleHotspots = allHotspots.filter((hotspot) => {
      if (!hotspot.view_path) {
        return !viewPath || viewPath === initialViewPath;
      }

      if (!viewPath) return false;
      return hotspot.view_path === viewPath;
    });

    const publicImageUrl = (ponto.imagePath && uploadFileExists(ponto.imagePath))
      ? toAbsoluteRequestUrl(req, getPublicUploadUrl(ponto.imagePath))
      : null;

    return res.status(200).json({
      ponto: {
        id_ponto: ponto.id_ponto,
        name: ponto.name,
        description: ponto.description,
        image_path: ponto.imagePath || '',
        image_url: publicImageUrl,
        initial_view_path: initialViewPath,
      },
      query: {
        view_path: viewPath,
        include_all: includeAll,
      },
      hotspots: includeAll ? allHotspots : visibleHotspots,
      meta: {
        total_hotspots: allHotspots.length,
        visible_hotspots: visibleHotspots.length,
      },
    });
  } catch (error) {
    console.error('Erro ao preparar hotspots mobile:', error);
    return res.status(500).json({ error: 'Erro interno ao carregar hotspots para mobile.' });
  }
};
