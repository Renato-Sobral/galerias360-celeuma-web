const PontoAlinhamento = require('../models/ponto_alinhamento');
const { normalizeUploadsRelativePath } = require('../utils/mediaLibrary');

exports.getAlinhamento = async (req, res) => {
    try {
        const { id_ponto } = req.params;
        const vistPath = normalizeUploadsRelativePath(req.query.vista_path || '');

        if (!id_ponto || !vistPath) {
            return res.status(400).json({
                success: false,
                message: 'id_ponto e vista_path são obrigatórios'
            });
        }

        const alinhamento = await PontoAlinhamento.findOne({
            where: {
                id_ponto: parseInt(id_ponto),
                vista_path: vistPath
            }
        });

        return res.json({
            success: true,
            data: alinhamento || null
        });
    } catch (error) {
        console.error('Erro ao obter alinhamento do panorama:', error);
        return res.status(500).json({
            success: false,
            message: 'Erro ao obter alinhamento do panorama'
        });
    }
};

exports.salvarAlinhamento = async (req, res) => {
    try {
        const { id_ponto } = req.params;
        const vistPath = normalizeUploadsRelativePath(req.body?.vista_path || '');
        const {
            radius,
            verticalOffset,
            rotationX,
            rotationY,
            rotationZ,
            mirrorX,
            mirrorY
        } = req.body;

        if (!id_ponto || !vistPath) {
            return res.status(400).json({
                success: false,
                message: 'id_ponto e vista_path são obrigatórios'
            });
        }

        const alinhamento = await PontoAlinhamento.findOne({
            where: {
                id_ponto: parseInt(id_ponto),
                vista_path: vistPath
            }
        });

        const dadosAlinhamento = {
            id_ponto: parseInt(id_ponto),
            vista_path: vistPath,
            radius: radius !== undefined ? Number(radius) : 700,
            verticalOffset: verticalOffset !== undefined ? Number(verticalOffset) : 0,
            rotationX: rotationX !== undefined ? Number(rotationX) : 0,
            rotationY: rotationY !== undefined ? Number(rotationY) : -130,
            rotationZ: rotationZ !== undefined ? Number(rotationZ) : 0,
            mirrorX: mirrorX !== undefined ? Boolean(mirrorX) : false,
            mirrorY: mirrorY !== undefined ? Boolean(mirrorY) : false
        };

        let resultado;
        if (alinhamento) {
            await alinhamento.update(dadosAlinhamento);
            resultado = alinhamento;
        } else {
            resultado = await PontoAlinhamento.create(dadosAlinhamento);
        }

        return res.json({
            success: true,
            data: resultado,
            message: 'Alinhamento do panorama guardado com sucesso'
        });
    } catch (error) {
        console.error('Erro ao guardar alinhamento do panorama:', error);
        return res.status(500).json({
            success: false,
            message: 'Erro ao guardar alinhamento do panorama'
        });
    }
};
