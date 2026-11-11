import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const assetRoot=path.resolve('public/assets');
const catalog=fs.readFileSync('src/app/core/illustration-catalog.ts','utf8');
const items=[...catalog.matchAll(/\{id:"([^"]+)",name:"[^"]+",group:"(vector|pastel|doodle|icons3d)",src:/g)];
const byGroup=Object.groupBy(items,match=>match[2]);
assert.equal(items.length,74);
for(const [key,n] of Object.entries({vector:15,pastel:10,doodle:33,icons3d:16})) assert.equal((byGroup[key]||[]).length,n,key);
const paths=[...fs.readdirSync(path.join(assetRoot,'illustrations')).filter(s=>s.endsWith('.svg')).map(s=>path.join(assetRoot,'illustrations',s)),...fs.readdirSync(path.join(assetRoot,'illustrations/3d')).filter(s=>s.endsWith('.png')).map(s=>path.join(assetRoot,'illustrations/3d',s))];
assert.equal(paths.length,25);
for(const p of paths)assert(fs.statSync(p).size>300,`Asset not present or empty ${p}`);
const lotties=['book-loading','loading-book','success-checkmark','education-certificate','education-animation'];
for(const name of lotties){for(const ext of ['json','lottie']){const p=path.join(assetRoot,'lottie',`${name}.${ext}`);assert(fs.statSync(p).size>100,p);}}
const schemas=fs.readFileSync('../backend/app/illustrations.py','utf8');
for(const match of items){if(match[2]==='pastel')assert(schemas.includes(match[1].replace(/^pastel-/,'') ));}
console.log('OK — 15 SVG + 10 PNG 3D locaux, 5 Lottie, 33 Open Doodles + 16 3dicons CC0 catalogués, schéma backend présent.');
