import { useEffect, useState } from "react";
import logoSrc from "@/assets/logo.png";

interface Props {
  onDone: () => void;
}

/**
 * Full-screen splash that plays once per session.
 * - Logo fades + scales in
 * - Title + subtitle fade in below
 * - Gold loading bar fills to 100 %
 * - Whole screen fades out, then onDone() fires
 */
export function SplashScreen({ onDone }: Props) {
  const [progress, setProgress] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Smoothly animate progress from 0 → 100 over ~1.8 s
    const start = performance.now();
    const duration = 4000;

    const tick = (now: number) => {
      const elapsed = now - start;
      const p = Math.min((elapsed / duration) * 100, 100);
      setProgress(p);

      if (p < 100) {
        requestAnimationFrame(tick);
      } else {
        // Hold at 100% for 400 ms, then fade out
        setTimeout(() => {
          setFadeOut(true);
          // After fade-out transition (600 ms) unmount
          setTimeout(onDone, 600);
        }, 400);
      }
    };

    requestAnimationFrame(tick);
  }, [onDone]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(ellipse at top, oklch(0.22 0.07 295 / 40%), transparent 60%)," +
          "radial-gradient(ellipse at bottom, oklch(0.52 0.22 25 / 20%), transparent 55%)," +
          "oklch(0.10 0.03 150)",
        opacity: fadeOut ? 0 : 1,
        transition: "opacity 0.6s ease",
        pointerEvents: fadeOut ? "none" : "all",
      }}
    >
      {/* Logo */}
      <div
        style={{
          width: 160,
          height: 160,
          borderRadius: "50%",
          overflow: "hidden",
          marginBottom: "1.75rem",
          boxShadow:
            "0 0 60px oklch(0.83 0.16 88 / 50%), 0 0 120px oklch(0.83 0.16 88 / 20%)",
          animation: "splash-logo-in 0.7s cubic-bezier(0.34,1.56,0.64,1) both",
        }}
      >
        <img
          src={logoSrc}
          alt="Stumbling Fours"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>

      {/* Title */}
      <div
        style={{
          textAlign: "center",
          animation: "splash-text-in 0.6s 0.3s ease both",
          marginBottom: "0.5rem",
        }}
      >
        <div
          style={{
            fontFamily: '"Cinzel", serif',
            fontWeight: 900,
            fontSize: "clamp(2rem, 6vw, 3.5rem)",
            letterSpacing: "0.08em",
            background: "linear-gradient(135deg, oklch(0.92 0.14 92) 0%, oklch(0.78 0.17 78) 50%, oklch(0.62 0.16 70) 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            textShadow: "none",
            lineHeight: 1,
          }}
        >
          STUMBLING FOURS
        </div>
        <div
          style={{
            fontFamily: '"Bebas Neue", sans-serif',
            fontSize: "clamp(0.75rem, 2vw, 1rem)",
            letterSpacing: "0.4em",
            color: "oklch(0.78 0.04 90 / 70%)",
            marginTop: "0.5rem",
          }}
        >
          ALL FOURS · TRINIDAD CARD GAME
        </div>
      </div>

      {/* Loading bar */}
      <div
        style={{
          width: "min(320px, 70vw)",
          marginTop: "2.5rem",
          animation: "splash-text-in 0.5s 0.5s ease both",
        }}
      >
        {/* Track */}
        <div
          style={{
            height: 6,
            borderRadius: 999,
            background: "oklch(0.20 0.06 150)",
            border: "1px solid oklch(0.83 0.16 88 / 20%)",
            overflow: "hidden",
          }}
        >
          {/* Fill */}
          <div
            style={{
              height: "100%",
              width: `${progress}%`,
              borderRadius: 999,
              background:
                "linear-gradient(90deg, oklch(0.92 0.14 92), oklch(0.78 0.17 78), oklch(0.62 0.16 70))",
              boxShadow: "0 0 10px oklch(0.83 0.16 88 / 70%)",
              transition: "width 0.05s linear",
            }}
          />
        </div>
        <div
          style={{
            marginTop: "0.6rem",
            textAlign: "center",
            fontFamily: '"Bebas Neue", sans-serif',
            letterSpacing: "0.3em",
            fontSize: "0.7rem",
            color: "oklch(0.83 0.16 88 / 50%)",
          }}
        >
          {Math.round(progress)}%
        </div>
      </div>

      <style>{`
        @keyframes splash-logo-in {
          from { opacity: 0; transform: scale(0.6); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes splash-text-in {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
