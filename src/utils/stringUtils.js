const crypto = require('crypto');

/**
 * Nettoie le HTML d'une chaîne pour n'avoir que le texte
 */
exports.cleanHtml = (htmlString) => {
  if (!htmlString) return '';
  
  return htmlString
    .replace(/<[^>]*>/g, '') // Enlever toutes les balises HTML
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&rsquo;/g, "'")
    .replace(/&eacute;/g, 'é')
    .replace(/&egrave;/g, 'è')
    .replace(/&agrave;/g, 'à')
    .replace(/&ccedil;/g, 'ç')
    .replace(/\s+/g, ' ') // Remplacer les espaces multiples par un seul
    .trim();
};

/**
 * Extrait la date d'un document HTML
 */
exports.extractDate = ($) => {
  console.log("Tentative d'extraction de date...");
  
  // 1. D'abord essayer avec datePublished dans le JSON-LD
  const jsonLdScripts = $('script[type="application/ld+json"]');
  console.log(`Trouvé ${jsonLdScripts.length} scripts JSON-LD`);
  
  if (jsonLdScripts.length > 0) {
    for (let i = 0; i < jsonLdScripts.length; i++) {
      const jsonLdText = $(jsonLdScripts[i]).html();
      if (jsonLdText) {
        try {
          const jsonLd = JSON.parse(jsonLdText);
          console.log('JSON-LD parsé:', JSON.stringify(jsonLd).substring(0, 100) + '...');
          
          if (jsonLd.datePublished) {
            console.log(`datePublished trouvé: ${jsonLd.datePublished}`);
            const dateMatch = jsonLd.datePublished.match(/^(\d{4}-\d{2}-\d{2})/);
            if (dateMatch) {
              console.log(`Date extraite du JSON-LD: ${dateMatch[1]}`);
              return dateMatch[1];
            }
          } else if (jsonLd.mainEntity && jsonLd.mainEntity.datePublished) {
            console.log(`mainEntity.datePublished trouvé: ${jsonLd.mainEntity.datePublished}`);
            const dateMatch = jsonLd.mainEntity.datePublished.match(/^(\d{4}-\d{2}-\d{2})/);
            if (dateMatch) {
              console.log(`Date extraite du mainEntity: ${dateMatch[1]}`);
              return dateMatch[1];
            }
          }
        } catch (e) {
          console.log(`Erreur parsing JSON-LD: ${e.message}`);
        }
      }
    }
  }
  
  // 2. Essayer avec meta property article:published_time
  const metaPublishedTime = $('meta[property="article:published_time"]').attr('content');
  if (metaPublishedTime) {
    console.log(`Meta published_time trouvé: ${metaPublishedTime}`);
    const dateMatch = metaPublishedTime.match(/^(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      console.log(`Date extraite du meta: ${dateMatch[1]}`);
      return dateMatch[1];
    }
  }
  
  // 3. Essayer d'extraire la date de la balise time
  const timeElements = $('time[datetime]');
  console.log(`Trouvé ${timeElements.length} balises time avec datetime`);
  
  if (timeElements.length > 0) {
    for (let i = 0; i < timeElements.length; i++) {
      const datetime = $(timeElements[i]).attr('datetime');
      if (datetime) {
        console.log(`datetime trouvé: ${datetime}`);
        const dateMatch = datetime.match(/^(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) {
          console.log(`Date extraite de time: ${dateMatch[1]}`);
          return dateMatch[1];
        }
      }
    }
  }
  
  // 4. Essayer d'extraire la date du body class
  const bodyClass = $('body').attr('class');
  if (bodyClass) {
    console.log(`body class trouvé: ${bodyClass}`);
    const dateMatch = bodyClass.match(/date-(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      console.log(`Date extraite du body class: ${dateMatch[1]}`);
      return dateMatch[1];
    }
  }
  
  // 5. Essayer avec le span publish
  const publishElements = $('span.publish');
  console.log(`Trouvé ${publishElements.length} spans avec classe publish`);
  
  if (publishElements.length > 0) {
    const publishText = $(publishElements[0]).text().trim();
    console.log(`Texte publish trouvé: ${publishText}`);
    
    if (publishText.includes('Hier')) {
      // Calculer la date d'hier
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const result = yesterday.toISOString().split('T')[0];
      console.log(`Date calculée pour "Hier": ${result}`);
      return result;
    } else if (publishText.includes('Aujourd\'hui')) {
      // Utiliser la date du jour
      const result = new Date().toISOString().split('T')[0];
      console.log(`Date calculée pour "Aujourd'hui": ${result}`);
      return result;
    } else if (publishText.includes('/')) {
      // Format possible: "Publié le 01/04/2024"
      const dateMatch = publishText.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (dateMatch) {
        const result = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
        console.log(`Date extraite du format JJ/MM/AAAA: ${result}`);
        return result;
      }
    }
  }
  
  // 6. Chercher une balise p class="date"
  const dateElements = $('p.date');
  console.log(`Trouvé ${dateElements.length} paragraphes avec classe date`);
  
  if (dateElements.length > 0) {
    const dateText = $(dateElements[0]).text().trim();
    console.log(`Texte date trouvé: ${dateText}`);
    // Format: "lun. 28/04/2025"
    const dateMatch = dateText.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (dateMatch) {
      const result = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
      console.log(`Date extraite du format JJ/MM/AAAA: ${result}`);
      return result;
    }
  }
  
  // 7. Chercher une date au format YYYY-MM-DD n'importe où dans le texte
  const htmlContent = $.html();
  const htmlExcerpt = htmlContent.substring(0, 5000); // Pour ne pas logger tout le contenu
  console.log(`Recherche de date ISO dans les 5000 premiers caractères: ${htmlExcerpt.substring(0, 100)}...`);
  
  const isoDateMatch = htmlContent.match(/\d{4}-\d{2}-\d{2}/);
  if (isoDateMatch) {
    console.log(`Date ISO trouvée: ${isoDateMatch[0]}`);
    return isoDateMatch[0];
  }
  
  // 8. Chercher une date au format JJ/MM/YYYY
  const frDateMatch = htmlContent.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (frDateMatch) {
    const result = `${frDateMatch[3]}-${frDateMatch[2]}-${frDateMatch[1]}`;
    console.log(`Date française trouvée: ${result}`);
    return result;
  }
  
  // Si aucune date n'est trouvée, renvoyer la date actuelle
  const today = new Date().toISOString().split('T')[0];
  console.log(`Aucune date trouvée, utilisation de la date actuelle: ${today}`);
  return today;
};

/**
 * Génère un hash MD5 à partir d'une chaîne
 */
exports.generateHash = (str) => {
  return crypto.createHash('md5').update(str).digest('hex');
}; 