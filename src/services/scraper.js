const axios = require('axios');
const cheerio = require('cheerio');
const communesService = require('./communesService');
const { cleanHtml, extractDate, generateHash } = require('../utils/stringUtils');
const { dateInRange } = require('../utils/dateUtils');

// Configuration
const JURA_CODE = "39"; // Code du département du Jura
const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

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
      url = 'https://www.leprogres.fr' + url;
    }
    
    metadata.url = url;
    // Générer un ID unique basé sur l'URL
    metadata.id = generateHash(url);
  }
  
  // Extraction simplifiée du headline - utilisation directe du sélecteur CSS exact
  const headlineElement = $(article).find('span.headline');
  if (headlineElement.length) {
    metadata.headline = headlineElement.text().trim();
    console.log(`Headline extrait: "${metadata.headline}"`);
  } else {
    console.log("Pas de headline trouvé dans cet article");
  }
  
  // Nouveau : Extraire le titre directement depuis l'URL pour assurer cohérence avec le script bash
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
  
  // Si on n'a pas pu extraire le titre de l'URL, essayer les méthodes classiques
  if (!metadata.title) {
    // Essayer d'extraire depuis h2 avec flagPaid
    const titleElement = $(article).find('h2:has(span.flagPaid)');
    if (titleElement.length) {
      // Enlever la balise flagPaid pour n'avoir que le texte du titre
      metadata.title = titleElement.clone()
        .find('span.flagPaid').remove().end()
        .text().trim();
      console.log(`Titre extrait du h2 avec flagPaid: "${metadata.title}"`);
    }
    
    // Si toujours pas de titre, essayer n'importe quel h2
    if (!metadata.title || metadata.title.length < 5) {
      const h2Element = $(article).find('h2');
      if (h2Element.length) {
        metadata.title = h2Element.text().trim();
        console.log(`Titre extrait du h2: "${metadata.title}"`);
      }
    }
    
    // Si toujours pas de titre, essayer le h3
    if (!metadata.title || metadata.title.length < 5) {
      const h3Element = $(article).find('h3');
      if (h3Element.length) {
        metadata.title = h3Element.text().trim();
        console.log(`Titre extrait du h3: "${metadata.title}"`);
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
  
  // Vérifier si le titre est cohérent avec l'URL
  if (metadata.title && metadata.url) {
    // Extraire les mots-clés significatifs de l'URL
    const urlKeywords = metadata.url.split('/').pop()
      .replace('.html', '')
      .replace(/-/g, ' ')
      .toLowerCase();
    
    // Compter combien de mots du titre se retrouvent dans l'URL (approximatif)
    let matchCount = 0;
    const titleWords = metadata.title.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3 && !['avec', 'pour', 'dans', 'cette', 'entre', 'plus'].includes(word));
    
    for (const word of titleWords) {
      if (urlKeywords.includes(word)) {
        matchCount++;
      }
    }
    
    // Si moins de 2 mots correspondent, utiliser le titre extrait de l'URL
    if (matchCount < 2) {
      const urlTitle = metadata.url.split('/').pop()
        .replace('.html', '')
        .replace(/-/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
      
      if (urlTitle.length > 10) {
        console.log(`Titre incohérent, utilisation du titre extrait de l'URL: "${urlTitle}"`);
        metadata.title = urlTitle;
      }
    }
  }
  
  // Extraire la description
  const descElement = $(article).find('span.desc');
  if (descElement.length) {
    metadata.description = descElement.text().trim();
  }
  
  // Extraire la date
  const dateElement = $(article).find('span.publish');
  if (dateElement.length) {
    const publishDate = dateElement.text().trim();
    // Adapter ici pour gérer "Hier", "Aujourd'hui", etc.
    metadata.date = publishDate;
  }
  
  return metadata;
};

/**
 * Vérifie si un article est lié au Jura
 * Cette fonction suit exactement la logique du script bash enedis_jura.sh
 */
const isArticleRelatedToJura = async (metadata) => {
  // Liste des villes principales du Jura à vérifier directement dans le headline
  const juraMainPlaces = [
    "Jura", "Jura Nord", "Jura Sud", "Haut-Jura", "Haut Jura", "39",
  ];
  
  // Liste des thèmes d'intérêt à vérifier dans le headline
  const themesOfInterest = [
    "Énergie", "Energie", "Vie quotidienne", "Social"
  ];
  
  // 1. Vérifier si le headline contient explicitement une ville/région du Jura
  if (metadata.headline) {
    for (const place of juraMainPlaces) {
      if (metadata.headline.includes(place)) {
        console.log(`Article du Jura trouvé: headline contient "${place}" (ville/région majeure)`);
        return true;
      }
    }
    
    // 1.b Vérifier si le headline contient un des thèmes d'intérêt
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
  
  // 2. Si pas trouvé dans le headline, vérifier toutes les communes du Jura dans le headline
  if (metadata.headline) {
    // Récupérer la liste des communes du Jura
    const communes = await communesService.getJuraCommunes();
    
    // Vérifier d'abord si le headline correspond exactement à une commune du Jura
    const headlineLower = metadata.headline.toLowerCase();
    
    // 2.1 Vérifier correspondance exacte
    for (const commune of communes) {
      const communeLower = commune.toLowerCase();
      if (headlineLower === communeLower) {
        console.log(`Headline correspond exactement à une commune du Jura: ${commune} (correspondance exacte)`);
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
          console.log(`Commune du Jura "${commune}" trouvée comme mot exact dans le headline (mot exact)`);
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
          console.log(`Commune du Jura "${commune}" trouvée au début du headline (commune en début)`);
          return true;
        }
      }
    }
  }
  
  // Si on arrive ici, l'article n'est pas lié au Jura
  return false;
};

/**
 * Recherche des articles selon les critères
 */
exports.searchArticles = async ({ keyword, startDate, endDate }) => {
  if (!keyword) {
    throw new Error('Le mot-clé est requis pour la recherche');
  }
  
  // Nombre maximum de pages à parcourir - valeur très élevée pour explorer en profondeur
  // NOTE: L'exploration s'arrêtera automatiquement quand on trouve des articles plus anciens
  const maxPages = 100; // Au lieu de 5 pages
  
  const results = [];
  let processedUrls = new Set(); // Pour éviter les doublons
  let totalArticlesFound = 0;
  let totalOutOfRangeCount = 0;
  let found_older_article = false; // Comme dans le script bash
  
  // Logging pour indiquer qu'on recherche sans limite de pages
  console.log(`Recherche d'articles pour "${keyword}" entre ${startDate || 'date indéfinie'} et ${endDate || 'date indéfinie'}`);
  console.log(`ATTENTION: La recherche explorera jusqu'à ${maxPages} pages ou jusqu'à trouver des articles plus anciens que la date de début`);
  
  for (let page = 1; page <= maxPages; page++) {
    // Arrêter la recherche si on a trouvé des articles plus anciens que la date de début
    // Exactement comme dans le script bash
    if (found_older_article) {
      console.log("Articles plus anciens trouvés, arrêt de la recherche.");
      break;
    }
    
    // Si plus aucun article n'est trouvé sur une page, arrêter la recherche
    if (page > 1 && totalArticlesFound === 0) {
      console.log("Aucun article trouvé après plusieurs pages, arrêt de la recherche.");
      break;
    }
    
    console.log(`\nExploration de la page ${page} pour le mot-clé '${keyword}'`);
    
    // URL de recherche avec pagination
    const searchUrl = `https://www.leprogres.fr/recherche?q=${encodeURIComponent(keyword)}&x=0&y=0&page=${page}`;
    
    try {
      // Récupérer la page de résultats
      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': USER_AGENT
        }
      });
      
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
      
      // Extraire tous les blocs d'articles - en suivant exactement la méthode du script bash
      // Méthode 1: recherche par la balise article avec classe tertiary
      let articlesElements = [];
      const articlesTertiary = $('article.tertiary');
      
      if (articlesTertiary.length > 0) {
        console.log(`Page ${page}: Trouvé ${articlesTertiary.length} articles avec la méthode principale (article.tertiary)`);
        articlesElements = articlesTertiary;
      } else {
        // Méthode 2: recherche par span.headline
        const articlesHeadline = $('span.headline').closest('article');
        
        if (articlesHeadline.length > 0) {
          console.log(`Page ${page}: Trouvé ${articlesHeadline.length} articles avec la méthode alternative 1 (span.headline)`);
          articlesElements = articlesHeadline;
        } else {
          // Méthode 3: recherche par h2 avec flagPaid
          const articlesFlagPaid = $('h2:has(span.flagPaid)').closest('article');
          
          if (articlesFlagPaid.length > 0) {
            console.log(`Page ${page}: Trouvé ${articlesFlagPaid.length} articles avec la méthode alternative 2 (h2 avec flagPaid)`);
            articlesElements = articlesFlagPaid;
          } else {
            console.log(`Page ${page}: Aucun article trouvé avec les méthodes disponibles`);
          }
        }
      }
      
      // Traiter chaque article trouvé
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
        
        // Vérifier si c'est un article du Jura - BASÉ PRINCIPALEMENT SUR LE HEADLINE
        const isJura = await isArticleRelatedToJura(metadata);
        
        if (!isJura) {
          console.log(`Article ${i}: Pas lié au Jura, ignoré`);
          continue;
        }
        
        totalArticlesFound++;
        console.log(`Article ${i}: Lié au Jura, récupération du contenu complet`);
        
        // Récupérer le contenu complet de l'article
        try {
          const articleResponse = await axios.get(metadata.url, {
            headers: {
              'User-Agent': USER_AGENT
            }
          });
          
          if (!articleResponse.data) {
            console.log(`Article ${i}: Pas de contenu trouvé, ignoré`);
            continue;
          }
          
          // Analyser le contenu pour extraire la date précise en suivant la méthode du script bash
          const articleHtml = articleResponse.data;
          const $article = cheerio.load(articleHtml);
          
          // Extraire la date avec les méthodes du script bash
          let articleDate = null;
          
          // 1. D'abord essayer avec datePublished dans le JSON-LD
          const jsonLdScripts = $article('script[type="application/ld+json"]');
          if (jsonLdScripts.length > 0) {
            let dateFound = false;
            
            jsonLdScripts.each((idx, script) => {
              if (dateFound) return;
              try {
                const jsonText = $article(script).html();
                const json = JSON.parse(jsonText);
                
                if (Array.isArray(json)) {
                  for (const item of json) {
                    if (item.datePublished) {
                      const dateMatch = item.datePublished.match(/^(\d{4}-\d{2}-\d{2})/);
                      if (dateMatch) {
                        articleDate = dateMatch[1];
                        dateFound = true;
                        console.log(`Date extraite du JSON-LD: ${articleDate}`);
                        break;
                      }
                    }
                  }
                } else if (json.datePublished) {
                  const dateMatch = json.datePublished.match(/^(\d{4}-\d{2}-\d{2})/);
                  if (dateMatch) {
                    articleDate = dateMatch[1];
                    dateFound = true;
                    console.log(`Date extraite du JSON-LD: ${articleDate}`);
                  }
                }
              } catch (e) {
                console.log(`Erreur parsing JSON-LD: ${e.message}`);
              }
            });
          }
          
          // 2. Essayer avec meta property article:published_time
          if (!articleDate) {
            const metaPublishedTime = $article('meta[property="article:published_time"]').attr('content');
            if (metaPublishedTime) {
              const dateMatch = metaPublishedTime.match(/^(\d{4}-\d{2}-\d{2})/);
              if (dateMatch) {
                articleDate = dateMatch[1];
                console.log(`Date extraite du meta published_time: ${articleDate}`);
              }
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
          
          // 4. Essayer d'extraire la date du body class
          if (!articleDate) {
            const bodyClass = $article('body').attr('class');
            if (bodyClass && bodyClass.includes('date-')) {
              const dateMatch = bodyClass.match(/date-(\d{4}-\d{2}-\d{2})/);
              if (dateMatch) {
                articleDate = dateMatch[1];
                console.log(`Date extraite du body class: ${articleDate}`);
              }
            }
          }
          
          // 5. Dernier recours: extraire la date de l'URL
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
          console.log(`Article ${i}: Date: ${metadata.date}`);
          
          // Vérifier si l'article est dans l'intervalle de dates
          if (dateInRange(metadata.date, startDate, endDate)) {
            console.log(`Article ${i}: Dans l'intervalle de dates, ajouté aux résultats`);
            
            // Extraire un court extrait du contenu de l'article
            try {
              const contentElements = $article('p.article__paragraph');
              if (contentElements.length > 0) {
                let contentTexts = [];
                contentElements.each((index, el) => {
                  if (index < 5) { // Limiter à 5 paragraphes
                    contentTexts.push($article(el).text());
                  }
                });
                metadata.content = cleanHtml(contentTexts.join(' '));
              } else {
                // Essayer avec tous les paragraphes si aucun n'a la classe spécifique
                const paragraphs = $article('p');
                if (paragraphs.length > 0) {
                  let contentTexts = [];
                  paragraphs.each((index, el) => {
                    if (index < 5) { // Limiter à 5 paragraphes
                      contentTexts.push($article(el).text());
                    }
                  });
                  metadata.content = cleanHtml(contentTexts.join(' '));
                }
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
            
            // Ajouter l'article aux résultats
            results.push(metadata);
          } else {
            totalOutOfRangeCount++;
            
            // Si article plus ancien que la date de début, arrêter la recherche (comme dans le script bash)
            if (metadata.date && startDate && metadata.date < startDate) {
              console.log(`Article ${i}: Plus ancien que la date de début ${startDate}, fin de la recherche.`);
              found_older_article = true;
              break;
            } else {
              console.log(`Article ${i}: Hors de l'intervalle de dates, ignoré`);
            }
          }
        } catch (error) {
          console.error(`Erreur lors de la récupération de l'article ${metadata.url}:`, error.message);
          continue;
        }
      }
      
      // Attendre un peu avant la prochaine requête pour éviter d'être bloqué
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error(`Erreur lors de la recherche sur la page ${page}:`, error.message);
      break;
    }
  }
  
  console.log(`\nRecherche terminée: ${results.length} articles trouvés au total`);
  console.log(`Total des articles liés au Jura trouvés: ${totalArticlesFound}`);
  console.log(`Total des articles hors intervalle de dates: ${totalOutOfRangeCount}`);
  
  return results;
};