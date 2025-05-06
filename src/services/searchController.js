const { EventEmitter } = require('events');
const scraperLeProgres = require('./scraperLeProgres');
const scraperLAlsace = require('./scraperLAlsace');
const scraperEstRepublicain = require('./scraperEstRepublicain');

class SearchController extends EventEmitter {
  constructor() {
    super();
    this.results = [];
    this.completedSources = 0;
    this.totalSources = 3;
  }

  async searchAllNewspapers(params) {
    this.results = [];
    this.completedSources = 0;
    
    // Lancer les 3 recherches en parallèle
    this._searchNewspaper('progres', scraperLeProgres, params);
    this._searchNewspaper('alsace', scraperLAlsace, params);
    this._searchNewspaper('estrepublicain', scraperEstRepublicain, params);
    
    // Promise qui se résout à la fin de toutes les recherches
    return new Promise((resolve) => {
      this.on('allCompleted', () => {
        // Trier les résultats par date décroissante
        this.results.sort((a, b) => new Date(b.date) - new Date(a.date));
        resolve(this.results);
      });
    });
  }

  _searchNewspaper(sourceName, scraper, params) {
    // Étendre le scraper pour qu'il utilise les événements
    const emitter = new EventEmitter();
    
    // Écouter les événements du scraper
    emitter.on('articlesFound', (articles) => {
      // Ajouter la source et émettre vers le client
      const sourcedArticles = articles.map(article => ({
        ...article,
        sourceJournal: sourceName,
        sourceName: this._getSourceDisplayName(sourceName)
      }));
      
      this.results.push(...sourcedArticles);
      this.emit('articlesFound', sourcedArticles);
    });
    
    // Lancer la recherche avec l'émetteur
    scraper.searchArticles(params, emitter)
      .then(() => {
        this.completedSources++;
        if (this.completedSources === this.totalSources) {
          this.emit('allCompleted');
        }
      })
      .catch(error => {
        console.error(`Erreur lors de la recherche dans ${sourceName}:`, error);
        this.completedSources++;
        if (this.completedSources === this.totalSources) {
          this.emit('allCompleted');
        }
      });
  }

  _getSourceDisplayName(source) {
    switch(source) {
      case 'progres': return 'Le Progrès';
      case 'alsace': return 'L\'Alsace';
      case 'estrepublicain': return 'L\'Est Républicain';
      default: return source;
    }
  }
}

module.exports = new SearchController(); 