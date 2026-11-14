const fs = require('fs');
const html = fs.readFileSync('/home/hatch/workspace/keiba-game/prototype/index.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n;\n');
function el(){ return new Proxy(function(){}, {
  get: (t, k) => { if (k === 'style') return {}; if (k === 'classList') return { add(){}, remove(){}, toggle(){}, contains: () => false }; if (k === 'dataset') return {}; if (k === 'children' || k === 'options') return []; if (k === 'value' || k === 'textContent' || k === 'innerHTML') return ''; if (k === Symbol.toPrimitive) return () => ''; return el(); },
  set: () => true, apply: () => el()
}); }
global.document = { querySelector: () => el(), querySelectorAll: () => [], getElementById: () => el(), createElement: () => el(), addEventListener(){}, body: el(), documentElement: el() };
const store = {};
global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
global.window = global; global.location = { href: '', reload(){} };
global.alert = () => {}; global.confirm = () => true;
const tests = fs.readFileSync('/tmp/tests.js', 'utf8');
eval(scripts + '\n;\n' + tests);
