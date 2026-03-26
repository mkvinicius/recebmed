const fs = require('fs');
const data = JSON.parse(fs.readFileSync('client/src/locales/en.json', 'utf8'));

function flatten(obj, prefix = '') {
  let keys = [];
  for (let key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      keys = keys.concat(flatten(obj[key], prefix + key + '.'));
    } else {
      keys.push(prefix + key);
    }
  }
  return keys;
}

const flatKeys = flatten(data);
flatKeys.sort().forEach(k => console.log(k));
