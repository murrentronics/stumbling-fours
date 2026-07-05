/**
 * Stumbling Fours — Casino App Song
 *
 * Synthesized casino groove using Web Audio API scheduled nodes.
 * Designed to be CPU-light: schedules 4 bars ahead, polls every 2 seconds
 * instead of every 100ms — 20× less JS overhead, same audio quality.
 *
 * SYNC STRATEGY
 * All devices derive their position from a shared wall-clock epoch
 * (EPOCH_MS). barIndex = floor((Date.now() - EPOCH_MS) / BAR_MS).
 * This means any device that starts or resumes will land on the same
 * bar as every other device — no drift, no re-start from bar 0.
 */

const BPM  = 120;
const BEAT = 60 / BPM;
const BAR  = BEAT * 4;
const BAR_MS = BAR * 1000;

// Fixed epoch — "bar 0" of the song. All devices share this anchor.
// Value: 2025-01-01 00:00:00 UTC (arbitrary fixed point in the past)
const EPOCH_MS = 1735689600000;

// Pre-schedule this many bars ahead (at 120bpm, 4 bars = 8 seconds ahead)
const LOOKAHEAD_BARS = 4;
// How often to check and schedule more bars (much less frequent = less CPU)
const SCHEDULE_INTERVAL_MS = 2000;

const MELODY_NOTES = [130.81, 164.81, 196.00, 220.00, 261.63, 329.63, 392.00, 440.00];
const BASS_NOTE    = 65.41;

/** Returns the global bar index for the current wall-clock moment. */
function globalBarIndex(): number {
  return Math.floor((Date.now() - EPOCH_MS) / BAR_MS);
}

/**
 * Given the current AudioContext time and wall-clock "now", returns
 * the AudioContext timestamp that corresponds to the start of the
 * next bar boundary on the global clock.
 */
function nextBarAudioTime(ctx: AudioContext): { audioTime: number; barIndex: number } {
  const nowMs      = Date.now();
  const elapsedMs  = nowMs - EPOCH_MS;
  // How far into the current bar are we (in ms)?
  const msIntoBar  = elapsedMs % BAR_MS;
  // How many ms until the next bar boundary?
  const msToNext   = BAR_MS - msIntoBar;
  const barIdx     = Math.floor(elapsedMs / BAR_MS) + 1; // next bar
  // Convert to AudioContext time
  const audioTime  = ctx.currentTime + msToNext / 1000;
  return { audioTime, barIndex: barIdx };
}

function ramp(param: AudioParam, value: number, time: number, rampTime = 0.01) {
  param.setValueAtTime(param.value, time);
  param.linearRampToValueAtTime(value, time + rampTime);
}

// ── Shared noise buffer (created once per AudioContext, reused for all hats/snares) ──
function makeNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const size = Math.ceil(ctx.sampleRate * seconds);
  const buf  = ctx.createBuffer(1, size, ctx.sampleRate);
  const d    = buf.getChannelData(0);
  for (let i = 0; i < size; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function scheduleKick(ctx: AudioContext, when: number, out: AudioNode) {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.frequency.setValueAtTime(150, when);
  osc.frequency.exponentialRampToValueAtTime(40, when + 0.12);
  env.gain.setValueAtTime(0.9, when);
  env.gain.exponentialRampToValueAtTime(0.001, when + 0.25);
  osc.connect(env).connect(out);
  osc.start(when); osc.stop(when + 0.3);
}

function scheduleSnare(ctx: AudioContext, when: number, out: AudioNode, noiseBuf: AudioBuffer) {
  const src    = ctx.createBufferSource();
  src.buffer   = noiseBuf;
  const filter = ctx.createBiquadFilter();
  filter.type  = "bandpass"; filter.frequency.value = 2000; filter.Q.value = 0.8;
  const env    = ctx.createGain();
  env.gain.setValueAtTime(0.55, when);
  env.gain.exponentialRampToValueAtTime(0.001, when + 0.18);
  src.connect(filter).connect(env).connect(out);
  src.start(when); src.stop(when + 0.2);
}

function scheduleHat(ctx: AudioContext, when: number, out: AudioNode, noiseBuf: AudioBuffer, open = false) {
  const src    = ctx.createBufferSource();
  src.buffer   = noiseBuf;
  const filter = ctx.createBiquadFilter();
  filter.type  = "highpass"; filter.frequency.value = 8000;
  const env    = ctx.createGain();
  env.gain.setValueAtTime(open ? 0.3 : 0.2, when);
  env.gain.exponentialRampToValueAtTime(0.001, when + (open ? 0.12 : 0.04));
  src.connect(filter).connect(env).connect(out);
  src.start(when); src.stop(when + (open ? 0.14 : 0.05));
}

function scheduleBass(ctx: AudioContext, barStart: number, out: AudioNode) {
  for (const s of [0, 0.5, 1.5, 2, 3, 3.5]) {
    const t   = barStart + s * BEAT * 0.5;
    const osc = ctx.createOscillator();
    osc.type  = "sawtooth";
    osc.frequency.value = s % 2 === 1 ? BASS_NOTE * 1.5 : BASS_NOTE;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass"; filter.frequency.value = 400;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.4, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(filter).connect(env).connect(out);
    osc.start(t); osc.stop(t + 0.22);
  }
}

function scheduleChords(ctx: AudioContext, barStart: number, out: AudioNode) {
  const chords = [
    [MELODY_NOTES[0], MELODY_NOTES[2], MELODY_NOTES[4]],
    [MELODY_NOTES[1], MELODY_NOTES[3], MELODY_NOTES[5]],
  ];
  [1, 3].forEach((beat, i) => {
    const t = barStart + beat * BEAT;
    for (const freq of chords[i % 2]) {
      const osc = ctx.createOscillator();
      osc.type = "triangle"; osc.frequency.value = freq;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.15, t);
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(env).connect(out);
      osc.start(t); osc.stop(t + 0.28);
    }
  });
}

