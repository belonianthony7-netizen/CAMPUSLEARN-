import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = join(process.cwd(), 'public/assets/lottie');
const pages = join(process.cwd(), 'src/app/pages');
const declarations = {
  'book-loading': ['dashboard.page.ts', 'courses.page.ts', 'course-detail.page.ts', 'teacher.page.ts'],
  'loading-book': ['course-detail.page.ts'],
  'success-checkmark': ['course-detail.page.ts'],
  'education-certificate': ['course-detail.page.ts'],
  'education-animation': ['dashboard.page.ts', 'courses.page.ts', 'teacher.page.ts', 'course-detail.page.ts'],
};
const implementation = readFileSync(join(process.cwd(), 'src/app/shared/learning-lottie.component.ts'), 'utf8');
const fullName = (name, ext) => join(root, `${name}.${ext}`);
const config = JSON.parse(readFileSync(join(process.cwd(),'angular.json'),'utf8'));
const copiedAssets = config.projects.campuslearn.architect.build.options.assets;
if (!copiedAssets.some(x => x.glob === 'dotlottie-player.wasm' && x.input.includes('dotlottie-web/dist'))) throw Error('Missing local WebAssembly asset copy: player would require a CDN');
if (!implementation.includes("DotLottie.setWasmUrl('/assets/lottie/engine/dotlottie-player.wasm')")) throw Error('Runtime not pointed at local WASM');
let verified = 0;
for (const [name, usedBy] of Object.entries(declarations)) {
  for (const ext of ['json', 'lottie']) {
    const path = fullName(name, ext);
    if (!existsSync(path) || statSync(path).size < 100) throw Error(`Lottie manquante ou vide : ${path}`);
  }
  const json = JSON.parse(readFileSync(fullName(name, 'json'), 'utf8'));
  for (const field of ['v', 'w', 'h', 'layers']) if (!(field in json)) throw Error(`${name}.json sans ${field}`);
  const bytes = readFileSync(fullName(name, 'lottie'));
  if (bytes.subarray(0, 2).toString('utf8') !== 'PK') throw Error(`${name}.lottie n'est pas une archive ZIP`);
  for (const asset of json.assets ?? []) {
    if (asset.p && !asset.e && !existsSync(join(root, asset.u ?? '', asset.p))) {
      throw Error(`Image manquante : ${name}/${asset.u}/${asset.p}`);
    }
  }
  if (!implementation.includes(`'${name}'`)) throw Error(`${name} non déclaré dans le composant`);
  for (const file of usedBy) {
    const code = readFileSync(join(pages, file), 'utf8');
    if (!code.includes(`'${name}'`) && !code.includes(`"${name}"`)) throw Error(`${name} sans intégration dans ${file}`);
  }
  verified++;
}
console.log(`OK — ${verified} animations Lottie (JSON, dotLottie, images, usages Angular).`);
