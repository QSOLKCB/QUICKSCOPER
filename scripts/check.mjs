import {readFile,readdir,stat} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const sources=(await readdir('src')).filter(f=>f.endsWith('.js')).map(f=>'src/'+f).concat(['sw.js']);
let bytes=0;
for(const path of sources){
 const result=spawnSync(process.execPath,['--check',path],{stdio:'inherit'});if(result.status!==0)process.exit(1);
 const code=await readFile(path,'utf8');
 if(/(?:import|export).*from\s*['"](?:https?:|\/\/)/.test(code))throw new Error('Remote runtime import: '+path);
 for(const [,ref] of code.matchAll(/from\s+['"](\.[^'"]+)['"]/g))await stat(new URL(ref,new URL('../'+path,import.meta.url)));
 bytes+=Buffer.byteLength(code);
}
const html=await readFile('index.html','utf8');
for(const [,ref] of html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g))await stat(ref);
JSON.parse(await readFile('manifest.webmanifest','utf8'));
console.log(`Syntax and local asset checks passed. ${sources.length} runtime scripts, ${bytes.toLocaleString()} JS bytes.`);