function scheduleMelody(ctx: AudioContext, barStart: number, out: AudioNode, barIndex: number) {
  const pattern = [0, 2, 4, 5, 4, 2, 3, 1];
  for (let i = 0; i < 8; i++) {
    const freq = MELODY_NOTES[(pattern[i] + barIndex * 2) % MELODY_NOTES.length];
    const t    = barStart + i * (BEAT / 2);
    const osc  = ctx.createOscillator();
    osc.type   = "sine"; osc.frequency.value = freq;
    const env  = ctx.createGain();
    env.gain.setValueAtTime(0.18, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(env).connect(out);
    osc.start(t); osc.stop(t + 0.2);
  }
}

function scheduleBar(
  ctx: AudioContext,
  barStart: number,
  out: AudioNode,
  barIndex: number,
  noiseBuf: AudioBuffer,
) {
  scheduleKick(ctx, barStart, out);
  scheduleKick(ctx, barStart + 2 * BEAT, out);
  scheduleSnare(ctx, barStart + 1 * BEAT, out, noiseBuf);
  scheduleSnare(ctx, barStart + 3 * BEAT, out, noiseBuf);
  for (let i = 0; i < 8; i++) {
    scheduleHat(ctx, barStart + i * BEAT * 0.5, out, noiseBuf, i === 5);
  }
  scheduleBass(ctx, barStart, out);
  scheduleChords(ctx, barStart, out);
  scheduleMelody(ctx, barStart, out, barIndex);
}

// ── Singleton ─────────────────────────────────────────────────────────────────

class AppMusic {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private schedulerId: ReturnType<typeof setInterval> | null = null;
  private nextBarTime = 0;
  private nextBarIndex = 0;
  playing = false;

  start() {
    if (this.playing) return;
    this.playing = true;

    const Ctx = window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!this.ctx || this.ctx.state === "closed") {
      this.ctx        = new Ctx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0;
      this.masterGain.connect(this.ctx.destination);
      this.noiseBuf = makeNoiseBuffer(this.ctx, 0.2);
    }
    if (this.ctx.state === "suspended") this.ctx.resume();

    ramp(this.masterGain!.gain, 0.7, this.ctx.currentTime, 1.0);

    // Sync to the global wall-clock bar grid — start scheduling from the
    // next bar boundary so this device lines up with any other device.
    const { audioTime, barIndex } = nextBarAudioTime(this.ctx);
    this.nextBarTime  = audioTime;
    this.nextBarIndex = barIndex;
    this._schedule();

    this.schedulerId = setInterval(() => this._schedule(), SCHEDULE_INTERVAL_MS);
  }

  stop() {
    if (!this.playing) return;
    this.playing = false;
    if (this.schedulerId !== null) {
      clearInterval(this.schedulerId);
      this.schedulerId = null;
    }
    if (this.masterGain && this.ctx) {
      ramp(this.masterGain.gain, 0, this.ctx.currentTime, 0.8);
      setTimeout(() => {
        this.ctx?.close();
        this.ctx        = null;
        this.masterGain = null;
        this.noiseBuf   = null;
      }, 1000);
    }
  }

  private _schedule() {
    if (!this.ctx || !this.masterGain || !this.noiseBuf) return;
    const horizon = this.ctx.currentTime + BAR * LOOKAHEAD_BARS;
    while (this.nextBarTime < horizon) {
      scheduleBar(this.ctx, this.nextBarTime, this.masterGain, this.nextBarIndex, this.noiseBuf);
      this.nextBarTime  += BAR;
      this.nextBarIndex++;
    }
  }
}

export const appMusic = new AppMusic();
