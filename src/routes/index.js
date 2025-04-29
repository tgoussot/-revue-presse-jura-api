const express = require('express');
const articlesRoutes = require('./articles');
const communesRoutes = require('./communes');

const router = express.Router();

// Route de base pour vérifier que l'API fonctionne
router.get('/', (req, res) => {
  res.json({
    message: 'API Revue Presse Jura',
    version: '1.0.0',
    status: 'active'
  });
});

// Intégration des sous-routes
router.use('/articles', articlesRoutes);
router.use('/communes', communesRoutes);

module.exports = router; 