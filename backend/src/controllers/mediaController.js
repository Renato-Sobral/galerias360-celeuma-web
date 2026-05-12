const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { Op } = require('sequelize');
const Trajeto = require('../models/trajeto');
const ThemePreset = require('../models/theme_preset');
const AppSetting = require('../models/app_setting');
const Ponto = require('../models/ponto');
const Hotspot = require('../models/hotspot');
const MapOverlay = require('../models/map_overlay');
const {
  ALL_UPLOADS_ROOTS_NORMALIZED,
  UPLOADS_ROOT_NORMALIZED,
  absoluteFromUploadsRelative,
  normalizeUploadsRelativePath,
  resolveExistingUploadAbsolute,
} = require('../utils/mediaLibrary');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const CODE_SEARCH_ROOTS = [
  path.join(PROJECT_ROOT, 'frontend', 'src'),
  path.join(PROJECT_ROOT, 'backend', 'src'),
];
const TEXT_FILE_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.json',
  '.md',
  '.css',
  '.scss',
  '.mjs',
]);
const MAX_CODE_REFERENCES = 100;

if (!fs.existsSync(UPLOADS_ROOT_NORMALIZED)) {
  fs.mkdirSync(UPLOADS_ROOT_NORMALIZED, { recursive: true });
}

function statToItem(relativePath, entry, stat) {
  const ext = path.extname(entry.name || '').toLowerCase();
  return {
    name: entry.name,
    path: relativePath,
    type: stat.isDirectory() ? 'folder' : 'file',
    extension: ext,
    size: stat.isDirectory() ? null : stat.size,
    modifiedAt: stat.mtime,
  };
}

async function listEntries(relativeDirPath = '') {
  const safeRelativePath = normalizeUploadsRelativePath(relativeDirPath);
  const candidateRoots = ALL_UPLOADS_ROOTS_NORMALIZED
    .map((root) => path.resolve(root, safeRelativePath))
    .filter((absoluteDirPath) => fs.existsSync(absoluteDirPath) && fs.statSync(absoluteDirPath).isDirectory());

  if (candidateRoots.length === 0) {
    const error = new Error('Pasta não encontrada');
    error.statusCode = 404;
    throw error;
  }

  const itemMap = new Map();

  for (const absoluteDirPath of candidateRoots) {
    const dirEntries = await fs.promises.readdir(absoluteDirPath, { withFileTypes: true });

    for (const entry of dirEntries) {
      const entryRelativePath = normalizeUploadsRelativePath(path.posix.join(safeRelativePath, entry.name));
      if (itemMap.has(entryRelativePath)) continue;

      const absoluteEntryPath = resolveExistingUploadAbsolute(entryRelativePath) || absoluteFromUploadsRelative(entryRelativePath);
      const stat = await fs.promises.stat(absoluteEntryPath);
      itemMap.set(entryRelativePath, statToItem(entryRelativePath, entry, stat));
    }
  }

  const items = Array.from(itemMap.values());

  return items.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name, 'pt');
  });
}

function getExistingDirectoryPaths(relativeDirPath = '') {
  const safeRelativePath = normalizeUploadsRelativePath(relativeDirPath);

  return ALL_UPLOADS_ROOTS_NORMALIZED
    .map((root) => path.resolve(root, safeRelativePath))
    .filter((absoluteDirPath) => absoluteDirPath.startsWith(rootForPath(absoluteDirPath)))
    .filter((absoluteDirPath) => fs.existsSync(absoluteDirPath) && fs.statSync(absoluteDirPath).isDirectory());
}

function rootForPath(absolutePath) {
  return ALL_UPLOADS_ROOTS_NORMALIZED.find((root) => absolutePath.startsWith(root)) || UPLOADS_ROOT_NORMALIZED;
}

