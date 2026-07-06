import { useMemo, useState, useEffect } from "react";
import { motion } from "motion/react";
import { useApp, type Match, type Team, winnerIsTeamA } from "@/lib/store";
import { HangJackOverlay } from "./HangJackOverlay";
import { Crown, Spade, Heart, Diamond, Club, Lock } from "lucide-react";
import { supabase } from "@/lib/supabase";

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

  const isPending = match.status === "pending";

  // Determine winner name for pending state
  const pendingWinner = isPending
    ? (match.winnerId === match.teamA.id ? match.teamA : match.teamB)
    : null;

  return (
    <div className="ornate-border relative overflow-hidden">
      <HangJackOverlay flashAt={flash} tableId={match.tableId} />

      <div className="p-5 sm:p-7">
        {/* table header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 rounded-full font-marquee tracking-[0.3em] text-sm"
                 style={{ background: isPending ? "oklch(0.55 0.18 145)" : "var(--gradient-crimson)", color: "oklch(0.97 0.02 90)" }}>
              {match.tableName}
            </div>
            <span className="text-xs uppercase tracking-widest text-foreground/60">Round {match.round}</span>
          </div>
          {isPending
            ? <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
                   style={{ background: "oklch(0.55 0.18 145 / 20%)", border: "1px solid oklch(0.55 0.18 145 / 50%)", color: "oklch(0.75 0.16 145)" }}>
                <Lock className="h-3.5 w-3.5" /> Awaiting approval
              </div>
            : <LivePulse />
          }
        </div>

        {/* the felt table */}
        <div className="felt-surface relative rounded-[140px] aspect-[16/9] max-w-3xl mx-auto p-6 sm:p-10 border-[6px]"
             style={{ borderColor: isPending ? "oklch(0.55 0.18 145)" : "oklch(0.45 0.10 60)" }}>
          {/* center logo */}
          <div className="absolute inset-0 grid place-items-center pointer-events-none">
            <div className="text-center opacity-25">
              <Spade className="h-16 w-16 mx-auto" style={{ color: "oklch(0.83 0.16 88)" }} />
              <div className="font-display font-black tracking-widest text-2xl mt-1 gold-text">SF</div>
            </div>
          </div>

          {/* Pending lock overlay on the felt */}
          {isPending && (
            <div className="absolute inset-0 rounded-[130px] z-20 flex flex-col items-center justify-center gap-2"
                 style={{ background: "oklch(0 0 0 / 65%)", backdropFilter: "blur(2px)" }}>
              <Lock className="h-10 w-10 text-white/80" />
              <div className="font-display font-black text-lg text-white/90 tracking-wide">Table Locked</div>
              {pendingWinner && (
                <div className="font-display font-black text-base text-center mt-1"
                     style={{ color: `var(--${pendingWinner.color})` }}>
                  {pendingWinner.name} — {match.winnerId === match.teamA.id ? match.scoreA : match.scoreB} pts
                </div>
              )}
            </div>
          )}

          {/* score */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10
                          flex items-center gap-2 sm:gap-4 px-3 sm:px-5 py-1.5 sm:py-2 rounded-full"
               style={{ background: "oklch(0.10 0.03 150 / 85%)", border: "2px solid oklch(0.83 0.16 88)" }}>
            <ScoreNum value={match.scoreA} color={match.teamA.color} />
            <span className="font-display font-black text-xs sm:text-base text-foreground/50">VS</span>
            <ScoreNum value={match.scoreB} color={match.teamB.color} />
          </div>

          {/* 4 player seats */}
          {match.teamA.players[0] && <Seat pos="top-left"     player={match.teamA.players[0]} team={match.teamA} />}
          {match.teamA.players[1] && <Seat pos="bottom-right" player={match.teamA.players[1]} team={match.teamA} />}
          {match.teamB.players[0] && <Seat pos="top-right"    player={match.teamB.players[0]} team={match.teamB} />}
          {match.teamB.players[1] && <Seat pos="bottom-left"  player={match.teamB.players[1]} team={match.teamB} />}
        </div>

        {/* score entry OR locked message */}
        {isPending ? (
          <div className="mt-6 rounded-xl p-5 flex flex-col items-center gap-3 text-center"
               style={{ background: "oklch(0.18 0.05 150 / 80%)", border: "1px solid oklch(0.55 0.18 145 / 40%)" }}>
            <Lock className="h-6 w-6" style={{ color: "oklch(0.75 0.16 145)" }} />
            <div className="font-display font-black text-lg"
                 style={{ color: "oklch(0.75 0.16 145)" }}>
              Scoring Disabled
            </div>
            <p className="text-sm text-foreground/60 max-w-xs">
              A team has reached 14 points. The admin must approve or reject the result before play continues.
            </p>
            <p className="mt-1 text-xs text-foreground/45 italic">
              View game stats in the Past tab once approved.
            </p>
          </div>
        ) : (
          /* score entry — scorer for each team sees their panel; everyone else spectates */
          <div className="mt-6 grid md:grid-cols-2 gap-4">
            {canScoreA && (
              <ScoreEntry
                match={match}
                team={match.teamA}
                onSubmit={(entry) => {
                  addEntry(entry);
                  const newScore = match.scoreA + entry.total;
                  const reached = newScore >= 14;
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
        )}

        {/* Round Points */}
        <div className="mt-5">
          <div className="text-xs uppercase tracking-[0.3em] text-foreground/60 mb-3">Round Points</div>
          <RoundPointsLog entries={allEntries.filter((e) => e.matchId === match.id)} match={match} />
        </div>
      </div>
    </div>
  );
}

/** Shows both teams' points for every round, paired — most recent first */
function RoundPointsLog({ entries, match }: {
  entries: import("@/lib/store").RoundEntry[];
  match: Match;
}) {
  if (entries.length === 0) {
    return <div className="text-sm text-foreground/50 italic">No rounds entered yet.</div>;
  }

  // Group entries by round number (use ts order to assign round indices)
  // Each "round" = one entry per team submitted around the same time.
  // We pair them by sorting chronologically and grouping in pairs of 2
  // (one per team). If only one team has submitted, the other shows 0.
  const sorted = [...entries].sort((a, b) => a.ts - b.ts);

  // Build round groups: collect entries in order, pair by team
  type RoundGroup = { roundNum: number; a?: typeof sorted[0]; b?: typeof sorted[0] };
  const groups: RoundGroup[] = [];
  const usedIds = new Set<string>();

  let roundNum = 1;
  for (let i = 0; i < sorted.length; i++) {
    if (usedIds.has(sorted[i].id)) continue;
    const entryA = sorted[i].teamId === match.teamA.id ? sorted[i] : undefined;
    const entryB = sorted[i].teamId === match.teamB.id ? sorted[i] : undefined;

    // Look for the matching other-team entry within the next 3 entries
    for (let j = i + 1; j < Math.min(i + 4, sorted.length); j++) {
      if (usedIds.has(sorted[j].id)) continue;
      if (!entryA && sorted[j].teamId === match.teamA.id) {
        groups.push({ roundNum, a: sorted[j], b: entryB ?? sorted[i] });
        usedIds.add(sorted[i].id); usedIds.add(sorted[j].id);
        break;
      }
      if (!entryB && sorted[j].teamId === match.teamB.id) {
        groups.push({ roundNum, a: entryA ?? sorted[i], b: sorted[j] });
        usedIds.add(sorted[i].id); usedIds.add(sorted[j].id);
        break;
      }
    }
    if (!usedIds.has(sorted[i].id)) {
      // Unpaired — only one team scored this round
      groups.push({ roundNum, a: entryA, b: entryB });
      usedIds.add(sorted[i].id);
    }
    roundNum++;
  }

  // Show most recent first, last 6 rounds
  const visible = [...groups].reverse().slice(0, 6);

  return (
    <div className="space-y-2">
      {visible.map((g) => {
        const badgesA = entryBadges(g.a);
        const badgesB = entryBadges(g.b);
        return (
          <div key={g.roundNum}
               className="rounded-lg overflow-hidden"
               style={{ border: "1px solid oklch(0.83 0.16 88 / 20%)" }}>
            {/* Round label */}
            <div className="px-3 py-1 text-[9px] font-marquee tracking-[0.3em] text-foreground/40 uppercase"
                 style={{ background: "oklch(0.16 0.04 150)" }}>
              Round {g.roundNum}
            </div>
            {/* Team A row */}
            <div className="flex items-center justify-between px-3 py-2 gap-2"
                 style={{ background: "oklch(0.20 0.06 150)", borderTop: "1px solid oklch(0.83 0.16 88 / 10%)" }}>
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-2 h-2 rounded-full flex-shrink-0"
                     style={{ background: `var(--${match.teamA.color})` }} />
                <span className="font-bold text-xs truncate"
                      style={{ color: `var(--${match.teamA.color})` }}>
                  {match.teamA.name}
                </span>
                {badgesA.length > 0 && (
                  <span className="text-[10px] text-foreground/40 truncate hidden sm:block">
                    {badgesA.join(" · ")}
                  </span>
                )}
              </div>
              <span className="font-display font-black text-sm flex-shrink-0"
                    style={{ color: `var(--${match.teamA.color})` }}>
                {g.a ? `+${g.a.total}` : "+0"}
              </span>
            </div>
            {/* Team B row */}
            <div className="flex items-center justify-between px-3 py-2 gap-2"
                 style={{ background: "oklch(0.18 0.05 150 / 60%)", borderTop: "1px solid oklch(0.83 0.16 88 / 10%)" }}>
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-2 h-2 rounded-full flex-shrink-0"
                     style={{ background: `var(--${match.teamB.color})` }} />
                <span className="font-bold text-xs truncate"
                      style={{ color: `var(--${match.teamB.color})` }}>
                  {match.teamB.name}
                </span>
                {badgesB.length > 0 && (
                  <span className="text-[10px] text-foreground/40 truncate hidden sm:block">
                    {badgesB.join(" · ")}
                  </span>
                )}
              </div>
              <span className="font-display font-black text-sm flex-shrink-0"
                    style={{ color: `var(--${match.teamB.color})` }}>
                {g.b ? `+${g.b.total}` : "+0"}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function entryBadges(e?: import("@/lib/store").RoundEntry): string[] {
  if (!e) return [];
  const k = e.kick ?? 0;
  const kickLabel = k === 1 ? "K-Ace" : k === 2 ? "K-Six" : k === 3 ? "K-Jack" : null;
  return [
    e.high  && "H",
    e.low   && "L",
    e.jack === 3 ? "HJ" : e.jack === 1 ? "J" : null,
    e.game  && "G",
    kickLabel,
  ].filter((v): v is string => Boolean(v));
}

function ScoreNum({ value, color }: { value: number; color: string }) {
  return (
    <motion.div
      key={value}
      initial={{ scale: 1.4, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="font-display font-black text-2xl sm:text-5xl"
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
    <div className={`absolute ${positions[pos]} flex flex-col items-center gap-1`}>
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
      {/* Name below the avatar — always visible */}
      <div className="text-center leading-tight max-w-[72px]">
        <div className="font-display font-bold text-[10px] sm:text-xs truncate"
             style={{ color: `var(--${team.color})`, textShadow: `0 1px 4px oklch(0 0 0 / 80%)` }}>
          {player.name || player.email.split("@")[0]}
        </div>
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
  const [kick, setKick] = useState<0 | 1 | 2 | 3>(0); // 0=none, 1=Ace, 2=Six, 3=Jack

  const jackPts = jack ? 3 : 0;
  const total = (high ? 1 : 0) + (low ? 1 : 0) + jackPts + (game ? 2 : 0) + kick;
  const canSubmit = total > 0;

  const reset = () => { setHigh(false); setLow(false); setJack(false); setGame(false); setKick(0); };

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

      {/* High / Low / Hang Jack / Game */}
      <div className="grid grid-cols-4 gap-2">
        <PointBtn label="High" value="+1" active={high} onClick={() => setHigh(!high)} />
        <PointBtn label="Low" value="+1" active={low} onClick={() => setLow(!low)} />
        <PointBtn label="Hang Jack" value="+3" active={jack} onClick={() => setJack(!jack)} accent />
        <PointBtn label="Game" value="+2" active={game} onClick={() => setGame(!game)} />
      </div>

      {/* Kick card row */}
      <div className="mt-2">
        <div className="text-[9px] uppercase tracking-[0.25em] text-foreground/40 mb-1.5">Kick Card (dealer bonus)</div>
        <div className="grid grid-cols-3 gap-2">
          <PointBtn label="Ace" value="+1" active={kick === 1} onClick={() => setKick(kick === 1 ? 0 : 1)} dim />
          <PointBtn label="Six" value="+2" active={kick === 2} onClick={() => setKick(kick === 2 ? 0 : 2)} dim />
          <PointBtn label="Jack" value="+3" active={kick === 3} onClick={() => setKick(kick === 3 ? 0 : 3)} dim />
        </div>
      </div>

      <div className="flex items-center justify-between mt-4">
        <div className="text-sm text-foreground/70">
          Total: <span className="font-display font-black text-xl gold-text">{total}</span>
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
              high, low, jack: jackPts, game, kick, total,
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
  label, value, active, onClick, accent, dim,
}: { label: string; value: string; active: boolean; onClick: () => void; accent?: boolean; dim?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg py-2.5 px-2 text-center transition border-2 ${
        active ? "scale-[1.02]" : "opacity-80 hover:opacity-100"
      }`}
      style={{
        background: active
          ? dim
            ? "oklch(0.55 0.14 220 / 80%)"
            : accent ? "var(--gradient-crimson)" : "var(--gradient-gold)"
          : "oklch(0.22 0.06 150)",
        borderColor: active
          ? dim
            ? "oklch(0.65 0.16 220)"
            : accent ? "oklch(0.62 0.24 25)" : "oklch(0.83 0.16 88)"
          : "oklch(0.83 0.16 88 / 25%)",
        color: active && !accent && !dim ? "oklch(0.18 0.05 150)" : "var(--color-foreground)",
        boxShadow: active
          ? dim
            ? "0 0 16px oklch(0.55 0.14 220 / 40%)"
            : "0 0 20px oklch(0.83 0.16 88 / 40%)"
          : "none",
      }}
    >
      <div className="font-display font-bold text-xs uppercase tracking-wider">{label}</div>
      <div className="font-marquee text-lg tracking-wider">{value}</div>
    </button>
  );
}
