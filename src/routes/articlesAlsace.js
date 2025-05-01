const express = require('express');
const router = express.Router();
const articlesAlsaceController = require('../controllers/articlesAlsace');

/**
 * @route GET /api/articles/alsace/search
 * @desc Recherche d'articles dans le journal L'Alsace
 * @access Public
 * @param {string} keyword - Mot-clé de recherche obligatoire
 * @param {string} startDate - Date de début (format YYYY-MM-DD) optionnelle
 * @param {string} endDate - Date de fin (format YYYY-MM-DD) optionnelle
 */
router.get('/search', articlesAlsaceController.searchArticles);

module.exports = router; 