function buildTreeNode(relativeDirPath) {
  const childEntriesMap = new Map();

  for (const absoluteDirPath of getExistingDirectoryPaths(relativeDirPath)) {
    const childEntries = fs
      .readdirSync(absoluteDirPath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name, 'pt'));

    for (const entry of childEntries) {
      if (!childEntriesMap.has(entry.name)) {
        childEntriesMap.set(entry.name, entry);
      }
    }
  }

  return {
    name: relativeDirPath ? path.posix.basename(relativeDirPath) : 'uploads',
    path: relativeDirPath,
    type: 'folder',
    children: Array.from(childEntriesMap.keys()).sort((a, b) => a.localeCompare(b, 'pt')).map((entryName) => {
      const childRelativePath = normalizeUploadsRelativePath(path.posix.join(relativeDirPath, entryName));
      return buildTreeNode(childRelativePath);
    }),
  };
}

async function walkFiles(dirPath, output = []) {
  if (!fs.existsSync(dirPath)) return output;

  const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const absoluteEntryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') {
        continue;
      }
      await walkFiles(absoluteEntryPath, output);
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (TEXT_FILE_EXTENSIONS.has(ext)) {
      output.push(absoluteEntryPath);
    }
  }

  return output;
}

async function scanCodeReferences(relativePath) {
  const normalizedPath = String(relativePath || '').replace(/\\/g, '/');
  if (!normalizedPath) return [];

  const basename = path.posix.basename(normalizedPath);
  const pathNeedles = [
    `/uploads/${normalizedPath}`,
    `uploads/${normalizedPath}`,
    encodeURI(`/uploads/${normalizedPath}`),
  ];
  const fileNameNeedles = basename ? [basename] : [];

  const allFiles = [];
  for (const root of CODE_SEARCH_ROOTS) {
    const files = await walkFiles(root, []);
    allFiles.push(...files);
  }

  const refs = [];

  for (const absoluteFilePath of allFiles) {
    if (refs.length >= MAX_CODE_REFERENCES) break;

    let content;
    try {
      content = await fs.promises.readFile(absoluteFilePath, 'utf8');
    } catch {
      continue;
    }

    const lines = content.split(/\r?\n/);
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      if (refs.length >= MAX_CODE_REFERENCES) break;

      const line = lines[lineIndex];
      const hasPathMatch = pathNeedles.some((needle) => line.includes(needle));
      const hasFileNameMatch = !hasPathMatch && fileNameNeedles.some((needle) => needle && line.includes(needle));

      if (!hasPathMatch && !hasFileNameMatch) continue;

      const relativeFile = path.relative(PROJECT_ROOT, absoluteFilePath).replace(/\\/g, '/');
      refs.push({
        type: hasPathMatch ? 'code.path' : 'code.filename',
        id: `${relativeFile}:${lineIndex + 1}`,
        label: `${relativeFile}:${lineIndex + 1}`,
        details: line.trim(),
      });
    }
  }

  return refs;
}

async function ensureUniqueDestinationPath(destinationAbsolutePath) {
  if (!fs.existsSync(destinationAbsolutePath)) return destinationAbsolutePath;

  const dir = path.dirname(destinationAbsolutePath);
  const ext = path.extname(destinationAbsolutePath);
  const baseName = path.basename(destinationAbsolutePath, ext);

  let counter = 1;
  while (true) {
    const candidateName = `${baseName} (${counter})${ext}`;
    const candidateAbsolutePath = path.join(dir, candidateName);
    if (!fs.existsSync(candidateAbsolutePath)) return candidateAbsolutePath;
    counter += 1;
  }
}

function ensureUniqueDestinationPathSync(destinationAbsolutePath) {
  if (!fs.existsSync(destinationAbsolutePath)) return destinationAbsolutePath;

  const dir = path.dirname(destinationAbsolutePath);
  const ext = path.extname(destinationAbsolutePath);
  const baseName = path.basename(destinationAbsolutePath, ext);

  let counter = 1;
  while (true) {
    const candidateName = `${baseName} (${counter})${ext}`;
    const candidateAbsolutePath = path.join(dir, candidateName);
    if (!fs.existsSync(candidateAbsolutePath)) return candidateAbsolutePath;
    counter += 1;
  }
}

