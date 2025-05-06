const searchController = require('../services/searchController');

/**
 * Recherche des articles dans tous les journaux avec streaming
 */
exports.searchAllArticlesStreaming = async (req, res) => {
  try {
    const { keyword, startDate, endDate } = req.query;
    
    console.log('====== RECHERCHE UNIFIÉE AVEC STREAMING ======');
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
    if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      console.log(`Attention: La date de début ${startDate} n'est pas au format YYYY-MM-DD`);
    }
    
    if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      console.log(`Attention: La date de fin ${endDate} n'est pas au format YYYY-MM-DD`);
    }
    
    // Configuration pour le Server-Sent Events (SSE)
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    
    // Fonction pour envoyer des événements SSE
    const sendEvent = (eventType, data) => {
      const event = `data: ${JSON.stringify({ type: eventType, ...data })}\n\n`;
      console.log(`Envoi d'un événement SSE: ${eventType}`);
      res.write(event);
    };
    
    // Message initial
    sendEvent('init', { message: 'Recherche démarrée' });
    
    // Compteurs
    let totalArticles = 0;
    let sourceProgress = {
      progres: 0,
      alsace: 0,
      estrepublicain: 0
    };
    
    // Vérifier périodiquement que la connexion est active
    const keepAliveInterval = setInterval(() => {
      console.log('Envoi d\'un keep-alive SSE');
      res.write(': keep-alive\n\n');
    }, 15000); // Envoyer un keep-alive toutes les 15 secondes
    
    // Écouter les événements d'articles trouvés
    const handleArticlesFound = (articles) => {
      if (!articles || articles.length === 0) return;
      
      const source = articles[0].sourceJournal;
      totalArticles += articles.length;
      sourceProgress[source] = (sourceProgress[source] || 0) + 1;
      
      console.log(`Envoi de ${articles.length} articles de ${source} au client (total: ${totalArticles})`);
      
      // Envoyer les articles au client
      sendEvent('articles', { 
        source: source,
        sourceName: articles[0].sourceName,
        count: articles.length,
        total: totalArticles,
        progress: sourceProgress,
        articles: articles 
      });
    };
    
    // Écouter l'événement de fin de recherche
    const handleCompletion = () => {
      console.log(`Recherche terminée: ${totalArticles} articles trouvés au total`);
      
      sendEvent('complete', { 
        message: 'Recherche terminée',
        total: totalArticles
      });
      
      // Arrêter le keep-alive
      clearInterval(keepAliveInterval);
      
      // Terminer la réponse
      res.end();
      
      // Supprimer les écouteurs d'événements pour éviter les fuites mémoire
      searchController.removeListener('articlesFound', handleArticlesFound);
      searchController.removeListener('allCompleted', handleCompletion);
    };
    
    // Ajouter les écouteurs d'événements
    searchController.on('articlesFound', handleArticlesFound);
    searchController.on('allCompleted', handleCompletion);
    
    // Gérer la déconnexion du client
    req.on('close', () => {
      console.log('Client déconnecté, nettoyage des écouteurs');
      clearInterval(keepAliveInterval);
      searchController.removeListener('articlesFound', handleArticlesFound);
      searchController.removeListener('allCompleted', handleCompletion);
    });
    
    // Lancer la recherche parallèle
    searchController.searchAllNewspapers({
      keyword,
      startDate,
      endDate
    });
    
  } catch (error) {
    console.error('Erreur lors de la recherche d\'articles unifiée:', error);
    
    // Si les en-têtes n'ont pas encore été envoyés, envoyer une réponse JSON d'erreur
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      // Sinon, envoyer l'erreur dans le flux SSE
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
      res.end();
    }
  }
};

/**
 * Recherche des articles dans tous les journaux avec réponse standard JSON
 */
exports.searchAllArticles = async (req, res) => {
  try {
    const { keyword, startDate, endDate } = req.query;
    
    console.log('====== RECHERCHE UNIFIÉE ======');
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
    
    // Lancer la recherche et attendre tous les résultats
    const articles = await searchController.searchAllNewspapers({
      keyword,
      startDate,
      endDate
    });
    
    console.log(`Recherche terminée: ${articles.length} articles trouvés au total`);
    
    // Renvoyer tous les résultats en une fois
    res.json(articles);
    
  } catch (error) {
    console.error('Erreur lors de la recherche d\'articles unifiée:', error);
    res.status(500).json({ error: error.message });
  }
}; 