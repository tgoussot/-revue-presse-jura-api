const axios = require('axios');

// Configuration
const JURA_CODE = "39"; // Code du département du Jura
const API_URL = `https://geo.api.gouv.fr/departements/${JURA_CODE}/communes`;

// Cache pour éviter des appels répétés à l'API
let communesCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 heures en millisecondes

/**
 * Récupère la liste des communes du Jura
 */
exports.getJuraCommunes = async () => {
  // Vérifier si le cache est valide
  const now = Date.now();
  if (communesCache && cacheTimestamp && (now - cacheTimestamp < CACHE_DURATION)) {
    return communesCache;
  }
  
  try {
    // Appeler l'API pour récupérer les communes
    const response = await axios.get(API_URL);
    
    if (!response.data || !Array.isArray(response.data)) {
      throw new Error('Format de réponse incorrect de l\'API des communes');
    }
    
    // Extraire les noms des communes
    const communes = response.data.map(commune => commune.nom);
    
    // Ajouter "Jura" et d'autres communes importantes à la liste
    // pour être certain qu'elles sont toujours disponibles
    const communesImportantes = [
      "Jura", "Jura Nord", "Jura Sud", "Haut-Jura", "Haut Jura", "39"
    ];
    
    // Ajouter les communes importantes si elles ne sont pas déjà présentes
    for (const commune of communesImportantes) {
      if (!communes.includes(commune)) {
        communes.push(commune);
      }
    }
    
    // Mettre à jour le cache
    communesCache = communes;
    cacheTimestamp = now;
    
    return communes;
  } catch (error) {
    console.error('Erreur lors de la récupération des communes du Jura:', error.message);
    
    // En cas d'erreur, retourner au moins les communes importantes
    return [
      "Jura", "Jura Nord", "Jura Sud", "Haut-Jura", "Haut Jura", "39",
    ];
  }
}; 