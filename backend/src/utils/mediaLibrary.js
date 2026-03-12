const fs = require('fs');
const path = require('path');

const PRIMARY_UPLOADS_ROOT = path.join(__dirname, '..', '..', 'uploads');
const LEGACY_UPLOADS_ROOT = path.join(__dirname, '..', 'uploads');
const UPLOADS_ROOT = PRIMARY_UPLOADS_ROOT;
const UPLOADS_ROOT_NORMALIZED = path.resolve(UPLOADS_ROOT);
const ALL_UPLOADS_ROOTS_NORMALIZED = [
  path.resolve(PRIMARY_UPLOADS_ROOT),
  path.resolve(LEGACY_UPLOADS_ROOT),
].filter((root, index, roots) => roots.indexOf(root) === index);

function normalizeUploadsRelativePath(inputPath = '') {
  const raw = String(inputPath || '').replace(/\\/g, '/').trim();
  if (!raw || raw === '.' || raw === '/') return '';

  let normalized = raw;
  const uploadsIndex = normalized.indexOf('/uploads/');
  if (uploadsIndex >= 0) {
    normalized = normalized.slice(uploadsIndex + '/uploads/'.length);
  }

  normalized = normalized.replace(/^uploads\//, '').replace(/^\/+/, '');
  normalized = path.posix.normalize(normalized);

  if (!normalized || normalized === '.') return '';
  if (normalized.startsWith('..')) {
    const error = new Error('Caminho inválido');
    error.statusCode = 400;
    throw error;
  }

  return normalized;
}

function absoluteFromUploadsRelative(relativePath = '') {
  const safeRelative = normalizeUploadsRelativePath(relativePath);
  const absolutePath = path.resolve(UPLOADS_ROOT_NORMALIZED, safeRelative);

  if (!absolutePath.startsWith(UPLOADS_ROOT_NORMALIZED)) {
    const error = new Error('Caminho inválido');
    error.statusCode = 400;
    throw error;
  }

  return absolutePath;
}

function resolveExistingUploadAbsolute(relativePath = '', options = {}) {
  const safeRelative = normalizeUploadsRelativePath(relativePath);
  const mustBeDirectory = options.type === 'directory';
  const mustBeFile = options.type === 'file';

  for (const root of ALL_UPLOADS_ROOTS_NORMALIZED) {
    const absolutePath = path.resolve(root, safeRelative);

    if (!absolutePath.startsWith(root)) continue;
    if (!fs.existsSync(absolutePath)) continue;

    const stat = fs.statSync(absolutePath);
    if (mustBeDirectory && !stat.isDirectory()) continue;
    if (mustBeFile && !stat.isFile()) continue;

    return absolutePath;
  }

  return null;
}

function getPublicUploadUrl(relativePath = '') {
  const safeRelative = normalizeUploadsRelativePath(relativePath);
  return safeRelative ? `/uploads/${safeRelative}` : null;
}

function readUploadFileBuffer(relativePath = '') {
  const safeRelative = normalizeUploadsRelativePath(relativePath);
  if (!safeRelative) return null;

  const absolutePath = resolveExistingUploadAbsolute(safeRelative, { type: 'file' });
  if (!absolutePath) {
    const error = new Error('Ficheiro não encontrado no File Manager');
    error.statusCode = 404;
    throw error;
  }

  return fs.readFileSync(absolutePath);
}

function saveBufferToUploads(buffer, options = {}) {
  if (!buffer) return null;

  const destinationDir = normalizeUploadsRelativePath(options.destinationDir || '');
  const originalName = String(options.originalName || 'ficheiro').trim();
  const parsedName = path.parse(originalName);
  const safeBaseName = (parsedName.name || 'ficheiro').replace(/[\\/:*?"<>|]/g, '-').trim() || 'ficheiro';
  const safeExtension = parsedName.ext || '';
  const targetDirAbsolute = absoluteFromUploadsRelative(destinationDir);

  fs.mkdirSync(targetDirAbsolute, { recursive: true });

  let counter = 0;
  let finalName = `${Date.now()}-${safeBaseName}${safeExtension}`;
  let finalAbsolutePath = path.join(targetDirAbsolute, finalName);

  while (fs.existsSync(finalAbsolutePath)) {
    counter += 1;
    finalName = `${Date.now()}-${safeBaseName}-${counter}${safeExtension}`;
    finalAbsolutePath = path.join(targetDirAbsolute, finalName);
  }

  fs.writeFileSync(finalAbsolutePath, buffer);

  return normalizeUploadsRelativePath(path.posix.join(destinationDir, finalName));
}

function uploadFileExists(relativePath = '') {
  const safeRelative = normalizeUploadsRelativePath(relativePath);
  if (!safeRelative) return false;

  try {
    return !!resolveExistingUploadAbsolute(safeRelative, { type: 'file' });
  } catch {
    return false;
  }
}

module.exports = {
  PRIMARY_UPLOADS_ROOT,
  LEGACY_UPLOADS_ROOT,
  UPLOADS_ROOT,
  UPLOADS_ROOT_NORMALIZED,
  ALL_UPLOADS_ROOTS_NORMALIZED,
  normalizeUploadsRelativePath,
  absoluteFromUploadsRelative,
  resolveExistingUploadAbsolute,
  getPublicUploadUrl,
  readUploadFileBuffer,
  saveBufferToUploads,
  uploadFileExists,
};