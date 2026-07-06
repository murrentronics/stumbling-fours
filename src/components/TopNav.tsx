import { Link } from "@tanstack/react-router";
import { Shield, User, LogOut, Menu, X, Settings } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import logoSrc from "@/assets/logo.png";

interface TopNavProps {}

export function TopNav({}: TopNavProps) {
  const { profile, isAdmin, signOut, user } = useAuth();
  const label = profile?.display_name || user?.email?.split("@")[0] || "Player";
  const avatarUrl = profile?.avatar_url ?? null;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [menuOpen]);

  const close = () => setMenuOpen(false);

  return (
    <header className="px-4 sm:px-8 pt-5 pb-4 flex items-center justify-between gap-3">
      {/* Logo */}
      <Link to="/" onClick={close} className="flex items-center gap-3 min-w-0 flex-shrink-0">
        <div className="rounded-full overflow-hidden flex-shrink-0"
             style={{ width: 72, height: 72, boxShadow: "var(--shadow-gold)" }}>
          <img src={logoSrc} alt="Stumbling Fours" className="w-full h-full object-cover" />
        </div>
        <div className="leading-none hidden sm:block">
          <div className="font-display font-black text-2xl gold-text tracking-wider">STUMBLING FOURS</div>
          <div className="font-marquee text-xs text-foreground/70 tracking-[0.3em]">ALL FOURS · TRINIDAD CARD GAME</div>
        </div>
      </Link>

      {/* Desktop nav */}
      <nav className="hidden md:flex items-center gap-1 rounded-full p-1.5 flex-shrink-0"
           style={{ background: "oklch(0.20 0.06 150)", border: "1px solid oklch(0.83 0.16 88 / 30%)" }}>
        <NavLink to="/">Home</NavLink>
        <NavLink to="/tables">Tables</NavLink>
        <NavLink to="/league">Teams</NavLink>
        {!isAdmin && <NavLink to="/my-games">My Games</NavLink>}
        {isAdmin && <NavLink to="/teams">Teams (Admin)</NavLink>}
        {isAdmin && <NavLink to="/players">Players</NavLink>}
        {isAdmin && <NavLink to="/tournament">Tournament</NavLink>}
        {isAdmin && <NavLink to="/settings">Settings</NavLink>}
      </nav>

      {/* Desktop right side */}
      <div className="hidden md:flex items-center gap-2 rounded-full p-1.5 flex-shrink-0"
           style={{ background: "oklch(0.20 0.06 150)", border: "1px solid oklch(0.83 0.16 88 / 30%)" }}>
        {/* User badge → profile link */}
        <Link to="/profile"
              className="flex items-center gap-2 px-2 py-1.5 rounded-full font-bold transition hover:opacity-80"
              style={isAdmin ? { background: "var(--gradient-gold)", color: "oklch(0.18 0.05 150)" } : { color: "var(--color-foreground)" }}>
          <AvatarBadge url={avatarUrl} isAdmin={isAdmin} size={28} />
          <span className="text-[10px] max-w-[120px] truncate leading-tight">{label}</span>
        </Link>

        <button onClick={() => signOut()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider text-foreground/70 hover:text-foreground transition">
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </button>
      </div>

      {/* Mobile: avatar badge + hamburger */}
      <div className="flex md:hidden items-center gap-2 flex-shrink-0">
        <Link to="/profile" onClick={close}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-full font-bold transition hover:opacity-80"
              style={isAdmin
                ? { background: "var(--gradient-gold)", color: "oklch(0.18 0.05 150)" }
                : { background: "oklch(0.20 0.06 150)", border: "1px solid oklch(0.83 0.16 88 / 30%)", color: "var(--color-foreground)" }}>
          <AvatarBadge url={avatarUrl} isAdmin={isAdmin} size={26} />
          <span className="text-[10px] max-w-[90px] truncate leading-tight">{label}</span>
        </Link>

        {/* Hamburger */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="h-10 w-10 rounded-full grid place-items-center transition"
            style={{ background: "oklch(0.20 0.06 150)", border: "1px solid oklch(0.83 0.16 88 / 30%)" }}
            aria-label="Menu"
          >
            {menuOpen ? <X className="h-5 w-5 text-foreground" /> : <Menu className="h-5 w-5 text-foreground" />}
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-12 z-50 w-56 rounded-2xl shadow-2xl overflow-hidden"
                 style={{ background: "oklch(0.18 0.05 150)", border: "2px solid oklch(0.83 0.16 88 / 35%)" }}>
              <div className="p-2 space-y-0.5">
                <MobileNavLink to="/" onClick={close}>Home</MobileNavLink>
                <MobileNavLink to="/tables" onClick={close}>Tables</MobileNavLink>
                <MobileNavLink to="/league" onClick={close}>Teams</MobileNavLink>
                {!isAdmin && <MobileNavLink to="/my-games" onClick={close}>My Games</MobileNavLink>}
                {isAdmin && <MobileNavLink to="/teams" onClick={close}>Teams (Admin)</MobileNavLink>}
                {isAdmin && <MobileNavLink to="/players" onClick={close}>Players</MobileNavLink>}
                {isAdmin && <MobileNavLink to="/tournament" onClick={close}>Tournament</MobileNavLink>}
                {isAdmin && (
                  <MobileNavLink to="/settings" onClick={close}>
                    <Settings className="h-4 w-4 mr-2 inline-block" />Settings
                  </MobileNavLink>
                )}
              </div>
              <div className="h-px mx-3" style={{ background: "oklch(0.83 0.16 88 / 20%)" }} />
              <div className="p-2">
                <button onClick={() => { signOut(); close(); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wider text-red-400 hover:bg-white/8 transition">
                  <LogOut className="h-4 w-4" /> Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

/** Tiny avatar circle — shows photo if available, icon fallback */
function AvatarBadge({ url, isAdmin, size }: { url: string | null; isAdmin: boolean; size: number }) {
  return (
    <div className="rounded-full overflow-hidden flex-shrink-0 border-2"
         style={{
           width: size, height: size,
           borderColor: isAdmin ? "oklch(0.18 0.05 150)" : "oklch(0.83 0.16 88 / 50%)",
           background: "oklch(0.22 0.06 150)",
         }}>
      {url ? (
        <img src={url} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full grid place-items-center">
          {isAdmin
            ? <Shield style={{ width: size * 0.55, height: size * 0.55 }} />
            : <User style={{ width: size * 0.55, height: size * 0.55, opacity: 0.6 }} />}
        </div>
      )}
    </div>
  );
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to}
          className="px-4 py-1.5 rounded-full text-sm font-semibold uppercase tracking-wider text-foreground/75 hover:text-foreground transition"
          activeProps={{
            className: "px-4 py-1.5 rounded-full text-sm font-semibold uppercase tracking-wider text-black",
            style: { background: "var(--gradient-gold)" },
          }}
          activeOptions={{ exact: to === "/" }}>
      {children}
    </Link>
  );
}

function MobileNavLink({ to, children, onClick }: { to: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <Link to={to} onClick={onClick}
          className="flex items-center px-3 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wider text-foreground/75 hover:text-foreground hover:bg-white/8 transition"
          activeProps={{
            className: "flex items-center px-3 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wider text-black",
            style: { background: "var(--gradient-gold)" },
          }}
          activeOptions={{ exact: to === "/" }}>
      {children}
    </Link>
  );
}
