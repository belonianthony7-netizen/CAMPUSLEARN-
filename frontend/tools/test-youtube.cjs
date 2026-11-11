/** Pure URL parsing unit tests — runs after npm install (typescript is a devDependency). */
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = readFileSync('src/app/core/youtube.ts','utf8');
const js = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const context={exports:{},URL,Set};
vm.runInNewContext(js,context);
const {youtubeVideoId,canonicalYoutubeUrl}=context.exports;
const id='M7lc1UVf-VE';
for (const url of [id,`https://www.youtube.com/watch?v=${id}`,`https://youtu.be/${id}?t=34`,`https://www.youtube.com/shorts/${id}`,`https://m.youtube.com/live/${id}`,`https://www.youtube-nocookie.com/embed/${id}`]) {
  assert.equal(youtubeVideoId(url),id,url);
  assert.equal(canonicalYoutubeUrl(url),`https://www.youtube.com/watch?v=${id}`);
}
for(const url of [`https://youtube.com.evil.net/watch?v=${id}`,`https://www.youtube.com:1234/watch?v=${id}`,`https://www.youtube.com@evil.net/watch?v=${id}`,'javascript:alert(1)','https://youtu.be/INVALID','https://www.youtube.com/watch?v='+id+'&v=xxxxxxxxxxx']) {
 assert.equal(youtubeVideoId(url),null,url);
}
console.log('OK — YouTube URLs recognized, canonicalized and unsafe hosts rejected.');
