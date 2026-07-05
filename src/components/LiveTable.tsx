import { useMemo, useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { useApp, type Match, type Team, winnerIsTeamA } from "@/lib/store";
import { HangJackOverlay } from "./HangJackOverlay";
import { Crown, Spade, Heart, Diamond, Club } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { appMusic } from "@/lib/appMusic";

/** Fetch avatar_url for a player by email — cached in module scope */
const avatarCache = new Map<string, string | null>();

function usePlayerAvatar(email: string): string | null {
  const [url, setUrl] = useState<string | null>(avatarCache.get(email) ?? null);
  useEffect(() => {
    if (!email) return;
    if (avatarCache.has(email)) { setUrl(avatarCache.get(email)!); return; }
    supabase
      .from("profiles")
      .select("avatar_url")
      .eq("email", email)
      .maybeSingle()
      .then(({ data }) => {
        const av = (data as { avatar_url: string | null } | null)?.avatar_url ?? null;
        avatarCache.set(email, av);
        setUrl(av);
      });
  }, [email]);
  return url;
}

export function LiveTable({ match }: { match: Match }) {
  const currentUserEmail = useApp((s) => s.currentUserEmail);
  const role = useApp((s) => s.role);
  const addEntry = useApp((s) => s.addEntry);
  const updateMatch = useApp((s) => s.updateMatch);
  const triggerHangJack = useApp((s) => s.triggerHangJack);
  const flash = useApp((s) => s.hangJackFlash[match.tableId]);
  const allEntries = useApp((s) => s.entries);
  const entries = useMemo(
    () => allEntries.filter((e) => e.matchId === match.id).slice(0, 6),
    [allEntries, match.id],
  );

  // ── Silence music while at the live table ────────────────────────────────
  // Remember whether music was playing when we arrived, resume on exit.
  const musicWasPlaying = useRef(false);
  useEffect(() => {
    musicWasPlaying.current = appMusic.playing;
    if (appMusic.playing) appMusic.stop();
    return () => {
      // Only resume if it was playing before we entered
      if (musicWasPlaying.current) appMusic.start();
    };
  }, []);

  // ── Scorer selection ──────────────────────────────────────────────────────
  // For each team, exactly ONE player gets the scoring panel.
  // Priority: whichever team player is currently logged in.
  // If multiple players from the same team are registered but only one has
  // a phone, the logged-in one becomes scorer automatically.
  // Fallback (no one logged in): player[0] is designated scorer by default.
  //
  // This means:
  //  - If you're player[1] and player[0] is also logged in → you spectate
  //  - If you're player[1] and player[0] is NOT logged in  → you score
  //  - If you're not on either team                        → you spectate

  const getScorerEmail = (team: Team): string => {
    const emailLower = currentUserEmail.toLowerCase();
    // If current user is on this team, they are the scorer
    if (team.players.some((p) => p.email?.toLowerCase() === emailLower)) {
      return emailLower;
    }
    // Otherwise fall back to player[0] as default scorer
    return team.players[0]?.email?.toLowerCase() ?? "";
  };

  const scorerEmailA = useMemo(() => getScorerEmail(match.teamA), [match, currentUserEmail]);
  const scorerEmailB = useMemo(() => getScorerEmail(match.teamB), [match, currentUserEmail]);

  const emailLower = currentUserEmail.toLowerCase();

  // Can this user score for team A / B?
  const canScoreA = role === "admin" || (emailLower !== "" && emailLower === scorerEmailA);
  const canScoreB = role === "admin" || (emailLower !== "" && emailLower === scorerEmailB);

  // Is the user on one of the teams (for spectator message)
  const onTeamA = match.teamA.players.some((p) => p.email?.toLowerCase() === emailLower);
  const onTeamB = match.teamB.players.some((p) => p.email?.toLowerCase() === emailLower);
  const onAnyTeam = onTeamA || onTeamB;

  return (
    <div className="ornate-border relative overflow-hidden">
      <HangJackOverlay flashAt={flash} tableId={match.tableId} />

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
            <ScoreNum value={match.scoreA} color={match.teamA.color} />
            <span className="font-display font-black text-foreground/50">VS</span>
            <ScoreNum value={match.scoreB} color={match.teamB.color} />
          </div>

          {/* 4 player seats */}
          {match.teamA.players[0] && <Seat pos="top-left" player={match.teamA.players[0]} team={match.teamA} />}
          {match.teamA.players[1] && <Seat pos="bottom-right" player={match.teamA.players[1]} team={match.teamA} />}
          {match.teamB.players[0] && <Seat pos="top-right" player={match.teamB.players[0]} team={match.teamB} />}
          {match.teamB.players[1] && <Seat pos="bottom-left" player={match.teamB.players[1]} team={match.teamB} />}
        </div>

        {/* score entry — scorer for each team sees their panel; everyone else spectates */}
        <div className="mt-6 grid md:grid-cols-2 gap-4">
          {canScoreA && (
            <ScoreEntry
              match={match}
              team={match.teamA}
              onSubmit={(entry) => {
                addEntry(entry);
                const newScore = match.scoreA + entry.total;
                const reached = newScore >= 14;
                // Tiebreaker: if both teams hit 14, winner = first to score High→Low→Jack→Game
                const isTied = reached && match.scoreB >= 14;
                const allMatchEntries = [...useApp.getState().entries.filter(e => e.matchId === match.id), entry];
                const winnerIdForTie = isTied
                  ? (winnerIsTeamA({ ...match, scoreA: newScore, teamA: match.teamA, teamB: match.teamB }, allMatchEntries)
                      ? match.teamA.id : match.teamB.id)
                  : match.teamA.id;
                updateMatch(match.id, {
                  scoreA: newScore,
                  status: reached ? "pending" : "live",
                  winnerId: reached ? winnerIdForTie : undefined,
                });
                if (entry.jack === 3) triggerHangJack(match.tableId);
              }}
            />
          )}
          {canScoreB && (
            <ScoreEntry
              match={match}
              team={match.teamB}
              onSubmit={(entry) => {
                addEntry(entry);
                const newScore = match.scoreB + entry.total;
                const reached = newScore >= 14;
                // Tiebreaker: if both teams hit 14, winner = first to score High→Low→Jack→Game
                const isTied = reached && match.scoreA >= 14;
                const allMatchEntries = [...useApp.getState().entries.filter(e => e.matchId === match.id), entry];
                const winnerIdForTie = isTied
                  ? (winnerIsTeamA({ ...match, scoreB: newScore, teamA: match.teamA, teamB: match.teamB }, allMatchEntries)
                      ? match.teamA.id : match.teamB.id)
                  : match.teamB.id;
                updateMatch(match.id, {
                  scoreB: newScore,
                  status: reached ? "pending" : "live",
                  winnerId: reached ? winnerIdForTie : undefined,
                });
                if (entry.jack === 3) triggerHangJack(match.tableId);
              }}
            />
          )}
          {!canScoreA && !canScoreB && (
            <div className="md:col-span-2 text-center text-sm text-foreground/50 italic py-4">
              {onAnyTeam
                ? "Another player on your team is the scorer for this round."
                : "You are spectating this table."}
            </div>
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
                <span className="font-bold" style={{ color: `var(--${e.teamId === match.teamA.id ? match.teamA.color : match.teamB.color})` }}>
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

        {/* Next-round roster footer */}
        <NextRoundRoster currentMatchId={match.id} />
      </div>
    </div>
  );
}

/** Shows other live/pending matches happening right now as a footer strip */
function NextRoundRoster({ currentMatchId }: { currentMatchId: string }) {
  const allMatches = useApp((s) => s.matches);

  // Other tables currently playing (live or pending, not this one)
  const otherLive = useMemo(
    () => allMatches.filter(
      (m) => m.id !== currentMatchId && (m.status === "live" || m.status === "pending")
    ),
    [allMatches, currentMatchId],
  );

  // Completed matches of the current round — show who won to hint next round
  const completedThisRound = useMemo(() => {
    const current = allMatches.find((m) => m.id === currentMatchId);
    if (!current) return [];
    return allMatches.filter(
      (m) => m.id !== currentMatchId && m.status === "completed" && m.round === current.round
    );
  }, [allMatches, currentMatchId]);

  if (otherLive.length === 0 && completedThisRound.length === 0) return null;

  return (
    <div className="mt-5 pt-4 border-t" style={{ borderColor: "oklch(0.83 0.16 88 / 15%)" }}>
      <div className="text-[10px] uppercase tracking-[0.3em] text-foreground/45 mb-3">Other Tables This Round</div>
      <div className="space-y-2">
        {otherLive.map((m) => (
          <div key={m.id}
               className="rounded-lg px-3 py-2 flex items-center gap-2"
               style={{ background: "oklch(0.18 0.05 150 / 80%)", border: "1px solid oklch(0.83 0.16 88 / 15%)" }}>
            <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
              <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
                    style={{ background: "oklch(0.62 0.24 25)" }} />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5"
                    style={{ background: "oklch(0.62 0.24 25)" }} />
            </span>
            <span className="font-marquee text-[10px] tracking-widest text-foreground/50 flex-shrink-0">{m.tableName}</span>
            <span className="font-display font-bold text-xs truncate" style={{ color: `var(--${m.teamA.color})` }}>{m.teamA.name}</span>
            <span className="font-display font-black text-sm" style={{ color: `var(--${m.teamA.color})` }}>{m.scoreA}</span>
            <span className="text-foreground/30 text-[10px]">vs</span>
            <span className="font-display font-black text-sm" style={{ color: `var(--${m.teamB.color})` }}>{m.scoreB}</span>
            <span className="font-display font-bold text-xs truncate text-right" style={{ color: `var(--${m.teamB.color})` }}>{m.teamB.name}</span>
          </div>
        ))}
        {completedThisRound.map((m) => {
          const wA = winnerIsTeamA(m);
          const winner = wA ? m.teamA : m.teamB;
          return (
            <div key={m.id}
                 className="rounded-lg px-3 py-2 flex items-center gap-2"
                 style={{ background: "oklch(0.18 0.05 150 / 60%)", border: "1px solid oklch(0.83 0.16 88 / 10%)" }}>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{ background: "oklch(0.83 0.16 88 / 15%)", color: "oklch(0.83 0.16 88)" }}>
                Done
              </span>
              <span className="font-marquee text-[10px] tracking-widest text-foreground/50 flex-shrink-0">{m.tableName}</span>
              <span className="text-[10px] text-foreground/50">Winner:</span>
              <span className="font-display font-bold text-xs" style={{ color: `var(--${winner.color})` }}>{winner.name}</span>
              <span className="font-display font-black text-sm gold-text ml-auto flex-shrink-0">
                {wA ? m.scoreA : m.scoreB}–{wA ? m.scoreB : m.scoreA}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ScoreNum({ value, color }: { value: number; color: string }) {
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

  const avatarUrl = usePlayerAvatar(player.email);
  const Icon = SeatIcons[Math.abs((player.email ?? "").length) % 4];

  return (
    <div className={`absolute ${positions[pos]} flex items-center gap-2`}>
      {/* Avatar circle with thick team-colour border */}
      <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full overflow-hidden flex-shrink-0 border-[3px]"
           style={{
             borderColor: `var(--${team.color})`,
             boxShadow: `0 0 14px var(--${team.color})`,
             background: "oklch(0.20 0.06 150)",
           }}>
        {avatarUrl ? (
          <img src={avatarUrl} alt={player.name}
               className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full grid place-items-center">
            <Icon className="h-5 w-5" style={{ color: `var(--${team.color})` }} />
          </div>
        )}
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
          label="Hang Jack"
          value="+3"
          active={jack}
          onClick={() => setJack(!jack)}
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
              high, low, jack: jackPts, game, total,
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
