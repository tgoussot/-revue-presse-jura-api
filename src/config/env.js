const dotenv = require('dotenv');
const path = require('path');

// Charger les variables d'environnement depuis .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Définir les variables d'environnement par défaut
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

// Vérifier les variables d'environnement requises
const requiredEnvs = [];

requiredEnvs.forEach((env) => {
  if (!process.env[env]) {
    console.warn(`⚠️  Variable d'environnement requise: ${env}`);
  }
}); 