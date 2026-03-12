const Ponto = require('../models/ponto');
const CategoriaPonto = require('../models/categoria_ponto');
const Visualizacao = require('../models/estatistica');
const multer = require('multer');
const logger = require('../models/logger');
const crypto = require('crypto');
const { Sequelize } = require('sequelize');
const {
    normalizeUploadsRelativePath,
    getPublicUploadUrl,
    readUploadFileBuffer,
    saveBufferToUploads,
    uploadFileExists,
} = require('../utils/mediaLibrary');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage }).single('image');

const getEncryptionSecret = () => {
    const secret = process.env.ENCRYPTION_KEY;

    if (typeof secret === 'string' && secret.trim()) {
        return secret;
    }

    if (process.env.NODE_ENV === 'production') {
        throw new Error('ENCRYPTION_KEY não definida. Configure esta variável no ambiente de produção.');
    }

    console.warn('⚠️ ENCRYPTION_KEY não definida. A usar chave de desenvolvimento temporária.');
    return 'dev-encryption-key-change-me';
};

const ENCRYPTION_KEY = crypto.createHash('sha256').update(getEncryptionSecret(), 'utf8').digest(); // gera 32 bytes fixos
const IV_LENGTH = 16;

function encrypt(buffer) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    return {
        encryptedBuffer: encrypted,
        iv: iv.toString('hex')
    };
}

