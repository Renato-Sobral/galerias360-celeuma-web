const express = require('express');
const router = express.Router();
const {createPonto, listPontos, getPontoById, updatePonto, deletePonto} = require('../controllers/pontoController');

router.post('/create', createPonto);
router.get('/list', listPontos);
router.get('/:id', getPontoById)
router.patch('/update/:id_ponto', updatePonto)
router.delete('/delete/:id_ponto', deletePonto);

module.exports = router;
