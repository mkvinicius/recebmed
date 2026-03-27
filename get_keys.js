const fs = require('fs');

function flatten(obj, prefix = '') {
  let keys = [];
  for (const key in obj) {
    const newKey = prefix ? \`\${prefix}.\${key}\` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      keys = keys.concat(flatten(obj[key], newKey));
    } else {
      keys.push(newKey);
    }
  }
  return keys;
}

const locales = ['en.json', 'es.json', 'fr.json', 'pt-BR.json'];
locales.forEach(file => {
  const content = JSON.parse(fs.readFileSync(\`client/src/locales/\${file}\`, 'utf8'));
  const keys = flatten(content);
  fs.writeFileSync(\`\${file.split('.')[0]}_keys.txt\`, keys.sort().join('\n'));
});
