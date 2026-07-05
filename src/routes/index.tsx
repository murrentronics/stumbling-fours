import { createFileRoute, Link } from "@tanstack/react-router";
import { Spade, Users, Zap } from "lucide-react";
import { useApp } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Stumbling Fours — Lobby" },
      { name: "description", content: "Welcome to Stumbling Fours, the All Fours tournament scoring app." },
    ],
  }),
  component: Home,
});

function Home() {
  const tournament = useApp((s) => s.tournament);
  const matches = useApp((s) => s.matches);
  const role = useApp((s) => s.role);
  const live = matches.filter((m) => m.status === "live").length;

  return (
    <div className="pt-2">
      {/* hero */}
      <section className="relative rounded-3xl overflow-hidden ornate-border p-8 sm:p-14 text-center">
        <div className="absolute inset-0 opacity-25 pointer-events-none"
             style={{
               backgroundImage:
                 "radial-gradient(circle at 20% 30%, oklch(0.83 0.16 88 / 40%), transparent 40%), radial-gradient(circle at 80% 70%, oklch(0.62 0.24 25 / 40%), transparent 40%)",
             }} />
        <div className="relative">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 overflow-hidden relative"
               style={{ background: "#CE1126", border: "2px solid rgba(255,255,255,0.30)" }}>
            {/* Trinidad flag: red bg with black diagonal stripe bordered by white */}
            <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 32" aria-hidden="true">
              {/* white border of stripe */}
              <polygon points="30,0 56,0 70,32 44,32" fill="white" />
              {/* black core of stripe */}
              <polygon points="34,0 52,0 66,32 48,32" fill="black" />
            </svg>
            <Spade className="h-4 w-4 relative z-10 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]" style={{ color: "white" }} />
            <span className="font-marquee tracking-[0.4em] text-xs text-white relative z-10 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">TRINIDAD · ALL FOURS</span>
          </div>
          <h1 className="font-display font-black text-5xl sm:text-7xl gold-text leading-none">
            Deal. Score. Win.
          </h1>
          <p className="mt-5 max-w-2xl mx-auto text-foreground/75 text-lg">
            Run live tables, capture every High, Low, Jack & Game, and crown your champion —
            the first All Fours app built for proper Trini tournament nights.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/tables" className="chip-button chip-button-hover">Enter the Tables</Link>
            {role === "admin" && (
              <Link to="/tournament" className="chip-button chip-button-hover"
                    style={{ background: "var(--gradient-crimson)", color: "white" }}>
                Tournament Setup
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* stat strip */}
      <section className="grid md:grid-cols-2 gap-4 mt-8">
        <StatCard icon={<Zap className="h-5 w-5" />} label="Live Tables" value={String(live)} />
        <StatCard icon={<Users className="h-5 w-5" />} label="Teams Locked In" value={String(tournament?.teams.length ?? 0)} />
      </section>

      {/* rules summary */}
      <section className="mt-10 ornate-border p-6 sm:p-8">
        <h2 className="font-display font-black text-2xl gold-text mb-4">The Stumbling Fours Scorecard</h2>
        <div className="grid sm:grid-cols-4 gap-3">
          <RuleChip label="High" value="+1" />
          <RuleChip label="Low" value="+1" />
          <RuleChip label="Jack" value="+1 · Hang Jack +3" accent />
          <RuleChip label="Game" value="+2" />
        </div>
        <p className="mt-4 text-sm text-foreground/65">
          Max <span className="font-display font-bold gold-text">7 points</span> per round. First team to <span className="font-display font-bold gold-text">14</span> wins the game. Admin approves every match win before it locks.
        </p>
      </section>
    </div>
  );
}

function StatCard({ icon, label, value, small }: { icon: React.ReactNode; label: string; value: string; small?: boolean }) {
  return (
    <div className="ornate-border p-5 flex items-center gap-4">
      <div className="h-12 w-12 rounded-xl grid place-items-center"
           style={{ background: "var(--gradient-gold)", color: "oklch(0.18 0.05 150)" }}>
        {icon}
      </div>
      <div>
        <div className="text-xs uppercase tracking-[0.3em] text-foreground/60">{label}</div>
        <div className={`font-display font-black ${small ? "text-lg" : "text-3xl"} gold-text`}>{value}</div>
      </div>
    </div>
  );
}

function RuleChip({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg p-3 text-center border-2"
         style={{
           background: "oklch(0.18 0.05 150 / 80%)",
           borderColor: accent ? "oklch(0.62 0.24 25)" : "oklch(0.83 0.16 88 / 40%)",
         }}>
      <div className="font-display font-bold uppercase tracking-wider text-sm">{label}</div>
      <div className="font-marquee text-xl tracking-wider gold-text">{value}</div>
    </div>
  );
}
