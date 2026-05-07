const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const {
    listPresets,
    listStarterPresets,
    getPreset,
    createPreset,
    updatePreset,
    deletePreset,
    getActiveTheme,
    setActiveTheme,
    getLandingContent,
    setLandingContent,
    getFavicon,
    setFavicon,
} = require('../controllers/themeController');

// Public
router.get('/active', getActiveTheme);
router.get('/list', listPresets);
router.get('/starter-list', listStarterPresets);
router.get('/landing-content', getLandingContent);
router.get('/favicon', getFavicon);
router.get('/:id', getPreset);

// Admin
router.post('/create', requireAdmin, createPreset);
router.put('/update/:id', requireAdmin, updatePreset);
router.delete('/delete/:id', requireAdmin, deletePreset);
router.post('/set-active', requireAdmin, setActiveTheme);
router.post('/landing-content', requireAdmin, setLandingContent);
router.post('/favicon', requireAdmin, setFavicon);

module.exports = router;
