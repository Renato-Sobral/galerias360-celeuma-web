const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getEditorState, saveEditorState } = require('../controllers/editorStateController');

const router = express.Router();

router.get('/state', requireAuth, getEditorState);
router.put('/state', requireAuth, saveEditorState);

module.exports = router;
