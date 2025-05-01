const scraperLAlsace = require('../services/scraperLAlsace');

/**
 * Recherche des articles selon les critères fournis
 */
exports.searchArticles = async (req, res, next) => {
  try {
    const { keyword, startDate, endDate } = req.query;
    
    console.log('====== RECHERCHE D\'ARTICLES L\'ALSACE ======');
    console.log(`Mot-clé: "${keyword}"`);
    console.log(`Date de début: "${startDate || 'non spécifiée'}"`);
    console.log(`Date de fin: "${endDate || 'non spécifiée'}"`);
    
    // Validation des paramètres
    if (!keyword) {
      console.log('Erreur: Mot-clé manquant');
      return res.status(400).json({
        message: 'Le mot-clé est requis pour la recherche'
      });
    }
    
    // Vérification des formats de date
    if (startDate) {
      console.log(`Format de la date de début reçue: ${startDate}`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
        console.log(`Attention: La date de début ${startDate} n'est pas au format YYYY-MM-DD`);
      }
    }
    
    if (endDate) {
      console.log(`Format de la date de fin reçue: ${endDate}`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        console.log(`Attention: La date de fin ${endDate} n'est pas au format YYYY-MM-DD`);
      }
    }
    
    // Appel au service de scraping
    const articles = await scraperLAlsace.searchArticles({
      keyword,
      startDate,
      endDate
    });
    
    console.log(`Résultats: ${articles.length} articles trouvés`);
    
    // Affichage des dates des 5 premiers articles pour débogage
    if (articles.length > 0) {
      console.log('Échantillon des articles trouvés:');
      articles.slice(0, 5).forEach((article, index) => {
        console.log(`- Article ${index+1}: date=${article.date}, titre=${article.title}, départements=${article.departements ? article.departements.join(',') : 'non spécifiés'}`);
      });
    }
    
    res.json(articles);
  } catch (error) {
    console.error('Erreur lors de la recherche d\'articles dans L\'Alsace:', error);
    next(error);
  }
}; 