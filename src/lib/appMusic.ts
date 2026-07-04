/**
 * Stumbling Fours — Casino App Song
 *
 * A looping soca-inflected casino groove synthesized entirely with the
 * Web Audio API. No audio files needed, works on all devices.
 *
 * Usage:
 *   appMusic.start()   — begin playback (safe to call multiple times)
 *   appMusic.stop()    — fade out and stop
 *   appMusic.playing   — current playback state
 */

const BPM = 120;
const BEAT = 60 / BPM;      // seconds per beat
const BAR  = BEAT * 4;      // 4/4 time

// ---------------------------------------------------------------------------
// Scales / harmony
// ---------------------------------------------------------------------------
// C major pentatonic: C3 E3 G3 A3 C4 E4 G4 A4
const MELODY_NOTES = [130.81, 164.81, 196.00, 220.00, 261.63, 329.63, 392.00, 440.00];
// Bass root: C2
const BASS_NOTE = 65.41;

// ---------------------------------------------------------------------------
// Tiny helpers
// ---------------------------------------------------------------------------
function ramp(param: AudioParam, value: number, time: number, rampTime = 0.01) {
  param.setValueAtTime(param.value, time);
  param.linearRampToValueAtTime(value, time + rampTime);
}

// ---------------------------------------------------------------------------
// Individual voice generators (all scheduled into the future)
// ---------------------------------------------------------------------------

/** Kick drum — short sine thump with pitch slide */
function scheduleKick(ctx: AudioContext, when: number, masterGain: GainNode) {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.frequency.setValueAtTime(150, when);
  osc.frequency.exponentialRampToValueAtTime(40, when + 0.12);
  env.gain.setValueAtTime(0, when);
  env.gain.linearRampToValueAtTime(0.9, when + 0.005);
  env.gain.exponentialRampToValueAtTime(0.001, when + 0.25);
  osc.connect(env).connect(masterGain);
  osc.start(when);
  osc.stop(when + 0.3);
}

/** Snare — filtered noise burst */
function scheduleSnare(ctx: AudioContext, when: number, masterGain: GainNode) {
  const bufSize = Math.ceil(ctx.sampleRate * 0.15);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 2000;
  filter.Q.value = 0.8;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, when);
  env.gain.linearRampToValueAtTime(0.55, when + 0.005);
  env.gain.exponentialRampToValueAtTime(0.001, when + 0.18);
  src.connect(filter).connect(env).connect(masterGain);
  src.start(when);
}

/** Hi-hat tick */
function scheduleHat(ctx: AudioContext, when: number, masterGain: GainNode, open = false) {
  const bufSize = Math.ceil(ctx.sampleRate * (open ? 0.12 : 0.04));
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 8000;
  const env = ctx.createGain();
  const peak = open ? 0.35 : 0.25;
  const decay = open ? 0.14 : 0.04;
  env.gain.setValueAtTime(0, when);
  env.gain.linearRampToValueAtTime(peak, when + 0.003);
  env.gain.exponentialRampToValueAtTime(0.001, when + decay);
  src.connect(filter).connect(env).connect(masterGain);
  src.start(when);
}

/** Bass line — two 16th-note patterns per bar */
function scheduleBass(ctx: AudioContext, barStart: number, masterGain: GainNode) {
  // Pattern: 1 . . . 2 . . . 3 . . . 4 . . .  (sixteenth offbeats on 2&4)
  const steps = [0, 0.5, 1.5, 2, 3, 3.5];
  for (const s of steps) {
    const t = barStart + s * BEAT * 0.5;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    const freq = s % 2 === 1 ? BASS_NOTE * 1.5 : BASS_NOTE; // fifth on off-beats
    osc.frequency.value = freq;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 400;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.45, t + 0.01);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(filter).connect(env).connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.25);
  }
}

