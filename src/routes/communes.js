const express = require('express');
const communesController = require('../controllers/communes');

const router = express.Router();

// Route pour récupérer les communes du Jura
router.get('/jura', communesController.getJuraCommunes);

module.exports = router;