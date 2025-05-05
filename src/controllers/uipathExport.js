// backend/src/controllers/uipathExport.js
exports.getArticlesForUiPath = async (req, res, next) => {
  try {
    // Données fictives pour les tests avec UiPath
    const exportData = [
      {
        "url": "https://www.leprogres.fr/economie/2023/10/20/comment-le-jura-est-devenu-la-silicon-valley-de-l-horlogerie",
        "source": "progres"
      },
      {
        "url": "https://www.leprogres.fr/societe/2023/10/18/ce-village-du-jura-qui-reinvente-l-energie-locale",
        "source": "progres"
      },
      {
        "url": "https://www.estrepublicain.fr/economie/2023/10/15/la-filiere-bois-du-jura-face-aux-defis-climatiques", 
        "source": "estrepublicain"
      },
      {
        "url": "https://www.leprogres.fr/jura/2023/09/25/le-parc-naturel-du-haut-jura-fete-ses-30-ans", 
        "source": "progres"
      },
      {
        "url": "https://www.estrepublicain.fr/culture/2023/10/05/les-festivals-de-musique-du-jura-se-preparent-pour-l-ete-prochain", 
        "source": "estrepublicain"
      }
    ];
    
    res.json(exportData);
  } catch (error) {
    console.error('Erreur lors de l\'export des articles pour UiPath:', error);
    next(error);
  }
}; 