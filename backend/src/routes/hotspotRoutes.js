const express = require('express');
const router = express.Router();
const {createHotspot, getHotspots, updateHotspot, deleteHotspot} = require('../controllers/hotspotController');

router.post('/add', createHotspot);
router.get('/', getHotspots);
router.put('/:id', updateHotspot);
router.delete('/:id', deleteHotspot);

module.exports = router;
