const CategoriaPonto = require('../models/categoria_ponto');
const PontoCategoria = require('../models/ponto_categoria');
const Ponto = require('../models/ponto');

exports.listCategorias = async (_req, res) => {
    try {
        const categorias = await CategoriaPonto.findAll({
            order: [['name', 'ASC']],
        });

        return res.status(200).json({ categorias });
    } catch (error) {
        console.error('Erro ao listar categorias:', error);
        return res.status(500).json({ error: 'Erro ao listar categorias' });
    }
};

exports.getCategoriaById = async (req, res) => {
    try {
        const { id_categoria } = req.params;
        const categoria = await CategoriaPonto.findByPk(id_categoria);

        if (!categoria) {
            return res.status(404).json({ error: 'Categoria não encontrada' });
        }

        return res.status(200).json({ categoria });
    } catch (error) {
        console.error('Erro ao obter categoria:', error);
        return res.status(500).json({ error: 'Erro ao obter categoria' });
    }
};

exports.createCategoria = async (req, res) => {
    try {
        const name = req.body?.name?.trim();

        if (!name) {
            return res.status(400).json({ error: 'Nome da categoria é obrigatório' });
        }

        const existing = await CategoriaPonto.findOne({ where: { name } });
        if (existing) {
            return res.status(409).json({ error: 'Já existe uma categoria com esse nome' });
        }

        const categoria = await CategoriaPonto.create({ name });
        return res.status(201).json({ message: 'Categoria criada com sucesso', categoria });
    } catch (error) {
        console.error('Erro ao criar categoria:', error);
        return res.status(500).json({ error: 'Erro ao criar categoria' });
    }
};

exports.updateCategoria = async (req, res) => {
    try {
        const { id_categoria } = req.params;
        const name = req.body?.name?.trim();

        if (!name) {
            return res.status(400).json({ error: 'Nome da categoria é obrigatório' });
        }

        const categoria = await CategoriaPonto.findByPk(id_categoria);
        if (!categoria) {
            return res.status(404).json({ error: 'Categoria não encontrada' });
        }

        const existing = await CategoriaPonto.findOne({ where: { name } });
        if (existing && existing.id_categoria !== categoria.id_categoria) {
            return res.status(409).json({ error: 'Já existe uma categoria com esse nome' });
        }

        categoria.name = name;
        await categoria.save();

        return res.status(200).json({ message: 'Categoria atualizada com sucesso', categoria });
    } catch (error) {
        console.error('Erro ao atualizar categoria:', error);
        return res.status(500).json({ error: 'Erro ao atualizar categoria' });
    }
};

exports.deleteCategoria = async (req, res) => {
    try {
        const { id_categoria } = req.params;

        const categoria = await CategoriaPonto.findByPk(id_categoria);
        if (!categoria) {
            return res.status(404).json({ error: 'Categoria não encontrada' });
        }

        const [associadosTabelaJuncao, associadosLegado] = await Promise.all([
            PontoCategoria.count({ where: { id_categoria } }),
            Ponto.count({ where: { id_categoria } }),
        ]);

        const pontosAssociados = associadosTabelaJuncao + associadosLegado;
        if (pontosAssociados > 0) {
            return res.status(409).json({
                error: 'Não é possível eliminar esta categoria porque existem pontos associados',
                pontosAssociados,
            });
        }

        await categoria.destroy();

        return res.status(200).json({ message: 'Categoria eliminada com sucesso' });
    } catch (error) {
        console.error('Erro ao eliminar categoria:', error);
        return res.status(500).json({ error: 'Erro ao eliminar categoria' });
    }
};
