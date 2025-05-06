const axios = require('axios');
const cheerio = require('cheerio');
const communesEstService = require('./communesEstService');
const { cleanHtml, generateHash } = require('../utils/stringUtils');
const { dateInRange } = require('../utils/dateUtils');

// Configuration
const DOUBS_CODE = "25"; // Code du département du Doubs
const HAUTE_SAONE_CODE = "70"; // Code du département de la Haute-Saône
const TERRITOIRE_BELFORT_CODE = "90"; // Code du département du Territoire de Belfort
const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const BATCH_SIZE = 2; // Nombre de liens à traiter en parallèle
const MAX_RETRIES = 3; // Nombre maximum de tentatives en cas d'erreur

// Rotation de User-Agents pour paraître plus naturel
const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36 Edg/115.0.1901.188",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
];

/**
 * Fonction pour obtenir des headers HTTP réalistes
 */
const getRandomHeaders = (url) => {
  const hostname = new URL(url).hostname;
  const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  
  return {
    'User-Agent': userAgent,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cache-Control': 'max-age=0',
    'Connection': 'keep-alive',
    'Host': hostname,
    'Referer': `https://${hostname}/`,
    'sec-ch-ua': '"Not.A/Brand";v="8", "Chromium";v="115", "Google Chrome";v="115"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1'
  };
};

/**
 * Effectue une requête HTTP avec retry et backoff exponentiel
 */
const fetchWithRetry = async (url, options = {}, retries = MAX_RETRIES) => {
  try {
    // Obtenir des headers réalistes
    const headers = getRandomHeaders(url);
    
    // Effectuer la requête
    const response = await axios.get(url, { 
      ...options, 
      headers: { ...headers, ...options.headers },
      timeout: 10000 // Ajouter un timeout de 10 secondes
    });
    
    return response;
  } catch (error) {
    if (retries <= 0) {
      throw error;
    }
    
    // Si erreur 429 (Too Many Requests) ou 503 (Service Unavailable)
    const status = error.response ? error.response.status : 0;
    
    if (status === 429 || status === 503) {
      // Calculer un temps d'attente exponentiel (1s, 2s, 4s)
      const waitTime = Math.pow(2, MAX_RETRIES - retries) * 1000;
      console.log(`Erreur ${status} pour ${url}. Nouvelle tentative dans ${waitTime/1000}s (${retries} restantes)`);
      
      // Attendre avant de réessayer
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Réessayer
      return fetchWithRetry(url, options, retries - 1);
    }
    
    // Pour les autres erreurs, on les propage
    throw error;
  }
};

/**
 * Extrait les métadonnées d'un article
 */
