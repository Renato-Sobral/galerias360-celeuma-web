const ThemePreset = require('../models/theme_preset');
const AppSetting = require('../models/app_setting');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const logger = require('../models/logger');

/* ── multer: logos go to uploads/logos ── */
const logosDir = path.join(__dirname, '..', '..', 'uploads', 'logos');
if (!fs.existsSync(logosDir)) fs.mkdirSync(logosDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, logosDir),
    filename: (_req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, unique + path.extname(file.originalname));
    },
});
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (['.png', '.jpg', '.jpeg', '.svg', '.webp'].includes(ext)) return cb(null, true);
        cb(new Error('Formato de imagem não suportado'));
    },
}).fields([
    { name: 'logoLight', maxCount: 1 },
    { name: 'logoDark', maxCount: 1 },
]);

/* ── helpers ── */
const baseUrl = () => process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`;
const logoUrl = (filename) => filename ? `${baseUrl()}/uploads/logos/${filename}` : null;

const removeLogo = (url) => {
    if (!url) return;
    const filename = url.split('/').pop();
    const filepath = path.join(logosDir, filename);
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
};

const LANDING_TITLE_KEY = 'landing_hero_title';
const LANDING_DESCRIPTION_KEY = 'landing_hero_description';

const DEFAULT_LANDING_TITLE = 'Explora o mundo com Galerias 360';
const DEFAULT_LANDING_DESCRIPTION = 'Descobre pontos turísticos e culturais em realidade aumentada com uma experiência imersiva em 360º. Acede ao mapa interativo e mergulha em cada história.';

/* ── LIST all presets ── */
exports.listPresets = async (_req, res) => {
    try {
        const presets = await ThemePreset.findAll({ order: [['createdAt', 'DESC']] });
        return res.json({ success: true, data: presets });
    } catch (err) {
        console.error('Erro ao listar presets:', err);
        return res.status(500).json({ success: false, message: 'Erro ao listar presets' });
    }
};

/* ── GET single preset ── */
exports.getPreset = async (req, res) => {
    try {
        const preset = await ThemePreset.findByPk(req.params.id);
        if (!preset) return res.status(404).json({ success: false, message: 'Preset não encontrado' });
        return res.json({ success: true, data: preset });
    } catch (err) {
        console.error('Erro ao obter preset:', err);
        return res.status(500).json({ success: false, message: 'Erro ao obter preset' });
    }
};

/* ── CREATE preset ── */
exports.createPreset = (req, res) => {
    upload(req, res, async (err) => {
        if (err) return res.status(400).json({ success: false, message: err.message });
        try {
            const { name, lightVars, darkVars } = req.body;
            if (!name) return res.status(400).json({ success: false, message: 'Nome é obrigatório' });

            const logoLightUrl = req.files?.logoLight?.[0] ? logoUrl(req.files.logoLight[0].filename) : null;
            const logoDarkUrl = req.files?.logoDark?.[0] ? logoUrl(req.files.logoDark[0].filename) : null;

            const preset = await ThemePreset.create({
                name,
                lightVars: lightVars ? JSON.parse(lightVars) : null,
                darkVars: darkVars ? JSON.parse(darkVars) : null,
                logoLightUrl,
                logoDarkUrl,
            });

            logger.info(`Preset "${name}" criado (id ${preset.id_theme_preset})`);
            return res.status(201).json({ success: true, data: preset });
        } catch (err) {
            console.error('Erro ao criar preset:', err);
            if (err.name === 'SequelizeUniqueConstraintError')
                return res.status(409).json({ success: false, message: 'Já existe um preset com esse nome' });
            return res.status(500).json({ success: false, message: 'Erro ao criar preset' });
        }
    });
};

/* ── UPDATE preset ── */
exports.updatePreset = (req, res) => {
    upload(req, res, async (err) => {
        if (err) return res.status(400).json({ success: false, message: err.message });
        try {
            const preset = await ThemePreset.findByPk(req.params.id);
            if (!preset) return res.status(404).json({ success: false, message: 'Preset não encontrado' });

            const { name, lightVars, darkVars } = req.body;
            if (name !== undefined) preset.name = name;
            if (lightVars !== undefined) preset.lightVars = JSON.parse(lightVars);
            if (darkVars !== undefined) preset.darkVars = JSON.parse(darkVars);

            if (req.files?.logoLight?.[0]) {
                removeLogo(preset.logoLightUrl);
                preset.logoLightUrl = logoUrl(req.files.logoLight[0].filename);
            }
            if (req.files?.logoDark?.[0]) {
                removeLogo(preset.logoDarkUrl);
                preset.logoDarkUrl = logoUrl(req.files.logoDark[0].filename);
            }

            await preset.save();
            logger.info(`Preset "${preset.name}" atualizado (id ${preset.id_theme_preset})`);
            return res.json({ success: true, data: preset });
        } catch (err) {
            console.error('Erro ao atualizar preset:', err);
            if (err.name === 'SequelizeUniqueConstraintError')
                return res.status(409).json({ success: false, message: 'Já existe um preset com esse nome' });
            return res.status(500).json({ success: false, message: 'Erro ao atualizar preset' });
        }
    });
};

/* ── DELETE preset ── */
exports.deletePreset = async (req, res) => {
    try {
        const preset = await ThemePreset.findByPk(req.params.id);
        if (!preset) return res.status(404).json({ success: false, message: 'Preset não encontrado' });

        removeLogo(preset.logoLightUrl);
        removeLogo(preset.logoDarkUrl);

        // If this was the active preset, clear app_setting
        const activeSetting = await AppSetting.findByPk('active_theme_preset_id');
        if (activeSetting && String(activeSetting.value) === String(preset.id_theme_preset)) {
            await activeSetting.destroy();
        }

        await preset.destroy();
        logger.info(`Preset "${preset.name}" eliminado (id ${req.params.id})`);
        return res.json({ success: true, message: 'Preset eliminado com sucesso' });
    } catch (err) {
        console.error('Erro ao eliminar preset:', err);
        return res.status(500).json({ success: false, message: 'Erro ao eliminar preset' });
    }
};

/* ── GET active theme (public) ── */
exports.getActiveTheme = async (_req, res) => {
    try {
        const setting = await AppSetting.findByPk('active_theme_preset_id');
        if (!setting || !setting.value) {
            return res.json({ success: true, data: null }); // use defaults
        }
        const preset = await ThemePreset.findByPk(setting.value);
        return res.json({ success: true, data: preset || null });
    } catch (err) {
        console.error('Erro ao obter tema ativo:', err);
        return res.status(500).json({ success: false, message: 'Erro ao obter tema ativo' });
    }
};

/* ── SET active theme ── */
exports.setActiveTheme = async (req, res) => {
    try {
        const { presetId } = req.body; // null = revert to default
        if (presetId) {
            const preset = await ThemePreset.findByPk(presetId);
            if (!preset) return res.status(404).json({ success: false, message: 'Preset não encontrado' });
        }
        await AppSetting.upsert({ key: 'active_theme_preset_id', value: presetId ?? null });
        logger.info(`Tema ativo definido para preset id ${presetId ?? 'default'}`);
        return res.json({ success: true, message: 'Tema ativo atualizado' });
    } catch (err) {
        console.error('Erro ao definir tema ativo:', err);
        return res.status(500).json({ success: false, message: 'Erro ao definir tema ativo' });
    }
};

/* ── GET landing texts (public) ── */
exports.getLandingContent = async (_req, res) => {
    try {
        const [titleSetting, descriptionSetting] = await Promise.all([
            AppSetting.findByPk(LANDING_TITLE_KEY),
            AppSetting.findByPk(LANDING_DESCRIPTION_KEY),
        ]);

        return res.json({
            success: true,
            data: {
                title: titleSetting?.value || DEFAULT_LANDING_TITLE,
                description: descriptionSetting?.value || DEFAULT_LANDING_DESCRIPTION,
            },
        });
    } catch (err) {
        console.error('Erro ao obter conteúdo da homepage:', err);
        return res.status(500).json({ success: false, message: 'Erro ao obter conteúdo da homepage' });
    }
};

/* ── SET landing texts (admin) ── */
exports.setLandingContent = async (req, res) => {
    try {
        const { title, description } = req.body || {};

        if (typeof title !== 'string' || !title.trim()) {
            return res.status(400).json({ success: false, message: 'Título é obrigatório' });
        }
        if (typeof description !== 'string' || !description.trim()) {
            return res.status(400).json({ success: false, message: 'Descrição é obrigatória' });
        }

        await Promise.all([
            AppSetting.upsert({ key: LANDING_TITLE_KEY, value: title.trim() }),
            AppSetting.upsert({ key: LANDING_DESCRIPTION_KEY, value: description.trim() }),
        ]);

        logger.info('Texto da homepage atualizado na personalização');
        return res.json({
            success: true,
            data: {
                title: title.trim(),
                description: description.trim(),
            },
            message: 'Conteúdo da homepage atualizado',
        });
    } catch (err) {
        console.error('Erro ao atualizar conteúdo da homepage:', err);
        return res.status(500).json({ success: false, message: 'Erro ao atualizar conteúdo da homepage' });
    }
};
