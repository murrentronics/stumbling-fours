import { Link } from "@tanstack/react-router";
import { useApp } from "@/lib/store";
import { Spade, Shield, User } from "lucide-react";

export function TopNav() {
  const role = useApp((s) => s.role);
  const setRole = useApp((s) => s.setRole);

  return (
    <header className="px-5 sm:px-8 pt-6 pb-4 flex flex-wrap items-center justify-between gap-4">
      <Link to="/" className="flex items-center gap-3 group">
        <div className="h-11 w-11 rounded-full grid place-items-center"
             style={{ background: "var(--gradient-gold)", boxShadow: "var(--shadow-gold)" }}>
          <Spade className="h-6 w-6" style={{ color: "oklch(0.18 0.05 150)" }} />
        </div>
        <div className="leading-none">
          <div className="font-display font-black text-2xl sm:text-3xl gold-text tracking-wider">
            STUMBLING FOURS
          </div>
          <div className="font-marquee text-xs sm:text-sm text-foreground/70 tracking-[0.3em]">
            ALL FOURS · TRINIDAD CARD GAME
          </div>
        </div>
      </Link>

      <nav className="flex items-center gap-1 rounded-full p-1.5"
           style={{ background: "oklch(0.20 0.06 150)", border: "1px solid oklch(0.83 0.16 88 / 30%)" }}>
        <NavLink to="/">Home</NavLink>
        <NavLink to="/tables">Tables</NavLink>
        <NavLink to="/tournament">Tournament</NavLink>
      </nav>

      <div className="flex items-center gap-2 rounded-full p-1.5"
           style={{ background: "oklch(0.20 0.06 150)", border: "1px solid oklch(0.83 0.16 88 / 30%)" }}>
        <button
          onClick={() => setRole("player")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition ${
            role === "player" ? "text-[oklch(0.18_0.05_150)]" : "text-foreground/60"
          }`}
          style={role === "player" ? { background: "var(--gradient-gold)" } : {}}
        >
          <User className="h-3.5 w-3.5" /> Player
        </button>
        <button
          onClick={() => setRole("admin")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition ${
            role === "admin" ? "text-[oklch(0.18_0.05_150)]" : "text-foreground/60"
          }`}
          style={role === "admin" ? { background: "var(--gradient-gold)" } : {}}
        >
          <Shield className="h-3.5 w-3.5" /> Admin
        </button>
      </div>
    </header>
  );
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="px-4 py-1.5 rounded-full text-sm font-semibold uppercase tracking-wider text-foreground/75 hover:text-foreground transition"
      activeProps={{
        className:
          "px-4 py-1.5 rounded-full text-sm font-semibold uppercase tracking-wider text-[oklch(0.18_0.05_150)]",
        style: { background: "var(--gradient-gold)" },
      }}
      activeOptions={{ exact: to === "/" }}
    >
      {children}
    </Link>
  );
}
