const express = require('express');
const router = express.Router();
const {
  createOverlay,
  listOverlays,
  getOverlayById,
  updateOverlay,
  deleteOverlay
} = require('../controllers/mapOverlayController');

// Criar overlay (imagem, vídeo ou modelo 3D)
router.post('/create', createOverlay);

// Listar todos os overlays
router.get('/list', listOverlays);

// Obter overlay por ID
router.get('/:id', getOverlayById);

// Atualizar overlay por ID
router.patch('/update/:id', updateOverlay);

// Eliminar overlay por ID
router.delete('/delete/:id', deleteOverlay);

module.exports = router;