const axios = require('axios');
const cheerio = require('cheerio');
const communesAlsaceService = require('./communesAlsaceService');
const { cleanHtml, generateHash } = require('../utils/stringUtils');
const { dateInRange } = require('../utils/dateUtils');

// Configuration
const BAS_RHIN_CODE = "67"; // Code du département du Bas-Rhin
const HAUT_RHIN_CODE = "68"; // Code du département du Haut-Rhin
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
      url = 'https://www.lalsace.fr' + url;
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
 * Vérifie si un article est lié à l'Alsace ou plus spécifiquement à un département (Bas-Rhin ou Haut-Rhin)
 */
const isArticleRelatedToAlsace = async (metadata) => {
  // Si pas de headline, rejeter l'article
  if (!metadata.headline) {
    console.log("Pas de headline disponible pour vérifier la région");
    return false;
  }

  // Liste des valeurs exactes de headlines qui indiquent l'Alsace ou ses régions
  const alsaceSpecificHeadlines = [
    "Alsace", "Centre-Alsace", "Nord Alsace", "Sud Alsace", 
    "Bas-Rhin", "Haut-Rhin", "Région", "Régional", "Grand Est",
    "67", "68", "Eurométropole", "Strasbourgeois", "Mulhousien", "Colmarien",
    "Région de Guebwiller", "Markstein", "Politique"
  ];

  // Vérifier si le headline est exactement l'une des valeurs spécifiques à l'Alsace
  for (const specificHeadline of alsaceSpecificHeadlines) {
    if (metadata.headline === specificHeadline) {
      console.log(`Article lié à l'Alsace: headline est exactement "${specificHeadline}"`);
      return true;
    }
  }
  
  // 1. Liste des villes majeures à vérifier comme valeur exacte du headline
  const majorCities = [
    // Bas-Rhin (67)
    "Strasbourg", "Haguenau", "Schiltigheim", "Illkirch-Graffenstaden", 
    "Sélestat", "Bischwiller", "Saverne", "Lingolsheim", "Obernai", 
    // Haut-Rhin (68)
    "Mulhouse", "Colmar", "Saint-Louis", "Wittenheim", "Illzach", 
    "Kingersheim", "Guebwiller", "Cernay", "Thann", "Altkirch"
  ];
  
  // Vérifier si le headline est exactement une ville majeure
  for (const city of majorCities) {
    if (metadata.headline === city) {
      console.log(`Article lié à l'Alsace: headline est exactement "${city}" (ville majeure alsacienne)`);
      return true;
    }
  }
  
  // 2. Vérifier les catégories thématiques courantes dans L'Alsace
  const commonCategories = [
    "Énergie", "Energie", "Vie quotidienne", "Social"
  ];
  
  // Si le headline est une catégorie commune, continuer la vérification avec le titre
  if (commonCategories.includes(metadata.headline)) {
    console.log(`Headline est une catégorie commune: "${metadata.headline}", vérification du titre nécessaire`);
    
    // Si nous avons un titre, chercher des mentions d'Alsace ou de ses régions dans le titre
    if (metadata.title) {
      for (const specificRegion of alsaceSpecificHeadlines) {
        if (metadata.title.includes(specificRegion)) {
          console.log(`Article lié à l'Alsace: titre contient "${specificRegion}"`);
          return true;
        }
      }
      
      // Chercher les mentions de villes majeures dans le titre
      for (const city of majorCities) {
        if (metadata.title.includes(city)) {
          console.log(`Article lié à l'Alsace: titre contient "${city}" (ville majeure alsacienne)`);
          return true;
        }
      }
    }
  }
  
  // 3. Si le headline ressemble à un nom de commune (commence par une majuscule)
  if (/^[A-Z][a-zéèêëàâäôöùûüç]+([-\s][A-Z][a-zéèêëàâäôöùûüç]+)*$/.test(metadata.headline)) {
    try {
      // Récupérer la liste des communes d'Alsace
      const communes = await communesAlsaceService.getCommunesByDepartements([BAS_RHIN_CODE, HAUT_RHIN_CODE]);
      
      // Vérifier si le headline correspond exactement à une commune
      if (communes.includes(metadata.headline)) {
        console.log(`Article lié à l'Alsace: headline est exactement la commune "${metadata.headline}"`);
        return true;
      }
      
      // Vérifier les variantes (avec/sans traits d'union, accents, etc.)
      const headlineLower = metadata.headline.toLowerCase();
      for (const commune of communes) {
        const communeLower = commune.toLowerCase();
        if (headlineLower === communeLower) {
          console.log(`Article lié à l'Alsace: headline correspond à la commune "${commune}" (casse différente)`);
          return true;
        }
      }
    } catch (error) {
      console.error("Erreur lors de la vérification des communes:", error.message);
    }
  }
  
  // 4. Vérifier les thèmes d'intérêt avec mention explicite de l'Alsace dans le titre
  const themesOfInterest = ["Énergie", "Vie quotidienne", "Agriculture", "Emploi", "Logement"];
  
  if (themesOfInterest.includes(metadata.headline) && metadata.title) {
    // Chercher des mentions d'Alsace ou de ses régions dans le titre pour ces thèmes
    for (const specificRegion of alsaceSpecificHeadlines) {
      if (metadata.title.includes(specificRegion)) {
        console.log(`Article d'intérêt lié à l'Alsace: thème "${metadata.headline}" avec "${specificRegion}" dans le titre`);
        return true;
      }
    }
  }
  
  // Si aucun critère n'est satisfait, l'article n'est probablement pas lié à l'Alsace
  console.log(`Article non lié à l'Alsace selon les critères: headline="${metadata.headline}"`);
  return false;
};

