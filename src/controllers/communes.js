const communesService = require('../services/communesService');

/**
 * Récupère la liste des communes du Jura
 */
exports.getJuraCommunes = async (req, res, next) => {
  try {
    const communes = await communesService.getJuraCommunes();
    res.json(communes);
  } catch (error) {
    console.error('Erreur lors de la récupération des communes:', error);
    next(error);
  }
}; 