const express = require('express');
const communesUnifiedController = require('../controllers/communesUnified');

const router = express.Router();

// Route d'administration pour forcer le peuplement de tous les caches
router.get('/populate-caches', communesUnifiedController.populateAllCaches);

// Routes par département
router.get('/departement/25', communesUnifiedController.getDoubsCommunes);
router.get('/departement/39', communesUnifiedController.getJuraCommunes);
router.get('/departement/67', communesUnifiedController.getBasRhinCommunes);
router.get('/departement/68', communesUnifiedController.getHautRhinCommunes);
router.get('/departement/70', communesUnifiedController.getHauteSaoneCommunes);
router.get('/departement/90', communesUnifiedController.getTerritoireBelfortCommunes);
router.get('/departement/:deptCode', communesUnifiedController.getCommunesByDepartement);

// Routes par région
router.get('/est', communesUnifiedController.getEstCommunes);
router.get('/alsace', communesUnifiedController.getAlsaceCommunes);

// Route pour toutes les communes
router.get('/all', communesUnifiedController.getAllCommunes);
router.get('/', communesUnifiedController.getAllCommunes); // Alias de /all pour faciliter l'accès

module.exports = router; 