const express = require('express');
const articlesUnifiedController = require('../controllers/articlesUnified');

const router = express.Router();

// Route pour rechercher dans tous les journaux en même temps (JSON standard)
router.get('/search', articlesUnifiedController.searchAllArticles);

// Route pour rechercher dans tous les journaux avec streaming des résultats (SSE)
router.get('/search/streaming', articlesUnifiedController.searchAllArticlesStreaming);

module.exports = router; 