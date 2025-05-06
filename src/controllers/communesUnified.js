const communesUnifiedService = require('../services/communesUnifiedService');

/**
 * Récupère les communes du Jura (39)
 */
exports.getJuraCommunes = async (req, res) => {
  try {
    const communes = await communesUnifiedService.getJuraCommunes();
    res.json({ 
      success: true, 
      data: communes,
      count: communes.length,
      departement: '39'
    });
  } catch (error) {
    console.error('Erreur dans le controller communesUnified.getJuraCommunes:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors de la récupération des communes du Jura',
      message: error.message
    });
  }
};

/**
 * Récupère les communes du Doubs (25)
 */
exports.getDoubsCommunes = async (req, res) => {
  try {
    const communes = await communesUnifiedService.getDoubsCommunes();
    res.json({ 
      success: true, 
      data: communes,
      count: communes.length,
      departement: '25'
    });
  } catch (error) {
    console.error('Erreur dans le controller communesUnified.getDoubsCommunes:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors de la récupération des communes du Doubs',
      message: error.message
    });
  }
};

/**
 * Récupère les communes de la Haute-Saône (70)
 */
exports.getHauteSaoneCommunes = async (req, res) => {
  try {
    const communes = await communesUnifiedService.getHauteSaoneCommunes();
    res.json({ 
      success: true, 
      data: communes,
      count: communes.length,
      departement: '70'
    });
  } catch (error) {
    console.error('Erreur dans le controller communesUnified.getHauteSaoneCommunes:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors de la récupération des communes de la Haute-Saône',
      message: error.message
    });
  }
};

/**
 * Récupère les communes du Territoire de Belfort (90)
 */
exports.getTerritoireBelfortCommunes = async (req, res) => {
  try {
    const communes = await communesUnifiedService.getTerritoireBelfortCommunes();
    res.json({ 
      success: true, 
      data: communes,
      count: communes.length,
      departement: '90'
    });
  } catch (error) {
    console.error('Erreur dans le controller communesUnified.getTerritoireBelfortCommunes:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors de la récupération des communes du Territoire de Belfort',
      message: error.message
    });
  }
};

/**
 * Récupère les communes du Bas-Rhin (67)
 */
exports.getBasRhinCommunes = async (req, res) => {
  try {
    const communes = await communesUnifiedService.getBasRhinCommunes();
    res.json({ 
      success: true, 
      data: communes,
      count: communes.length,
      departement: '67'
    });
  } catch (error) {
    console.error('Erreur dans le controller communesUnified.getBasRhinCommunes:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors de la récupération des communes du Bas-Rhin',
      message: error.message
    });
  }
};

/**
 * Récupère les communes du Haut-Rhin (68)
 */
exports.getHautRhinCommunes = async (req, res) => {
  try {
    const communes = await communesUnifiedService.getHautRhinCommunes();
    res.json({ 
      success: true, 
      data: communes,
      count: communes.length,
      departement: '68'
    });
  } catch (error) {
    console.error('Erreur dans le controller communesUnified.getHautRhinCommunes:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors de la récupération des communes du Haut-Rhin',
      message: error.message
    });
  }
};

/**
 * Récupère les communes de l'Est (25, 70, 90)
 */
exports.getEstCommunes = async (req, res) => {
  try {
    const communes = await communesUnifiedService.getEstCommunes();
    res.json({ 
      success: true, 
      data: communes,
      count: communes.length,
      region: 'Est',
      departements: ['25', '70', '90']
    });
  } catch (error) {
    console.error('Erreur dans le controller communesUnified.getEstCommunes:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors de la récupération des communes de l\'Est',
      message: error.message
    });
  }
};

/**
 * Récupère les communes d'Alsace (67, 68)
 */
exports.getAlsaceCommunes = async (req, res) => {
  try {
    const communes = await communesUnifiedService.getAlsaceCommunes();
    res.json({ 
      success: true, 
      data: communes,
      count: communes.length,
      region: 'Alsace',
      departements: ['67', '68']
    });
  } catch (error) {
    console.error('Erreur dans le controller communesUnified.getAlsaceCommunes:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors de la récupération des communes d\'Alsace',
      message: error.message
    });
  }
};

/**
 * Récupère toutes les communes de tous les départements
 */
exports.getAllCommunes = async (req, res) => {
  try {
    const communes = await communesUnifiedService.getAllCommunes();
    res.json({ 
      success: true, 
      data: communes,
      count: communes.length,
      departements: ['25', '39', '67', '68', '70', '90']
    });
  } catch (error) {
    console.error('Erreur dans le controller communesUnified.getAllCommunes:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors de la récupération de toutes les communes',
      message: error.message
    });
  }
};

/**
 * Récupère les communes d'un département spécifique par son code
 */
exports.getCommunesByDepartement = async (req, res) => {
  try {
    const { deptCode } = req.params;
    
    if (!deptCode || !deptCode.match(/^(25|39|67|68|70|90)$/)) {
      return res.status(400).json({
        success: false,
        error: 'Code département invalide',
        message: 'Le code département doit être l\'un des suivants: 25, 39, 67, 68, 70, 90'
      });
    }
    
    const communes = await communesUnifiedService.getCommunesByDepartementCode(deptCode);
    res.json({ 
      success: true, 
      data: communes,
      count: communes.length,
      departement: deptCode
    });
  } catch (error) {
    console.error(`Erreur dans le controller communesUnified.getCommunesByDepartement:`, error.message);
    res.status(500).json({ 
      success: false, 
      error: `Erreur lors de la récupération des communes du département`,
      message: error.message
    });
  }
};

/**
 * Force le peuplement de tous les fichiers de cache des communes
 */
exports.populateAllCaches = async (req, res) => {
  try {
    const result = await communesUnifiedService.populateAllCaches();
    
    if (result.success) {
      res.json({
        success: true,
        message: "Tous les caches de communes ont été peuplés avec succès",
        stats: result.stats
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Le peuplement des caches a rencontré des erreurs",
        stats: result.stats,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Erreur dans le controller communesUnified.populateAllCaches:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors du peuplement des caches de communes',
      message: error.message
    });
  }
}; 