import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/lib/store";
import { winnerIsTeamA } from "@/lib/store";
import { LiveTable } from "@/components/LiveTable";
import { Check, X, Clock, History, ArrowLeft, Spade, MoreVertical, Trash2, UserX, Search, ChevronDown, ChevronUp, Trophy, Radio, CalendarDays, type LucideIcon, Timer } from "lucide-react";

export const Route = createFileRoute("/tables")({
  head: () => ({
    meta: [
      { title: "Tournament — Stumbling Fours" },
      { name: "description", content: "Live and past All Fours tournament games, scoring and approvals." },
    ],
  }),
  component: Tables,
});

type Tab = "live" | "upcoming" | "history" | "pending";

type TabDef = { id: Tab; label: string; icon: LucideIcon };

function Tables() {
  const role = useApp((s) => s.role);
  const allMatches = useApp((s) => s.matches);
  const updateMatch = useApp((s) => s.updateMatch);
  const [tab, setTab] = useState<Tab>("live");

  // ── Flip scheduled → live when startedAt is reached (runs regardless of active tab) ──
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      useApp.getState().matches.forEach((m) => {
        if (m.status === "scheduled" && m.startedAt <= now) {
          updateMatch(m.id, { status: "live", startedAt: now });
        }
      });
    }, 1000);
    return () => clearInterval(id);
  }, [updateMatch]);

  // ── Realtime badge counts ────────────────────────────────────────────────
  const liveCount     = allMatches.filter((m) => m.status === "live" || m.status === "pending" || (m.status === "scheduled" && m.startedAt <= Date.now())).length;
  const upcomingCount = allMatches.filter((m) => m.status === "scheduled" && m.startedAt > Date.now()).length;
  const historyCount  = allMatches.filter((m) => m.status === "completed").length;
  const pendingCount  = allMatches.filter((m) => m.status === "pending").length;

  const counts: Record<Tab, number> = {
    live:     liveCount,
    upcoming: upcomingCount,
    history:  historyCount,
    pending:  pendingCount,
  };

  const baseTabs: TabDef[] = [
    { id: "live",     label: "Live",     icon: Radio   },
    { id: "upcoming", label: "Upcoming", icon: Timer   },
    { id: "history",  label: "Past",     icon: History },
  ];
  const tabs = baseTabs; // pending is shown separately below for admins

  return (
    <div className="pt-2 overflow-x-hidden">
      {/* Title row */}
      <div className="mb-3">
        <h1 className="font-display font-black text-4xl gold-text">Tournament</h1>
      </div>

      {/* Main tab strip — 3 tabs only */}
      <div className="flex items-center gap-1 p-1.5 rounded-full mb-2 w-full"
           style={{ background: "oklch(0.20 0.06 150)", border: "1px solid oklch(0.83 0.16 88 / 30%)" }}>
        {tabs.map((t) => {
          const active = tab === t.id;
          const count  = counts[t.id];
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-1.5 font-bold uppercase tracking-widest transition text-xs min-w-0
                ${active ? "text-black" : "text-foreground/70"}`}
              style={active ? { background: "var(--gradient-gold)" } : {}}
            >
              <span className="truncate">{t.label}</span>
              {count > 0 && (
                <span
                  className="flex-shrink-0 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-black leading-4 text-center"
                  style={{
                    background: active ? "rgba(0,0,0,0.2)" : "oklch(0.83 0.16 88 / 25%)",
                    color: active ? "black" : "oklch(0.83 0.16 88)",
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Admin-only Pending button — right-aligned below the tab strip */}
      {role === "admin" && (
        <div className="flex justify-end mb-4">
          <button
            onClick={() => setTab("pending")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-bold uppercase tracking-widest text-xs transition
              ${tab === "pending" ? "text-black" : "text-foreground/70"}`}
            style={tab === "pending"
              ? { background: "var(--gradient-crimson)", color: "white" }
              : { background: "oklch(0.20 0.06 150)", border: "1px solid oklch(0.83 0.16 88 / 30%)" }}
          >
            <Clock className="h-3.5 w-3.5 flex-shrink-0" />
            <span>Pending</span>
            {pendingCount > 0 && (
              <span
                className="flex-shrink-0 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-black leading-4 text-center"
                style={{
                  background: tab === "pending" ? "rgba(255,255,255,0.3)" : "var(--gradient-crimson)",
                  color: "white",
                }}
              >
                {pendingCount}
              </span>
            )}
          </button>
        </div>
      )}
      {/* Add margin when no pending button */}
      {role !== "admin" && <div className="mb-4" />}

      {tab === "live"     && <LiveTab />}
      {tab === "upcoming" && <UpcomingTab />}
      {tab === "history"  && <HistoryTab />}
      {tab === "pending"  && role === "admin" && <PendingTab />}
    </div>
  );
}

