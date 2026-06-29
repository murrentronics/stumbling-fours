import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { useApp, type Match, type Team } from "@/lib/store";
import { HangJackOverlay } from "./HangJackOverlay";
import { Crown, Spade, Heart, Diamond, Club } from "lucide-react";

export function LiveTable({ match }: { match: Match }) {
  const role = useApp((s) => s.role);
  const currentUserEmail = useApp((s) => s.currentUserEmail);
  const addEntry = useApp((s) => s.addEntry);
  const updateMatch = useApp((s) => s.updateMatch);
  const triggerHangJack = useApp((s) => s.triggerHangJack);
  const flash = useApp((s) => s.hangJackFlash[match.tableId]);
  const allEntries = useApp((s) => s.entries);
  const entries = useMemo(
    () => allEntries.filter((e) => e.matchId === match.id).slice(0, 6),
    [allEntries, match.id],
  );

  // which team does current user belong to (for player view)
  const myTeam = useMemo<Team | null>(() => {
    if ([match.teamA, match.teamB].some((t) => t.players.some((p) => p.email === currentUserEmail))) {
      if (match.teamA.players.some((p) => p.email === currentUserEmail)) return match.teamA;
      return match.teamB;
    }
    return null;
  }, [match, currentUserEmail]);

  return (
    <div className="ornate-border relative overflow-hidden">
      <HangJackOverlay flashAt={flash} />

      <div className="p-5 sm:p-7">
        {/* table header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 rounded-full font-marquee tracking-[0.3em] text-sm"
                 style={{ background: "var(--gradient-crimson)", color: "oklch(0.97 0.02 90)" }}>
              {match.tableName}
            </div>
            <span className="text-xs uppercase tracking-widest text-foreground/60">Round {match.round}</span>
          </div>
          <LivePulse />
        </div>

        {/* the felt table */}
        <div className="felt-surface relative rounded-[140px] aspect-[16/9] max-w-3xl mx-auto p-6 sm:p-10
                        border-[6px]"
             style={{ borderColor: "oklch(0.45 0.10 60)" }}>
          {/* center logo */}
          <div className="absolute inset-0 grid place-items-center pointer-events-none">
            <div className="text-center opacity-25">
              <Spade className="h-16 w-16 mx-auto" style={{ color: "oklch(0.83 0.16 88)" }} />
              <div className="font-display font-black tracking-widest text-2xl mt-1 gold-text">SF</div>
            </div>
          </div>

          {/* score */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10
                          flex items-center gap-4 px-5 py-2 rounded-full"
               style={{ background: "oklch(0.10 0.03 150 / 85%)", border: "2px solid oklch(0.83 0.16 88)" }}>
            <ScoreNum value={match.scoreA} color="team-a" />
            <span className="font-display font-black text-foreground/50">VS</span>
            <ScoreNum value={match.scoreB} color="team-b" />
          </div>

          {/* 4 player seats */}
          <Seat pos="top-left" player={match.teamA.players[0]} team={match.teamA} />
          <Seat pos="bottom-right" player={match.teamA.players[1]} team={match.teamA} />
          <Seat pos="top-right" player={match.teamB.players[0]} team={match.teamB} />
          <Seat pos="bottom-left" player={match.teamB.players[1]} team={match.teamB} />
        </div>

        {/* score entry — players see their team only; admin sees both */}
        <div className="mt-6 grid md:grid-cols-2 gap-4">
          {(role === "admin" || myTeam?.id === match.teamA.id) && (
            <ScoreEntry
              match={match}
              team={match.teamA}
              onSubmit={(entry) => {
                addEntry(entry);
                const newScore = match.scoreA + entry.total;
                const reached = newScore >= 14;
                updateMatch(match.id, {
                  scoreA: newScore,
                  status: reached ? "pending" : "live",
                  winnerId: reached ? match.teamA.id : undefined,
                });
                if (entry.jack === 3) triggerHangJack(match.tableId);
              }}
            />
          )}
          {(role === "admin" || myTeam?.id === match.teamB.id) && (
            <ScoreEntry
              match={match}
              team={match.teamB}
              onSubmit={(entry) => {
                addEntry(entry);
                const newScore = match.scoreB + entry.total;
                const reached = newScore >= 14;
                updateMatch(match.id, {
                  scoreB: newScore,
                  status: reached ? "pending" : "live",
                  winnerId: reached ? match.teamB.id : undefined,
                });
                if (entry.jack === 3) triggerHangJack(match.tableId);
              }}
            />
          )}
        </div>

        {/* recent entries */}
        <div className="mt-5">
          <div className="text-xs uppercase tracking-[0.3em] text-foreground/60 mb-2">Recent rounds</div>
          <div className="flex flex-wrap gap-2">
            {entries.length === 0 && (
              <div className="text-sm text-foreground/50 italic">No rounds entered yet.</div>
            )}
            {entries.map((e) => (
              <div key={e.id} className="rounded-md px-3 py-1.5 text-xs flex items-center gap-2"
                   style={{ background: "oklch(0.20 0.06 150)", border: "1px solid oklch(0.83 0.16 88 / 25%)" }}>
                <span className="font-bold" style={{ color: e.teamId === match.teamA.id ? "var(--team-a)" : "var(--team-b)" }}>
                  {e.teamName}
                </span>
                <span className="text-foreground/70">+{e.total}</span>
                <span className="text-foreground/40">
                  {[e.high && "H", e.low && "L", e.jack === 3 ? "HJ" : e.jack === 1 ? "J" : null, e.game && "G"]
                    .filter(Boolean).join(" · ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreNum({ value, color }: { value: number; color: "team-a" | "team-b" }) {
  return (
    <motion.div
      key={value}
      initial={{ scale: 1.4, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="font-display font-black text-4xl sm:text-5xl"
      style={{ color: `var(--${color})`, textShadow: `0 0 20px var(--${color})` }}
    >
      {value}
    </motion.div>
  );
}

function LivePulse() {
  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
              style={{ background: "oklch(0.62 0.24 25)" }} />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5"
              style={{ background: "oklch(0.62 0.24 25)" }} />
      </span>
      <span className="font-marquee tracking-[0.3em] text-xs text-foreground/80">LIVE</span>
    </div>
  );
}

const SeatIcons = [Spade, Heart, Diamond, Club];

function Seat({
  pos,
  player,
  team,
}: {
  pos: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  player: { email: string; name: string };
  team: Team;
}) {
  const positions = {
    "top-left": "top-2 left-2 sm:top-4 sm:left-8",
    "top-right": "top-2 right-2 sm:top-4 sm:right-8",
    "bottom-left": "bottom-2 left-2 sm:bottom-4 sm:left-8",
    "bottom-right": "bottom-2 right-2 sm:bottom-4 sm:right-8",
  } as const;
  const Icon = SeatIcons[Math.abs(player.email.length) % 4];
  return (
    <div className={`absolute ${positions[pos]} flex items-center gap-2`}>
      <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full grid place-items-center border-2"
           style={{
             background: "oklch(0.20 0.06 150)",
             borderColor: `var(--${team.color})`,
             boxShadow: `0 0 14px var(--${team.color})`,
           }}>
        <Icon className="h-5 w-5" style={{ color: `var(--${team.color})` }} />
      </div>
      <div className="hidden sm:block leading-tight">
        <div className="font-display font-bold text-sm">{player.name}</div>
        <div className="text-[10px] uppercase tracking-wider text-foreground/60">{team.name}</div>
      </div>
    </div>
  );
}

function ScoreEntry({
  match,
  team,
  onSubmit,
}: {
  match: Match;
  team: Team;
  onSubmit: (e: import("@/lib/store").RoundEntry) => void;
}) {
  const currentUserEmail = useApp((s) => s.currentUserEmail);
  const [high, setHigh] = useState(false);
  const [low, setLow] = useState(false);
  const [jack, setJack] = useState(false);
  const [game, setGame] = useState(false);

  const jackPts = jack ? 3 : 0;
  const total = (high ? 1 : 0) + (low ? 1 : 0) + jackPts + (game ? 2 : 0);
  const canSubmit = total > 0;

  const reset = () => { setHigh(false); setLow(false); setJack(false); setGame(false); };

  return (
    <div className="rounded-xl p-4 border-2"
         style={{ borderColor: `var(--${team.color})`, background: "oklch(0.18 0.05 150 / 80%)" }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Crown className="h-4 w-4" style={{ color: `var(--${team.color})` }} />
          <div className="font-display font-bold tracking-wider" style={{ color: `var(--${team.color})` }}>
            {team.name}
          </div>
        </div>
        <div className="font-marquee text-xs tracking-[0.25em] text-foreground/60">
          ROUND ENTRY
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <PointBtn label="High" value="+1" active={high} onClick={() => setHigh(!high)} />
        <PointBtn label="Low" value="+1" active={low} onClick={() => setLow(!low)} />
        <PointBtn
          label={jack === 3 ? "Hang Jack" : "Jack"}
          value={jack === 3 ? "+3" : "+1"}
          active={jack > 0}
          onClick={() => setJack(jack === 0 ? 1 : jack === 1 ? 3 : 0)}
          accent
        />
        <PointBtn label="Game" value="+2" active={game} onClick={() => setGame(!game)} />
      </div>

      <div className="flex items-center justify-between mt-4">
        <div className="text-sm text-foreground/70">
          Total: <span className="font-display font-black text-xl gold-text">{total}</span>
          <span className="text-xs text-foreground/40 ml-2">(max 7)</span>
        </div>
        <button
          disabled={!canSubmit}
          onClick={() => {
            onSubmit({
              id: `e-${Date.now()}-${team.id}`,
              tableId: match.tableId,
              matchId: match.id,
              teamId: team.id,
              teamName: team.name,
              high, low, jack, game, total,
              submittedBy: currentUserEmail,
              ts: Date.now(),
            });
            reset();
          }}
          className="chip-button chip-button-hover disabled:opacity-40 disabled:cursor-not-allowed text-sm"
        >
          Submit
        </button>
      </div>
    </div>
  );
}

function PointBtn({
  label, value, active, onClick, accent,
}: { label: string; value: string; active: boolean; onClick: () => void; accent?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg py-2.5 px-2 text-center transition border-2 ${
        active ? "scale-[1.02]" : "opacity-80 hover:opacity-100"
      }`}
      style={{
        background: active
          ? accent ? "var(--gradient-crimson)" : "var(--gradient-gold)"
          : "oklch(0.22 0.06 150)",
        borderColor: active
          ? accent ? "oklch(0.62 0.24 25)" : "oklch(0.83 0.16 88)"
          : "oklch(0.83 0.16 88 / 25%)",
        color: active && !accent ? "oklch(0.18 0.05 150)" : "var(--color-foreground)",
        boxShadow: active ? "0 0 20px oklch(0.83 0.16 88 / 40%)" : "none",
      }}
    >
      <div className="font-display font-bold text-xs uppercase tracking-wider">{label}</div>
      <div className="font-marquee text-lg tracking-wider">{value}</div>
    </button>
  );
}
