const express = require('express');
const router = express.Router();
const logController = require('../controllers/logController');

router.get("/logs/downloadAll", logController.downloadAllLogs);

router.get('/logs', logController.listWeeklyLogs);

router.get('/logs/:id', logController.downloadWeeklyLog);

module.exports = router;
