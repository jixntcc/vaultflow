'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');

const html=fs.readFileSync(path.join(root,'public','index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'public','css','app.css'),'utf8');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'public','manifest.json'),'utf8'));
const sw=fs.readFileSync(path.join(root,'public','sw.js'),'utf8');
const matrix=JSON.parse(fs.readFileSync(path.join(root,'docs','phase8c-device-test-matrix.json'),'utf8'));

const head=html.slice(0,html.toLowerCase().indexOf('</head>'));
const viewport=head.match(/<meta\s+name=["']viewport["'][^>]*>/gi)||[];
assert.strictEqual(viewport.length,1,'Exactly one viewport declaration is required.');
assert(/width=device-width/i.test(viewport[0]),'Viewport must use device width.');

assert(/<link[^>]+rel=["']manifest["'][^>]+href=["']\/manifest\.json["']/i.test(head),'Manifest link missing.');
assert.strictEqual(manifest.display,'standalone','PWA display must remain standalone.');
assert.strictEqual(manifest.start_url,'/','PWA start_url must remain root.');
assert(fs.existsSync(path.join(root,'public','sw.js')),'Service worker file missing.');
assert(/serviceWorker\.register\(['"]\/sw\.js['"]\)/.test(html),'Service worker registration missing.');

assert(css.includes('grid-template-columns:repeat(5, minmax(0, 1fr));'),'Desktop five-column contract missing.');
assert(css.includes('@media (max-width: 768px)'),'Mobile breakpoint missing.');
assert(css.includes('min-height: 44px'),'Touch target baseline missing.');
assert(css.includes('max-height: calc(100dvh - 24px)'),'Mobile modal viewport guard missing.');
assert(css.includes('env(safe-area-inset-bottom)'),'Safe-area handling missing.');

const requiredFlows=['auth','dashboard','transactions','vaults','goals','habits','reports','settings','pwa','offline-sync','recovery'];
for(const id of requiredFlows) assert(matrix.flows.some(x=>x.id===id),`Missing device flow: ${id}`);
for(const v of matrix.viewports) assert(v.width>0&&v.height>0,`Invalid viewport: ${v.id}`);

assert(sw.length>1000,'Service worker appears unexpectedly small.');
assert(/fetch/i.test(sw),'Service worker must contain fetch handling.');

console.log('Phase 8C device-matrix static contract passed.');
console.log(`Manual matrix: ${matrix.viewports.length} viewport targets × ${matrix.flows.length} critical flows.`);
