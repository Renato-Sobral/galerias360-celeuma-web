const express = require('express');
const router = express.Router();
const {createPonto, listPontos, getPontoById, updatePonto, deletePonto} = require('../controllers/pontoController');
const { requireAuth, forbidRoleIds } = require('../middleware/auth');

const forbidRole2Write = forbidRoleIds([2], 'Utilizadores com perfil de visualização não podem editar panoramas.');

router.post('/create', requireAuth, forbidRole2Write, createPonto);
router.get('/list', listPontos);
router.get('/:id', getPontoById)
router.patch('/update/:id_ponto', requireAuth, forbidRole2Write, updatePonto)
router.delete('/delete/:id_ponto', requireAuth, forbidRole2Write, deletePonto);

module.exports = router;
