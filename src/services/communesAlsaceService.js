const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// Chemins des fichiers de cache
const BAS_RHIN_CACHE_FILE = path.join(__dirname, '../data/communes_67.json');
const HAUT_RHIN_CACHE_FILE = path.join(__dirname, '../data/communes_68.json');
const ALL_COMMUNES_CACHE_FILE = path.join(__dirname, '../data/communes_alsace.json');

// API Geo pour récupérer les communes
const API_GEO_URL = 'https://geo.api.gouv.fr/departements';

/**
 * Récupère les communes d'un département
 */
async function getCommunesByDepartement(deptCode) {
  // Vérifier si le code département est valide
  if (deptCode !== '67' && deptCode !== '68') {
    throw new Error(`Code département non supporté: ${deptCode}. Ce service gère uniquement les départements 67 et 68.`);
  }

  // Choisir le fichier de cache approprié
  const cacheFile = deptCode === '67' ? BAS_RHIN_CACHE_FILE : HAUT_RHIN_CACHE_FILE;
  
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
      if (deptCode === '67') {
        // Ajouter termes pour le Bas-Rhin
        const termes = ['Bas-Rhin', 'Nord Alsace', '67'];
        communes.push(...termes);
      } else if (deptCode === '68') {
        // Ajouter termes pour le Haut-Rhin
        const termes = ['Haut-Rhin', 'Sud Alsace', '68'];
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
 * Récupère toutes les communes d'Alsace (67 et 68)
 */
async function getAllCommunes() {
  try {
    // Essayer de lire depuis le cache global
    const cacheData = await fs.readFile(ALL_COMMUNES_CACHE_FILE, 'utf8');
    const cachedCommunes = JSON.parse(cacheData);
    console.log(`Récupération de toutes les communes d'Alsace depuis le cache (${cachedCommunes.length} communes)`);
    return cachedCommunes;
  } catch (error) {
    // Si le cache n'existe pas, combiner les communes des départements individuels
    const basRhinCommunes = await getCommunesByDepartement('67');
    const hautRhinCommunes = await getCommunesByDepartement('68');
    
    // Combiner et dédupliquer les communes
    const allCommunes = [...new Set([...basRhinCommunes, ...hautRhinCommunes])];
    
    // Ajouter le terme "Alsace" et "Grand Est" s'ils ne sont pas déjà présents
    if (!allCommunes.includes('Alsace')) allCommunes.push('Alsace');
    if (!allCommunes.includes('Grand Est')) allCommunes.push('Grand Est');
    
    // Sauvegarder dans le cache global
    try {
      await fs.writeFile(ALL_COMMUNES_CACHE_FILE, JSON.stringify(allCommunes, null, 2));
    } catch (writeError) {
      console.error('Erreur lors de l\'écriture du cache global:', writeError.message);
    }
    
    console.log(`${allCommunes.length} communes combinées des deux départements alsaciens`);
    return allCommunes;
  }
}

/**
 * Récupère les communes pour une liste de départements alsaciens
 */
async function getCommunesByDepartements(deptCodes) {
  if (!Array.isArray(deptCodes) || deptCodes.length === 0) {
    return [];
  }
  
  // Filtrer pour ne garder que les codes 67 et 68
  const validCodes = deptCodes.filter(code => code === '67' || code === '68');
  
  if (validCodes.length === 0) {
    console.warn('Aucun code département valide fourni (seuls 67 et 68 sont acceptés)');
    return [];
  }
  
  // Si les deux départements sont requis, utiliser getAllCommunes
  if (validCodes.includes('67') && validCodes.includes('68') && validCodes.length === 2) {
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