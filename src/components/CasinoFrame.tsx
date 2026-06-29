import { type ReactNode } from "react";

/**
 * Thick wavy casino border frame wrapping the whole app.
 * Layered: outer dark, scalloped gold ring with bulbs, crimson inner trim.
 */
export function CasinoFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen p-3 sm:p-5">
      <div className="relative rounded-[32px] p-[10px]"
           style={{
             background:
               "repeating-conic-gradient(from 0deg, oklch(0.83 0.16 88) 0deg 10deg, oklch(0.55 0.14 70) 10deg 20deg)",
             boxShadow:
               "0 0 0 3px oklch(0.30 0.12 25), 0 0 60px oklch(0.83 0.16 88 / 25%), 0 30px 80px oklch(0 0 0 / 60%)",
           }}>
        {/* bulb lights */}
        <BulbStrip orientation="top" />
        <BulbStrip orientation="bottom" />
        <BulbStrip orientation="left" />
        <BulbStrip orientation="right" />

        {/* inner crimson trim */}
        <div className="rounded-[24px] p-[6px]"
             style={{
               background:
                 "linear-gradient(135deg, oklch(0.55 0.22 25), oklch(0.32 0.18 25))",
               boxShadow: "inset 0 0 0 2px oklch(0.83 0.16 88)",
             }}>
          {/* wavy inner edge via radial-gradient scallop */}
          <div
            className="rounded-[20px] overflow-hidden"
            style={{
              background:
                "radial-gradient(ellipse at top, oklch(0.22 0.07 295 / 50%), transparent 60%), oklch(0.10 0.03 150)",
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function BulbStrip({ orientation }: { orientation: "top" | "bottom" | "left" | "right" }) {
  const horizontal = orientation === "top" || orientation === "bottom";
  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: horizontal ? 18 : orientation === "left" ? 4 : "auto",
        right: horizontal ? 18 : orientation === "right" ? 4 : "auto",
        top: orientation === "top" ? 4 : orientation === "bottom" ? "auto" : 18,
        bottom: orientation === "bottom" ? 4 : orientation === "top" ? "auto" : 18,
        height: horizontal ? 10 : "auto",
        width: horizontal ? "auto" : 10,
        backgroundImage:
          "radial-gradient(circle, oklch(1 0.05 90) 0 3px, oklch(0.83 0.16 88 / 60%) 3.5px, transparent 5px)",
        backgroundSize: horizontal ? "22px 10px" : "10px 22px",
        backgroundRepeat: horizontal ? "repeat-x" : "repeat-y",
        filter: "drop-shadow(0 0 6px oklch(0.95 0.15 90 / 80%))",
        animation: "bulb-flicker 2.4s ease-in-out infinite",
      }}
    />
  );
}

// Inject keyframes once
if (typeof document !== "undefined" && !document.getElementById("casino-keyframes")) {
  const s = document.createElement("style");
  s.id = "casino-keyframes";
  s.textContent = `
    @keyframes bulb-flicker {
      0%,100% { opacity: 1; }
      50% { opacity: 0.55; }
    }
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
  `;
  document.head.appendChild(s);
}
