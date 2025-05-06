const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// Chemin du fichier de cache
const JURA_CACHE_FILE = path.join(__dirname, '../data/communes_39.json');

// API Geo pour récupérer les communes
const API_GEO_URL = 'https://geo.api.gouv.fr/departements';

// Code du département du Jura
const JURA_CODE = "39";

/**
 * Récupère les communes du Jura
 */
async function getJuraCommunes() {
  try {
    // Essayer de lire depuis le cache
    const cacheData = await fs.readFile(JURA_CACHE_FILE, 'utf8');
    const cachedCommunes = JSON.parse(cacheData);
    console.log(`Récupération des communes du Jura depuis le cache (${cachedCommunes.length} communes)`);
    return cachedCommunes;
  } catch (error) {
    // Si le cache n'existe pas ou est corrompu, récupérer depuis l'API
    console.log(`Cache non disponible pour le Jura, interrogation de l'API Geo`);
    
    try {
      // Créer le répertoire data s'il n'existe pas
      const dataDir = path.dirname(JURA_CACHE_FILE);
      await fs.mkdir(dataDir, { recursive: true });
      
      // Récupérer les communes depuis l'API
      const response = await axios.get(`${API_GEO_URL}/${JURA_CODE}/communes`);
      const communes = response.data.map(commune => commune.nom);
      
      // Ajouter des noms de régions ou zones importantes
      const termesImportants = [
        "Jura", "Jura Nord", "Jura Sud", "Haut-Jura", "Haut Jura", "39"
      ];
      
      // Ajouter les termes importants s'ils ne sont pas déjà présents
      for (const terme of termesImportants) {
        if (!communes.includes(terme)) {
          communes.push(terme);
        }
      }
      
      // Sauvegarder dans le cache
      await fs.writeFile(JURA_CACHE_FILE, JSON.stringify(communes, null, 2));
      
      console.log(`${communes.length} communes récupérées pour le Jura et mises en cache`);
      return communes;
    } catch (apiError) {
      console.error(`Erreur lors de la récupération des communes du Jura:`, apiError.message);
      
      // En cas d'erreur, retourner au moins les communes importantes
      const communesImportantes = [
        "Jura", "Jura Nord", "Jura Sud", "Haut-Jura", "Haut Jura", "39",
        "Lons-le-Saunier", "Dole", "Saint-Claude", "Champagnole", "Morez", 
        "Poligny", "Arbois", "Salins-les-Bains"
      ];
      
      return communesImportantes;
    }
  }
}

module.exports = {
  getJuraCommunes
}; 