const MapOverlay = require('../models/map_overlay');
const multer = require('multer');
const logger = require('../models/logger');
const { normalizeUploadsRelativePath, readUploadFileBuffer } = require('../utils/mediaLibrary');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage, limits: { fileSize: 100 * 1024 * 1024 } }).single('file'); // "file" será o campo enviado no form

function resolveOverlayPayload(req) {
    if (req.file?.buffer) {
        return {
            buffer: req.file.buffer,
            mediaPath: null,
        };
    }

    const mediaPath = normalizeUploadsRelativePath(req.body.mediaPath || '');
    if (!mediaPath) {
        return {
            buffer: null,
            mediaPath: null,
        };
    }

    return {
        buffer: readUploadFileBuffer(mediaPath),
        mediaPath,
    };
}

// CREATE
exports.createOverlay = (req, res) => {
    upload(req, res, async (err) => {
        if (err) return res.status(500).json({ error: 'Erro ao fazer upload do ficheiro' });

        const { tipo, username } = req.body;

        try {
            const { buffer, mediaPath } = resolveOverlayPayload(req);
            if (!buffer) {
                return res.status(400).json({ error: 'Ficheiro é obrigatório' });
            }

            const overlay = await MapOverlay.create({
                tipo,
                conteudo: buffer,
                mediaPath,
            });

            const logMessage = `${username} criou um novo overlay (${tipo})`;
            logger.info(logMessage);

            if (global.io) global.io.emit("novoOverlay", { message: logMessage });

            return res.status(201).json({ message: 'Overlay criado com sucesso', overlay });
        } catch (error) {
            console.error("Erro no createOverlay:", error);
            return res.status(500).json({ error: error.message || 'Erro ao criar overlay' });
        }
    });
};

// LIST
exports.listOverlays = async (req, res) => {
    try {
        const overlays = await MapOverlay.findAll();

        const overlaysBase64 = overlays.map(o => {
            return {
                ...o.toJSON(),
                conteudo: o.conteudo ? o.conteudo.toString('base64') : null
            };
        });

        return res.status(200).json({ overlays: overlaysBase64 });
    } catch (error) {
        console.error("Erro no listOverlays:", error);
        return res.status(500).json({ error: 'Erro ao listar overlays' });
    }
};

// GET BY ID
exports.getOverlayById = async (req, res) => {
    try {
        const { id } = req.params;
        const overlay = await MapOverlay.findByPk(id);

        if (!overlay) return res.status(404).json({ message: 'Overlay não encontrado' });

        return res.json({
            overlay: {
                ...overlay.toJSON(),
                conteudo: overlay.conteudo ? overlay.conteudo.toString('base64') : null
            }
        });
    } catch (error) {
        console.error("Erro no getOverlayById:", error);
        return res.status(500).json({ message: 'Erro ao buscar overlay', error });
    }
};

// UPDATE
exports.updateOverlay = (req, res) => {
    upload(req, res, async (err) => {
        if (err) return res.status(500).json({ error: "Erro ao carregar ficheiro" });

        const { id } = req.params;
        const { tipo } = req.body;

        try {
            const overlay = await MapOverlay.findByPk(id);
            if (!overlay) return res.status(404).json({ error: "Overlay não encontrado" });

            const { buffer, mediaPath } = resolveOverlayPayload(req);

            if (buffer) {
                overlay.conteudo = buffer;
                overlay.mediaPath = mediaPath;
            } else if (req.body.mediaPath !== undefined) {
                overlay.mediaPath = mediaPath || null;
            }

            overlay.tipo = tipo ?? overlay.tipo;

            await overlay.save();

            const logMessage = `Overlay com ID ${id} foi atualizado`;
            logger.info(logMessage);

            return res.status(200).json({ message: "Overlay atualizado com sucesso", overlay });
        } catch (error) {
            console.error("Erro ao atualizar overlay:", error);
            return res.status(500).json({ error: "Erro ao atualizar overlay" });
        }
    });
};

// DELETE
exports.deleteOverlay = async (req, res) => {
    try {
        const { id } = req.params;
        const overlay = await MapOverlay.findByPk(id);

        if (!overlay) return res.status(404).json({ message: 'Overlay não encontrado' });

        await overlay.destroy();

        const logMessage = `Overlay com ID ${id} foi eliminado`;
        logger.info(logMessage);

        if (global.io) global.io.emit("overlayRemovido", { message: logMessage });

        return res.status(200).json({ message: 'Overlay eliminado com sucesso' });
    } catch (error) {
        console.error("Erro no deleteOverlay:", error);
        return res.status(500).json({ error: 'Erro ao eliminar overlay' });
    }
};