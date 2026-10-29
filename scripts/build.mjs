import {mkdir,rm,cp,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const out=join(root,'dist');
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
for(const path of ['index.html','style.css','icon.svg','manifest.webmanifest','sw.js','src','LICENSE'])await cp(join(root,path),join(out,path),{recursive:true});
await writeFile(join(out,'.nojekyll'),'');
console.log('Static game packaged in dist/ (no dependencies or compilation).');
