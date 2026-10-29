// One shared flow field for all six bots. Recompute only when the player changes
// grid cells; reuse typed scratch arrays. Cardinal routes cannot cut cover corners.
export class Navigation {
  constructor(solids){
    this.solids=solids;this.width=25;this.height=32;this.target=-1;
    const size=this.width*this.height;
    this.open=new Uint8Array(size);this.distance=new Int16Array(size);this.queue=new Int16Array(size);
    for(let i=0;i<size;i++){
      const [x,z]=this.point(i);
      this.open[i]=!solids.some(b=>b.min[1]<2.2&&b.max[1]>0.01&&x+0.48>b.min[0]&&x-0.48<b.max[0]&&z+0.48>b.min[2]&&z-0.48<b.max[2]);
    }
  }
  point(i){return [-24+(i%this.width)*2,-37+Math.floor(i/this.width)*2];}
  cell(x,z){return Math.max(0,Math.min(this.height-1,Math.round((z+37)/2)))*this.width+Math.max(0,Math.min(this.width-1,Math.round((x+24)/2)));}
  neighbors(i){const x=i%this.width;return [x?i-1:-1,x<this.width-1?i+1:-1,i-this.width,i+this.width];}
  toward(x,z,px,pz){
    let target=this.cell(px,pz);
    if(!this.open[target]){
      let best=Infinity;
      for(let i=0;i<this.open.length;i++)if(this.open[i]){const p=this.point(i),d=(p[0]-px)**2+(p[1]-pz)**2;if(d<best){best=d;target=i;}}
    }
    if(target!==this.target){
      this.target=target;this.distance.fill(-1);let head=0,tail=1;this.queue[0]=target;this.distance[target]=0;
      while(head<tail){const i=this.queue[head++];for(const n of this.neighbors(i))if(n>=0&&n<this.open.length&&this.open[n]&&this.distance[n]<0){this.distance[n]=this.distance[i]+1;this.queue[tail++]=n;}}
    }
    const cell=this.cell(x,z);let best=cell,value=this.distance[cell]<0?32767:this.distance[cell];
    for(const n of this.neighbors(cell))if(n>=0&&n<this.open.length&&this.distance[n]>=0&&this.distance[n]<value){best=n;value=this.distance[n];}
    return this.point(best);
  }
}
