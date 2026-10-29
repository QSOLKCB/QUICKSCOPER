// CPU mesh-generation microbenchmark, not an FPS promise. Optional old renderer
// module path compares identical box geometry against a previous implementation.
import {performance} from 'node:perf_hooks';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {Mesh} from '../src/renderer.js';
const color=[0.23,0.49,0.45],boxes=128,frames=150;
function bench(Type,reuse){
  const mesh=new Type(),times=[];
  for(let pass=0;pass<6;pass++){
    const start=performance.now();
    for(let frame=0;frame<frames;frame++){
      const m=reuse?mesh.clear():new Type();
      for(let i=0;i<boxes;i++)m.box(i%12,1,-i/12,0.5,1,0.5,color,i*0.17);
      // Account for the old renderer's per-frame upload conversion.
      if(!reuse)new Float32Array(m.data);
    }
    if(pass)times.push((performance.now()-start)/frames);
  }
  times.sort((a,b)=>a-b);return Number(times[2].toFixed(3));
}
const current=bench(Mesh,true),result={boxesPerFrame:boxes,medianMilliseconds:current,particleVertices:{before:36,after:1},notes:'Node CPU mesh construction only; GPU, browser and device performance vary.'};
if(process.argv[2]){
  const old=await import(pathToFileURL(resolve(process.argv[2])));result.baselineMilliseconds=bench(old.Mesh,false);result.speedup=Number((result.baselineMilliseconds/current).toFixed(2));
}
console.log(JSON.stringify(result,null,2));
