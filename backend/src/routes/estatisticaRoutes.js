const express = require('express');
const router = express.Router();
const {
    adicionarVisualizacao,
    estatisticasResumo,
    visualizacoesPonto,
    estatisticasDispositivos,
    estatisticasBrowsers,
    estatisticasSO,
    estatisticasTimeline,
    historicoAcessos,
    topPontos,
} = require('../controllers/estatisticaController');

router.post('/', adicionarVisualizacao);
router.get('/resumo', estatisticasResumo);
router.get('/dispositivos', estatisticasDispositivos);
router.get('/browsers', estatisticasBrowsers);
router.get('/so', estatisticasSO);
router.get('/timeline', estatisticasTimeline);
router.get('/historico', historicoAcessos);
router.get('/top-pontos', topPontos);
router.get('/visualizacoes/:id_ponto', visualizacoesPonto);

module.exports = router;
