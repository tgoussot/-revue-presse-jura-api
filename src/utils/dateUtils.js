/**
 * Vérifie si une date est dans un intervalle donné (dates de début et fin INCLUSIVES)
 * @param {string} dateToCheck - La date à vérifier au format YYYY-MM-DD
 * @param {string|null} startDate - La date de début au format YYYY-MM-DD, ou null si pas de limite
 * @param {string|null} endDate - La date de fin au format YYYY-MM-DD (INCLUSIVE), ou null si pas de limite
 * @returns {boolean} - true si la date est dans l'intervalle, false sinon
 */
exports.dateInRange = (dateToCheck, startDate, endDate) => {
  console.log(`Vérification de date: ${dateToCheck} est-elle entre ${startDate || 'aucune limite'} et ${endDate || 'aucune limite'}?`);
  
  // Si la date est vide, on considère qu'elle est dans l'intervalle
  if (!dateToCheck) {
    console.log('Date à vérifier vide, considérée comme valide');
    return true;
  }
  
  // Si aucune date limite n'est fournie, on considère que c'est dans l'intervalle
  if (!startDate && !endDate) {
    console.log('Aucune limite de date fournie, considérée comme valide');
    return true;
  }
  
  try {
    // Normaliser la date à vérifier
    let dateToCheckNormalized = dateToCheck;
    if (dateToCheck.includes('/')) {
      const parts = dateToCheck.split('/');
      if (parts.length === 3) {
        dateToCheckNormalized = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }
    
    console.log(`Date normalisée à vérifier: ${dateToCheckNormalized}`);
    
    // Pour rendre la date de début inclusive, on utilise >= au lieu de >
    if (startDate && dateToCheckNormalized < startDate) {
      console.log(`Date ${dateToCheckNormalized} est antérieure à la date de début ${startDate}, non valide`);
      return false;
    }
    
    // IMPORTANT: Pour garantir que la date de fin soit inclusive
    // on ajuste la date de fin en ajoutant un jour si elle est fournie
    let adjustedEndDate = null;
    if (endDate) {
      try {
        // Créer une date JavaScript à partir de la chaîne endDate
        const endDateObj = new Date(endDate);
        
        // Vérifier si la date est valide
        if (isNaN(endDateObj.getTime())) {
          console.log(`Date de fin invalide: ${endDate}, traitée comme si non fournie`);
          adjustedEndDate = null;
        } else {
          // Ajouter un jour à la date
          endDateObj.setDate(endDateObj.getDate() + 1);
          
          // Convertir la date en format YYYY-MM-DD
          adjustedEndDate = endDateObj.toISOString().split('T')[0];
          
          console.log(`Date de fin ajustée: ${endDate} -> ${adjustedEndDate} (pour inclusion)`);
        }
      } catch (error) {
        console.error(`Erreur lors du traitement de la date de fin: ${error.message}`);
        // En cas d'erreur, considérer qu'il n'y a pas de date de fin
        adjustedEndDate = null;
      }
    }
    
    // Utiliser la date de fin ajustée pour la comparaison
    if (adjustedEndDate && dateToCheckNormalized >= adjustedEndDate) {
      console.log(`Date ${dateToCheckNormalized} est postérieure à la date de fin ajustée ${adjustedEndDate}, non valide`);
      return false;
    }
    
    // Dans tous les autres cas, la date est valide
    console.log(`Date ${dateToCheckNormalized} est dans l'intervalle [${startDate || '*'}, ${endDate || '*'}], valide`);
    return true;
  } catch (error) {
    console.error(`Erreur lors de la vérification de date: ${error.message}`);
    // En cas d'erreur, on considère que la date est valide pour éviter de bloquer le processus
    return true;
  }
}; 