function LiveTab() {
  const allMatches = useApp((s) => s.matches);
  const currentUserEmail = useApp((s) => s.currentUserEmail);
  const matches = useMemo(
    () => allMatches.filter((m) => m.status === "live" || m.status === "pending"),
    [allMatches],
  );

  // Three-level navigation: "tournaments" → "tables" (within a tournament) → "detail" (live table)
  type LiveView =
    | { level: "tournaments" }
    | { level: "tables"; tournamentId: string; tournamentName: string }
    | { level: "detail"; matchId: string; tournamentId: string; tournamentName: string };

  const [view, setView] = useState<LiveView>({ level: "tournaments" });
  const [liveSearch, setLiveSearch] = useState("");

  // Clear stale navigation when matches change
  useEffect(() => {
    if (matches.length === 0) { setView({ level: "tournaments" }); return; }
    if (view.level === "detail") {
      // If the match is no longer live/pending (e.g. admin approved → completed), go back
      if (!matches.some((m) => m.id === view.matchId)) setView({ level: "tournaments" });
    }
    if (view.level === "tables") {
      // If all matches for this tournament are gone from the live list, go back
      const anyLeft = matches.some((m) => (m.tournamentId ?? "unknown") === view.tournamentId);
      if (!anyLeft) setView({ level: "tournaments" });
    }
  }, [matches]);

  if (matches.length === 0)
    return <Empty icon={<Clock className="h-6 w-6" />} title="No live tables" body="Start a tournament round to bring tables online." />;

  // ── Detail view ────────────────────────────────────────────────────────
  if (view.level === "detail") {
    const active = matches.find((m) => m.id === view.matchId) ?? null;
    if (!active) { setView({ level: "tournaments" }); return null; }
    return (
      <div className="space-y-4">
        <button
          onClick={() => setView({ level: "tables", tournamentId: view.tournamentId, tournamentName: view.tournamentName })}
          className="chip-button chip-button-hover"
          style={{ background: "var(--gradient-gold)", color: "oklch(0.10 0.03 150)" }}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {view.tournamentName}
        </button>
        <LiveTable match={active} />
      </div>
    );
  }

  // Group live matches by tournament
  const byTournament = useMemo(() => {
    const map = new Map<string, { id: string; name: string; matches: typeof matches }>();
    for (const m of matches) {
      const tid = m.tournamentId ?? "unknown";
      const tname = m.tournamentName ?? "Tournament";
      if (!map.has(tid)) map.set(tid, { id: tid, name: tname, matches: [] });
      map.get(tid)!.matches.push(m);
    }
    return Array.from(map.values());
  }, [matches]);

  // ── Tables view (within one tournament) ───────────────────────────────
  if (view.level === "tables") {
    const trn = byTournament.find((t) => t.id === view.tournamentId);
    const trnMatches = trn?.matches ?? [];
    const myMatch = trnMatches.find((m) =>
      [...m.teamA.players, ...m.teamB.players].some((p) => p.email === currentUserEmail)
    );
    const liveCount = trnMatches.filter((m) => m.status === "live").length;
    const searchTerm = liveSearch.trim().toLowerCase();
    const filtered = searchTerm
      ? trnMatches.filter((m) =>
          m.teamA.name.toLowerCase().includes(searchTerm) ||
          m.teamB.name.toLowerCase().includes(searchTerm)
        )
      : trnMatches;
    const maxRound = Math.max(...trnMatches.map((m) => m.round));
    const byRound = filtered.reduce<Record<number, typeof trnMatches>>((acc, m) => {
      (acc[m.round] ??= []).push(m);
      return acc;
    }, {});
    const roundNumbers = Object.keys(byRound).map(Number).sort((a, b) => a - b);

    return (
      <div className="space-y-6">
        {/* Back to tournaments */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button
            onClick={() => { setView({ level: "tournaments" }); setLiveSearch(""); }}
            className="chip-button chip-button-hover"
            style={{ background: "var(--gradient-gold)", color: "oklch(0.10 0.03 150)" }}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Tournaments
          </button>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ background: "var(--gradient-crimson)", color: "white" }}>
              {liveCount} LIVE
            </span>
            {trnMatches.length > liveCount && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                    style={{ background: "oklch(0.55 0.18 145)", color: "white" }}>
                {trnMatches.length - liveCount} PENDING
              </span>
            )}
          </div>
        </div>

        <h2 className="font-display font-black text-xl gold-text -mt-2">{view.tournamentName}</h2>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40 pointer-events-none" />
          <input
            value={liveSearch}
            onChange={(e) => setLiveSearch(e.target.value)}
            placeholder="Search by team name…"
            style={{
              background: "oklch(0.16 0.04 150)",
              border: "1px solid oklch(0.83 0.16 88 / 25%)",
              color: "var(--color-foreground)",
              padding: "0.55rem 0.75rem",
              paddingLeft: "2.25rem",
              paddingRight: liveSearch ? "2.25rem" : "0.75rem",
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
              width: "100%",
              outline: "none",
            }}
          />
          {liveSearch && (
            <button type="button" onClick={() => setLiveSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground/70 transition">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {filtered.length === 0 && <p className="text-sm text-foreground/50">No tables match.</p>}

        {roundNumbers.map((roundNum) => (
          <div key={roundNum}>
            <div className="flex items-center gap-4 mb-4">
              <div className="font-marquee tracking-[0.25em] text-lg gold-text">
                {getRoundLabel(roundNum, maxRound)}
              </div>
              <div className="flex-1 h-px" style={{ background: "oklch(0.83 0.16 88 / 25%)" }} />
              <div className="text-[10px] uppercase tracking-widest text-foreground/40">
                {byRound[roundNum].length} {byRound[roundNum].length === 1 ? "table" : "tables"}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {byRound[roundNum].map((m) => {
                const isMine = m.id === myMatch?.id;
                const isPending = m.status === "pending";
                return (
                  <div key={m.id}
                       className="relative rounded-xl border-2 transition hover:scale-[1.02] hover:shadow-xl min-w-0 w-full"
                       style={{
                         borderColor: isPending ? "oklch(0.55 0.18 145)" : "oklch(0.83 0.16 88 / 35%)",
                         background: "oklch(0.18 0.05 150 / 80%)",
                         boxShadow: isMine ? "0 0 20px oklch(0.83 0.16 88 / 30%)" : undefined,
                       }}>
                    <button
                      onClick={() => setView({ level: "detail", matchId: m.id, tournamentId: view.tournamentId, tournamentName: view.tournamentName })}
                      className="w-full text-left p-4 focus:outline-none"
                    >
                      <div className="flex items-center justify-between mb-3 pr-6 gap-2">
                        <span className="font-marquee tracking-[0.3em] text-sm text-foreground/80 truncate">{m.tableName}</span>
                        <span className="flex items-center gap-1.5 flex-shrink-0">
                          {isPending ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                                  style={{ background: "oklch(0.55 0.18 145)", color: "white" }}>PENDING</span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <span className="relative flex h-2 w-2">
                                <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
                                      style={{ background: "oklch(0.62 0.24 25)" }} />
                                <span className="relative inline-flex rounded-full h-2 w-2"
                                      style={{ background: "oklch(0.62 0.24 25)" }} />
                              </span>
                              <span className="font-marquee tracking-widest text-[10px] text-foreground/70">LIVE</span>
                            </span>
                          )}
                          {isMine && <span className="text-[11px] gold-text font-bold">★ YOU</span>}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1 min-w-0">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: `var(--${m.teamA.color})` }} />
                            <div className="font-display font-bold text-xs truncate min-w-0" style={{ color: `var(--${m.teamA.color})` }}>{m.teamA.name}</div>
                          </div>
                          <div className="font-display font-black text-2xl" style={{ color: `var(--${m.teamA.color})`, textShadow: `0 0 12px var(--${m.teamA.color})` }}>{m.scoreA}</div>
                        </div>
                        <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                          <Spade className="h-3.5 w-3.5 text-foreground/30" />
                          <span className="font-marquee tracking-widest text-[10px] text-foreground/40">VS</span>
                        </div>
                        <div className="flex-1 min-w-0 text-right">
                          <div className="flex items-center justify-end gap-1.5 mb-1 min-w-0">
                            <div className="font-display font-bold text-xs truncate min-w-0" style={{ color: `var(--${m.teamB.color})` }}>{m.teamB.name}</div>
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: `var(--${m.teamB.color})` }} />
                          </div>
                          <div className="font-display font-black text-2xl text-right" style={{ color: `var(--${m.teamB.color})`, textShadow: `0 0 12px var(--${m.teamB.color})` }}>{m.scoreB}</div>
                        </div>
                      </div>
                    </button>
                    <AdminCardMenu matchId={m.id} teamA={m.teamA} teamB={m.teamB} />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Tournament list view ───────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {byTournament.map((trn) => {
        const liveCount = trn.matches.filter((m) => m.status === "live").length;
        const pendingCount = trn.matches.filter((m) => m.status === "pending").length;
        const earliest = Math.min(...trn.matches.map((m) => m.startedAt));
        const fmtDate = (ts: number) => new Date(ts).toLocaleDateString("en-TT", { day: "numeric", month: "short" });
        return (
          <button
            key={trn.id}
            onClick={() => setView({ level: "tables", tournamentId: trn.id, tournamentName: trn.name })}
            className="w-full text-left ornate-border p-5 flex items-center gap-4 transition hover:scale-[1.01]"
            style={{ borderColor: "oklch(0.83 0.16 88 / 35%)" }}
          >
            <div className="h-12 w-12 rounded-full grid place-items-center flex-shrink-0"
                 style={{ background: "var(--gradient-crimson)", color: "white" }}>
              <Trophy className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-display font-black text-lg gold-text truncate">{trn.name}</div>
              <div className="text-xs text-foreground/50 mt-0.5">{fmtDate(earliest)} · {trn.matches.length} table{trn.matches.length === 1 ? "" : "s"}</div>
              <div className="flex items-center gap-2 mt-1.5">
                {liveCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold"
                        style={{ background: "var(--gradient-crimson)", color: "white" }}>{liveCount} LIVE</span>
                )}
                {pendingCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold"
                        style={{ background: "oklch(0.55 0.18 145)", color: "white" }}>{pendingCount} PENDING</span>
                )}
              </div>
            </div>
            <ArrowLeft className="h-5 w-5 text-foreground/40 rotate-180 flex-shrink-0" />
          </button>
        );
      })}
    </div>
  );
}

function UpcomingTab() {
  const tournament = useApp((s) => s.tournament);
  const allMatches = useApp((s) => s.matches);
  const role = useApp((s) => s.role);
  const setTournament = useApp((s) => s.setTournament);

  // Scheduled matches — status is "scheduled" and start time is still in the future
  const scheduledMatches = allMatches.filter((m) => m.status === "scheduled" && m.startedAt > Date.now());

  if (scheduledMatches.length === 0) {
    return (
      <Empty
        icon={<Timer className="h-6 w-6" />}
        title="No upcoming tournaments"
      />
    );
  }

  // Get tournament info for the scheduled matches
  const tournamentName = tournament?.name ?? scheduledMatches[0]?.tournamentName ?? "Tournament";
  // All scheduled matches share the same startedAt (set to scheduledDate at creation)
  const scheduledDate = scheduledMatches[0].startedAt;

  return (
    <div className="space-y-4">
      <UpcomingCard
        tournament={tournament ?? { id: "", name: tournamentName, playersPerTeam: 2, gamesPerRound: 1, prizes: { first: "" }, teams: [], createdAt: 0, scheduledDate }}
        hasLiveMatches={false}
        isAdmin={role === "admin"}
        onDelete={() => {
          if (!confirm(`Cancel "${tournamentName}"? This will remove the scheduled tournament.`)) return;
          // Remove scheduled matches and clear tournament
          useApp.getState().setMatches(allMatches.filter((m) => m.status !== "scheduled"));
          setTournament(null);
        }}
      />
    </div>
  );
}

function UpcomingCard({
  tournament,
  hasLiveMatches,
  isAdmin,
  onDelete,
}: {
  tournament: import("@/lib/store").Tournament;
  hasLiveMatches: boolean;
  isAdmin?: boolean;
  onDelete?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const scheduledDate = tournament.scheduledDate!;
    // Don't tick if already past the scheduled time
    if (scheduledDate <= Date.now()) return;
    const id = setInterval(() => {
      const remaining = scheduledDate - Date.now();
      setNow(Date.now());
      // Stop ticking once tournament has started
      if (remaining <= 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [tournament.scheduledDate]);

  const scheduledDate = tournament.scheduledDate!;
  const diff = scheduledDate - now;
  const started = diff <= 0;

  const pad = (n: number) => String(Math.max(0, Math.floor(n))).padStart(2, "0");
  const days    = Math.floor(diff / 86_400_000);
  const hours   = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1000);

  const dateLabel = new Date(scheduledDate).toLocaleDateString("en-TT", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const timeLabel = new Date(scheduledDate).toLocaleTimeString("en-TT", {
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="ornate-border overflow-hidden">
      {/* Card header */}
      <div className="relative"
           style={{ background: started ? "oklch(0.62 0.24 25 / 8%)" : "oklch(0.20 0.06 150 / 60%)" }}>
        {/* Expand button — takes up full header */}
        <button
          onClick={() => setOpen(v => !v)}
          className="w-full text-left p-5"
        >
          <div className="flex items-start gap-4 pr-10">
            <div className="h-12 w-12 rounded-full grid place-items-center flex-shrink-0"
                 style={{ background: started ? "var(--gradient-crimson)" : "var(--gradient-gold)",
                          color: started ? "white" : "oklch(0.18 0.05 150)" }}>
              <Trophy className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-display font-black text-xl gold-text truncate">{tournament.name}</div>
              <div className="text-sm text-foreground/60 mt-0.5">{dateLabel} · {timeLabel}</div>

            {/* Countdown or Started badge */}
            {started ? (
              <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider"
                   style={{ background: "var(--gradient-crimson)", color: "white" }}>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping bg-white" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                </span>
                {hasLiveMatches ? "In Progress" : "Starting Now"}
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                {days > 0 && <CountUnit value={days} label="days" />}
                <CountUnit value={hours} label="hrs" />
                <CountUnit value={minutes} label="min" />
                <CountUnit value={seconds} label="sec" />
              </div>
            )}
          </div>
          <div className="flex-shrink-0 pt-1">
            {open
              ? <ChevronUp className="h-5 w-5 text-foreground/50" />
              : <ChevronDown className="h-5 w-5 text-foreground/50" />}
          </div>
        </div>

        {/* Prize strip */}
        {(tournament.prizes.first) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              { label: "1st", value: tournament.prizes.first },
              tournament.prizes.second && { label: "2nd", value: tournament.prizes.second },
              tournament.prizes.third  && { label: "3rd", value: tournament.prizes.third },
            ].filter(Boolean).map((p) => p && (
              <span key={p.label}
                    className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                    style={{ background: "oklch(0.83 0.16 88 / 15%)", color: "oklch(0.83 0.16 88)" }}>
                {p.label} · {p.value}
              </span>
            ))}
          </div>
        )}
        </button>

        {/* Admin trash button — absolutely positioned top-right */}
        {isAdmin && onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="absolute top-3 right-3 p-2 rounded-md transition hover:bg-red-500/20"
            title="Cancel tournament"
          >
            <Trash2 className="h-4 w-4 text-red-400" />
          </button>
        )}
      </div>

      {/* Expanded bracket */}
      {open && (
        <div className="px-5 pb-5 pt-3 space-y-4 border-t"
             style={{ borderColor: "oklch(0.83 0.16 88 / 15%)" }}>
          <div className="text-[10px] uppercase tracking-[0.3em] text-foreground/50">Tournament Line-up</div>

          {tournament.teams.length < 2 ? (
            <div className="text-sm text-foreground/50 italic">Teams not yet assigned.</div>
          ) : (
            <div className="space-y-2">
              {/* Pair teams for display — same logic as bracket generation */}
              {(() => {
                const teams = tournament.teams;
                const pairs: [typeof teams[0], typeof teams[0] | undefined][] = [];
                for (let i = 0; i < teams.length - 1; i += 2) {
                  pairs.push([teams[i], teams[i + 1]]);
                }
                if (teams.length % 2 !== 0) pairs.push([teams[teams.length - 1], undefined]);
                return pairs.map((pair, i) => (
                  <div key={i}
                       className="rounded-xl px-4 py-3 flex items-start gap-3"
                       style={{ background: "oklch(0.18 0.05 150 / 80%)", border: "1px solid oklch(0.83 0.16 88 / 20%)" }}>
                    <TeamRoster team={pair[0]} />
                    <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-1">
                      <span className="font-marquee text-xs text-foreground/40 tracking-widest">VS</span>
                      <span className="text-[10px] text-foreground/35 whitespace-nowrap">Table {i + 1}</span>
                    </div>
                    {pair[1]
                      ? <TeamRoster team={pair[1]} />
                      : <span className="text-xs text-foreground/40 italic flex-1 pt-1">Bye</span>}
                  </div>
                ));
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CountUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center px-2.5 py-1.5 rounded-lg min-w-[44px]"
         style={{ background: "oklch(0.22 0.06 150)", border: "1px solid oklch(0.83 0.16 88 / 25%)" }}>
      <span className="font-display font-black text-xl gold-text leading-none">
        {String(Math.max(0, value)).padStart(2, "0")}
      </span>
      <span className="text-[9px] uppercase tracking-widest text-foreground/45 mt-0.5">{label}</span>
    </div>
  );
}

function TeamPill({ team }: { team: import("@/lib/store").Team }) {
  return (
    <div className="flex items-center gap-1.5 flex-1 min-w-0">
      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
           style={{ background: `var(--${team.color})` }} />
      <span className="font-display font-bold text-sm truncate"
            style={{ color: `var(--${team.color})` }}>
        {team.name}
      </span>
    </div>
  );
}

function TeamRoster({ team }: { team: import("@/lib/store").Team }) {
  return (
    <div className="flex-1 min-w-0 space-y-1">
      <div className="flex items-center gap-1.5">
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
             style={{ background: `var(--${team.color})` }} />
        <span className="font-display font-bold text-sm truncate"
              style={{ color: `var(--${team.color})` }}>
          {team.name}
        </span>
      </div>
      {team.players.length > 0 ? (
        <div className="pl-4 space-y-0.5">
          {team.players.map((p, i) => (
            <div key={i} className="text-[11px] text-foreground/60 truncate">
              {p.name || p.email.split("@")[0]}
            </div>
          ))}
        </div>
      ) : (
        <div className="pl-4 text-[11px] text-foreground/35 italic">No players assigned</div>
      )}
    </div>
  );
}

function PendingTab() {
  const allMatches = useApp((s) => s.matches);
  const matches = allMatches.filter((m) => m.status === "pending");
  const updateMatch = useApp((s) => s.updateMatch);
  if (matches.length === 0)
    return <Empty icon={<Check className="h-6 w-6" />} title="Nothing pending" body="Match wins appear here for your approval at ≥14 points." />;
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {matches.map((m) => {
        const wA = winnerIsTeamA(m);
        const winner = wA ? m.teamA : m.teamB;
        return (
          <div key={m.id} className="ornate-border p-5">
            <div className="text-xs font-marquee tracking-[0.3em] text-foreground/60 mb-2">{m.tableName} · Awaiting approval</div>
            <div className="font-display font-bold text-lg mb-1">
              Winner: <span className="gold-text">{winner.name}</span>
            </div>
            <div className="text-sm text-foreground/70 mb-4">
              {m.teamA.name} {m.scoreA} — {m.scoreB} {m.teamB.name}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => updateMatch(m.id, { status: "completed" })}
                className="chip-button chip-button-hover text-xs"
              >
                <Check className="h-3.5 w-3.5 mr-1" /> Approve
              </button>
              <button
                onClick={() => updateMatch(m.id, { status: "live", winnerId: undefined })}
                className="chip-button chip-button-hover text-xs"
                style={{ background: "var(--gradient-crimson)", color: "white" }}
              >
                <X className="h-3.5 w-3.5 mr-1" /> Reject
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HistoryTab() {
  const allMatches = useApp((s) => s.matches);
  const allEntries = useApp((s) => s.entries);

  const completed = allMatches.filter((m) => m.status === "completed");

  if (completed.length === 0)
    return <Empty icon={<History className="h-6 w-6" />} title="No completed games yet" body="Completed matches will appear here grouped by tournament." />;

  const fmtDate = (ts: number) =>
    new Date(ts).toLocaleDateString("en-TT", { day: "numeric", month: "short", year: "numeric" });

  // Group by tournamentId — fall back to "legacy" bucket for matches without one
  const groups = new Map<string, { id: string; name: string; matches: typeof completed }>();
  for (const m of completed) {
    const tid   = m.tournamentId   ?? "legacy";
    const tname = m.tournamentName ?? "Tournament";
    if (!groups.has(tid)) groups.set(tid, { id: tid, name: tname, matches: [] });
    groups.get(tid)!.matches.push(m);
  }

  // Sort groups: most recent first (by latest match startedAt in group)
  const sortedGroups = Array.from(groups.values()).sort((a, b) => {
    const latestA = Math.max(...a.matches.map((m) => m.startedAt));
    const latestB = Math.max(...b.matches.map((m) => m.startedAt));
    return latestB - latestA;
  });

  return (
    <div className="space-y-4">
      {sortedGroups.map((grp) => {
        const timestamps = grp.matches.map((m) => m.startedAt);
        const minTs = Math.min(...timestamps);
        const maxTs = Math.max(...timestamps);
        const dateRange = minTs === maxTs
          ? fmtDate(minTs)
          : `${fmtDate(minTs)} – ${fmtDate(maxTs)}`;
        const maxRound = Math.max(...grp.matches.map((m) => m.round));
        const sorted = [...grp.matches].sort((a, b) =>
          b.round !== a.round ? b.round - a.round : b.startedAt - a.startedAt
        );
        return (
          <TournamentAccordion
            key={grp.id}
            name={grp.name}
            dateRange={dateRange}
            matches={sorted}
            maxRound={maxRound}
            allEntries={allEntries}
          />
        );
      })}
    </div>
  );
}

type MatchEntry = import("@/lib/store").RoundEntry;
type MatchItem = import("@/lib/store").Match;

function TournamentAccordion({
  name, dateRange, matches, maxRound, allEntries,
}: {
  name: string;
  dateRange: string;
  matches: MatchItem[];
  maxRound: number;
  allEntries: MatchEntry[];
}) {
  const [open, setOpen] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="ornate-border overflow-hidden">
      {/* Tournament accordion header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-4 p-5 text-left"
        style={{ background: "oklch(0.20 0.06 150 / 60%)" }}
      >
        <div className="h-10 w-10 rounded-full grid place-items-center flex-shrink-0"
             style={{ background: "var(--gradient-gold)", color: "oklch(0.18 0.05 150)" }}>
          <Trophy className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display font-black text-base gold-text leading-snug">{name}</div>
          <div className="font-marquee text-xs tracking-[0.25em] text-foreground/55 mt-0.5">{dateRange}</div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-foreground/50">{matches.length} games</span>
          {open ? <ChevronUp className="h-4 w-4 text-foreground/50" /> : <ChevronDown className="h-4 w-4 text-foreground/50" />}
        </div>
      </button>

      {/* Match list */}
      {open && (
        <div className="divide-y" style={{ borderColor: "oklch(0.83 0.16 88 / 15%)" }}>
          {matches.map((m) => {
            const isFinal = m.round === maxRound;
            const isExpanded = expandedId === m.id;
            const matchEntries = allEntries.filter((e) => e.matchId === m.id);
            const roundLabel = getRoundLabel(m.round, maxRound);

            // Group entries by team
            const entriesA = matchEntries.filter((e) => e.teamId === m.teamA.id);
            const entriesB = matchEntries.filter((e) => e.teamId === m.teamB.id);

            return (
              <div key={m.id} style={{ borderColor: "oklch(0.83 0.16 88 / 15%)" }}>

                {/* ── Collapsed row ── */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : m.id)}
                  className="w-full text-left transition-all active:scale-[0.99]"
                  style={{
                    background: isExpanded
                      ? "oklch(0.22 0.06 150)"
                      : isFinal
                        ? "oklch(0.83 0.16 88 / 6%)"
                        : "oklch(0.18 0.05 150 / 60%)",
                    borderBottom: isExpanded ? "none" : "1px solid oklch(0.83 0.16 88 / 10%)",
                  }}
                >
                  <div className="px-4 py-3.5">
                    {/* Top row: stage + date + expand indicator */}
                    <div className="flex items-center gap-2 mb-2.5">
                      {isFinal ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex-shrink-0"
                              style={{ background: "var(--gradient-gold)", color: "oklch(0.18 0.05 150)" }}>
                          ★ Final
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex-shrink-0"
                              style={{ background: "oklch(0.25 0.06 150)", color: "var(--color-foreground)", opacity: 0.7 }}>
                          {roundLabel}
                        </span>
                      )}
                      <span className="text-[10px] text-foreground/35 flex-shrink-0">
                        {new Date(m.startedAt).toLocaleDateString("en-TT", { day: "numeric", month: "short" })}
                        {" · "}{m.tableName}
                      </span>
                      {/* Expand pill — the main affordance */}
                      <div className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-full flex-shrink-0 transition-all"
                           style={{
                             background: isExpanded ? "oklch(0.83 0.16 88 / 20%)" : "oklch(0.83 0.16 88 / 10%)",
                             border: "1px solid oklch(0.83 0.16 88 / 30%)",
                             color: "oklch(0.83 0.16 88)",
                           }}>
                        <span className="text-[9px] font-bold uppercase tracking-wider">
                          {isExpanded ? "Close" : "Details"}
                        </span>
                        {isExpanded
                          ? <ChevronUp className="h-3 w-3" />
                          : <ChevronDown className="h-3 w-3" />}
                      </div>
                    </div>

                    {/* Score line */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                               style={{ background: `var(--${m.teamA.color})` }} />
                          <span className="font-display font-bold text-sm truncate"
                                style={{ color: `var(--${m.teamA.color})` }}>
                            {m.teamA.name}
                          </span>
                          {m.disqualifiedTeamId === m.teamA.id && (
                            <span className="text-[9px] font-bold px-1 py-0.5 rounded flex-shrink-0"
                                  style={{ background: "oklch(0.55 0.22 25 / 25%)", color: "oklch(0.75 0.18 25)" }}>DQ</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {(() => {
                          const wA = winnerIsTeamA(m, matchEntries);
                          return (
                            <>
                              <span className="font-display font-black text-xl"
                                    style={{ color: wA ? "oklch(0.83 0.16 88)" : "var(--color-foreground)" }}>
                                {m.scoreA}
                              </span>
                              <span className="text-foreground/30 text-sm font-bold">—</span>
                              <span className="font-display font-black text-xl"
                                    style={{ color: !wA ? "oklch(0.83 0.16 88)" : "var(--color-foreground)" }}>
                                {m.scoreB}
                              </span>
                            </>
                          );
                        })()}
                      </div>
                      <div className="flex-1 min-w-0 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {m.disqualifiedTeamId === m.teamB.id && (
                            <span className="text-[9px] font-bold px-1 py-0.5 rounded flex-shrink-0"
                                  style={{ background: "oklch(0.55 0.22 25 / 25%)", color: "oklch(0.75 0.18 25)" }}>DQ</span>
                          )}
                          <span className="font-display font-bold text-sm truncate"
                                style={{ color: `var(--${m.teamB.color})` }}>
                            {m.teamB.name}
                          </span>
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                               style={{ background: `var(--${m.teamB.color})` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </button>

                {/* ── Expanded detail ── */}
                {isExpanded && (
                  <div className="px-4 pb-5 space-y-4"
                       style={{ background: "oklch(0.15 0.04 150 / 80%)", borderTop: "1px solid oklch(0.83 0.16 88 / 12%)" }}>

                    {/* Players */}
                    {(() => {
                      const wA = winnerIsTeamA(m, matchEntries);
                      const winnerTeam  = wA ? m.teamA : m.teamB;
                      const winnerScore = wA ? m.scoreA : m.scoreB;
                      const loserScore  = wA ? m.scoreB : m.scoreA;

                      return (
                        <>
                          <div className="grid grid-cols-2 gap-3 pt-4">
                            <PlayerCard team={m.teamA} isWinner={wA} isDQ={m.disqualifiedTeamId === m.teamA.id} />
                            <PlayerCard team={m.teamB} isWinner={!wA} isDQ={m.disqualifiedTeamId === m.teamB.id} />
                          </div>

                          {/* Round entries per team */}
                          {matchEntries.length > 0 && (
                            <div className="grid grid-cols-2 gap-3">
                              <EntryColumn entries={entriesA} team={m.teamA} />
                              <EntryColumn entries={entriesB} team={m.teamB} />
                            </div>
                          )}

                          {/* Final score banner */}
                          <div className="rounded-xl overflow-hidden"
                               style={{ border: "1px solid oklch(0.83 0.16 88 / 25%)" }}>
                            <div className="p-3 flex items-center justify-between gap-3"
                                 style={{ background: "oklch(0.20 0.06 150)" }}>
                              <div className="text-xs font-bold uppercase tracking-wider"
                                   style={{ color: `var(--${winnerTeam.color})` }}>
                                {winnerTeam.name} wins
                              </div>
                              <div className="font-display font-black text-2xl gold-text flex-shrink-0">
                                {winnerScore} — {loserScore}
                              </div>
                            </div>
                            {m.disqualifiedTeamId && (
                              <div className="flex items-center gap-2 px-3 py-2"
                                   style={{ background: "oklch(0.55 0.22 25 / 12%)", borderTop: "1px solid oklch(0.55 0.22 25 / 25%)" }}>
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase flex-shrink-0"
                                      style={{ background: "var(--gradient-crimson)", color: "white" }}>DQ</span>
                                <span className="text-[11px] text-foreground/60">
                                  {m.disqualifiedTeamId === m.teamA.id ? m.teamA.name : m.teamB.name} was disqualified — opponent awarded the win
                                </span>
                              </div>
                            )}
                          </div>
                        </>
                      );
                    })()}

                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PlayerCard({ team, isWinner, isDQ }: {
  team: MatchItem["teamA"];
  isWinner: boolean;
  isDQ: boolean;
}) {
  return (
    <div className="rounded-xl p-3 space-y-1.5"
         style={{
           background: "oklch(0.18 0.05 150 / 80%)",
           border: `1px solid var(--${team.color})`,
           opacity: isDQ ? 0.6 : 1,
         }}>
      <div className="flex items-center gap-1.5 mb-1">
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
             style={{ background: `var(--${team.color})` }} />
        <span className="font-display font-bold text-xs truncate"
              style={{ color: `var(--${team.color})` }}>{team.name}</span>
        {isWinner && <span className="ml-auto text-[10px] gold-text font-black flex-shrink-0">★ Won</span>}
        {isDQ && <span className="ml-auto text-[10px] font-bold flex-shrink-0"
                       style={{ color: "oklch(0.75 0.18 25)" }}>DQ</span>}
      </div>
      {team.players.map((p) => (
        <div key={p.email} className="text-[11px] text-foreground/65 truncate pl-0.5">
          {p.name || p.email.split("@")[0]}
        </div>
      ))}
    </div>
  );
}

function EntryColumn({ entries, team }: {
  entries: MatchEntry[];
  team: MatchItem["teamA"];
}) {
  const total = entries.reduce((s, e) => s + e.total, 0);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-[0.2em] font-bold truncate"
              style={{ color: `var(--${team.color})` }}>{team.name}</span>
        <span className="text-[10px] text-foreground/45 flex-shrink-0 ml-1">{total} pts</span>
      </div>
      {entries.length === 0 && (
        <div className="text-[11px] text-foreground/35 italic">No rounds</div>
      )}
      {entries.map((e) => {
        const badges = [
          e.high  && { label: "H",  title: "High",      gold: true  },
          e.low   && { label: "L",  title: "Low",       gold: true  },
          e.jack === 3 && { label: "HJ", title: "Hang Jack", red: true },
          e.jack === 1 && { label: "J",  title: "Jack",      gold: true },
          e.game  && { label: "G",  title: "Game",      gold: true  },
        ].filter(Boolean) as { label: string; title: string; gold?: boolean; red?: boolean }[];

        return (
          <div key={e.id}
               className="rounded-lg px-2.5 py-2 flex items-center justify-between gap-2"
               style={{ background: "oklch(0.20 0.06 150)", border: "1px solid oklch(0.83 0.16 88 / 15%)" }}>
            <div className="flex items-center gap-1 flex-wrap min-w-0">
              {badges.map((b) => (
                <span key={b.label} title={b.title}
                      className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase"
                      style={{
                        background: b.red ? "var(--gradient-crimson)" : "oklch(0.83 0.16 88 / 20%)",
                        color: b.red ? "white" : "oklch(0.83 0.16 88)",
                      }}>
                  {b.label}
                </span>
              ))}
              {badges.length === 0 && <span className="text-[10px] text-foreground/30">—</span>}
            </div>
            <span className="font-display font-black text-sm flex-shrink-0 gold-text">+{e.total}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Derives a human-readable stage label from the round number.
 * maxRound = highest round number across ALL matches (live + completed).
 */
function getRoundLabel(round: number, maxRound: number): string {
  const remaining = maxRound - round; // how many rounds after this one
  if (remaining === 0) return "Final";
  if (remaining === 1) return "Semifinal";
  if (remaining === 2) return "Quarterfinal";
  return `Round ${round}`;
}

// ── Admin card menu ────────────────────────────────────────────────────────

type AdminCardMenuProps = {
  matchId: string;
  teamA: import("@/lib/store").Team;
  teamB: import("@/lib/store").Team;
};

function AdminCardMenu({ matchId, teamA, teamB }: AdminCardMenuProps) {
  const role = useApp((s) => s.role);
  const allMatches = useApp((s) => s.matches);
  const setMatches = useApp((s) => s.setMatches);
  const updateMatch = useApp((s) => s.updateMatch);

  const [open, setOpen] = useState(false);
  const [dqOpen, setDqOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (role !== "admin") return null;

  const handleDelete = () => {
    if (!confirm(`Delete this table? This cannot be undone.`)) return;
    setMatches(allMatches.filter((m) => m.id !== matchId));
    setOpen(false);
  };

  const handleDisqualify = (losingTeamId: string) => {
    const match = allMatches.find((m) => m.id === matchId);
    if (!match) return;
    const winner = match.teamA.id === losingTeamId ? match.teamB : match.teamA;
    updateMatch(matchId, { status: "completed", winnerId: winner.id, disqualifiedTeamId: losingTeamId });
    setDqOpen(false);
    setOpen(false);
  };

  return (
    <>
      {/* 3-dot trigger */}
      <div ref={menuRef} className="absolute top-3 right-3">
        <button
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
          className="p-1.5 rounded-md transition hover:bg-white/10 focus:outline-none"
          title="Table options"
        >
          <MoreVertical className="h-4 w-4 text-foreground/50" />
        </button>

        {open && (
          <div
            className="absolute right-0 top-8 z-50 min-w-[170px] rounded-xl border overflow-hidden shadow-2xl"
            style={{ background: "oklch(0.20 0.06 150)", borderColor: "oklch(0.83 0.16 88 / 30%)" }}
          >
            <button
              onClick={(e) => { e.stopPropagation(); setDqOpen(true); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-left hover:bg-white/8 transition"
            >
              <UserX className="h-4 w-4 text-amber-400 flex-shrink-0" />
              <span>Disqualify Team…</span>
            </button>
            <div className="h-px mx-3" style={{ background: "oklch(0.83 0.16 88 / 15%)" }} />
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(); }}
              className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-left hover:bg-white/8 transition text-red-400"
            >
              <Trash2 className="h-4 w-4 flex-shrink-0" />
              <span>Delete Table</span>
            </button>
          </div>
        )}
      </div>

      {/* Disqualify dialog */}
      {dqOpen && (
        <DisqualifyDialog
          teamA={teamA}
          teamB={teamB}
          onConfirm={handleDisqualify}
          onClose={() => setDqOpen(false)}
        />
      )}
    </>
  );
}

// ── Disqualify dialog ──────────────────────────────────────────────────────

type DisqualifyDialogProps = {
  teamA: import("@/lib/store").Team;
  teamB: import("@/lib/store").Team;
  onConfirm: (losingTeamId: string) => void;
  onClose: () => void;
};

function DisqualifyDialog({ teamA, teamB, onConfirm, onClose }: DisqualifyDialogProps) {
  const [selected, setSelected] = useState<string>("");

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "oklch(0 0 0 / 70%)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 shadow-2xl"
        style={{ background: "oklch(0.20 0.06 150)", border: "2px solid oklch(0.83 0.16 88 / 40%)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-1">
          <UserX className="h-5 w-5 text-amber-400" />
          <h2 className="font-display font-black text-lg gold-text">Disqualify Team</h2>
        </div>
        <p className="text-sm text-foreground/60 mb-5">
          Select the team to disqualify. Their opponent will be declared the winner instantly.
        </p>

        <div className="space-y-3 mb-6">
          {[teamA, teamB].map((team) => (
            <button
              key={team.id}
              onClick={() => setSelected(team.id)}
              className="w-full flex items-center gap-3 rounded-xl px-4 py-3 border-2 transition"
              style={{
                borderColor: selected === team.id ? `var(--${team.color})` : "oklch(0.83 0.16 88 / 20%)",
                background: selected === team.id ? `oklch(from var(--${team.color}) l c h / 15%)` : "oklch(0.16 0.04 150)",
                boxShadow: selected === team.id ? `0 0 12px var(--${team.color} / 30%)` : "none",
              }}
            >
              <div className="w-3 h-3 rounded-full flex-shrink-0"
                   style={{ background: `var(--${team.color})` }} />
              <span className="font-display font-bold" style={{ color: `var(--${team.color})` }}>
                {team.name}
              </span>
              {selected === team.id && (
                <span className="ml-auto text-xs text-foreground/60 italic">disqualified</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold border transition hover:bg-white/5"
            style={{ borderColor: "oklch(0.83 0.16 88 / 25%)" }}
          >
            Cancel
          </button>
          <button
            disabled={!selected}
            onClick={() => selected && onConfirm(selected)}
            className="flex-1 chip-button chip-button-hover text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "var(--gradient-crimson)", color: "white" }}
          >
            Confirm DQ
          </button>
        </div>
      </div>
    </div>
  );
}


function TeamLine({ name, score, color, winner, disqualified }: { name: string; score: number; color: string; winner: boolean; disqualified?: boolean }) {
  return (
    <div className="text-center">
      <div className="font-display font-bold text-sm" style={{ color: `var(--${color})` }}>{name}</div>
      {disqualified ? (
        <div className="text-[10px] font-bold mt-0.5 mb-0.5"
             style={{ color: "oklch(0.75 0.18 25)" }}>
          (Disqualified)
        </div>
      ) : null}
      <div className={`font-display font-black text-2xl ${winner ? "gold-text" : disqualified ? "text-foreground/40 line-through" : "text-foreground/80"}`}>
        {score}
      </div>
    </div>
  );
}

function Empty({ icon, title }: { icon: React.ReactNode; title: string; body?: string }) {
  return (
    <div className="ornate-border p-12 text-center">
      <div className="h-14 w-14 mx-auto rounded-full grid place-items-center mb-3"
           style={{ background: "var(--gradient-gold)", color: "oklch(0.18 0.05 150)" }}>
        {icon}
      </div>
      <div className="font-display font-bold text-xl gold-text">{title}</div>
    </div>
  );
}

// ── Exported shared tab view — used by both /tables (users) and /tournament (admin) ──

export function TournamentTabsView() {
  const role        = useApp((s) => s.role);
  const allMatches  = useApp((s) => s.matches);
  const tournament  = useApp((s) => s.tournament);
  const updateMatch = useApp((s) => s.updateMatch);
  const [tab, setTab] = useState<Tab>("live");

  // ── Flip scheduled → live when startedAt is reached ──
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      useApp.getState().matches.forEach((m) => {
        if (m.status === "scheduled" && m.startedAt <= now) {
          updateMatch(m.id, { status: "live", startedAt: now });
        }
      });
    }, 1000);
    return () => clearInterval(id);
  }, [updateMatch]);

  const liveCount     = allMatches.filter((m) => m.status === "live" || m.status === "pending" || (m.status === "scheduled" && m.startedAt <= Date.now())).length;
  const upcomingCount = allMatches.filter((m) => m.status === "scheduled" && m.startedAt > Date.now()).length;
  const historyCount  = allMatches.filter((m) => m.status === "completed").length;
  const pendingCount  = allMatches.filter((m) => m.status === "pending").length;

  const counts: Record<Tab, number> = {
    live: liveCount, upcoming: upcomingCount, history: historyCount, pending: pendingCount,
  };

  const baseTabs: TabDef[] = [
    { id: "live",     label: "Live",     icon: Radio   },
    { id: "upcoming", label: "Upcoming", icon: Timer   },
    { id: "history",  label: "Past",     icon: History },
  ];

  return (
    <div className="space-y-2">
      {/* Sub-tab strip */}
      <div className="flex items-center gap-1 p-1.5 rounded-full w-full"
           style={{ background: "oklch(0.20 0.06 150)", border: "1px solid oklch(0.83 0.16 88 / 30%)" }}>
        {baseTabs.map((t) => {
          const active = tab === t.id;
          const count  = counts[t.id];
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-1.5 font-bold uppercase tracking-widest transition text-xs min-w-0
                ${active ? "text-black" : "text-foreground/70"}`}
              style={active ? { background: "var(--gradient-gold)" } : {}}
            >
              <span className="truncate">{t.label}</span>
              {count > 0 && (
                <span className="flex-shrink-0 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-black leading-4 text-center"
                      style={{ background: active ? "rgba(0,0,0,0.2)" : "oklch(0.83 0.16 88 / 25%)", color: active ? "black" : "oklch(0.83 0.16 88)" }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Admin-only Pending button */}
      {role === "admin" && (
        <div className="flex justify-end">
          <button
            onClick={() => setTab("pending")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-bold uppercase tracking-widest text-xs transition
              ${tab === "pending" ? "text-white" : "text-foreground/70"}`}
            style={tab === "pending"
              ? { background: "var(--gradient-crimson)" }
              : { background: "oklch(0.20 0.06 150)", border: "1px solid oklch(0.83 0.16 88 / 30%)" }}
          >
            <Clock className="h-3.5 w-3.5 flex-shrink-0" />
            <span>Pending</span>
            {pendingCount > 0 && (
              <span className="flex-shrink-0 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-black leading-4 text-center"
                    style={{ background: tab === "pending" ? "rgba(255,255,255,0.3)" : "var(--gradient-crimson)", color: "white" }}>
                {pendingCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Content */}
      <div className="pt-2">
        {tab === "live"     && <LiveTab />}
        {tab === "upcoming" && <UpcomingTab />}
        {tab === "history"  && <HistoryTab />}
        {tab === "pending"  && role === "admin" && <PendingTab />}
      </div>
    </div>
  );
}
