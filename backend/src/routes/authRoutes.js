const express = require('express');
const router = express.Router();
const { login, registo, permissao} = require('../controllers/authController');

// Rota para login
router.post('/login', login);
// Rota para registo
router.post('/registo', registo);

router.get('/me', permissao);

module.exports = router;
