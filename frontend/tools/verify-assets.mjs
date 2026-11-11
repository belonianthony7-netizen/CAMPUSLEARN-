import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const root = resolve('public/assets/illustrations');
const required = [
  'course-tech.svg','course-math.svg','course-business.svg','course-language.svg',
  'course-science.svg','course-general.svg','cover-python.svg','cover-sql.svg',
  'cover-research.svg','cover-web.svg','catalogue-explore.svg','hero-learning.svg',
  'spotlight-path.svg','teacher-studio.svg','admin-control.svg',
];
for (const file of required) {
  const full=resolve(root,file);
  assert(existsSync(full),`Missing illustration: ${file}`);
  const content=readFileSync(full,'utf8');
  assert(content.startsWith('<svg') && content.includes('</svg>'),`Invalid SVG wrapper: ${file}`);
  assert(content.length>350,`Empty illustration: ${file}`);
}
const pageFiles=['src/app/shared/course-card.component.ts','src/app/pages/teacher.page.ts',
  'src/app/pages/admin.page.ts','src/app/pages/course-detail.page.ts'];
for(const file of pageFiles) assert(readFileSync(resolve(file),'utf8').includes('.svg') || readFileSync(resolve(file),'utf8').includes('coverFor') || readFileSync(resolve(file),'utf8').includes('artwork()'),`Missing illustration hookup in ${file}`);
console.log(`OK — ${required.length} SVG illustrations and 4 Angular integration points checked.`);
