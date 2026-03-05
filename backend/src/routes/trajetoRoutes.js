const express = require('express');
const router = express.Router();
const trajetoController = require('../controllers/trajetoController');

router.post('/create', trajetoController.createTrajeto);
router.get('/list', trajetoController.getTrajetoComPontos);
router.post('/upload-video/:id',trajetoController.uploadVideoMiddleware, trajetoController.uploadVideo);
router.patch('/update-description/:id', trajetoController.updateDescription);
router.delete('/rota/delete/:id', trajetoController.deleteRotaComTrajetos);
router.get('/video/:id',trajetoController.getVideoByTrajetoId);

module.exports = router;
