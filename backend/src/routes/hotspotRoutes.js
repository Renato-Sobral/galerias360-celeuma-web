const express = require('express');
const router = express.Router();
const {createHotspot, getHotspots, updateHotspot, deleteHotspot, getHotspotIconConfig, updateHotspotIconConfig} = require('../controllers/hotspotController');
const hotspotCustomizationController = require('../controllers/hotspotCustomizationController');
const { requireAuth, forbidRoleIds } = require('../middleware/auth');

const forbidRole2Write = forbidRoleIds([2], 'Utilizadores com perfil de visualização não podem editar hotspots.');

router.post('/add', requireAuth, forbidRole2Write, createHotspot);
router.get('/', getHotspots);
router.put('/:id', requireAuth, forbidRole2Write, updateHotspot);
router.delete('/:id', requireAuth, forbidRole2Write, deleteHotspot);
router.get('/icon-config/:id_ponto', requireAuth, forbidRole2Write, getHotspotIconConfig);
router.put('/icon-config/:id_ponto', requireAuth, forbidRole2Write, updateHotspotIconConfig);

// Personalização por-utilizador (apenas afeta o próprio utilizador autenticado)
router.get('/custom/me', requireAuth, hotspotCustomizationController.getMyHotspotCustomizations);
router.put('/:id/custom/me', requireAuth, hotspotCustomizationController.upsertMyHotspotCustomization);

module.exports = router;
