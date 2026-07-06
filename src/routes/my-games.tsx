import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Gamepad2, Trophy, X as XIcon, ChevronDown, ChevronUp,
  ArrowLeft, Users, Star, TrendingDown, CalendarDays,
  ArrowRight,
} from "lucide-react";
import { useApp, type Match, winnerIsTeamA } from "@/lib/store";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/my-games")({
  head: () => ({
    meta: [
      { title: "My Games — Stumbling Fours" },
      { name: "description", content: "Your live table, wins, and losses." },
    ],
  }),
  component: MyGamesPage,
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function toDateLabel(ts: number) {
  return new Date(ts).toLocaleDateString("en-TT", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

function toISODate(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Returns whether the current user's team won this match. */
function didIWin(match: Match, email: string, entries?: import("@/lib/store").RoundEntry[]): boolean {
  const emailLower = email.toLowerCase();
  const inA = match.teamA.players.some((p) => p.email && p.email.toLowerCase() === emailLower);
  const inB = match.teamB.players.some((p) => p.email && p.email.toLowerCase() === emailLower);

  const wA = winnerIsTeamA(match, entries);

  if (inA) return wA;
  if (inB) return !wA;
  return false;
}

function getMyTeamAndOpponent(match: Match, email: string) {
  const emailLower = email.toLowerCase();
  const inA = match.teamA.players.some(
    (p) => p.email && p.email.toLowerCase() === emailLower
  );
  const myTeam   = inA ? match.teamA : match.teamB;
  const opponent = inA ? match.teamB : match.teamA;
  const myScore  = inA ? match.scoreA : match.scoreB;
  const oppScore = inA ? match.scoreB : match.scoreA;
  return { myTeam, opponent, myScore, oppScore };
}

// ── Page ─────────────────────────────────────────────────────────────────────

type View = "cards" | "wins" | "losses";

function MyGamesPage() {
  const { user } = useAuth();
  const email = user?.email ?? "";
  const allMatches = useApp((s) => s.matches);
  const allEntries = useApp((s) => s.entries);
  const [view, setView] = useState<View>("cards");

  const myMatches = useMemo(
    () => allMatches.filter((m) =>
      [...m.teamA.players, ...m.teamB.players].some(
        (p) => p.email?.toLowerCase() === email.toLowerCase()
      )
    ),
    [allMatches, email],
  );

  const liveMatch = useMemo(
    () => myMatches.find((m) => m.status === "live" || m.status === "pending") ?? null,
    [myMatches],
  );

  const completedMatches = useMemo(
    () => myMatches.filter((m) => m.status === "completed"),
    [myMatches],
  );

  const wins = useMemo(
    () => completedMatches.filter((m) =>
      didIWin(m, email, allEntries.filter((e) => e.matchId === m.id))
    ),
    [completedMatches, email, allEntries],
  );

  const losses = useMemo(
    () => completedMatches.filter((m) =>
      !didIWin(m, email, allEntries.filter((e) => e.matchId === m.id))
    ),
    [completedMatches, email, allEntries],
  );

  if (view === "wins") return <GameListPage title="Games Won" matches={wins} email={email} variant="win" onBack={() => setView("cards")} />;
  if (view === "losses") return <GameListPage title="Games Lost" matches={losses} email={email} variant="loss" onBack={() => setView("cards")} />;

  return (
    <div className="pt-2 space-y-6">
      <div>
        <h1 className="font-display font-black text-4xl gold-text">My Games</h1>
        <p className="text-foreground/65 text-sm mt-1">Your table, your wins, your losses.</p>
      </div>
      <div className="grid gap-5">
        <LiveCard liveMatch={liveMatch} email={email} />
        <SummaryCard
          icon={<Trophy className="h-6 w-6" />}
          label="Games Won"
          count={wins.length}
          accent="gold"
          onClick={() => setView("wins")}
        />
        <SummaryCard
          icon={<TrendingDown className="h-6 w-6" />}
          label="Games Lost"
          count={losses.length}
          accent="crimson"
          onClick={() => setView("losses")}
        />
      </div>
    </div>
  );
}

// ── Card 1: Live Table ────────────────────────────────────────────────────────

function LiveCard({ liveMatch, email }: { liveMatch: Match | null; email: string }) {
  return (
    <Link
      to="/tables"
      className="ornate-border overflow-hidden block transition-all hover:scale-[1.01]"
      style={{ borderColor: liveMatch ? "oklch(0.62 0.24 25)" : "oklch(0.83 0.16 88 / 25%)" }}
    >
      <div className="p-5 flex items-center gap-4">
        {/* Pulse / icon */}
        <div
          className="h-14 w-14 flex-shrink-0 rounded-full grid place-items-center"
          style={{
            background: liveMatch ? "var(--gradient-crimson)" : "oklch(0.22 0.06 150)",
            boxShadow: liveMatch ? "0 0 24px oklch(0.62 0.24 25 / 60%)" : "none",
          }}
        >
          {liveMatch ? (
            <span className="relative flex h-4 w-4">
              <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
                    style={{ background: "white" }} />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-white" />
            </span>
          ) : (
            <Gamepad2 className="h-6 w-6 text-foreground/40" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-display font-black text-xl"
               style={{ color: liveMatch ? "oklch(0.95 0.05 60)" : "var(--color-foreground)" }}>
            {liveMatch ? `${liveMatch.tableName} — LIVE` : "No Active Table"}
          </div>

          {liveMatch ? (() => {
            const { myTeam, opponent, myScore, oppScore } = getMyTeamAndOpponent(liveMatch, email);
            return (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-display font-bold text-sm truncate max-w-[120px]"
                      style={{ color: `var(--${myTeam.color})` }}>
                  {myTeam.name}
                </span>
                <span className="font-display font-black text-lg leading-none"
                      style={{ color: `var(--${myTeam.color})` }}>
                  {myScore}
                </span>
                <span className="text-foreground/40 text-sm font-bold">—</span>
                <span className="font-display font-black text-lg leading-none text-foreground/70">
                  {oppScore}
                </span>
                <span className="font-display font-bold text-sm truncate max-w-[120px]"
                      style={{ color: `var(--${opponent.color})` }}>
                  {opponent.name}
                </span>
              </div>
            );
          })() : (
            <div className="text-sm text-foreground/50 mt-0.5">You are not in a live game right now.</div>
          )}
        </div>

        <ArrowRight className="h-5 w-5 flex-shrink-0 text-foreground/40" />
      </div>
    </Link>
  );
}

// ── Cards 2 & 3: Summary clickable cards ─────────────────────────────────────

function SummaryCard({
  icon, label, count, accent, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  accent: "gold" | "crimson";
  onClick: () => void;
}) {
  const gradBg = accent === "gold" ? "var(--gradient-gold)" : "var(--gradient-crimson)";
  const gradColor = accent === "gold" ? "oklch(0.18 0.05 150)" : "white";
  const borderColor = accent === "gold" ? "oklch(0.83 0.16 88 / 40%)" : "oklch(0.62 0.24 25 / 40%)";

  return (
    <button
      onClick={onClick}
      className="ornate-border p-5 flex items-center gap-5 w-full text-left hover:scale-[1.015] transition-transform"
      style={{ borderColor }}
    >
      <div className="h-14 w-14 flex-shrink-0 rounded-full grid place-items-center"
           style={{ background: gradBg, color: gradColor, boxShadow: accent === "gold" ? "var(--shadow-gold)" : "0 4px 20px oklch(0.62 0.24 25 / 40%)" }}>
        {icon}
      </div>
      <div className="flex-1">
        <div className="font-display font-black text-3xl gold-text">{count}</div>
        <div className="text-sm text-foreground/70 uppercase tracking-widest font-bold">{label}</div>
      </div>
      <ChevronDown className="h-5 w-5 text-foreground/40 -rotate-90 flex-shrink-0" />
    </button>
  );
}

// ── Game List Page (Wins / Losses) ────────────────────────────────────────────

function GameListPage({
  title, matches, email, variant, onBack,
}: {
  title: string;
  matches: Match[];
  email: string;
  variant: "win" | "loss";
  onBack: () => void;
}) {
  // Group by calendar date, newest first
  const grouped = useMemo(() => {
    const map = new Map<string, { label: string; iso: string; matches: Match[] }>();
    const sorted = [...matches].sort((a, b) => b.startedAt - a.startedAt);
    for (const m of sorted) {
      const iso = toISODate(m.startedAt);
      if (!map.has(iso)) map.set(iso, { label: toDateLabel(m.startedAt), iso, matches: [] });
      map.get(iso)!.matches.push(m);
    }
    return Array.from(map.values());
  }, [matches]);

  const accentColor = variant === "win" ? "var(--gradient-gold)" : "var(--gradient-crimson)";
  const accentFg = variant === "win" ? "oklch(0.18 0.05 150)" : "white";

  return (
    <div className="pt-2 space-y-6">
      {/* Back + heading */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="chip-button chip-button-hover"
                style={{ background: accentColor, color: accentFg }}>
          <ArrowLeft className="h-4 w-4 mr-2" /> My Games
        </button>
      </div>
      <div>
        <h1 className="font-display font-black text-4xl gold-text">{title}</h1>
        <p className="text-foreground/65 text-sm mt-1">{matches.length} {matches.length === 1 ? "game" : "games"} total · sorted by date</p>
      </div>

      {matches.length === 0 && (
        <div className="ornate-border p-12 text-center">
          <div className="h-14 w-14 mx-auto rounded-full grid place-items-center mb-3"
               style={{ background: accentColor, color: accentFg }}>
            {variant === "win" ? <Trophy className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
          </div>
          <div className="font-display font-bold text-xl gold-text">
            {variant === "win" ? "No wins yet — keep playing!" : "No losses on record."}
          </div>
        </div>
      )}

      {grouped.map(({ label, iso, matches: dayMatches }) => (
        <DateGroup key={iso} label={label} matches={dayMatches} email={email} variant={variant} />
      ))}
    </div>
  );
}

// ── Date group accordion ──────────────────────────────────────────────────────

function DateGroup({
  label, matches, email, variant,
}: {
  label: string;
  matches: Match[];
  email: string;
  variant: "win" | "loss";
}) {
  const [open, setOpen] = useState(true); // open by default

  return (
    <div className="space-y-3">
      {/* Date header — accordion toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-4"
      >
        <div
          className="flex-1 h-px"
          style={{ background: "linear-gradient(to right, transparent, oklch(0.83 0.16 88 / 60%), transparent)" }}
        />
        <div
          className="flex items-center gap-2 px-4 py-1.5 rounded-full font-marquee tracking-[0.25em] text-xs flex-shrink-0"
          style={{
            background: "linear-gradient(var(--color-card), var(--color-card)) padding-box, var(--gradient-gold) border-box",
            border: "2px solid transparent",
            color: "oklch(0.83 0.16 88)",
          }}
        >
          <CalendarDays className="h-3.5 w-3.5" />
          {label}
          {open ? <ChevronUp className="h-3.5 w-3.5 ml-1" /> : <ChevronDown className="h-3.5 w-3.5 ml-1" />}
        </div>
        <div
          className="flex-1 h-px"
          style={{ background: "linear-gradient(to left, transparent, oklch(0.83 0.16 88 / 60%), transparent)" }}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="date-group"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden space-y-3"
          >
            {matches.map((m) => (
              <GameRecord key={m.id} match={m} email={email} variant={variant} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Individual game record card ───────────────────────────────────────────────

function GameRecord({
  match, email, variant,
}: {
  match: Match;
  email: string;
  variant: "win" | "loss";
}) {
  const [expanded, setExpanded] = useState(false);
  const allEntries = useApp((s) => s.entries);

  const { myTeam, opponent, myScore, oppScore } = getMyTeamAndOpponent(match, email);

  // Round entries for this match, grouped by team
  const matchEntries = useMemo(
    () => allEntries.filter((e) => e.matchId === match.id),
    [allEntries, match.id],
  );
  const myEntries = matchEntries.filter((e) => e.teamId === myTeam.id);
  const oppEntries = matchEntries.filter((e) => e.teamId === opponent.id);

  const isWin = variant === "win";
  const borderColor = isWin ? "oklch(0.83 0.16 88 / 40%)" : "oklch(0.62 0.24 25 / 40%)";
  const resultColor = isWin ? "oklch(0.83 0.16 88)" : "oklch(0.75 0.22 25)";
  const resultLabel = isWin ? "WIN" : "LOSS";

  const time = new Date(match.startedAt).toLocaleTimeString("en-TT", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="ornate-border overflow-hidden" style={{ borderColor }}>
      {/* Collapsed row — always visible */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left p-4 flex items-center gap-4"
      >
        {/* Result badge */}
        <div
          className="h-12 w-12 flex-shrink-0 rounded-full grid place-items-center font-display font-black text-xs"
          style={{ background: isWin ? "var(--gradient-gold)" : "var(--gradient-crimson)",
                   color: isWin ? "oklch(0.18 0.05 150)" : "white",
                   boxShadow: isWin ? "var(--shadow-gold)" : "0 4px 16px oklch(0.62 0.24 25 / 40%)" }}
        >
          {resultLabel}
        </div>

        {/* Match summary */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-marquee tracking-[0.25em] text-xs text-foreground/60">{match.tableName}</span>
            <span className="text-[10px] text-foreground/40">· R{match.round} · {time}</span>
            {match.disqualifiedTeamId && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                    style={{ background: "oklch(0.55 0.22 25 / 25%)", color: "oklch(0.75 0.18 25)" }}>DQ</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-sm" style={{ color: `var(--${myTeam.color})` }}>
              {myTeam.name}
            </span>
            <span className="font-display font-black text-lg" style={{ color: resultColor }}>
              {myScore}
            </span>
            <span className="text-foreground/40 text-sm">—</span>
            <span className="font-display font-black text-lg text-foreground/70">{oppScore}</span>
            <span className="font-display font-bold text-sm" style={{ color: `var(--${opponent.color})` }}>
              {opponent.name}
            </span>
          </div>
        </div>

        <div className="flex-shrink-0">
          {expanded
            ? <ChevronUp className="h-4 w-4 text-foreground/40" />
            : <ChevronDown className="h-4 w-4 text-foreground/40" />}
        </div>
      </button>

      {/* Expanded detail */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 border-t" style={{ borderColor: "oklch(0.83 0.16 88 / 15%)" }}>
              {/* Players */}
              <div className="grid grid-cols-2 gap-4 pt-4">
                <PlayerList team={myTeam} label="Your Team" />
                <PlayerList team={opponent} label="Opponent" />
              </div>

              {/* Score breakdown */}
              {(myEntries.length > 0 || oppEntries.length > 0) && (
                <div>
                  <div className="text-[10px] uppercase tracking-[0.3em] text-foreground/50 mb-2">Round Breakdown</div>
                  <div className="grid grid-cols-2 gap-3">
                    <EntryList entries={myEntries} color={myTeam.color} teamName={myTeam.name} />
                    <EntryList entries={oppEntries} color={opponent.color} teamName={opponent.name} />
                  </div>
                </div>
              )}

              {/* Final score line */}
              <div
                className="rounded-xl p-3 flex items-center justify-between"
                style={{ background: "oklch(0.18 0.05 150 / 80%)", border: "1px solid oklch(0.83 0.16 88 / 20%)" }}
              >
                <div className="flex items-center gap-1.5">
                  {isWin ? <Star className="h-4 w-4" style={{ color: "oklch(0.83 0.16 88)" }} />
                         : <XIcon className="h-4 w-4 text-red-400" />}
                  <span className="font-display font-bold text-sm" style={{ color: resultColor }}>
                    {isWin ? "Victory" : "Defeat"}
                    {match.disqualifiedTeamId === opponent.id ? " (Opponent DQ)" : ""}
                    {match.disqualifiedTeamId === myTeam.id ? " (Your Team DQ)" : ""}
                  </span>
                </div>
                <div className="font-display font-black text-xl gold-text">
                  {myScore} <span className="text-foreground/40 font-normal text-base">vs</span> {oppScore}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PlayerList({ team, label }: { team: import("@/lib/store").Team; label: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
             style={{ background: `var(--${team.color})` }} />
        <span className="text-[10px] uppercase tracking-[0.25em] text-foreground/55">{label}</span>
      </div>
      <div className="space-y-1">
        <div
          className="font-display font-bold text-sm truncate"
          style={{ color: `var(--${team.color})` }}
        >
          {team.name}
        </div>
        {team.players.map((p) => (
          <div key={p.email} className="flex items-center gap-1.5">
            <Users className="h-3 w-3 text-foreground/40 flex-shrink-0" />
            <span className="text-xs text-foreground/75 truncate">{p.name || p.email.split("@")[0]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EntryList({
  entries, color, teamName,
}: {
  entries: import("@/lib/store").RoundEntry[];
  color: string;
  teamName: string;
}) {
  if (entries.length === 0)
    return <div className="text-xs text-foreground/40 italic">No rounds logged</div>;

  return (
    <div className="space-y-1">
      <div className="font-display font-bold text-xs truncate mb-1"
           style={{ color: `var(--${color})` }}>
        {teamName}
      </div>
      {entries.map((e) => {
        const parts = [
          e.high && "High",
          e.low && "Low",
          e.jack === 3 ? "Hang Jack" : e.jack === 1 ? "Jack" : null,
          e.game && "Game",
        ].filter(Boolean);
        return (
          <div key={e.id}
               className="flex items-center justify-between rounded-md px-2 py-1 text-xs"
               style={{ background: "oklch(0.20 0.06 150)", border: "1px solid oklch(0.83 0.16 88 / 15%)" }}>
            <span className="text-foreground/65 truncate">{parts.join(" · ") || "—"}</span>
            <span className="font-display font-black ml-2 flex-shrink-0"
                  style={{ color: `var(--${color})` }}>+{e.total}</span>
          </div>
        );
      })}
    </div>
  );
}
