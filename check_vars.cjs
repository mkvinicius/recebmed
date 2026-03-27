const fs = require('fs');

const locales = ['en.json', 'es.json', 'fr.json', 'pt-BR.json'];
const results = {};

function getVars(str) {
  const matches = str.match(/{{[^}]+}}/g);
  return matches ? matches.sort() : [];
}

function check(obj, prefix = '') {
  for (const key in obj) {
    const fullKey = prefix ? prefix + '.' + key : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      check(obj[key], fullKey);
    } else if (typeof obj[key] === 'string') {
      const vars = getVars(obj[key]);
      if (!results[fullKey]) results[fullKey] = {};
      results[fullKey][currentLang] = vars;
    }
  }
}

let currentLang;
locales.forEach(file => {
  currentLang = file.split('.')[0];
  const content = JSON.parse(fs.readFileSync('client/src/locales/' + file, 'utf8'));
  check(content);
});

for (const key in results) {
  const langs = Object.keys(results[key]);
  if (langs.length > 1) {
    const firstVars = JSON.stringify(results[key][langs[0]]);
    for (let i = 1; i < langs.length; i++) {
      if (JSON.stringify(results[key][langs[i]]) !== firstVars) {
        console.log('Inconsistent variables for key "' + key + '":');
        langs.forEach(l => console.log('  ' + l + ': ' + (results[key][l].length ? results[key][l].join(', ') : 'none')));
      }
    }
  }
}
