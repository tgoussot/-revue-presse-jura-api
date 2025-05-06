const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// Chemins des fichiers de cache
const DOUBS_CACHE_FILE = path.join(__dirname, '../data/communes_25.json');
const HAUTE_SAONE_CACHE_FILE = path.join(__dirname, '../data/communes_70.json');
const TERRITOIRE_BELFORT_CACHE_FILE = path.join(__dirname, '../data/communes_90.json');
const ALL_COMMUNES_CACHE_FILE = path.join(__dirname, '../data/communes_est.json');

// API Geo pour récupérer les communes
const API_GEO_URL = 'https://geo.api.gouv.fr/departements';

// Codes des départements
const DOUBS_CODE = "25";
const HAUTE_SAONE_CODE = "70";
const TERRITOIRE_BELFORT_CODE = "90";

/**
 * Récupère les communes d'un département
 */
async function getCommunesByDepartement(deptCode) {
  // Vérifier si le code département est valide
  if (deptCode !== DOUBS_CODE && deptCode !== HAUTE_SAONE_CODE && deptCode !== TERRITOIRE_BELFORT_CODE) {
    throw new Error(`Code département non supporté: ${deptCode}. Ce service gère uniquement les départements 25, 70 et 90.`);
  }

  // Choisir le fichier de cache approprié
  let cacheFile;
  switch(deptCode) {
    case DOUBS_CODE:
      cacheFile = DOUBS_CACHE_FILE;
      break;
    case HAUTE_SAONE_CODE:
      cacheFile = HAUTE_SAONE_CACHE_FILE;
      break;
    case TERRITOIRE_BELFORT_CODE:
      cacheFile = TERRITOIRE_BELFORT_CACHE_FILE;
      break;
  }
  
  try {
    // Essayer de lire depuis le cache
    const cacheData = await fs.readFile(cacheFile, 'utf8');
    const cachedCommunes = JSON.parse(cacheData);
    console.log(`Récupération des communes du département ${deptCode} depuis le cache (${cachedCommunes.length} communes)`);
    return cachedCommunes;
  } catch (error) {
    // Si le cache n'existe pas ou est corrompu, récupérer depuis l'API
    console.log(`Cache non disponible pour le département ${deptCode}, interrogation de l'API Geo`);
    
    try {
      // Créer le répertoire data s'il n'existe pas
      const dataDir = path.dirname(cacheFile);
      await fs.mkdir(dataDir, { recursive: true });
      
      // Récupérer les communes depuis l'API
      const response = await axios.get(`${API_GEO_URL}/${deptCode}/communes`);
      const communes = response.data.map(commune => commune.nom);
      
      // Ajouter des noms de régions ou zones importantes
      if (deptCode === DOUBS_CODE) {
        // Ajouter termes pour le Doubs
        const termes = ["Doubs", "25", "Besançon", "Montbéliard", "Pontarlier", "Morteau"];
        communes.push(...termes);
      } else if (deptCode === HAUTE_SAONE_CODE) {
        // Ajouter termes pour la Haute-Saône
        const termes = ["Haute-Saône", "Haute Saône", "70", "Vesoul", "Gray", "Luxeuil-les-Bains", "Lure"];
        communes.push(...termes);
      } else if (deptCode === TERRITOIRE_BELFORT_CODE) {
        // Ajouter termes pour le Territoire de Belfort
        const termes = ["Territoire de Belfort", "90", "Belfort", "Delle", "Giromagny"];
        communes.push(...termes);
      }
      
      // Sauvegarder dans le cache
      await fs.writeFile(cacheFile, JSON.stringify(communes, null, 2));
      
      console.log(`${communes.length} communes récupérées pour le département ${deptCode} et mises en cache`);
      return communes;
    } catch (apiError) {
      console.error(`Erreur lors de la récupération des communes du département ${deptCode}:`, apiError.message);
      
      // En cas d'erreur, retourner un tableau vide
      return [];
    }
  }
}

/**
 * Récupère toutes les communes des trois départements
 */
async function getAllCommunes() {
  try {
    // Essayer de lire depuis le cache global
    const cacheData = await fs.readFile(ALL_COMMUNES_CACHE_FILE, 'utf8');
    const cachedCommunes = JSON.parse(cacheData);
    console.log(`Récupération de toutes les communes de l'Est depuis le cache (${cachedCommunes.length} communes)`);
    return cachedCommunes;
  } catch (error) {
    // Si le cache n'existe pas, combiner les communes des départements individuels
    const doubsCommunes = await getCommunesByDepartement(DOUBS_CODE);
    const hauteSaoneCommunes = await getCommunesByDepartement(HAUTE_SAONE_CODE);
    const territoireBelfortCommunes = await getCommunesByDepartement(TERRITOIRE_BELFORT_CODE);
    
    // Combiner et dédupliquer les communes
    const allCommunes = [...new Set([...doubsCommunes, ...hauteSaoneCommunes, ...territoireBelfortCommunes])];
    
    // Ajouter les termes régionaux s'ils ne sont pas déjà présents
    const termesRegionaux = ["Franche-Comté", "Franche Comté", "Grand Est"];
    for (const terme of termesRegionaux) {
      if (!allCommunes.includes(terme)) {
        allCommunes.push(terme);
      }
    }
    
    // Sauvegarder dans le cache global
    try {
      await fs.writeFile(ALL_COMMUNES_CACHE_FILE, JSON.stringify(allCommunes, null, 2));
    } catch (writeError) {
      console.error('Erreur lors de l\'écriture du cache global:', writeError.message);
    }
    
    console.log(`${allCommunes.length} communes combinées des trois départements de l'Est`);
    return allCommunes;
  }
}

/**
 * Récupère les communes pour une liste de départements de l'Est
 */
async function getCommunesByDepartements(deptCodes) {
  if (!Array.isArray(deptCodes) || deptCodes.length === 0) {
    return [];
  }
  
  // Filtrer pour ne garder que les codes 25, 70 et 90
  const validCodes = deptCodes.filter(code => [DOUBS_CODE, HAUTE_SAONE_CODE, TERRITOIRE_BELFORT_CODE].includes(code));
  
  if (validCodes.length === 0) {
    console.warn('Aucun code département valide fourni (seuls 25, 70 et 90 sont acceptés)');
    return [];
  }
  
  // Si les trois départements sont requis, utiliser getAllCommunes
  if (validCodes.length === 3 && 
      validCodes.includes(DOUBS_CODE) && 
      validCodes.includes(HAUTE_SAONE_CODE) && 
      validCodes.includes(TERRITOIRE_BELFORT_CODE)) {
    return await getAllCommunes();
  }
  
  // Sinon, récupérer département par département
  const communesPromises = validCodes.map(code => getCommunesByDepartement(code));
  const communesArrays = await Promise.all(communesPromises);
  
  // Aplatir le tableau de tableaux et dédupliquer
  return [...new Set(communesArrays.flat())];
}

module.exports = {
  getCommunesByDepartement,
  getCommunesByDepartements,
  getAllCommunes
}; 