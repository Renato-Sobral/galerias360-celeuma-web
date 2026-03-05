const Ponto = require('../models/ponto');
const multer = require('multer');
const logger = require('../models/logger');
const crypto = require('crypto');

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

exports.createPonto = (req, res) => {
    upload(req, res, async (err) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error uploading image' });
        }

        const { name, description, latitude, longitude, username } = req.body;

        try {
            let encryptedImage = null;
            let iv = null;

            if (req.file && req.file.buffer) {
                const { encryptedBuffer, iv: ivHex } = encrypt(req.file.buffer);
                encryptedImage = encryptedBuffer;
                iv = ivHex;
            }

            const novoPonto = await Ponto.create({
                name,
                description,
                latitude,
                longitude,
                image: encryptedImage,
                iv: iv
            });

            const logMessage = `${username} criou um novo ponto`;
            logger.info(logMessage);

            if (global.io) {
                global.io.emit("novoPonto", { message: logMessage });
            }

            return res.status(201).json({
                message: 'Ponto criado com sucesso',
                ponto: novoPonto
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
        const pontos = await Ponto.findAll();

        const pontosComImagens = pontos.map(ponto => {
            let imageBase64 = null;

            if (ponto.image && ponto.iv) {
                try {
                    const decryptedBuffer = decrypt(ponto.image, ponto.iv);
                    imageBase64 = decryptedBuffer.toString('base64');
                } catch (err) {
                    console.error(`Erro ao desencriptar imagem do ponto ${ponto.id_ponto}:`, err);
                }
            }

            return {
                ...ponto.toJSON(),
                image: imageBase64
            };
        });

        return res.status(200).json({ pontos: pontosComImagens });
    } catch (error) {
        console.error("Erro no listPontos:", error);
        return res.status(500).json({ error: 'Erro ao buscar pontos' });
    }
};

exports.getPontoById = async (req, res) => {
    try {
        const { id } = req.params;
        const ponto = await Ponto.findByPk(id);

        if (!ponto) {
            return res.status(404).json({ message: 'Ponto não encontrado' });
        }

        let imageBase64 = null;

        if (ponto.image && ponto.iv) {
            try {
                const decryptedBuffer = decrypt(ponto.image, ponto.iv);
                imageBase64 = decryptedBuffer.toString('base64');
            } catch (err) {
                console.error(`Erro ao desencriptar imagem do ponto ${ponto.id_ponto}:`, err);
            }
        }

        return res.json({
            ponto: {
                ...ponto.toJSON(),
                image: imageBase64
            }
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

        try {
            const ponto = await Ponto.findByPk(id_ponto);

            if (!ponto) {
                return res.status(404).json({ error: "Ponto não encontrado" });
            }

            if (req.file && req.file.buffer) {
                const { encryptedBuffer, iv: ivHex } = encrypt(req.file.buffer);
                ponto.image = encryptedBuffer;
                ponto.iv = ivHex;
            }

            ponto.name = name ?? ponto.name;
            ponto.description = description ?? ponto.description;
            ponto.latitude = latitude ?? ponto.latitude;
            ponto.longitude = longitude ?? ponto.longitude;

            await ponto.save();

            const logMessage = `Ponto com ID ${id_ponto} foi atualizado`;
            logger.info(logMessage);

            return res.status(200).json({ message: "Ponto atualizado com sucesso", ponto });
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
