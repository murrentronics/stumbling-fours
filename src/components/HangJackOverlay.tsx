import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

// Pre-load voices as soon as the module loads — Android needs this
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.addEventListener("voiceschanged", () => {
    window.speechSynthesis.getVoices();
  });
}

function playSlap() {
  try {
    const Ctx = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    const ctx = new Ctx();
    const now = ctx.currentTime;

    // Sharp slap: short noise burst + low thump
    const bufferSize = Math.floor(ctx.sampleRate * 0.18);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 4);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "highpass";
    noiseFilter.frequency.value = 1200;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.6, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    noise.connect(noiseFilter).connect(noiseGain).connect(ctx.destination);
    noise.start(now);

    // Low thud
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.12);
    oscGain.gain.setValueAtTime(0.5, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(oscGain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);

    setTimeout(() => ctx.close(), 400);
  } catch {
    // ignore audio failures
  }
}

/** Speak "Hang Jack" in a female voice using Web Speech API */
function speakHangJack() {
  try {
    if (!("speechSynthesis" in window)) return;
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utter = new SpeechSynthesisUtterance("Hang Jack!");
    utter.rate = 0.85;
    utter.pitch = 1.4;   // higher pitch = more feminine
    utter.volume = 1.0;

    // Pick a female voice if available
    const voices = window.speechSynthesis.getVoices();
    const femaleVoice = voices.find(v =>
      v.name.toLowerCase().includes("female") ||
      v.name.toLowerCase().includes("woman") ||
      v.name.toLowerCase().includes("samantha") ||
      v.name.toLowerCase().includes("victoria") ||
      v.name.toLowerCase().includes("karen") ||
      v.name.toLowerCase().includes("moira") ||
      v.name.toLowerCase().includes("zira") ||
      v.name.toLowerCase().includes("google uk english female") ||
      v.name.toLowerCase().includes("google us english")
    );
    if (femaleVoice) utter.voice = femaleVoice;

    // Delay slightly so it lands when the animation peaks
    setTimeout(() => window.speechSynthesis.speak(utter), 600);
  } catch {
    // ignore speech failures
  }
}

