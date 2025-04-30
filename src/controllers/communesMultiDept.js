const communesMultiDeptService = require('../services/communesMultiDeptService');

/**
 * Récupère les communes du Doubs
 */
exports.getDoubsCommunes = async (req, res, next) => {
  try {
    const communes = await communesMultiDeptService.getDoubsCommunes();
    res.json(communes);
  } catch (error) {
    console.error('Erreur lors de la récupération des communes du Doubs:', error);
    next(error);
  }
};

/**
 * Récupère les communes de Haute-Saône
 */
exports.getHauteSaoneCommunes = async (req, res, next) => {
  try {
    const communes = await communesMultiDeptService.getHauteSaoneCommunes();
    res.json(communes);
  } catch (error) {
    console.error('Erreur lors de la récupération des communes de Haute-Saône:', error);
    next(error);
  }
};

/**
 * Récupère les communes du Territoire de Belfort
 */
exports.getTerritoireBelfortCommunes = async (req, res, next) => {
  try {
    const communes = await communesMultiDeptService.getTerritoireBelfortCommunes();
    res.json(communes);
  } catch (error) {
    console.error('Erreur lors de la récupération des communes du Territoire de Belfort:', error);
    next(error);
  }
};

/**
 * Récupère toutes les communes des trois départements
 */
exports.getAllCommunes = async (req, res, next) => {
  try {
    const communes = await communesMultiDeptService.getAllCommunes();
    res.json(communes);
  } catch (error) {
    console.error('Erreur lors de la récupération de toutes les communes:', error);
    next(error);
  }
}; 