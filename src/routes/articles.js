const express = require('express');
const articlesController = require('../controllers/articles');

const router = express.Router();

// Route pour rechercher des articles
router.get('/search', articlesController.searchArticles);

module.exports = router; 