function extractUploadsRelativePathFromUrl(value) {
  const rawValue = String(value || '').trim();
  if (!rawValue) return '';

  const uploadsMarker = '/uploads/';
  const markerIndex = rawValue.indexOf(uploadsMarker);
  if (markerIndex < 0) return '';

  const start = markerIndex + uploadsMarker.length;
  const afterMarker = rawValue.slice(start);
  const cleanPath = afterMarker.split(/[?#]/)[0];

  try {
    return normalizeUploadsRelativePath(cleanPath);
  } catch {
    return '';
  }
}

function extractImage4pSrc(rawValue) {
  const value = String(rawValue || '');
  if (!value.startsWith('img4p:')) return '';

  try {
    const encodedPayload = value.slice('img4p:'.length);
    const json = Buffer.from(encodedPayload, 'base64').toString('utf8');
    const parsed = JSON.parse(json);
    return String(parsed?.src || '');
  } catch {
    return '';
  }
}

async function getImage4pPrimaryReferences(relativePath) {
  const targetRelativePath = normalizeUploadsRelativePath(relativePath);
  const hotspots = await Hotspot.findAll({
    where: { tipo: 'imagem4p' },
    attributes: ['id_hotspot', 'id_ponto', 'conteudo'],
  });

  return hotspots
    .map((hotspot) => {
      const src = extractImage4pSrc(hotspot.conteudo);
      const srcRelativePath = extractUploadsRelativePathFromUrl(src);
      if (!srcRelativePath || srcRelativePath !== targetRelativePath) return null;

      return {
        id_hotspot: hotspot.id_hotspot,
        id_ponto: hotspot.id_ponto,
      };
    })
    .filter(Boolean);
}

const uploadStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    try {
      const destinationPath = normalizeUploadsRelativePath(req.body.destinationPath || '');
      const destinationAbsolutePath = absoluteFromUploadsRelative(destinationPath);
      console.log('📁 Criando diretório de destino:', { destinationPath, destinationAbsolutePath });
      fs.mkdirSync(destinationAbsolutePath, { recursive: true });
      console.log('✅ Diretório criado/confirmado');
      cb(null, destinationAbsolutePath);
    } catch (error) {
      console.error('❌ Erro ao criar diretório:', error.message);
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    try {
      const destinationPath = normalizeUploadsRelativePath(req.body.destinationPath || '');
      const destinationAbsolutePath = absoluteFromUploadsRelative(destinationPath);
      const desiredPath = path.join(destinationAbsolutePath, file.originalname);
      const finalPath = ensureUniqueDestinationPathSync(desiredPath);
      console.log('📄 Nome do ficheiro gerado:', { original: file.originalname, final: path.basename(finalPath) });
      cb(null, path.basename(finalPath));
    } catch (error) {
      console.error('❌ Erro ao gerar nome do ficheiro:', error.message);
      cb(error);
    }
  },
});

exports.uploadMiddleware = multer({
  storage: uploadStorage,
  limits: { fileSize: 250 * 1024 * 1024 },
}).array('files', 50);

exports.getTree = async (_req, res) => {
  try {
    const tree = buildTreeNode('');
    return res.json({ success: true, tree });
  } catch (error) {
    console.error('Erro ao obter árvore de media:', error);
    return res.status(500).json({ success: false, message: 'Erro ao obter estrutura de pastas' });
  }
};

exports.listDirectory = async (req, res) => {
  try {
    const relativePath = normalizeUploadsRelativePath(req.query.path || '');
    const items = await listEntries(relativePath);
    return res.json({ success: true, path: relativePath, items });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message || 'Erro ao listar pasta' });
  }
};

exports.createFolder = async (req, res) => {
  try {
    const parentPath = normalizeUploadsRelativePath(req.body.parentPath || '');
    const folderName = String(req.body.name || '').trim();

    if (!folderName) {
      return res.status(400).json({ success: false, message: 'Nome da pasta é obrigatório' });
    }

    const cleanName = folderName.replace(/[\\/:*?"<>|]/g, '-').trim();
    if (!cleanName) {
      return res.status(400).json({ success: false, message: 'Nome da pasta inválido' });
    }

    const targetRelativePath = normalizeUploadsRelativePath(path.posix.join(parentPath, cleanName));
    const targetAbsolutePath = absoluteFromUploadsRelative(targetRelativePath);

    if (fs.existsSync(targetAbsolutePath)) {
      return res.status(409).json({ success: false, message: 'Já existe um item com esse nome' });
    }

    await fs.promises.mkdir(targetAbsolutePath, { recursive: true });
    return res.status(201).json({ success: true, folderPath: targetRelativePath });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message || 'Erro ao criar pasta' });
  }
};

