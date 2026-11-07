// Copied from QSOLKCB/VANILLAJS modules/frame-gate (Apache-2.0), unchanged below.
// SPDX-License-Identifier: Apache-2.0
// Source-inspired by QSOLKCB/ARCADE v0.4.0 (PR #2), commit
// 2284b78d713a46d8d51da26e4006787c95e9d326 (Apache-2.0).
// Explicit, fail-closed presentation-frame reuse; no canvas, clock or DOM.
const validKey=key=>typeof key==='string'||
  (typeof key==='number'&&Number.isFinite(key))||
  typeof key==='bigint';

/** Opt-in retained-frame decision gate for already-persistent presentation.
 * The caller owns a complete effective-input key, canvas/context lifecycle,
 * visible state and simulation. Never derive keys from mutable object identity.
 * Failing to bump a key/invalidate on any effective change is a caller defect.
 * draw must be synchronous; failed draws never publish an unchanged frame. */
export class FrameGate {
  #dirty=true;#generation=0;#last=null;#active=false;
  #draws=0;#skips=0;#invalidations=0;
  get dirty(){return this.#dirty;}
  invalidate(){
    this.#dirty=true;
    this.#generation++;
    this.#invalidations++;
  }
  /** The frame is valid only at this pixel size and context generation.
   * Use contextEpoch to force replay after context replacement/restoration.
   * Invalid arguments are rejected before draw or changes to the gate. */
  present({key,width,height,contextEpoch=0},draw){
    if(this.#active)throw Error('FrameGate is not reentrant');
    if(!validKey(key))throw new TypeError('complete primitive frame key required');
    if(!Number.isSafeInteger(width)||width<1||
       !Number.isSafeInteger(height)||height<1)
      throw new RangeError('frame pixel dimensions must be positive safe integers');
    if(!Number.isSafeInteger(contextEpoch)||contextEpoch<0)
      throw new RangeError('contextEpoch must be a nonnegative safe integer');
    if(typeof draw!=='function')throw new TypeError('synchronous draw callback required');
    const identity={key,width,height,contextEpoch};
    const last=this.#last;
    if(!this.#dirty&&last&&Object.is(last.key,key)&&
       last.width===width&&last.height===height&&
       last.contextEpoch===contextEpoch){this.#skips++;return false;}
    const generation=this.#generation;
    this.#active=true;
    try{
      const output=draw();
      if(output&&typeof output.then==='function')
        throw new TypeError('FrameGate does not accept async draw callbacks');
      this.#last=identity;
      this.#draws++;
      // A draw callback can itself invalidate the next presentation.
      this.#dirty=generation!==this.#generation;
      return true;
    }catch(error){
      this.#dirty=true;
      throw error;
    }finally{this.#active=false;}
  }
  stats(){return Object.freeze({drawn:this.#draws,skipped:this.#skips,
    invalidations:this.#invalidations,dirty:this.#dirty});}
}
