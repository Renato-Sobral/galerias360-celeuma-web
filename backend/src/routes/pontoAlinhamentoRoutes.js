const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getAlinhamento, salvarAlinhamento } = require('../controllers/pontoAlinhamentoController');

const router = express.Router();

router.get('/:id_ponto/alinhamento', requireAuth, getAlinhamento);
router.put('/:id_ponto/alinhamento', requireAuth, salvarAlinhamento);

module.exports = router;
