/**
 * Procedural sound effects via the Web Audio API. No external audio assets —
 * every sound is synthesised on the fly so the project ships zero copyrighted
 * audio. Created lazily and resumed on the first user gesture.
 */
export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private crowd: { gain: GainNode; src: AudioBufferSourceNode } | null = null;

  /** Must be called from a user gesture to satisfy autoplay policies. */
  resume() {
    if (!this.ctx) {
      const AC =
        typeof window !== 'undefined'
          ? window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
          : null;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.02);
    }
  }

  isMuted() {
    return this.muted;
  }

  private now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  private noiseBuffer(duration: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * duration);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** Short percussive thud for a kick. */
  kick(power = 1) {
    if (!this.ctx || !this.master) return;
    const t = this.now();
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220 + power * 120, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.6, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.18);
    // Noise click for the boot.
    const n = this.ctx.createBufferSource();
    n.buffer = this.noiseBuffer(0.05);
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.25, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    n.connect(ng).connect(this.master);
    n.start(t);
  }

  pass() {
    this.kick(0.5);
  }

  /** Metallic ping for the post / crossbar. */
  post() {
    if (!this.ctx || !this.master) return;
    const t = this.now();
    [880, 1320].forEach((f, i) => {
      const osc = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      osc.connect(g).connect(this.master!);
      osc.start(t + i * 0.005);
      osc.stop(t + 0.42);
    });
  }

  /** Referee whistle. */
  whistle() {
    if (!this.ctx || !this.master) return;
    const t = this.now();
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1900, t);
    osc.frequency.linearRampToValueAtTime(2300, t + 0.18);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.03);
    g.gain.setValueAtTime(0.3, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    // Vibrato.
    const lfo = this.ctx.createOscillator();
    const lfoG = this.ctx.createGain();
    lfo.frequency.value = 18;
    lfoG.gain.value = 40;
    lfo.connect(lfoG).connect(osc.frequency);
    osc.connect(g).connect(this.master);
    osc.start(t);
    lfo.start(t);
    osc.stop(t + 0.42);
    lfo.stop(t + 0.42);
  }

  /** Goal horn + crowd swell. */
  goal() {
    if (!this.ctx || !this.master) return;
    const t = this.now();
    [392, 523, 659].forEach((f, i) => {
      const osc = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
      osc.connect(g).connect(this.master!);
      osc.start(t + i * 0.02);
      osc.stop(t + 1.25);
    });
    this.crowdSwell(1.0, 0.4);
  }

  /** UI confirm blip. */
  confirm() {
    if (!this.ctx || !this.master) return;
    const t = this.now();
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(660, t);
    osc.frequency.setValueAtTime(990, t + 0.06);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  /** Start the ambient crowd loop. */
  startCrowd() {
    if (!this.ctx || !this.master || this.crowd) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(2);
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 600;
    filter.Q.value = 0.7;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.05;
    src.connect(filter).connect(gain).connect(this.master);
    src.start();
    this.crowd = { gain, src };
  }

  private crowdSwell(duration: number, level: number) {
    if (!this.crowd || !this.ctx) return;
    const t = this.now();
    this.crowd.gain.gain.cancelScheduledValues(t);
    this.crowd.gain.gain.setValueAtTime(this.crowd.gain.gain.value, t);
    this.crowd.gain.gain.linearRampToValueAtTime(0.05 + level, t + 0.1);
    this.crowd.gain.gain.linearRampToValueAtTime(0.05, t + duration);
  }

  stopCrowd() {
    if (this.crowd) {
      try {
        this.crowd.src.stop();
      } catch {
        /* ignore */
      }
      this.crowd = null;
    }
  }
}

let singleton: Sound | null = null;
export function getSound(): Sound {
  if (!singleton) singleton = new Sound();
  return singleton;
}
