const express = require('express');
const uipathExportController = require('../controllers/uipathExport');

const router = express.Router();

// Route pour obtenir les données pour UiPath
router.get('/articles', uipathExportController.getArticlesForUiPath);

module.exports = router; 