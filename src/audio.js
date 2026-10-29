import {MUSIC_STEP,musicStep,noteHz} from './music.js';
// All sounds are synthesized locally. No samples, tracks, or network requests.
export class Sound {
  constructor(){this.context=null;this.volume=0.45;this.musicVolume=0.3;this.muted=false;this.musicActive=false;this.musicVoices=new Set();this.musicIndex=0;this.nextNote=0;}
  start(){
    try{
      if(!this.context){
        const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)return;
        this.context=new Audio();this.master=this.context.createGain();this.master.connect(this.context.destination);
        this.musicGain=this.context.createGain();this.musicGain.gain.value=this.musicVolume;this.musicGain.connect(this.master);
        const n=this.context.sampleRate*0.4;this.noise=this.context.createBuffer(1,n,this.context.sampleRate);
        const a=this.noise.getChannelData(0);for(let i=0;i<n;i++)a[i]=Math.random()*2-1;
      }
      this.master.gain.value=this.muted?0:this.volume;
      this.context.resume().catch(()=>{});
    }catch{this.context=null;}
  }
  setVolume(value){this.volume=value;if(this.master)this.master.gain.value=this.muted?0:value;}
  setMusicVolume(value){this.musicVolume=value;if(this.musicGain)this.musicGain.gain.setTargetAtTime(value,this.context.currentTime,0.02);if(!value)this.stopMusic();}
  stopMusic(){
    this.musicActive=false;
    for(const voice of this.musicVoices){try{voice.stop();}catch{/* Already ended. */}}
    this.musicVoices.clear();
  }
  music(active,intensity=0){
    const c=this.context;
    if(!active||!c||c.state!=='running'||!this.volume||!this.musicVolume||this.muted){if(this.musicActive)this.stopMusic();return;}
    if(!this.musicActive){this.musicActive=true;this.nextNote=c.currentTime+0.025;}
    // Audio-clock lookahead. A delayed frame skips the backlog, never bursts it.
    if(this.nextNote<c.currentTime-0.05)this.nextNote=c.currentTime+0.025;
    let scheduled=0;
    while(this.nextNote<c.currentTime+0.12&&scheduled++<3){
      for(const n of musicStep(this.musicIndex,intensity))this.tone(noteHz(n.note),n.duration,n.type,n.volume,this.nextNote-c.currentTime,n.end||noteHz(n.note),true);
      this.nextNote+=MUSIC_STEP;this.musicIndex++;
    }
  }
  toggle(){this.muted=!this.muted;if(this.master)this.master.gain.value=this.muted?0:this.volume;return this.muted;}
  tone(frequency,duration,type='sine',volume=0.1,delay=0,end=frequency,music=false){
    const c=this.context;if(!c||c.state!=='running'||this.muted)return;
    const t=c.currentTime+delay,o=c.createOscillator(),g=c.createGain();
    o.type=type;o.frequency.setValueAtTime(frequency,t);o.frequency.exponentialRampToValueAtTime(Math.max(10,end),t+duration);
    g.gain.setValueAtTime(0.001,t);g.gain.linearRampToValueAtTime(volume,t+0.003);g.gain.exponentialRampToValueAtTime(0.001,t+duration);
    o.connect(g);g.connect(music?this.musicGain:this.master);o.start(t);o.stop(t+duration+0.01);
    if(music)this.musicVoices.add(o);
    o.onended=()=>{this.musicVoices.delete(o);o.disconnect();g.disconnect();};
  }
  burst(duration,volume,cutoff,delay=0){
    const c=this.context;if(!c||c.state!=='running'||this.muted)return;
    const t=c.currentTime+delay,n=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();
    n.buffer=this.noise;f.type='lowpass';f.frequency.value=cutoff;
    g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(0.001,t+duration);
    n.connect(f);f.connect(g);g.connect(this.master);n.start(t);n.stop(t+duration);n.onended=()=>{n.disconnect();f.disconnect();g.disconnect();};
  }
  play(type){
    if(type==='shot'){this.burst(0.22,0.7,4500);this.tone(130,0.24,'triangle',0.6,0,38);this.burst(0.1,0.12,1800,0.14);this.burst(0.07,0.15,6000,0.36);this.tone(180,0.07,'square',0.04,0.6,90);}
    if(type==='hit'){this.tone(1200,0.045,'triangle',0.22);this.tone(750,0.055,'sine',0.1,0.04);}
    if(type==='kill'){this.tone(660,0.08,'sine',0.15);this.tone(990,0.12,'sine',0.13,0.06);}
    if(type==='collateral'){[440,660,880,1320].forEach((f,i)=>this.tone(f,0.16,'triangle',0.12,i*0.065));}
    if(type==='scope'){this.burst(0.065,0.12,1400);this.tone(230,0.06,'triangle',0.07,0,380);}
    if(type==='reload'){this.burst(0.1,0.15,3000);this.tone(130,0.08,'square',0.04);}
    if(type==='loaded'){this.burst(0.07,0.2,4000);this.tone(220,0.05,'square',0.04);}
    if(type==='damage'){this.burst(0.14,0.2,600);this.tone(80,0.15,'triangle',0.2,0,30);}
    if(type==='enemyShot'){this.burst(0.06,0.07,1600);}
    if(type==='start'){[330,440,660].forEach((f,i)=>this.tone(f,0.12,'triangle',0.1,i*0.1));}
    if(type==='end'){[660,550,440,330].forEach((f,i)=>this.tone(f,0.24,'sine',0.12,i*0.12));}
  }
}
