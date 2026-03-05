const express = require('express');
const router = express.Router();
const {convidarUtilizador, registarComConvite} = require('../controllers/emailSenderController');

router.post('/user', convidarUtilizador);
router.post('/registo', registarComConvite)

module.exports = router;