function parseCategoriaIds(input) {
    if (input === undefined || input === null || input === '') return [];

    if (Array.isArray(input)) {
        return [...new Set(input.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
    }

    if (typeof input === 'number') {
        return Number.isInteger(input) && input > 0 ? [input] : [];
    }

    if (typeof input === 'string') {
        const trimmed = input.trim();
        if (!trimmed) return [];

        if (trimmed.startsWith('[')) {
            try {
                const parsed = JSON.parse(trimmed);
                return parseCategoriaIds(parsed);
            } catch {
                return [];
            }
        }

        if (trimmed.includes(',')) {
            return parseCategoriaIds(trimmed.split(','));
        }

        const parsed = Number(trimmed);
        return Number.isInteger(parsed) && parsed > 0 ? [parsed] : [];
    }

    return [];
}

function resolveImagePayload(req) {
    if (req.file?.buffer) {
        const storedPath = saveBufferToUploads(req.file.buffer, {
            destinationDir: 'pontos',
            originalName: req.file.originalname,
        });
        return {
            imagePath: storedPath,
        };
    }

    const imagePath = normalizeUploadsRelativePath(req.body.imagePath || '');
    if (!imagePath) {
        return {
            imagePath: null,
        };
    }

    readUploadFileBuffer(imagePath);
    return { imagePath };
}

function toAbsoluteRequestUrl(req, urlPath) {
    if (!urlPath) return null;
    if (/^https?:\/\//i.test(urlPath)) return urlPath;

    const forwardedProto = req.headers['x-forwarded-proto'];
    const protocol = (typeof forwardedProto === 'string' && forwardedProto) || req.protocol || 'http';
    const host = req.get('host');

    if (!host) return urlPath;
    return `${protocol}://${host}${urlPath.startsWith('/') ? urlPath : `/${urlPath}`}`;
}

function serializePonto(ponto, options = {}) {
    const { includeLegacyImage = true, visualizacoes = 0, request = null } = options;
    const raw = typeof ponto.toJSON === 'function' ? ponto.toJSON() : { ...ponto };

    let legacyBase64 = null;
    if (includeLegacyImage && raw.image && raw.iv) {
        try {
            const decryptedBuffer = decrypt(raw.image, raw.iv);
            legacyBase64 = decryptedBuffer.toString('base64');
        } catch (err) {
            console.error(`Erro ao desencriptar imagem do ponto ${raw.id_ponto}:`, err);
        }
    }

    const hasFileManagerImage = raw.imagePath && uploadFileExists(raw.imagePath);
    const imageUrl = hasFileManagerImage
        ? toAbsoluteRequestUrl(request, getPublicUploadUrl(raw.imagePath))
        : null;

    return {
        ...raw,
        image: legacyBase64,
        imageUrl,
        environment: imageUrl || legacyBase64 || null,
        visualizacoes,
    };
}

async function validateCategoriasExistem(categoriaIds) {
    if (!categoriaIds.length) return false;
    const count = await CategoriaPonto.count({ where: { id_categoria: categoriaIds } });
    return count === categoriaIds.length;
}

exports.createPonto = (req, res) => {
    upload(req, res, async (err) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error uploading image' });
        }

        const { name, description, latitude, longitude, username } = req.body;
        const categoriaIds = parseCategoriaIds(req.body.id_categorias ?? req.body.id_categoria);

        if (!name || !latitude || !longitude) {
            return res.status(400).json({ error: 'Nome, latitude e longitude são obrigatórios' });
        }

        if (!categoriaIds.length) {
            return res.status(400).json({ error: 'Pelo menos uma categoria é obrigatória' });
        }

        try {
            const categoriasValidas = await validateCategoriasExistem(categoriaIds);
            if (!categoriasValidas) {
                return res.status(400).json({ error: 'Categoria inválida' });
            }

            const { imagePath } = resolveImagePayload(req);

            const novoPonto = await Ponto.create({
                name,
                description,
                latitude,
                longitude,
                id_categoria: categoriaIds[0],
                image: null,
                imagePath,
                iv: null,
            });

            await novoPonto.setCategorias(categoriaIds);

            const novoPontoComCategorias = await Ponto.findByPk(novoPonto.id_ponto, {
                include: [{ model: CategoriaPonto, as: 'categorias', attributes: ['id_categoria', 'name'], through: { attributes: [] } }],
            });

            const logMessage = `${username} criou um novo ponto`;
            logger.info(logMessage);

            if (global.io) {
                global.io.emit("novoPonto", { message: logMessage });
            }

            return res.status(201).json({
                message: 'Ponto criado com sucesso',
                ponto: serializePonto(novoPontoComCategorias, { request: req })
            });
        } catch (error) {
            console.error("Erro no createPonto:", error);
            return res.status(500).json({ error: error.message || 'Erro ao criar ponto' });
        }
    });
};

function decrypt(encryptedBuffer, ivHex) {
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    const decrypted = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
    return decrypted;
}

exports.listPontos = async (req, res) => {
    try {
        const [pontos, visualizacoesPorPonto] = await Promise.all([
            Ponto.findAll({
                attributes: {
                    exclude: ['image', 'iv'],
                },
                include: [
                    {
                        model: CategoriaPonto,
                        as: 'categorias',
                        attributes: ['id_categoria', 'name'],
                        through: { attributes: [] },
                    },
                ],
            }),
            Visualizacao.findAll({
                where: { tipo: 'ponto' },
                attributes: [
                    'referencia_id',
                    [Sequelize.fn('COUNT', Sequelize.col('id_visualizacao')), 'total'],
                ],
                group: ['referencia_id'],
                raw: true,
            }),
        ]);

        const visualizacoesMap = visualizacoesPorPonto.reduce((acc, item) => {
            acc[String(item.referencia_id)] = Number.parseInt(item.total, 10) || 0;
            return acc;
        }, {});

        const pontosComImagens = pontos.map((ponto) => serializePonto(ponto, {
            includeLegacyImage: false,
            visualizacoes: visualizacoesMap[String(ponto.id_ponto)] || 0,
            request: req,
        }));

        return res.status(200).json({ pontos: pontosComImagens });
    } catch (error) {
        console.error("Erro no listPontos:", error);
        return res.status(500).json({ error: 'Erro ao buscar pontos' });
    }
};

exports.getPontoById = async (req, res) => {
    try {
        const { id } = req.params;
        const ponto = await Ponto.findByPk(id, {
            include: [
                {
                    model: CategoriaPonto,
                    as: 'categorias',
                    attributes: ['id_categoria', 'name'],
                    through: { attributes: [] },
                },
            ],
        });

        if (!ponto) {
            return res.status(404).json({ message: 'Ponto não encontrado' });
        }

        return res.json({
            ponto: serializePonto(ponto, { request: req })
        });

    } catch (error) {
        console.error("Erro no getPontoById:", error);
        res.status(500).json({ message: 'Erro ao buscar ponto', error });
    }
};

exports.updatePonto = (req, res) => {
    upload(req, res, async (err) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Erro ao carregar imagem" });
        }

        const { id_ponto } = req.params;
        const { name, description, latitude, longitude } = req.body;
        const categoriaIdsRaw = req.body.id_categorias ?? req.body.id_categoria;

        try {
            const ponto = await Ponto.findByPk(id_ponto);

            if (!ponto) {
                return res.status(404).json({ error: "Ponto não encontrado" });
            }

            if (categoriaIdsRaw !== undefined) {
                const categoriaIds = parseCategoriaIds(categoriaIdsRaw);
                if (!categoriaIds.length) {
                    return res.status(400).json({ error: 'Pelo menos uma categoria é obrigatória' });
                }

                const categoriasValidas = await validateCategoriasExistem(categoriaIds);
                if (!categoriasValidas) {
                    return res.status(400).json({ error: 'Categoria inválida' });
                }
                await ponto.setCategorias(categoriaIds);
                ponto.id_categoria = categoriaIds[0];
            }

            const { imagePath } = resolveImagePayload(req);
            if (imagePath) {
                ponto.image = null;
                ponto.iv = null;
                ponto.imagePath = imagePath;
            } else if (req.body.imagePath !== undefined) {
                ponto.image = null;
                ponto.iv = null;
                ponto.imagePath = imagePath || null;
            }

            ponto.name = name ?? ponto.name;
            ponto.description = description ?? ponto.description;
            ponto.latitude = latitude ?? ponto.latitude;
            ponto.longitude = longitude ?? ponto.longitude;

            await ponto.save();

            const pontoAtualizado = await Ponto.findByPk(id_ponto, {
                include: [
                    {
                        model: CategoriaPonto,
                        as: 'categorias',
                        attributes: ['id_categoria', 'name'],
                        through: { attributes: [] },
                    },
                ],
            });

            const logMessage = `Ponto com ID ${id_ponto} foi atualizado`;
            logger.info(logMessage);

            return res.status(200).json({ message: "Ponto atualizado com sucesso", ponto: serializePonto(pontoAtualizado, { request: req }) });
        } catch (error) {
            console.error("Erro ao atualizar ponto:", error);
            return res.status(500).json({ error: "Erro ao atualizar ponto" });
        }
    });
};

exports.deletePonto = async (req, res) => {
    try {
        const { id_ponto } = req.params;

        const ponto = await Ponto.findByPk(id_ponto);

        if (!ponto) {
            return res.status(404).json({ message: 'Ponto não encontrado' });
        }

        await ponto.destroy();

        const logMessage = `Ponto com ID ${id_ponto} foi eliminado`;
        logger.info(logMessage);

        if (global.io) {
            global.io.emit("pontoRemovido", { message: logMessage });
        }

        return res.status(200).json({ message: 'Ponto eliminado com sucesso' });
    } catch (error) {
        console.error("Erro no deletePonto:", error);
        return res.status(500).json({ error: 'Erro ao eliminar ponto' });
    }
};
