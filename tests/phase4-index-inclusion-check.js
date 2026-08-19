
'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');

const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'public/css/app.css'),'utf8');

const required=[
  '/css/app.css',
  '/js/core/store.js',
  '/js/core/api-client.js',
  '/js/core/habit-domain.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.9/dist/chart.umd.min.js'
];
for(const ref of required) assert(html.includes(ref),`Missing inclusion: ${ref}`);

const pos=ref=>html.indexOf(ref);
assert(pos('/css/app.css')<pos('/js/core/store.js'));
assert(pos('/js/core/store.js')<pos('/js/core/api-client.js'));
assert(pos('/js/core/api-client.js')<pos('/js/core/habit-domain.js'));
assert(pos('/js/core/habit-domain.js')<pos('chart.js@4.4.9/dist/chart.umd.min.js'));

for(const ref of ['/css/app.css','/js/core/store.js','/js/core/api-client.js','/js/core/habit-domain.js','/manifest.json','/icons/icon-192.svg']){
  assert(fs.existsSync(path.join(root,'public',ref.slice(1))),`Missing local resource: ${ref}`);
}

assert(!/<link[^>]+href=["'][^"']*\.css["'][^>]*rel=/i.test(html), 'Unexpected reversed stylesheet attributes');
assert(css.includes('.phase4-command-overlay'));
assert(css.includes('.phase4-dashboard-grid'));
assert(css.split('{').length===css.split('}').length,'Unbalanced CSS braces');

console.log('VaultFlow index.html dependency/inclusion assertions passed.');