export function HangJackOverlay({ flashAt, tableId }: { flashAt?: number; tableId: string }) {
  const [visible, setVisible] = useState(false);
  const lastShown = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!flashAt) return;
    if (lastShown.current === flashAt) return;
    lastShown.current = flashAt;
    setVisible(true);
    playSlap();
    speakHangJack();
    const hide = setTimeout(() => setVisible(false), 3200);
    // clear from store so switching tabs won't re-fire
    const clear = setTimeout(() => {
      import("@/lib/store").then(({ useApp }) => useApp.getState().clearHangJack(tableId));
    }, 3400);
    return () => {
      clearTimeout(hide);
      clearTimeout(clear);
      // Always clear on unmount so stale flash never re-triggers
      import("@/lib/store").then(({ useApp }) => useApp.getState().clearHangJack(tableId));
    };
  }, [flashAt, tableId]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="absolute inset-0 z-30 grid place-items-center pointer-events-none overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ background: "radial-gradient(circle, oklch(0 0 0 / 70%), oklch(0 0 0 / 95%))" }}
        >
          <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-10">
            <Gallows />
            <JackOfSpadesCard />
          </div>

          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="absolute bottom-10 text-center"
          >
            <div className="font-display font-black text-4xl sm:text-6xl gold-text tracking-widest">
              HANG JACK!
            </div>
            <div className="font-marquee text-xl tracking-[0.4em] mt-1" style={{ color: "oklch(0.95 0.15 90)" }}>
              +3 POINTS
            </div>
          </motion.div>

          {Array.from({ length: 24 }).map((_, i) => (
            <motion.span
              key={i}
              className="absolute h-2 w-2 rounded-full"
              style={{
                background: i % 2 ? "oklch(0.83 0.16 88)" : "oklch(0.62 0.24 25)",
                left: `${(i * 41) % 100}%`,
                top: "30%",
              }}
              initial={{ y: 0, opacity: 0 }}
              animate={{ y: 500, opacity: [0, 1, 0], x: (i % 5) * 25 - 50 }}
              transition={{ duration: 2.4, delay: 0.4 + (i % 8) * 0.06 }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Gallows() {
  // Stages: base, post, beam, rope draw, then head/body/arms/legs swing
  return (
    <motion.svg
      width="200"
      height="240"
      viewBox="0 0 200 240"
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* base */}
      <motion.line x1="20" y1="230" x2="180" y2="230" stroke="#c8a25a" strokeWidth="6"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.3 }} />
      {/* post */}
      <motion.line x1="40" y1="230" x2="40" y2="20" stroke="#c8a25a" strokeWidth="6"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, delay: 0.25 }} />
      {/* beam */}
      <motion.line x1="40" y1="20" x2="150" y2="20" stroke="#c8a25a" strokeWidth="6"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.3, delay: 0.6 }} />
      {/* rope */}
      <motion.line x1="150" y1="20" x2="150" y2="60" stroke="#e8c97a" strokeWidth="3"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.25, delay: 0.9 }} />

      {/* hangman group swings */}
      <motion.g
        style={{ transformOrigin: "150px 20px" }}
        initial={{ rotate: 0, opacity: 0 }}
        animate={{ opacity: 1, rotate: [0, 14, -10, 7, -4, 2, 0] }}
        transition={{ opacity: { delay: 1.15 }, rotate: { delay: 1.2, duration: 2.2, ease: "easeInOut" } }}
      >
        {/* head */}
        <circle cx="150" cy="80" r="18" fill="none" stroke="#fff" strokeWidth="3" />
        {/* X eyes */}
        <path d="M143 76 l5 5 M148 76 l-5 5" stroke="#fff" strokeWidth="2" />
        <path d="M153 76 l5 5 M158 76 l-5 5" stroke="#fff" strokeWidth="2" />
        {/* mouth */}
        <path d="M145 90 q5 4 10 0" stroke="#fff" strokeWidth="2" fill="none" />
        {/* body */}
        <line x1="150" y1="98" x2="150" y2="155" stroke="#fff" strokeWidth="3" />
        {/* arms */}
        <line x1="150" y1="115" x2="130" y2="140" stroke="#fff" strokeWidth="3" />
        <line x1="150" y1="115" x2="170" y2="140" stroke="#fff" strokeWidth="3" />
        {/* legs */}
        <line x1="150" y1="155" x2="132" y2="190" stroke="#fff" strokeWidth="3" />
        <line x1="150" y1="155" x2="168" y2="190" stroke="#fff" strokeWidth="3" />
      </motion.g>
    </motion.svg>
  );
}

function JackOfSpadesCard() {
  return (
    <motion.div
      initial={{ scale: 0.3, rotate: -40, x: -200, opacity: 0 }}
      animate={{
        scale: [0.3, 1.25, 1.05, 1.15, 1],
        rotate: [-40, 8, -4, 2, 0],
        x: [-200, 0, 10, 0, 0],
        opacity: 1,
      }}
      transition={{ duration: 0.7, ease: "easeOut", delay: 0.2 }}
      className="relative"
    >
      <div
        className="w-40 h-56 rounded-xl border-4 grid place-items-center relative"
        style={{
          background: "linear-gradient(180deg, #fff, #f0ebd8)",
          borderColor: "#e8c97a",
          boxShadow: "0 25px 50px oklch(0 0 0 / 70%)",
        }}
      >
        {/* corners */}
        <div className="absolute top-2 left-3 text-left leading-none">
          <div className="font-display font-black text-2xl text-black">J</div>
          <div className="text-xl leading-none text-black">♠</div>
        </div>
        <div className="absolute bottom-2 right-3 text-right leading-none rotate-180">
          <div className="font-display font-black text-2xl text-black">J</div>
          <div className="text-xl leading-none text-black">♠</div>
        </div>
        {/* center spade with J */}
        <div className="relative grid place-items-center">
          <div className="text-7xl leading-none text-black">♠</div>
          <div className="absolute font-display font-black text-3xl"
               style={{ color: "#c8102e", textShadow: "0 0 4px white" }}>
            J
          </div>
        </div>
      </div>
    </motion.div>
  );
}