/** Casino-style piano chord stabs */
function scheduleChords(ctx: AudioContext, barStart: number, masterGain: GainNode) {
  // Two stabs per bar — beats 2 and 4 (soca "chop" feel)
  const chords = [
    [MELODY_NOTES[0], MELODY_NOTES[2], MELODY_NOTES[4]], // C major
    [MELODY_NOTES[1], MELODY_NOTES[3], MELODY_NOTES[5]], // E A C
  ];
  [1, 3].forEach((beat, i) => {
    const t = barStart + beat * BEAT;
    const chord = chords[i % chords.length];
    for (const freq of chord) {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.18, t + 0.01);
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(env).connect(masterGain);
      osc.start(t);
      osc.stop(t + 0.3);
    }
  });
}

/** Melody arpeggio — classic casino twinkle */
function scheduleMelody(ctx: AudioContext, barStart: number, masterGain: GainNode, barIndex: number) {
  // 8 sixteenth notes, picking from the pentatonic in a looping pattern
  const pattern = [0, 2, 4, 5, 4, 2, 3, 1];
  for (let i = 0; i < 8; i++) {
    const idx = (pattern[i] + barIndex * 2) % MELODY_NOTES.length;
    const freq = MELODY_NOTES[idx];
    const t = barStart + i * (BEAT / 2);
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.22, t + 0.01);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(env).connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.2);
  }
}

/** Schedule one full bar (kick/snare/hat/bass/chords/melody) */
function scheduleBar(ctx: AudioContext, barStart: number, masterGain: GainNode, barIndex: number) {
  // Kick on beats 1 & 3
  scheduleKick(ctx, barStart, masterGain);
  scheduleKick(ctx, barStart + 2 * BEAT, masterGain);

  // Snare on beats 2 & 4
  scheduleSnare(ctx, barStart + 1 * BEAT, masterGain);
  scheduleSnare(ctx, barStart + 3 * BEAT, masterGain);

  // 8th note hi-hats, open on beat 3 offbeat
  for (let i = 0; i < 8; i++) {
    scheduleHat(ctx, barStart + i * BEAT * 0.5, masterGain, i === 5);
  }

  scheduleBass(ctx, barStart, masterGain);
  scheduleChords(ctx, barStart, masterGain);
  scheduleMelody(ctx, barStart, masterGain, barIndex);
}

// ---------------------------------------------------------------------------
// Public singleton
// ---------------------------------------------------------------------------
class AppMusic {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private schedulerId: ReturnType<typeof setInterval> | null = null;
  private nextBarTime = 0;
  private barIndex = 0;
  playing = false;

  /** Start or resume playback */
  start() {
    if (this.playing) return;
    this.playing = true;

    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!this.ctx || this.ctx.state === "closed") {
      this.ctx = new Ctx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0;
      this.masterGain.connect(this.ctx.destination);
    }

    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }

    // Fade in
    ramp(this.masterGain!.gain, 0.72, this.ctx.currentTime, 0.8);

    this.nextBarTime = this.ctx.currentTime + 0.1;
    this.barIndex = 0;
    this._tick();
    // Schedule lookahead every 100ms
    this.schedulerId = setInterval(() => this._tick(), 100);
  }

  /** Stop with a short fade-out */
  stop() {
    if (!this.playing) return;
    this.playing = false;
    if (this.schedulerId !== null) {
      clearInterval(this.schedulerId);
      this.schedulerId = null;
    }
    if (this.masterGain && this.ctx) {
      ramp(this.masterGain.gain, 0, this.ctx.currentTime, 0.6);
      // Close context after fade
      setTimeout(() => {
        this.ctx?.close();
        this.ctx = null;
        this.masterGain = null;
      }, 800);
    }
  }

  private _tick() {
    if (!this.ctx || !this.masterGain) return;
    // Schedule ahead by 0.3s
    while (this.nextBarTime < this.ctx.currentTime + 0.3) {
      scheduleBar(this.ctx, this.nextBarTime, this.masterGain, this.barIndex);
      this.nextBarTime += BAR;
      this.barIndex++;
    }
  }
}

export const appMusic = new AppMusic();
