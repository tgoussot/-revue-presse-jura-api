const express = require('express');
const articlesRoutes = require('./articles');
const articlesEstRepublicainRoutes = require('./articlesEstRepublicain');
const articlesAlsaceRoutes = require('./articlesAlsace');
const communesRoutes = require('./communes');
const communesMultiDeptRoutes = require('./communesMultiDept');

const router = express.Router();

// Route de base pour vérifier que l'API fonctionne
router.get('/', (req, res) => {
  res.json({
    message: 'API Revue Presse Multi-Départements',
    version: '1.0.0',
    status: 'active'
  });
});

// Intégration des sous-routes
router.use('/articles/progres', articlesRoutes);
router.use('/articles/estrepublicain', articlesEstRepublicainRoutes);
router.use('/articles/alsace', articlesAlsaceRoutes);
router.use('/communes/jura', communesRoutes);
router.use('/communes', communesMultiDeptRoutes);

module.exports = router; 