const fs = require('fs');

const locales = ['en', 'es', 'fr', 'pt-BR'];
const keySets = locales.reduce((acc, lang) => {
  acc[lang] = new Set(fs.readFileSync(lang + '_keys.txt', 'utf8').trim().split('\n'));
  return acc;
}, {});

const allKeys = new Set();
Object.values(keySets).forEach(set => set.forEach(k => allKeys.add(k)));

console.log('--- Missing Keys in Locales ---');
allKeys.forEach(key => {
  const missing = locales.filter(lang => !keySets[lang].has(key));
  if (missing.length > 0) {
    console.log(key + ' is missing in: ' + missing.join(', '));
  }
});

const usedKeys = new Set(fs.readFileSync('used_keys.txt', 'utf8').trim().split('\n').filter(k => k.length > 1 && !['-', '.', '/', 'T'].includes(k)));

console.log('\n--- Undefined Keys used in t() calls ---');
usedKeys.forEach(key => {
  if (!allKeys.has(key)) {
    // Check if it's a dynamic key with interpolation or if it's really missing
    // For now report all
    console.log('Key "' + key + '" used in code but not found in any locale file.');
  }
});

console.log('\n--- Unused Keys in Locale files ---');
allKeys.forEach(key => {
  if (!usedKeys.has(key)) {
    console.log('Key "' + key + '" is defined in locale files but not found in t() calls.');
  }
});
