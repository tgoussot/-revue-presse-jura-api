const axios = require('axios');

// Configuration
const DOUBS_CODE = "25"; // Code du département du Doubs
const HAUTE_SAONE_CODE = "70"; // Code du département de la Haute-Saône
const TERRITOIRE_BELFORT_CODE = "90"; // Code du département du Territoire de Belfort

// Cache pour éviter des appels répétés à l'API
let communesDoubsCache = null;
let communesHauteSaoneCache = null;
let communesTerritoireBelfortCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 heures en millisecondes

/**
 * Récupère la liste des communes d'un département spécifique
 */
async function getCommunesByDepartement(deptCode) {
  const API_URL = `https://geo.api.gouv.fr/departements/${deptCode}/communes`;
  
  try {
    // Appeler l'API pour récupérer les communes
    const response = await axios.get(API_URL);
    
    if (!response.data || !Array.isArray(response.data)) {
      throw new Error(`Format de réponse incorrect de l'API des communes pour le département ${deptCode}`);
    }
    
    // Extraire les noms des communes
    return response.data.map(commune => commune.nom);
  } catch (error) {
    console.error(`Erreur lors de la récupération des communes du département ${deptCode}:`, error.message);
    return [];
  }
}

/**
 * Récupère la liste des communes du Doubs
 */
exports.getDoubsCommunes = async () => {
  // Vérifier si le cache est valide
  const now = Date.now();
  if (communesDoubsCache && cacheTimestamp && (now - cacheTimestamp < CACHE_DURATION)) {
    return communesDoubsCache;
  }
  
  // Récupérer les communes du Doubs
  const communes = await getCommunesByDepartement(DOUBS_CODE);
  
  // Ajouter "Doubs" et d'autres termes importants à la liste
  const termesImportants = [
    "Doubs", "25", "Besançon", "Montbéliard", "Pontarlier", "Morteau"
  ];
  
  // Ajouter les termes importants s'ils ne sont pas déjà présents
  for (const terme of termesImportants) {
    if (!communes.includes(terme)) {
      communes.push(terme);
    }
  }
  
  // Mettre à jour le cache
  communesDoubsCache = communes;
  cacheTimestamp = now;
  
  return communes;
};

/**
 * Récupère la liste des communes de la Haute-Saône
 */
exports.getHauteSaoneCommunes = async () => {
  // Vérifier si le cache est valide
  const now = Date.now();
  if (communesHauteSaoneCache && cacheTimestamp && (now - cacheTimestamp < CACHE_DURATION)) {
    return communesHauteSaoneCache;
  }
  
  // Récupérer les communes de la Haute-Saône
  const communes = await getCommunesByDepartement(HAUTE_SAONE_CODE);
  
  // Ajouter "Haute-Saône" et d'autres termes importants à la liste
  const termesImportants = [
    "Haute-Saône", "Haute Saône", "70", "Vesoul", "Gray", "Luxeuil-les-Bains", "Lure"
  ];
  
  // Ajouter les termes importants s'ils ne sont pas déjà présents
  for (const terme of termesImportants) {
    if (!communes.includes(terme)) {
      communes.push(terme);
    }
  }
  
  // Mettre à jour le cache
  communesHauteSaoneCache = communes;
  cacheTimestamp = now;
  
  return communes;
};

/**
 * Récupère la liste des communes du Territoire de Belfort
 */
exports.getTerritoireBelfortCommunes = async () => {
  // Vérifier si le cache est valide
  const now = Date.now();
  if (communesTerritoireBelfortCache && cacheTimestamp && (now - cacheTimestamp < CACHE_DURATION)) {
    return communesTerritoireBelfortCache;
  }
  
  // Récupérer les communes du Territoire de Belfort
  const communes = await getCommunesByDepartement(TERRITOIRE_BELFORT_CODE);
  
  // Ajouter "Territoire de Belfort" et d'autres termes importants à la liste
  const termesImportants = [
    "Territoire de Belfort", "Territoire-de-Belfort", "90", "Belfort", "Delle", "Giromagny"
  ];
  
  // Ajouter les termes importants s'ils ne sont pas déjà présents
  for (const terme of termesImportants) {
    if (!communes.includes(terme)) {
      communes.push(terme);
    }
  }
  
  // Mettre à jour le cache
  communesTerritoireBelfortCache = communes;
  cacheTimestamp = now;
  
  return communes;
};

/**
 * Récupère la liste de toutes les communes des trois départements
 */
exports.getAllCommunes = async () => {
  const doubsCommunes = await exports.getDoubsCommunes();
  const hauteSaoneCommunes = await exports.getHauteSaoneCommunes();
  const territoireBelfortCommunes = await exports.getTerritoireBelfortCommunes();
  
  // Combiner les trois listes sans doublons
  return [...new Set([...doubsCommunes, ...hauteSaoneCommunes, ...territoireBelfortCommunes])];
}; 