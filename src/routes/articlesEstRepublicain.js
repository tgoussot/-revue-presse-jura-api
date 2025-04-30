const express = require('express');
const articlesEstRepublicainController = require('../controllers/articlesEstRepublicain');

const router = express.Router();

// Route pour rechercher des articles
router.get('/search', articlesEstRepublicainController.searchArticles);

module.exports = router; 