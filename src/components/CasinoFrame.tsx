import { type ReactNode } from "react";

const BULB_COLORS = [
  "#ff2d2d",
  "#ff8c00",
  "#ffd700",
  "#39ff14",
  "#00cfff",
  "#a855f7",
  "#ff1493",
  "#00e5c8",
];

/**
 * Fixed full-screen casino border frame.
 * The frame itself is a fixed overlay; children scroll inside.
 */
export function CasinoFrame({ children }: { children: ReactNode }) {
  return (
    <>
      {/* Fixed frame overlay — purely decorative, pointer-events pass through to inner content */}
      <div
        className="fixed inset-0 rounded-[32px] pointer-events-none"
        style={{ zIndex: 50 }}
      >
        {/* outer dark ring */}
        <div
          className="absolute inset-0 rounded-[32px]"
          style={{
            background: "transparent",
            boxShadow:
              "inset 0 0 0 12px oklch(0.08 0.02 150), 0 0 60px oklch(0 0 0 / 80%)",
          }}
        />
        {/* bulb strips */}
        <BulbStrip orientation="top" />
        <BulbStrip orientation="bottom" />
        <BulbStrip orientation="left" />
        <BulbStrip orientation="right" />
        {/* inner trim ring */}
        <div
          className="absolute rounded-[22px]"
          style={{
            inset: 12,
            boxShadow:
              "inset 0 0 0 5px oklch(0.12 0.03 150), inset 0 0 0 6px oklch(0.30 0.08 88 / 30%)",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* Scrollable content area inset from the frame edges */}
      <div
        className="casino-scroll fixed overflow-y-auto"
        style={{
          zIndex: 10,
          top: 18,
          right: 18,
          bottom: 18,
          left: 18,
          borderRadius: "20px",
          background:
            "radial-gradient(ellipse at top, oklch(0.22 0.07 295 / 40%), transparent 60%), oklch(0.10 0.03 150)",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {children}
      </div>

      <CasinoKeyframes />
    </>
  );
}

// ── Bulb strip ────────────────────────────────────────────────────────────────

const BULB_SIZE = 10;
const BULB_GAP  = 20;

function BulbStrip({ orientation }: { orientation: "top" | "bottom" | "left" | "right" }) {
  const horizontal = orientation === "top" || orientation === "bottom";

  const posStyle: React.CSSProperties = {
    position: "absolute",
    display: "flex",
    flexDirection: horizontal ? "row" : "column",
    alignItems: "center",
    gap: BULB_GAP - BULB_SIZE,
    ...(orientation === "top"    && { top:    5, left: 28, right: 28 }),
    ...(orientation === "bottom" && { bottom: 5, left: 28, right: 28 }),
    ...(orientation === "left"   && { left:   5, top:  28, bottom: 28 }),
    ...(orientation === "right"  && { right:  5, top:  28, bottom: 28 }),
    overflow: "hidden",
  };

  const count = 80;

  return (
    <div style={posStyle}>
      {Array.from({ length: count }).map((_, i) => {
        const color = BULB_COLORS[i % BULB_COLORS.length];
        const delay    = (i * 0.12).toFixed(2);
        const animName = i % 2 === 0 ? "bulb-on" : "bulb-off";
        const duration = (1.6 + (i % 5) * 0.15).toFixed(2);
        return (
          <span
            key={i}
            style={{
              display:      "inline-block",
              flexShrink:   0,
              width:        BULB_SIZE,
              height:       BULB_SIZE,
              borderRadius: "50%",
              background:   color,
              boxShadow:    `0 0 6px 2px ${color}cc, 0 0 14px 5px ${color}55`,
              animation:    `${animName} ${duration}s ${delay}s ease-in-out infinite`,
            }}
          />
        );
      })}
    </div>
  );
}

// ── Keyframes ─────────────────────────────────────────────────────────────────

function CasinoKeyframes() {
  return (
    <style>{`
      @keyframes bulb-on {
        0%,100% { opacity: 1;    filter: brightness(1.4); }
        45%,55% { opacity: 0.07; filter: brightness(0.2); }
      }
      @keyframes bulb-off {
        0%,100% { opacity: 0.07; filter: brightness(0.2); }
        45%,55% { opacity: 1;    filter: brightness(1.4); }
      }
    `}</style>
  );
}
