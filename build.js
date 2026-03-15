// build.js — runs on Netlify before deploy
// Reads Firebase config from environment variables and writes firebase-config.js
// firebase-config.js is gitignored and never committed to the repo

const fs = require('fs');

const required = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_DATABASE_URL',
  'FIREBASE_PROJECT_ID',
];

const missing = required.filter(k => !process.env[k]);
if (missing.length) {
  console.error('❌ Missing environment variables:', missing.join(', '));
  console.error('   Set them in Netlify: Site configuration → Environment variables');
  process.exit(1);
}

const config = `// Auto-generated at build time from Netlify environment variables.
// Do NOT commit this file — it is listed in .gitignore.
window.FIREBASE_CONFIG = {
  apiKey:      "${process.env.FIREBASE_API_KEY}",
  authDomain:  "${process.env.FIREBASE_AUTH_DOMAIN}",
  databaseURL: "${process.env.FIREBASE_DATABASE_URL}",
  projectId:   "${process.env.FIREBASE_PROJECT_ID}",
};
`;

fs.writeFileSync('firebase-config.js', config);
console.log('✓ firebase-config.js generated');
