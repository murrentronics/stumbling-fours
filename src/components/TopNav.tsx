import { Link } from "@tanstack/react-router";
import { Shield, User, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";
import logoSrc from "@/assets/logo.png";

export function TopNav() {
  const { profile, isAdmin, signOut, user } = useAuth();
  const label = profile?.display_name || user?.email?.split("@")[0] || "Player";

  return (
    <header className="px-5 sm:px-8 pt-6 pb-4 flex flex-wrap items-center justify-between gap-4">
      <Link to="/" className="flex items-center gap-3 group">
        <div className="rounded-full overflow-hidden flex-shrink-0"
             style={{ width: 88, height: 88, boxShadow: "var(--shadow-gold)" }}>
          <img src={logoSrc} alt="Stumbling Fours" className="w-full h-full object-cover" />
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
        {isAdmin && <NavLink to="/teams">Teams</NavLink>}
        {isAdmin && <NavLink to="/tournament">Tournament</NavLink>}
      </nav>

      <div className="flex items-center gap-2 rounded-full p-1.5"
           style={{ background: "oklch(0.20 0.06 150)", border: "1px solid oklch(0.83 0.16 88 / 30%)" }}>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider"
             style={isAdmin ? { background: "var(--gradient-gold)", color: "oklch(0.18 0.05 150)" } : { color: "var(--color-foreground)" }}>
          {isAdmin ? <Shield className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
          {isAdmin ? "Admin" : "Player"} · {label}
        </div>
        <button
          onClick={() => signOut()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider text-foreground/70 hover:text-foreground transition"
        >
          <LogOut className="h-3.5 w-3.5" /> Sign out
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
