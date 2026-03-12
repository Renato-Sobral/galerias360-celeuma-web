const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const {
    listCategorias,
    getCategoriaById,
    createCategoria,
    updateCategoria,
    deleteCategoria,
} = require('../controllers/categoriaPontoController');

router.get('/list', listCategorias);
router.get('/:id_categoria', getCategoriaById);
router.post('/create', requireAdmin, createCategoria);
router.patch('/update/:id_categoria', requireAdmin, updateCategoria);
router.delete('/delete/:id_categoria', requireAdmin, deleteCategoria);

module.exports = router;
