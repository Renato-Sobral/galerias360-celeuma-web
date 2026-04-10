const fs = require('fs');
const path = require('path');
const { normalizeUploadsRelativePath } = require('../utils/mediaLibrary');

const STATE_FILE = path.join(__dirname, '..', '..', 'uploads', 'editor-state.json');
const MAX_SETTINGS_BYTES = 200 * 1024;

async function ensureStoreDir() {
    await fs.promises.mkdir(path.dirname(STATE_FILE), { recursive: true });
}

async function readStateStore() {
    await ensureStoreDir();

    if (!fs.existsSync(STATE_FILE)) {
        return {};
    }

    try {
        const content = await fs.promises.readFile(STATE_FILE, 'utf8');
        if (!content.trim()) return {};
        const parsed = JSON.parse(content);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

async function writeStateStore(store) {
    await ensureStoreDir();
    await fs.promises.writeFile(STATE_FILE, JSON.stringify(store, null, 2), 'utf8');
}

function normalizeEditorType(value) {
    const next = String(value || '').trim().toLowerCase();
    if (next === '3d' || next === '360') return next;
    return null;
}

function buildStateKey(editorType, mediaPath) {
    return `${editorType}:${mediaPath}`;
}

exports.getEditorState = async (req, res) => {
    try {
        const editorType = normalizeEditorType(req.query.type);
        const mediaPath = normalizeUploadsRelativePath(req.query.path || '');

        if (!editorType) {
            return res.status(400).json({ success: false, message: 'Tipo do editor invalido' });
        }

        if (!mediaPath) {
            return res.status(400).json({ success: false, message: 'Caminho do ficheiro e obrigatorio' });
        }

        const store = await readStateStore();
        const key = buildStateKey(editorType, mediaPath);
        const payload = store[key] || null;

        return res.json({
            success: true,
            data: payload,
        });
    } catch (error) {
        console.error('Erro ao obter estado do editor:', error);
        return res.status(500).json({ success: false, message: 'Erro ao obter estado do editor' });
    }
};

exports.saveEditorState = async (req, res) => {
    try {
        const editorType = normalizeEditorType(req.body?.type);
        const mediaPath = normalizeUploadsRelativePath(req.body?.path || '');
        const settings = req.body?.settings;

        if (!editorType) {
            return res.status(400).json({ success: false, message: 'Tipo do editor invalido' });
        }

        if (!mediaPath) {
            return res.status(400).json({ success: false, message: 'Caminho do ficheiro e obrigatorio' });
        }

        if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
            return res.status(400).json({ success: false, message: 'As configuracoes sao obrigatorias' });
        }

        const serialized = JSON.stringify(settings);
        if (Buffer.byteLength(serialized, 'utf8') > MAX_SETTINGS_BYTES) {
            return res.status(413).json({ success: false, message: 'Configuracoes demasiado grandes' });
        }

        const store = await readStateStore();
        const key = buildStateKey(editorType, mediaPath);
        const savedAt = new Date().toISOString();

        store[key] = {
            type: editorType,
            path: mediaPath,
            settings,
            updatedBy: req.auth?.id_utilizador || null,
            savedAt,
        };

        await writeStateStore(store);

        return res.json({
            success: true,
            data: store[key],
        });
    } catch (error) {
        console.error('Erro ao guardar estado do editor:', error);
        return res.status(500).json({ success: false, message: 'Erro ao guardar estado do editor' });
    }
};