exports.uploadFiles = async (req, res) => {
  try {
    const destinationPath = normalizeUploadsRelativePath(req.body.destinationPath || '');
    const userId = req.auth?.id || 'unknown';

    console.log('📤 Upload recebido:', { userId, destinationPath, filesCount: req.files?.length, firstFileName: req.files?.[0]?.originalname });

    if (!Array.isArray(req.files) || req.files.length === 0) {
      console.log('❌ Nenhum ficheiro enviado');
      return res.status(400).json({ success: false, message: 'Nenhum ficheiro enviado' });
    }

    const uploaded = req.files.map((file) => {
      const relativePath = normalizeUploadsRelativePath(path.posix.join(destinationPath, file.filename));
      return {
        name: file.filename,
        originalName: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
        path: relativePath,
        url: `/uploads/${relativePath}`,
      };
    });

    console.log('✅ Upload concluído:', { uploaded: uploaded.map(u => u.name) });
    return res.status(201).json({ success: true, files: uploaded });
  } catch (error) {
    console.error('❌ Erro ao fazer upload:', { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: 'Erro ao fazer upload' });
  }
};

exports.moveItem = async (req, res) => {
  try {
    const sourcePath = normalizeUploadsRelativePath(req.body.sourcePath || '');
    const destinationPath = normalizeUploadsRelativePath(req.body.destinationPath || '');

    if (!sourcePath) {
      return res.status(400).json({ success: false, message: 'sourcePath é obrigatório' });
    }

    const sourceAbsolutePath = resolveExistingUploadAbsolute(sourcePath) || absoluteFromUploadsRelative(sourcePath);
    const destinationAbsoluteDir = resolveExistingUploadAbsolute(destinationPath, { type: 'directory' }) || absoluteFromUploadsRelative(destinationPath);

    if (!fs.existsSync(sourceAbsolutePath)) {
      return res.status(404).json({ success: false, message: 'Item de origem não encontrado' });
    }
    if (!fs.existsSync(destinationAbsoluteDir)) {
      return res.status(404).json({ success: false, message: 'Pasta de destino não encontrada' });
    }

    const sourceStat = await fs.promises.stat(sourceAbsolutePath);
    const sourceName = path.basename(sourceAbsolutePath);

    const targetAbsolutePathBase = path.join(destinationAbsoluteDir, sourceName);

    if (sourceStat.isDirectory()) {
      const sourceNormalized = path.resolve(sourceAbsolutePath);
      const destNormalized = path.resolve(targetAbsolutePathBase);
      if (destNormalized.startsWith(sourceNormalized + path.sep)) {
        return res.status(400).json({ success: false, message: 'Não é possível mover uma pasta para dentro dela própria' });
      }
    }

    const targetAbsolutePath = await ensureUniqueDestinationPath(targetAbsolutePathBase);

    await fs.promises.rename(sourceAbsolutePath, targetAbsolutePath);

    const targetRelativePath = normalizeUploadsRelativePath(path.posix.join(destinationPath, path.basename(targetAbsolutePath)));
    return res.json({ success: true, path: targetRelativePath });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message || 'Erro ao mover item' });
  }
};

