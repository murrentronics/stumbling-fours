import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

export function HangJackOverlay({ flashAt }: { flashAt?: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!flashAt) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 2600);
    return () => clearTimeout(t);
  }, [flashAt]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="absolute inset-0 z-30 grid place-items-center pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ background: "radial-gradient(circle, oklch(0 0 0 / 60%), oklch(0 0 0 / 90%))" }}
        >
          <motion.div
            initial={{ scale: 0.4, rotate: -25, y: -40 }}
            animate={{
              scale: [0.4, 1.25, 1.05, 1.15, 1],
              rotate: [-25, 8, -4, 2, 0],
              y: [-40, 0, -10, 0, 0],
            }}
            transition={{ duration: 1.4, ease: "easeOut" }}
            className="text-center"
          >
            {/* swinging jack card */}
            <motion.div
              className="mx-auto mb-4 w-24 h-32 rounded-lg border-4 grid place-items-center"
              style={{
                background: "linear-gradient(180deg, white, oklch(0.92 0.04 90))",
                borderColor: "oklch(0.83 0.16 88)",
                boxShadow: "0 20px 40px oklch(0 0 0 / 60%)",
                transformOrigin: "top center",
              }}
              animate={{ rotate: [0, 12, -12, 8, -6, 3, 0] }}
              transition={{ duration: 2, ease: "easeInOut", delay: 0.4 }}
            >
              <div className="font-display font-black text-5xl" style={{ color: "oklch(0.45 0.22 25)" }}>J</div>
            </motion.div>
            <div className="font-display font-black text-5xl sm:text-7xl gold-text tracking-widest">
              HANG JACK!
            </div>
            <div className="font-marquee text-2xl tracking-[0.4em] mt-2"
                 style={{ color: "oklch(0.95 0.15 90)" }}>
              +3 POINTS
            </div>
          </motion.div>

          {/* confetti dots */}
          {Array.from({ length: 30 }).map((_, i) => (
            <motion.span
              key={i}
              className="absolute h-2 w-2 rounded-full"
              style={{
                background: i % 2 ? "oklch(0.83 0.16 88)" : "oklch(0.62 0.24 25)",
                left: `${(i * 37) % 100}%`,
                top: "40%",
              }}
              initial={{ y: 0, opacity: 0 }}
              animate={{ y: 400, opacity: [0, 1, 0], x: (i % 5) * 20 - 40 }}
              transition={{ duration: 2, delay: 0.3 + (i % 10) * 0.05 }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
