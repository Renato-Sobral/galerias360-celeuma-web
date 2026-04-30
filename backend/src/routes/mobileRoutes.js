const express = require('express');
const router = express.Router();
const { getMobilePontoHotspots } = require('../controllers/mobileController');

// Endpoint read-only para a app mobile, com payload equivalente ao viewer web.
router.get('/pontos/:id_ponto/hotspots', getMobilePontoHotspots);

module.exports = router;
