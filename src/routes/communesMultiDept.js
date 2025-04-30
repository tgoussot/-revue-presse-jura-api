const express = require('express');
const communesMultiDeptController = require('../controllers/communesMultiDept');

const router = express.Router();

// Routes pour récupérer les communes
router.get('/doubs', communesMultiDeptController.getDoubsCommunes);
router.get('/haute-saone', communesMultiDeptController.getHauteSaoneCommunes);
router.get('/territoire-belfort', communesMultiDeptController.getTerritoireBelfortCommunes);
router.get('/all', communesMultiDeptController.getAllCommunes);

module.exports = router; 