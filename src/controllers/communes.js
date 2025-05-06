// const communesJuraService = require('../services/communesJuraService');

// /**
//  * Récupère la liste des communes du Jura
//  */
// exports.getJuraCommunes = async (req, res) => {
//   try {
//     const communes = await communesJuraService.getJuraCommunes();
//     res.json({ success: true, data: communes });
//   } catch (error) {
//     console.error('Erreur lors de la récupération des communes du Jura:', error.message);
//     res.status(500).json({ success: false, error: 'Erreur lors de la récupération des communes' });
//   }
// }; 