const extractArticleMetadata = ($, article) => {
  const metadata = {
    id: '',
    url: '',
    headline: '',
    title: '',
    description: '',
    date: '',
  };
  
  // Extraire l'URL
  const urlElement = $(article).find('a[href]').first();
  if (urlElement.length) {
    let url = urlElement.attr('href');
    
    // Construire l'URL complète
    if (url && !url.startsWith('http')) {
      if (!url.startsWith('/')) {
        url = '/' + url;
      }
      url = 'https://www.estrepublicain.fr' + url;
    }
    
    metadata.url = url;
    // Générer un ID unique basé sur l'URL
    metadata.id = generateHash(url);
  }
  
  // Extraction du headline - utilisation directe du sélecteur CSS exact
  const headlineElement = $(article).find('span.headline');
  if (headlineElement.length) {
    metadata.headline = headlineElement.text().trim();
    console.log(`Headline extrait: "${metadata.headline}"`);
  } else {
    console.log("Pas de headline trouvé dans cet article");
  }
  
  // Extraire le titre depuis le HTML
  // Essayer d'abord h2 avec flagPaid
  const titleElement = $(article).find('h2:has(span.flagPaid)');
  if (titleElement.length) {
    // Enlever la balise flagPaid pour n'avoir que le texte du titre
    metadata.title = titleElement.clone()
      .find('span.flagPaid').remove().end()
      .text().trim();
    console.log(`Titre extrait du h2 avec flagPaid: "${metadata.title}"`);
  }
  
  // Si pas de titre trouvé, essayer avec n'importe quel h2
  if (!metadata.title || metadata.title.length < 5) {
    const h2Element = $(article).find('h2');
    if (h2Element.length) {
      metadata.title = h2Element.text().trim()
        .replace(/^\s*\S+\s+/, ''); // Enlever le premier mot (souvent le headline)
      console.log(`Titre extrait du h2: "${metadata.title}"`);
    }
  }
  
  // Si toujours pas de titre, extraire depuis l'URL
  if (!metadata.title || metadata.title.length < 5) {
    if (metadata.url) {
      // Extraire la dernière partie de l'URL qui contient généralement le titre
      const urlParts = metadata.url.split('/');
      const lastPart = urlParts[urlParts.length - 1];
      const urlTitle = lastPart
        .replace('.html', '')
        .replace(/-/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
      
      if (urlTitle && urlTitle.length > 5) {
        metadata.title = urlTitle;
        console.log(`Titre extrait de l'URL: "${metadata.title}"`);
      }
    }
  }
  
  // Nettoyer le titre des éventuels "Premium" ou "Abonnés" qu'il pourrait contenir
  if (metadata.title) {
    metadata.title = metadata.title
      .replace(/premium/i, '')
      .replace(/abonnés/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  // Extraire la description
  const descElement = $(article).find('span.desc');
  if (descElement.length) {
    metadata.description = descElement.text().trim();
  }
  
  // Extraire la date (sera complétée lors de la récupération de l'article complet)
  const dateElement = $(article).find('span.publish');
  if (dateElement.length) {
    const publishDate = dateElement.text().trim();
    metadata.date = publishDate;
  }
  
  return metadata;
};

/**
 * Vérifie si un article est lié à l'un des trois départements
 */
const isArticleRelatedToDepartements = async (metadata) => {
  // Liste des régions principales à vérifier directement dans le headline
  const mainPlaces = [
    "Doubs", "Haute-Saône", "Haute Saône", "Territoire de Belfort", 
    "25", "70", "90", "Franche-Comté", "Franche Comté"
  ];
  
  // Liste des principales villes à vérifier
  const mainCities = [
    "Besançon", "Montbéliard", "Pontarlier", "Morteau", // Doubs
    "Vesoul", "Gray", "Luxeuil-les-Bains", "Lure", // Haute-Saône
    "Belfort", "Delle", "Giromagny" // Territoire de Belfort
  ];
  
  // Liste des thèmes d'intérêt à vérifier dans le headline
  const themesOfInterest = [
    "Énergie", "Energie", "Vie quotidienne", "Social"
  ];
  
  // 1. Vérifier si le headline contient explicitement une région/département
  if (metadata.headline) {
    for (const place of mainPlaces) {
      if (metadata.headline.includes(place)) {
        console.log(`Article trouvé: headline contient "${place}" (région/département)`);
        return true;
      }
    }
    
    // 1.b Vérifier si le headline contient une ville principale
    for (const city of mainCities) {
      if (metadata.headline.includes(city)) {
        console.log(`Article trouvé: headline contient "${city}" (ville principale)`);
        return true;
      }
    }
    
    // 1.c Vérifier si le headline contient un des thèmes d'intérêt
    for (const theme of themesOfInterest) {
      if (metadata.headline.includes(theme)) {
        console.log(`Article d'intérêt trouvé: headline contient "${theme}" (thème d'intérêt)`);
        return true;
      }
    }
  } else {
    console.log("Pas de headline disponible pour vérifier la région");
    return false; // Si pas de headline, on rejette l'article
  }
  
  // 2. Si pas trouvé dans le headline, vérifier les communes des trois départements dans le headline
  if (metadata.headline) {
    // Récupérer la liste des communes des trois départements
    const communes = await communesEstService.getCommunesByDepartements([DOUBS_CODE, HAUTE_SAONE_CODE, TERRITOIRE_BELFORT_CODE]);
    
    // Vérifier d'abord si le headline correspond exactement à une commune
    const headlineLower = metadata.headline.toLowerCase();
    
    // 2.1 Vérifier correspondance exacte
    for (const commune of communes) {
      const communeLower = commune.toLowerCase();
      if (headlineLower === communeLower) {
        console.log(`Headline correspond exactement à une commune: ${commune}`);
        return true;
      }
    }
    
    // 2.2 Si pas de correspondance exacte, vérifier les correspondances partielles
    // Décomposer le headline en mots individuels pour une vérification plus précise
    const headlineWords = headlineLower
      .split(/\s+/)
      .map(word => word.replace(/[,.;:!?]/g, ''))
      .filter(word => word.length > 2);  // Ignorer les mots trop courts
    
    // Vérifier chaque commune par rapport aux mots individuels du headline
    for (const commune of communes) {
      // Ignorer les communes trop courtes (3 lettres ou moins) pour éviter les faux positifs
      if (commune.length <= 3) continue;
      
      const communeLower = commune.toLowerCase();
      
      // 2.2.1 Vérifier si la commune est un mot exact dans le headline
      for (const word of headlineWords) {
        if (word === communeLower) {
          console.log(`Commune "${commune}" trouvée comme mot exact dans le headline`);
          return true;
        }
      }
      
      // 2.2.2 Vérifier si le headline commence par cette commune
      if (headlineLower.startsWith(communeLower + ' ') || headlineLower.startsWith(communeLower + '-')) {
        // Vérifier que ce n'est pas juste une partie d'un nom composé
        const suffixes = ["-le-", "-la-", "-les-", "-sur-", "-sous-", "-en-", "-de-", "-du-", "-des-"];
        let isPartOfCompound = false;
        
        for (const suffix of suffixes) {
          if (headlineLower.startsWith(communeLower + suffix)) {
            isPartOfCompound = true;
            break;
          }
        }
        
        if (!isPartOfCompound) {
          console.log(`Commune "${commune}" trouvée au début du headline`);
          return true;
        }
      }
    }
  }
  
  // Si on arrive ici, l'article n'est pas lié aux trois départements
  return false;
};

/**
 * Traite un lot d'articles en parallèle
 */
const processArticlesBatch = async (articlesMetadata, startDate, endDate) => {
  const results = [];
  
  // Traiter les articles par lots
  for (let i = 0; i < articlesMetadata.length; i += BATCH_SIZE) {
    console.log(`Traitement du lot ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(articlesMetadata.length/BATCH_SIZE)}`);
    
    const batch = articlesMetadata.slice(i, i + BATCH_SIZE);
    
    // Traiter ce lot en parallèle
    const batchResults = await Promise.all(
      batch.map(metadata => processArticleDetail(metadata, startDate, endDate))
    );
    
    // Ajouter les résultats valides
    results.push(...batchResults.filter(result => result !== null));
    
    // Court délai entre les lots pour éviter la détection
    if (i + BATCH_SIZE < articlesMetadata.length) {
      await new Promise(resolve => setTimeout(resolve, 500)); // Réduit de 800ms à 500ms
    }
  }
  
  return results;
};

/**
 * Traite le détail d'un article
 */
const processArticleDetail = async (metadata, startDate, endDate) => {
  try {
    console.log(`Récupération du contenu complet pour: ${metadata.url}`);
    
    // Récupérer le contenu complet de l'article avec retry
    const articleResponse = await fetchWithRetry(metadata.url);
    
    if (!articleResponse.data) {
      console.log(`Pas de contenu trouvé, ignoré: ${metadata.url}`);
      return null;
    }
    
    // Analyser le contenu pour extraire la date précise
    const articleHtml = articleResponse.data;
    const $article = cheerio.load(articleHtml);
    
    // Extraire la date avec différentes méthodes
    let articleDate = null;
    
    // 1. D'abord essayer avec la meta property article:published_time
    const metaPublishedTime = $article('meta[property="article:published_time"]').attr('content');
    if (metaPublishedTime) {
      const dateMatch = metaPublishedTime.match(/^(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        articleDate = dateMatch[1];
        console.log(`Date extraite du meta published_time: ${articleDate}`);
      }
    }
    
    // 2. Essayer avec datePublished dans le JSON-LD
    if (!articleDate) {
      const jsonLdScripts = $article('script[type="application/ld+json"]');
      
      if (jsonLdScripts.length > 0) {
        jsonLdScripts.each((idx, script) => {
          if (articleDate) return;
          try {
            const jsonText = $article(script).html();
            const json = JSON.parse(jsonText);
            
            if (json.datePublished) {
              const dateMatch = json.datePublished.match(/^(\d{4}-\d{2}-\d{2})/);
              if (dateMatch) {
                articleDate = dateMatch[1];
                console.log(`Date extraite du JSON-LD: ${articleDate}`);
              }
            }
          } catch (e) {
            console.log(`Erreur parsing JSON-LD: ${e.message}`);
          }
        });
      }
    }
    
    // 3. Essayer avec la balise time
    if (!articleDate) {
      const timeElement = $article('time[datetime]');
      if (timeElement.length) {
        const datetime = timeElement.attr('datetime');
        const dateMatch = datetime && datetime.match(/^(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) {
          articleDate = dateMatch[1];
          console.log(`Date extraite de la balise time: ${articleDate}`);
        }
      }
    }
    
    // 4. Essayer avec le span publish
    if (!articleDate) {
      const publishElement = $article('span.publish');
      if (publishElement.length) {
        const publishText = publishElement.text().trim();
        
        if (publishText.includes('Hier')) {
          // Calculer la date d'hier
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          articleDate = yesterday.toISOString().split('T')[0];
          console.log(`Date calculée pour "Hier": ${articleDate}`);
        } else if (publishText.includes('Aujourd\'hui')) {
          // Utiliser la date du jour
          articleDate = new Date().toISOString().split('T')[0];
          console.log(`Date calculée pour "Aujourd'hui": ${articleDate}`);
        }
      }
    }
    
    // 5. Essayer d'extraire la date de l'URL
    if (!articleDate) {
      const urlMatch = metadata.url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
      if (urlMatch) {
        articleDate = `${urlMatch[1]}-${urlMatch[2]}-${urlMatch[3]}`;
        console.log(`Date extraite de l'URL: ${articleDate}`);
      }
    }
    
    // Si aucune date trouvée, utiliser aujourd'hui
    if (!articleDate) {
      articleDate = new Date().toISOString().substring(0, 10);
      console.log(`Pas de date trouvée, utilisation de la date d'aujourd'hui: ${articleDate}`);
    }
    
    metadata.date = articleDate;
    console.log(`Date de l'article: ${metadata.date}`);
    
    // Vérifier si l'article est dans l'intervalle de dates
    if (dateInRange(metadata.date, startDate, endDate)) {
      console.log(`Article dans l'intervalle de dates, traitement du contenu: ${metadata.url}`);
      
      // Extraire un court extrait du contenu de l'article
      try {
        // Essayer de trouver les paragraphes dans le contenu
        let contentTexts = [];
        
        // Essayer plusieurs sélecteurs possibles
        let contentElements = $article('p.article__paragraph');
        if (contentElements.length === 0) {
          contentElements = $article('div.article-content p');
        }
        if (contentElements.length === 0) {
          contentElements = $article('div.article p');
        }
        if (contentElements.length === 0) {
          contentElements = $article('p');
        }
        
        if (contentElements.length > 0) {
          contentElements.each((index, el) => {
            if (index < 5) { // Limiter à 5 paragraphes
              const text = $article(el).text().trim();
              if (text.length > 20) { // Éviter les paragraphes trop courts
                contentTexts.push(text);
              }
            }
          });
          metadata.content = cleanHtml(contentTexts.join(' '));
        }
        
        // Si pas de contenu trouvé, utiliser la description comme contenu
        if (!metadata.content && metadata.description) {
          metadata.content = metadata.description;
        }
        
        // Si toujours pas de contenu, mettre une valeur par défaut
        if (!metadata.content) {
          metadata.content = "Contenu non disponible";
        }
      } catch (contentError) {
        console.error(`Erreur lors de l'extraction du contenu: ${contentError.message}`);
        // En cas d'erreur d'extraction du contenu, utiliser la description ou une valeur par défaut
        metadata.content = metadata.description || "Contenu non disponible";
      }
      
      // Ajouter les départements concernés
      metadata.departements = [];
      
      // Vérifier si l'article contient des références aux départements
      const articleContent = $article.html().toLowerCase();
      
      if (articleContent.includes('doubs') || articleContent.includes('"25"') || 
          articleContent.includes('besançon') || articleContent.includes('montbéliard')) {
        metadata.departements.push(DOUBS_CODE);
      }
      
      if (articleContent.includes('haute-saône') || articleContent.includes('haute saône') || 
          articleContent.includes('"70"') || articleContent.includes('vesoul')) {
        metadata.departements.push(HAUTE_SAONE_CODE);
      }
      
      if (articleContent.includes('territoire de belfort') || articleContent.includes('"90"') || 
          articleContent.includes('belfort')) {
        metadata.departements.push(TERRITOIRE_BELFORT_CODE);
      }
      
      // Si aucun département spécifique n'est détecté, considérer que c'est pour tous (info régionale)
      if (metadata.departements.length === 0) {
        metadata.departements = [DOUBS_CODE, HAUTE_SAONE_CODE, TERRITOIRE_BELFORT_CODE];
      }
      
      return metadata;
    } else {
      console.log(`Article hors de l'intervalle de dates, ignoré: ${metadata.url}`);
      
      // Indiquer si l'article est plus ancien que la date de début
      if (metadata.date && startDate && metadata.date < startDate) {
        return { isOlderThanStartDate: true };
      }
      
      return null;
    }
  } catch (error) {
    console.error(`Erreur lors de la récupération de l'article ${metadata.url}:`, error.message);
    return null;
  }
};

/**
 * Recherche des articles selon les critères
 */
exports.searchArticles = async ({ keyword, startDate, endDate }, emitter = null) => {
  if (!keyword) {
    throw new Error('Le mot-clé est requis pour la recherche');
  }
  
  // Nombre maximum de pages à parcourir
  const maxPages = 100;
  
  const results = [];
  let processedUrls = new Set(); // Pour éviter les doublons
  let found_older_article = false;
  let totalArticlesFound = 0;
  
  console.log(`Recherche d'articles pour "${keyword}" entre ${startDate || 'date indéfinie'} et ${endDate || 'date indéfinie'}`);
  console.log(`ATTENTION: La recherche explorera jusqu'à ${maxPages} pages ou jusqu'à trouver des articles plus anciens que la date de début`);
  
  for (let page = 1; page <= maxPages; page++) {
    // Arrêter la recherche si on a trouvé des articles plus anciens que la date de début
    if (found_older_article) {
      console.log("Articles plus anciens trouvés, arrêt de la recherche.");
      break;
    }
    
    // Si plus aucun article n'est trouvé sur une page, arrêter la recherche
    if (page > 5 && totalArticlesFound === 0) {
      console.log("Aucun article trouvé après plusieurs pages, arrêt de la recherche.");
      break;
    }
    
    console.log(`\nExploration de la page ${page} pour le mot-clé '${keyword}'`);
    
    try {
      // URL de recherche avec pagination
      const searchUrl = `https://www.estrepublicain.fr/recherche?q=${encodeURIComponent(keyword)}&page=${page}`;
      
      // Récupérer la page de résultats avec retry
      const response = await fetchWithRetry(searchUrl);
      
      if (!response.data) {
        console.log(`Page ${page} vide, arrêt de la recherche.`);
        break;
      }
      
      // Analyser le contenu HTML
      const $ = cheerio.load(response.data);
      
      // Afficher un extrait pour le débogage (seulement sur la première page)
      if (page === 1) {
        console.log("Extrait de la page de résultats pour analyse de structure:");
        const articleSample = $('article.tertiary').first().html();
        console.log(articleSample ? articleSample.substring(0, 150) + '...' : 'Aucun article trouvé');
        
        const headlineSample = $('span.headline').first().html();
        console.log(`Exemple de headline: ${headlineSample || 'Aucun headline trouvé'}`);
      }
      
      // Extraire tous les blocs d'articles
      let articlesElements = [];
      const articlesTertiary = $('article.tertiary');
      
      if (articlesTertiary.length > 0) {
        console.log(`Page ${page}: Trouvé ${articlesTertiary.length} articles avec la méthode principale (article.tertiary)`);
        articlesElements = articlesTertiary;
      } else {
        // Méthodes alternatives
        const articlesHeadline = $('span.headline').closest('article');
        
        if (articlesHeadline.length > 0) {
          console.log(`Page ${page}: Trouvé ${articlesHeadline.length} articles avec la méthode alternative 1 (span.headline)`);
          articlesElements = articlesHeadline;
        } else {
          const articlesFlagPaid = $('h2:has(span.flagPaid)').closest('article');
          
          if (articlesFlagPaid.length > 0) {
            console.log(`Page ${page}: Trouvé ${articlesFlagPaid.length} articles avec la méthode alternative 2 (h2 avec flagPaid)`);
            articlesElements = articlesFlagPaid;
          } else {
            console.log(`Page ${page}: Aucun article trouvé avec les méthodes disponibles`);
          }
        }
      }
      
      // Traiter chaque article trouvé sur la page
      let pageArticlesToProcess = [];
      
      for (let i = 0; i < articlesElements.length; i++) {
        const article = articlesElements[i];
        
        // Extraire les métadonnées en mettant l'accent sur le headline
        const metadata = extractArticleMetadata($, article);
        
        // Vérifier si l'URL a été trouvée
        if (!metadata.url) {
          console.log(`Article ${i}: Pas d'URL trouvée, ignoré`);
          continue;
        }
        
        // Vérifier si on n'a pas déjà traité cet URL (éviter les doublons)
        if (processedUrls.has(metadata.url)) {
          console.log(`Article ${i}: URL déjà traitée, ignoré: ${metadata.url}`);
          continue;
        }
        processedUrls.add(metadata.url);
        
        console.log(`Article ${i}: URL trouvée: ${metadata.url}`);
        console.log(`Article ${i}: Headline: ${metadata.headline}`);
        console.log(`Article ${i}: Titre: ${metadata.title}`);
        
        // Vérifier si c'est un article lié à l'un des trois départements
        const isRelated = await isArticleRelatedToDepartements(metadata);
        
        if (!isRelated) {
          console.log(`Article ${i}: Pas lié aux départements cibles, ignoré`);
          continue;
        }
        
        totalArticlesFound++;
        console.log(`Article ${i}: Lié aux départements cibles, ajouté à la liste de traitement`);
        pageArticlesToProcess.push(metadata);
      }
      
      // Traiter les articles de la page en parallèle
      if (pageArticlesToProcess.length > 0) {
        console.log(`Traitement en parallèle de ${pageArticlesToProcess.length} articles de la page ${page}`);
        
        // Traiter les articles par lots
        for (let i = 0; i < pageArticlesToProcess.length; i += BATCH_SIZE) {
          const batch = pageArticlesToProcess.slice(i, i + BATCH_SIZE);
          
          // Traiter ce lot en parallèle
          const processedArticles = await Promise.all(
            batch.map(metadata => processArticleDetail(metadata, startDate, endDate))
          );
          
          // Vérifier si l'un des articles est plus ancien que la date de début
          found_older_article = processedArticles.some(article => article && article.isOlderThanStartDate);
          
          // Filtrer les résultats pour ne garder que les articles valides
          const validArticles = processedArticles.filter(article => article && !article.isOlderThanStartDate);
          
          // Ajouter aux résultats
          results.push(...validArticles);
          
          // Émettre les résultats si un émetteur est fourni
          if (emitter && validArticles.length > 0) {
            emitter.emit('articlesFound', validArticles);
          }
          
          console.log(`Ajout de ${validArticles.length} articles valides aux résultats depuis la page ${page}`);
          
          // Court délai entre les lots pour éviter la détection
          if (i + BATCH_SIZE < pageArticlesToProcess.length) {
            await new Promise(resolve => setTimeout(resolve, 500)); // Réduit de 800ms à 500ms
          }
        }
      }
      
      // Attendre un peu avant la prochaine requête de page
      if (page < maxPages && !found_older_article) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Réduit de 1500ms à 1000ms
      }
      
    } catch (error) {
      console.error(`Erreur lors de la recherche sur la page ${page}:`, error.message);
      
      // Ajouter un délai supplémentaire en cas d'erreur pour permettre au site de récupérer
      await new Promise(resolve => setTimeout(resolve, 2000)); // Réduit de 3000ms à 2000ms
      
      // Continuer avec la prochaine page plutôt que d'arrêter complètement
      continue;
    }
  }
  
  console.log(`\nRecherche terminée: ${results.length} articles trouvés au total`);
  console.log(`Total des articles liés aux départements cibles trouvés: ${totalArticlesFound}`);
  
  return results;
}; 