/**
 * Détermine à quel département de l'Alsace l'article est lié
 */
const determineDepartement = ($article, headline) => {
  // Tableaux pour stocker les références aux départements
  const basRhinReferences = [];
  const hautRhinReferences = [];
  
  // Liste des indicateurs pour le Bas-Rhin
  const basRhinIndicators = [
    'Bas-Rhin', 'Bas Rhin', '67', 'Nord Alsace', 
    'Strasbourg', 'Haguenau', 'Schiltigheim', 'Sélestat', 
    'Saverne', 'Obernai', 'Wissembourg', 'Erstein'
  ];
  
  // Liste des indicateurs pour le Haut-Rhin
  const hautRhinIndicators = [
    'Haut-Rhin', 'Haut Rhin', '68', 'Sud Alsace',
    'Mulhouse', 'Colmar', 'Saint-Louis', 'Guebwiller',
    'Thann', 'Altkirch', 'Cernay', 'Ensisheim'
  ];
  
  // 1. Vérifier le headline
  if (headline) {
    // Vérifier les indicateurs du Bas-Rhin
    for (const indicator of basRhinIndicators) {
      if (headline.includes(indicator)) {
        basRhinReferences.push(`Headline: ${indicator}`);
      }
    }
    
    // Vérifier les indicateurs du Haut-Rhin
    for (const indicator of hautRhinIndicators) {
      if (headline.includes(indicator)) {
        hautRhinReferences.push(`Headline: ${indicator}`);
      }
    }
  }
  
  // 2. Vérifier dans le contenu HTML de l'article complet
  if ($article) {
    const articleText = $article.text().toLowerCase();
    
    // Vérifier les indicateurs du Bas-Rhin
    for (const indicator of basRhinIndicators) {
      const lowerIndicator = indicator.toLowerCase();
      if (articleText.includes(lowerIndicator)) {
        basRhinReferences.push(`Contenu: ${indicator}`);
      }
    }
    
    // Vérifier les indicateurs du Haut-Rhin
    for (const indicator of hautRhinIndicators) {
      const lowerIndicator = indicator.toLowerCase();
      if (articleText.includes(lowerIndicator)) {
        hautRhinReferences.push(`Contenu: ${indicator}`);
      }
    }
  }
  
  // Déterminer le résultat
  const departements = [];
  
  if (basRhinReferences.length > 0) {
    departements.push(BAS_RHIN_CODE);
  }
  
  if (hautRhinReferences.length > 0) {
    departements.push(HAUT_RHIN_CODE);
  }
  
  // Si aucun département spécifique n'est identifié, considérer qu'il s'applique aux deux
  if (departements.length === 0) {
    departements.push(BAS_RHIN_CODE, HAUT_RHIN_CODE);
  }
  
  return {
    departements,
    references: {
      basRhin: basRhinReferences,
      hautRhin: hautRhinReferences
    }
  };
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
      
      // Déterminer à quels départements l'article est lié
      const departementInfo = determineDepartement($article, metadata.headline);
      metadata.departements = departementInfo.departements;
      
      console.log(`Article: Départements: ${metadata.departements.join(', ')}`);
      
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
      const searchUrl = `https://www.lalsace.fr/recherche?q=${encodeURIComponent(keyword)}&r=&zr=&page=${page}&x=0&y=0`;
      
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
        
        // Vérifier si c'est un article lié à l'Alsace
        const isAlsace = await isArticleRelatedToAlsace(metadata);
        
        if (!isAlsace) {
          console.log(`Article ${i}: Pas lié à l'Alsace, ignoré`);
          continue;
        }
        
        totalArticlesFound++;
        console.log(`Article ${i}: Lié à l'Alsace, ajouté à la liste de traitement`);
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
  console.log(`Total des articles liés à l'Alsace trouvés: ${totalArticlesFound}`);
  
  return results;
}; 