exports.deleteItem = async (req, res) => {
  try {
    const targetPath = normalizeUploadsRelativePath(req.body.targetPath || req.query.path || '');

    if (!targetPath) {
      return res.status(400).json({ success: false, message: 'targetPath é obrigatório' });
    }

    const targetAbsolutePath = resolveExistingUploadAbsolute(targetPath) || absoluteFromUploadsRelative(targetPath);

    if (!fs.existsSync(targetAbsolutePath)) {
      return res.status(404).json({ success: false, message: 'Item não encontrado' });
    }

    const image4pPrimaryReferences = await getImage4pPrimaryReferences(targetPath);
    if (image4pPrimaryReferences.length > 0) {
      const isAdmin = String(req.auth?.role || '').toLowerCase() === 'admin';
      const forcePrimaryDelete = String(req.query.forcePrimaryDelete || req.body.forcePrimaryDelete || '') === '1'
        || req.body.forcePrimaryDelete === true;

      if (!(isAdmin && forcePrimaryDelete)) {
        return res.status(403).json({
          success: false,
          code: 'PRIMARY_IMAGE4P_PROTECTED',
          message: 'Imagem principal de hotspot imagem4p protegida. Apenas admin pode remover com forcePrimaryDelete=1.',
          references: image4pPrimaryReferences,
        });
      }
    }

    const stat = await fs.promises.stat(targetAbsolutePath);
    if (stat.isDirectory()) {
      await fs.promises.rm(targetAbsolutePath, { recursive: true, force: true });
    } else {
      await fs.promises.unlink(targetAbsolutePath);
    }

    return res.json({ success: true });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message || 'Erro ao apagar item' });
  }
};

exports.getReferences = async (req, res) => {
  try {
    const relativePath = normalizeUploadsRelativePath(req.query.path || '');
    if (!relativePath) {
      return res.status(400).json({ success: false, message: 'path é obrigatório' });
    }

    const refs = [];
    const relativeUrl = `/uploads/${relativePath}`;

    const [trajetos, presets, settings, pontos, overlays, codeRefs] = await Promise.all([
      Trajeto.findAll({
        where: {
          video: {
            [Op.like]: `%${relativePath}%`,
          },
        },
        attributes: ['id_trajeto', 'id_rota', 'description', 'video'],
      }),
      ThemePreset.findAll({
        where: {
          [Op.or]: [
            { logoLightUrl: { [Op.like]: `%${relativePath}%` } },
            { logoDarkUrl: { [Op.like]: `%${relativePath}%` } },
          ],
        },
        attributes: ['id_theme_preset', 'name', 'logoLightUrl', 'logoDarkUrl'],
      }),
      AppSetting.findAll({
        where: {
          value: {
            [Op.like]: `%${relativePath}%`,
          },
        },
        attributes: ['key', 'value'],
      }),
      Ponto.findAll({
        where: {
          imagePath: {
            [Op.like]: `%${relativePath}%`,
          },
        },
        attributes: ['id_ponto', 'name', 'imagePath'],
      }),
      MapOverlay.findAll({
        where: {
          mediaPath: {
            [Op.like]: `%${relativePath}%`,
          },
        },
        attributes: ['id', 'tipo', 'mediaPath'],
      }),
      scanCodeReferences(relativePath),
    ]);

    trajetos.forEach((trajeto) => {
      refs.push({
        type: 'trajeto.video',
        id: trajeto.id_trajeto,
        label: `Trajeto #${trajeto.id_trajeto}`,
        details: trajeto.video,
      });
    });

    presets.forEach((preset) => {
      if (preset.logoLightUrl && preset.logoLightUrl.includes(relativePath)) {
        refs.push({
          type: 'theme.logoLight',
          id: preset.id_theme_preset,
          label: `Preset ${preset.name}`,
          details: preset.logoLightUrl,
        });
      }
      if (preset.logoDarkUrl && preset.logoDarkUrl.includes(relativePath)) {
        refs.push({
          type: 'theme.logoDark',
          id: preset.id_theme_preset,
          label: `Preset ${preset.name}`,
          details: preset.logoDarkUrl,
        });
      }
    });

    settings.forEach((setting) => {
      refs.push({
        type: 'app.setting',
        id: setting.key,
        label: `Setting ${setting.key}`,
        details: setting.value,
      });
    });

    pontos.forEach((ponto) => {
      refs.push({
        type: 'ponto.image',
        id: ponto.id_ponto,
        label: `Ponto ${ponto.name}`,
        details: ponto.imagePath,
      });
    });

    overlays.forEach((overlay) => {
      refs.push({
        type: 'overlay.media',
        id: overlay.id,
        label: `Overlay #${overlay.id} (${overlay.tipo})`,
        details: overlay.mediaPath,
      });
    });

    codeRefs.forEach((ref) => refs.push(ref));

    return res.json({ success: true, path: relativePath, url: relativeUrl, references: refs });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message || 'Erro ao obter referências' });
  }
};
