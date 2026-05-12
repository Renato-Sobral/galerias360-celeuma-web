const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const mediaController = require('../controllers/mediaController');

function handleUploadMiddleware(req, res, next) {
	mediaController.uploadMiddleware(req, res, (err) => {
		if (!err) {
			console.log('✅ Multer: Ficheiro recebido com sucesso');
			return next();
		}

		const isMulterLimit = err.code === 'LIMIT_FILE_SIZE';
		const status = err.statusCode || (isMulterLimit ? 413 : 400);
		const message = isMulterLimit
			? 'Ficheiro demasiado grande (limite 250MB por ficheiro).'
			: err.message || 'Erro no upload';

		console.error('❌ Multer erro:', { code: err.code, message: err.message, status });
		return res.status(status).json({ success: false, message });
	});
}

router.get('/tree', requireAuth, mediaController.getTree);
router.get('/list', requireAuth, mediaController.listDirectory);
router.get('/references', requireAuth, mediaController.getReferences);

router.post('/folder', requireAuth, mediaController.createFolder);
router.post('/move', requireAuth, mediaController.moveItem);
router.post('/upload', requireAuth, handleUploadMiddleware, mediaController.uploadFiles);

router.delete('/item', requireAuth, mediaController.deleteItem);

module.exports = router;
