const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { rateLimit } = require('express-rate-limit');
const fs = require('fs');
const path = require('path');

// Configuration
require('./config/env');
// Utilisons explicitement le port 5002 sans dépendre des variables d'environnement
const PORT = process.env.PORT || 5002;

// Configuration des logs dans un fichier
const logStream = fs.createWriteStream(path.join(__dirname, '..', 'debug.log'), { flags: 'a' });

// Sauvegarde de la fonction console.log originale
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

// Redéfinition de console.log pour écrire aussi dans le fichier
console.log = function() {
  const args = Array.from(arguments);
  const logMessage = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
  ).join(' ');
  
  // Ajouter un timestamp
  const timestamp = new Date().toISOString();
  const logWithTimestamp = `[${timestamp}] ${logMessage}`;
  
  // Appel original pour l'affichage dans la console
  originalConsoleLog.apply(console, [logWithTimestamp]);
  
  // Écriture dans le fichier de log
  logStream.write(logWithTimestamp + '\n');
};

// Redéfinition de console.error pour écrire aussi dans le fichier
console.error = function() {
  const args = Array.from(arguments);
  const logMessage = args.map(arg => 
    typeof arg === 'object' && arg instanceof Error ? `${arg.message}\n${arg.stack}` :
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
  ).join(' ');
  
  // Ajouter un timestamp
  const timestamp = new Date().toISOString();
  const logWithTimestamp = `[${timestamp}] ERROR: ${logMessage}`;
  
  // Appel original pour l'affichage dans la console
  originalConsoleError.apply(console, [logWithTimestamp]);
  
  // Écriture dans le fichier de log
  logStream.write(logWithTimestamp + '\n');
};

// Initialisation de l'application
const app = express();

// Configuration CORS pour la production et le développement
const allowedOrigins = ['http://localhost:3000', 'https://revue-presse-scrap.vercel.app', 'https://revue-presse-jura.vercel.app', 'https://frontend-8nq0ilej2-goussots-projects.vercel.app', 'https://revue-presse-theo.vercel.app', 'https://frontend-f5k2m1tom-goussots-projects.vercel.app'];

const corsOptions = {
  origin: function (origin, callback) {
    // Permettre les requêtes sans origine (comme les appels API mobiles ou curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.CORS_ORIGIN === origin) {
      callback(null, true);
    } else {
      console.log(`CORS non autorisé pour l'origine: ${origin}`);
      // Au lieu de bloquer, autorisons toutes les origines en production
      callback(null, true);
    }
  },
  credentials: true,
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  optionsSuccessStatus: 200
};

// Middleware de base
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
})); // Sécurité moins restrictive
app.use(cors(corsOptions)); // Support des requêtes cross-origin avec configuration
app.use(express.json()); // Parser JSON
app.use(morgan('dev')); // Logging

// Limitation de débit pour éviter les abus
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limite chaque IP à 100 requêtes par fenêtre
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Trop de requêtes, veuillez réessayer plus tard'
});
app.use('/api/', limiter);

// Routes
const routes = require('./routes');
app.use('/api', routes);

// Middleware pour gérer les erreurs
app.use((err, req, res, next) => {
  console.error('ERREUR API:', err.stack);
  
  // Logging détaillé pour le débogage
  console.error('Détails de l\'erreur:');
  console.error('- Message:', err.message);
  console.error('- Nom:', err.name);
  console.error('- Code:', err.code);
  
  // Enregistrer les détails de la requête pour le débogage
  console.error('Détails de la requête:');
  console.error('- Méthode:', req.method);
  console.error('- URL:', req.originalUrl);
  console.error('- Paramètres:', req.params);
  console.error('- Query:', req.query);
  console.error('- Headers:', req.headers);
  
  res.status(500).json({
    message: "Une erreur est survenue sur le serveur",
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    details: process.env.NODE_ENV === 'development' ? {
      name: err.name,
      code: err.code,
      stack: err.stack
    } : undefined
  });
});

// Route par défaut
app.use('*', (req, res) => {
  res.status(404).json({ message: "Route non trouvée" });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});

module.exports = app; 