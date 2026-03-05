const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const {
    listPresets,
    getPreset,
    createPreset,
    updatePreset,
    deletePreset,
    getActiveTheme,
    setActiveTheme,
    getLandingContent,
    setLandingContent,
} = require('../controllers/themeController');

// Public
router.get('/active', getActiveTheme);
router.get('/list', listPresets);
router.get('/landing-content', getLandingContent);
router.get('/:id', getPreset);

// Admin
router.post('/create', requireAdmin, createPreset);
router.put('/update/:id', requireAdmin, updatePreset);
router.delete('/delete/:id', requireAdmin, deletePreset);
router.post('/set-active', requireAdmin, setActiveTheme);
router.post('/landing-content', requireAdmin, setLandingContent);

module.exports = router;
