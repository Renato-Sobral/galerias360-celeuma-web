const express = require('express');
const router = express.Router();
const {redefinirPassword, recuperarPassword} = require('../controllers/emailSenderController');

router.post('/redefinirPassword', redefinirPassword);

router.post('/recuperarPassword', recuperarPassword);

module.exports = router;