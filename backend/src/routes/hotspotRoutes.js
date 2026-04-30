const express = require('express');
const router = express.Router();
const {createHotspot, getHotspots, updateHotspot, deleteHotspot} = require('../controllers/hotspotController');
const { requireAuth, forbidRoleIds } = require('../middleware/auth');

const forbidRole2Write = forbidRoleIds([2], 'Utilizadores com perfil de visualização não podem editar hotspots.');

router.post('/add', requireAuth, forbidRole2Write, createHotspot);
router.get('/', getHotspots);
router.put('/:id', requireAuth, forbidRole2Write, updateHotspot);
router.delete('/:id', requireAuth, forbidRole2Write, deleteHotspot);

module.exports = router;
