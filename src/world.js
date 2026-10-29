import {boxAt} from './math.js';
export const PALETTE = {
  ground:[0.24,0.28,0.28], concrete:[0.49,0.52,0.49], dark:[0.13,0.19,0.20],
  rust:[0.57,0.27,0.16], blue:[0.20,0.37,0.39], yellow:[0.86,0.81,0.37],
  white:[0.78,0.81,0.73], light:[0.85,0.92,0.72]
};
export function makeWorld() {
  const geometry = [], solids = [];
  const add = (x,y,z,w,h,d,color,solid=false) => {
    const b={x,y,z,w,h,d,color,...boxAt(x,y,z,w,h,d)};
    geometry.push(b); if(solid) solids.push(b); return b;
  };
  const p=PALETTE;
  add(0,-0.25,-6,54,0.5,66,p.ground);
  // The original Switchyard: three connected lanes, low cover, and two gantries.
  add(-25,2,-6,1,4,64,p.concrete,true); add(25,2,-6,1,4,64,p.concrete,true);
  add(0,2,-38,51,4,1,p.concrete,true); add(0,2,26,51,4,1,p.concrete,true);
  for(let x=-24;x<=24;x+=8) {
    add(x,3.8,-37.3,0.3,1.3,0.35,p.dark); add(x,0.012,-6,0.075,0.025,60,[0.32,0.35,0.33]);
  }
  for(let z=-34;z<=22;z+=8) add(0,0.014,z,48,0.028,0.075,[0.32,0.35,0.33]);
  const container=(x,z,w,d,c)=>{
    add(x,1.7,z,w,3.4,d,c,true);
    add(x,3.46,z,w+0.14,0.12,d+0.14,p.dark);
    for(let a=-w/2+0.35;a<w/2;a+=0.65) {
      add(x+a,1.7,z+d/2+0.015,0.07,3.15,0.07,p.dark);
      add(x+a,1.7,z-d/2-0.015,0.07,3.15,0.07,p.dark);
    }
    add(x,2.4,z+d/2+0.07,w*0.45,0.13,0.04,p.white);
  };
  container(-13,-6,7,11,p.rust); container(13,-14,7,11,p.blue);
  container(-17,-28,8,5,p.blue); container(17,12,8,5,p.rust);
  const barrier=(x,z,w=4)=>{
    add(x,0.6,z,w,1.2,1.05,p.concrete,true);
    add(x,1.23,z,w+0.08,0.08,1.12,p.dark);
    for(let a=-w/2+0.3;a<w/2;a+=0.65) add(x+a,0.65,z+0.54,0.29,0.45,0.04,p.yellow);
  };
  barrier(-4,4,4); barrier(6,-6,4); barrier(-5,-21,4); barrier(18,-28,5);
  barrier(-20,10,3); barrier(9,19,3);
  const crate=(x,z,size=1.5)=>{
    add(x,size/2,z,size,size,size,[0.39,0.35,0.25],true);
    add(x,size*0.48,z+size/2+0.015,size*0.85,0.14,0.045,p.dark);
    add(x-size*0.27,size/2,z+size/2+0.04,0.08,size,0.05,p.yellow);
  };
  crate(-8,12); crate(-10,12); crate(6,-28,2); crate(8.1,-28,2); crate(21,-3);
  for(const z of [-30,8]) {
    for(const x of [-22,22]) {add(x,4.5,z,0.65,9,0.65,p.dark,true);add(x,4.6,z+0.35,0.22,1.4,0.05,p.yellow);}
    add(0,8.7,z,45,0.6,0.65,p.dark); add(0,8.35,z,44,0.12,0.5,p.yellow);
    for(let x=-20;x<=20;x+=5) {add(x,8,z,0.8,0.12,1.5,p.light);add(x,8.4,z,0.1,1,0.1,p.dark);}
  }
  // Striped firing bay and lane markings.
  for(const x of [-2.9,2.9]) add(x,0.035,16,0.12,0.05,10,p.yellow);
  for(const z of [11,21]) add(0,0.04,z,5.8,0.05,0.12,p.yellow);
  for(let z=-32;z<8;z+=4) add(0,0.025,z,0.12,0.04,1.5,p.yellow);
  // Silhouette buildings beyond the playable boundary.
  for(let i=0;i<13;i++) {
    const x=-54+i*9,h=7+(i*7%13);
    add(x,h/2,-60-(i%3)*6,6+(i%3)*2,h,9,[0.34,0.43,0.43]);
    add(x,h+0.5,-60-(i%3)*6,2,1,2,p.dark);
  }
  add(-42,9,-12,15,18,27,[0.29,0.37,0.37]);add(40,6,-25,15,12,21,[0.34,0.41,0.41]);
  return {geometry,solids,spawns:[[-4,-9],[5,-17],[2,-29],[-18,-17],[18,0],[-13,15],[17,-31],[5,7]]};
}
