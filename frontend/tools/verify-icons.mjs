import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';

const src = resolve('src/app');
const main = readFileSync(resolve('src/main.ts'), 'utf8');
const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));
const registry = new Set([...main.matchAll(/\bLucide([A-Z][a-zA-Z0-9]*)\b/g)].map(m =>
  m[1].replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()));
const all = [];
function walk(folder) {
  for (const item of readdirSync(folder, { withFileTypes: true })) {
    const full = join(folder, item.name);
    if (item.isDirectory()) walk(full);
    else if (item.name.endsWith('.ts')) all.push(full);
  }
}
walk(src);
let count = 0;
for (const file of all) {
  const source = readFileSync(file, 'utf8');
  assert(!/\bpi pi-|<i\s/.test(source), `PrimeIcons remaining: ${file}`);
  if (!source.includes('<app-icon')) continue;
  assert(source.includes('IconComponent'), `Component not imported: ${file}`);
  for (const m of source.matchAll(/<app-icon\s+name="([^"]+)"/g)) {
    assert(registry.has(m[1]), `Lucide icon not registered: ${m[1]} in ${file}`);
    count++;
  }
  // Conditional icon names (status alert & password visibility).
  for (const m of source.matchAll(/<app-icon\s+\[name\]="([^"]+)"/g)) {
    for (const name of [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1])) {
      assert(registry.has(name), `Conditional icon not registered: ${name} in ${file}`);
    }
    count++;
  }
}
assert(pkg.dependencies['@lucide/angular'], 'Missing @lucide/angular dependency');
assert(!pkg.dependencies.primeicons, 'PrimeIcons still installed');
const css = readFileSync(resolve('src/styles.css'), 'utf8');
assert(!css.includes('primeicons/'), 'Old PrimeIcons CSS import');
assert(count >= 100, `Expected at least 100 icon instances, found ${count}`);
console.log(`OK — ${count} Lucide icon occurrences verified across the Angular templates; ${registry.size} registered icons.`);
