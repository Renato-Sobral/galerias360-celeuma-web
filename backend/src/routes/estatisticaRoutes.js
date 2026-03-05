const express = require('express');
const router = express.Router();
const { adicionarVisualizacao, estatisticasResumo, visualizacoesPonto } = require('../controllers/estatisticaController');

router.post('/', adicionarVisualizacao);
router.get('/resumo', estatisticasResumo);
router.get('/visualizacoes/:id_ponto', visualizacoesPonto);

module.exports = router;
