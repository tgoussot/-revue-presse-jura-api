const communesJuraService = require('./communesJuraService');
const communesEstService = require('./communesEstService');
const communesAlsaceService = require('./communesAlsaceService');

/**
 * Service unifié pour l'accès aux communes de tous les départements gérés par l'application
 */

/**
 * Obtenir les communes du Jura (39)
 */
const getJuraCommunes = async () => {
  return await communesJuraService.getJuraCommunes();
};

/**
 * Obtenir les communes du Doubs (25)
 */
const getDoubsCommunes = async () => {
  return await communesEstService.getCommunesByDepartement('25');
};

/**
 * Obtenir les communes de la Haute-Saône (70)
 */
const getHauteSaoneCommunes = async () => {
  return await communesEstService.getCommunesByDepartement('70');
};

/**
 * Obtenir les communes du Territoire de Belfort (90)
 */
const getTerritoireBelfortCommunes = async () => {
  return await communesEstService.getCommunesByDepartement('90');
};

/**
 * Obtenir les communes du Bas-Rhin (67)
 */
const getBasRhinCommunes = async () => {
  return await communesAlsaceService.getCommunesByDepartement('67');
};

/**
 * Obtenir les communes du Haut-Rhin (68)
 */
const getHautRhinCommunes = async () => {
  return await communesAlsaceService.getCommunesByDepartement('68');
};

/**
 * Obtenir les communes des départements de l'Est (25, 70, 90)
 */
const getEstCommunes = async () => {
  return await communesEstService.getAllCommunes();
};

/**
 * Obtenir les communes d'Alsace (67, 68)
 */
const getAlsaceCommunes = async () => {
  return await communesAlsaceService.getAllCommunes();
};

/**
 * Obtenir toutes les communes de tous les départements
 */
const getAllCommunes = async () => {
  try {
    // Récupérer les communes de chaque région
    const juraCommunes = await getJuraCommunes();
    const estCommunes = await getEstCommunes();
    const alsaceCommunes = await getAlsaceCommunes();
    
    // Combiner toutes les communes et éliminer les doublons
    const allCommunes = [...new Set([...juraCommunes, ...estCommunes, ...alsaceCommunes])];
    
    // Ajouter des termes généraux qui pourraient être utiles pour la recherche
    const termesGeneraux = ["France", "Grand Est", "Bourgogne-Franche-Comté"];
    for (const terme of termesGeneraux) {
      if (!allCommunes.includes(terme)) {
        allCommunes.push(terme);
      }
    }
    
    return allCommunes;
  } catch (error) {
    console.error('Erreur lors de la récupération de toutes les communes:', error.message);
    return [];
  }
};

/**
 * Obtenir les communes par code de département
 */
const getCommunesByDepartementCode = async (deptCode) => {
  switch(deptCode) {
    case '25':
      return await getDoubsCommunes();
    case '39':
      return await getJuraCommunes();
    case '67':
      return await getBasRhinCommunes();
    case '68':
      return await getHautRhinCommunes();
    case '70':
      return await getHauteSaoneCommunes();
    case '90':
      return await getTerritoireBelfortCommunes();
    default:
      throw new Error(`Code département non supporté: ${deptCode}`);
  }
};

/**
 * Force le peuplement de tous les fichiers de cache des communes
 * @returns {Object} Statistiques sur les fichiers générés
 */
const populateAllCaches = async () => {
  const stats = {
    generated: [],
    errors: [],
    totalCommunes: 0
  };

  try {
    // Forcer la génération du cache pour le Jura
    try {
      const communes = await communesJuraService.getJuraCommunes();
      stats.generated.push('39');
      stats.totalCommunes += communes.length;
    } catch (error) {
      stats.errors.push({ dept: '39', error: error.message });
    }

    // Forcer la génération du cache pour les départements de l'Est
    try {
      // Force la génération individuelle des départements
      await communesEstService.getCommunesByDepartement('25');
      stats.generated.push('25');
      
      await communesEstService.getCommunesByDepartement('70');
      stats.generated.push('70');
      
      await communesEstService.getCommunesByDepartement('90');
      stats.generated.push('90');
      
      // Force la génération du cache global de l'Est
      const estCommunes = await communesEstService.getAllCommunes();
      stats.totalCommunes += estCommunes.length;
    } catch (error) {
      stats.errors.push({ dept: 'est', error: error.message });
    }

    // Forcer la génération du cache pour l'Alsace
    try {
      // Force la génération individuelle des départements
      await communesAlsaceService.getCommunesByDepartement('67');
      stats.generated.push('67');
      
      await communesAlsaceService.getCommunesByDepartement('68');
      stats.generated.push('68');
      
      // Force la génération du cache global de l'Alsace
      const alsaceCommunes = await communesAlsaceService.getAllCommunes();
      stats.totalCommunes += alsaceCommunes.length;
    } catch (error) {
      stats.errors.push({ dept: 'alsace', error: error.message });
    }

    // Forcer la récupération de toutes les communes pour s'assurer que les caches sont à jour
    const allCommunes = await getAllCommunes();
    
    return {
      success: true,
      stats: {
        ...stats,
        uniqueCommunes: allCommunes.length
      }
    };
  } catch (error) {
    console.error('Erreur lors du peuplement des caches:', error.message);
    return {
      success: false,
      error: error.message,
      stats
    };
  }
};

module.exports = {
  getJuraCommunes,
  getDoubsCommunes,
  getHauteSaoneCommunes,
  getTerritoireBelfortCommunes,
  getBasRhinCommunes,
  getHautRhinCommunes,
  getEstCommunes,
  getAlsaceCommunes,
  getAllCommunes,
  getCommunesByDepartementCode,
  populateAllCaches
}; 