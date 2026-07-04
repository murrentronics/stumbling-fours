import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/lib/store";
import { LiveTable } from "@/components/LiveTable";
import { Check, X, Clock, History, ArrowLeft, Spade, MoreVertical, Trash2, UserX, Search } from "lucide-react";

export const Route = createFileRoute("/tables")({
  head: () => ({
    meta: [
      { title: "Tables — Stumbling Fours" },
      { name: "description", content: "Live and past All Fours games, scoring and approvals." },
    ],
  }),
  component: Tables,
});

type Tab = "live" | "past" | "pending" | "history";

function Tables() {
  const role = useApp((s) => s.role);
  const [tab, setTab] = useState<Tab>("live");

  const baseTabs: { id: Tab; label: string }[] = [
    { id: "live", label: "Live" },
    { id: "past", label: "Past Games" },
  ];
  const adminTabs: { id: Tab; label: string }[] = [
    { id: "pending", label: "Pending Approvals" },
    { id: "history", label: "Point History" },
  ];
  const tabs = role === "admin" ? [...baseTabs, ...adminTabs] : baseTabs;

  return (
    <div className="pt-2">
      <div className="flex items-end justify-between flex-wrap gap-3 mb-5">
        <div>
          <h1 className="font-display font-black text-4xl gold-text">Tables</h1>
          <p className="text-foreground/65 text-sm">
            {role === "admin" ? "Manage live tables, approvals & every point logged." : "Your active tables. Tap your team to log the round."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1 p-1.5 rounded-full"
             style={{ background: "oklch(0.20 0.06 150)", border: "1px solid oklch(0.83 0.16 88 / 30%)" }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition ${
                tab === t.id ? "text-[oklch(0.18_0.05_150)]" : "text-foreground/70"
              }`}
              style={tab === t.id ? { background: "var(--gradient-gold)" } : {}}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "live" && <LiveTab />}
      {tab === "past" && <PastTab />}
      {tab === "pending" && role === "admin" && <PendingTab />}
      {tab === "history" && role === "admin" && <HistoryTab />}
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

  const myMatch = useMemo(
    () => matches.find((m) =>
      [...m.teamA.players, ...m.teamB.players].some((p) => p.email === currentUserEmail),
    ),
    [matches, currentUserEmail],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [liveSearch, setLiveSearch] = useState("");

  // Auto-open own table on first load; clear if match disappears
  useEffect(() => {
    if (matches.length === 0) { setSelectedId(null); return; }
    if (selectedId && matches.some((m) => m.id === selectedId)) return;
    // don't auto-select — let user pick from grid
  }, [matches]);

  if (matches.length === 0)
    return <Empty icon={<Clock className="h-6 w-6" />} title="No live tables" body="Start a tournament round to bring tables online." />;

  const active = selectedId ? matches.find((m) => m.id === selectedId) ?? null : null;

  // ── Detail view ──────────────────────────────────────────────────────────
  if (active) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setSelectedId(null)}
          className="chip-button chip-button-hover"
          style={{ background: "var(--gradient-gold)", color: "oklch(0.10 0.03 150)" }}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          All Tables
        </button>
        <LiveTable match={active} />
      </div>
    );
  }

  // ── Grid view ─────────────────────────────────────────────────────────────
  const liveCount = matches.filter((m) => m.status === "live").length;

  // Group by round number, sorted ascending
  const maxRound = Math.max(...matches.map((m) => m.round));

  // Filter matches by search
  const searchTerm = liveSearch.trim().toLowerCase();
  const filteredMatches = searchTerm
    ? matches.filter(
        (m) =>
          m.teamA.name.toLowerCase().includes(searchTerm) ||
          m.teamB.name.toLowerCase().includes(searchTerm),
      )
    : matches;

  const byRound = filteredMatches.reduce<Record<number, typeof matches>>((acc, m) => {
    (acc[m.round] ??= []).push(m);
    return acc;
  }, {});
  const roundNumbers = Object.keys(byRound).map(Number).sort((a, b) => a - b);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <span className="font-marquee tracking-[0.3em] text-xs text-foreground/60">TABLES</span>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{ background: "var(--gradient-crimson)", color: "white" }}>
          {liveCount} LIVE
        </span>
        {matches.length > liveCount && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{ background: "oklch(0.55 0.18 145)", color: "white" }}>
            {matches.length - liveCount} PENDING
          </span>
        )}
      </div>

      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
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
            <button
              type="button"
              onClick={() => setLiveSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground/70 transition"
              title="Clear"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {filteredMatches.length === 0 && (
        <p className="text-sm text-foreground/50">No tables match.</p>
      )}

      {roundNumbers.map((roundNum) => (
        <div key={roundNum}>
          {/* Round section header */}
          <div className="flex items-center gap-4 mb-4">
            <div className="font-marquee tracking-[0.25em] text-lg gold-text">
              {getRoundLabel(roundNum, maxRound)}
            </div>
            <div className="flex-1 h-px" style={{ background: "oklch(0.83 0.16 88 / 25%)" }} />
            <div className="text-[10px] uppercase tracking-widest text-foreground/40">
              {byRound[roundNum].length} {byRound[roundNum].length === 1 ? "table" : "tables"}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {byRound[roundNum].map((m) => {
              const isMine = m.id === myMatch?.id;
              const isPending = m.status === "pending";
              return (
                <div
                  key={m.id}
                  className="relative rounded-xl border-2 transition hover:scale-[1.02] hover:shadow-xl"
                  style={{
                    borderColor: isPending ? "oklch(0.55 0.18 145)" : "oklch(0.83 0.16 88 / 35%)",
                    background: "oklch(0.18 0.05 150 / 80%)",
                    boxShadow: isMine ? "0 0 20px oklch(0.83 0.16 88 / 30%)" : undefined,
                  }}
                >
                  <button
                    onClick={() => setSelectedId(m.id)}
                    className="w-full text-left p-5 focus:outline-none"
                  >
                    {/* Table name + status */}
                    <div className="flex items-center justify-between mb-4 pr-6">
                      <span className="font-marquee tracking-[0.3em] text-sm text-foreground/80">
                        {m.tableName}
                      </span>
                      <span className="flex items-center gap-1.5">
                        {isPending ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                                style={{ background: "oklch(0.55 0.18 145)", color: "white" }}>
                            PENDING
                          </span>
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

                    {/* VS matchup */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                               style={{ background: `var(--${m.teamA.color})` }} />
                          <div className="font-display font-bold text-sm truncate"
                               style={{ color: `var(--${m.teamA.color})` }}>
                            {m.teamA.name}
                          </div>
                        </div>
                        <div className="font-display font-black text-3xl"
                             style={{ color: `var(--${m.teamA.color})`, textShadow: `0 0 16px var(--${m.teamA.color})` }}>
                          {m.scoreA}
                        </div>
                      </div>

                      <div className="flex flex-col items-center gap-1 flex-shrink-0">
                        <Spade className="h-4 w-4 text-foreground/30" />
                        <span className="font-marquee tracking-widest text-xs text-foreground/40">VS</span>
                      </div>

                      <div className="flex-1 min-w-0 text-right">
                        <div className="flex items-center justify-end gap-1.5 mb-1">
                          <div className="font-display font-bold text-sm truncate"
                               style={{ color: `var(--${m.teamB.color})` }}>
                            {m.teamB.name}
                          </div>
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                               style={{ background: `var(--${m.teamB.color})` }} />
                        </div>
                        <div className="font-display font-black text-3xl text-right"
                             style={{ color: `var(--${m.teamB.color})`, textShadow: `0 0 16px var(--${m.teamB.color})` }}>
                          {m.scoreB}
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Admin 3-dot menu */}
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

function PastTab() {
  const allMatches = useApp((s) => s.matches);
  const matches = allMatches.filter((m) => m.status === "completed");
  const [pastSearch, setPastSearch] = useState("");
  const [pastDate, setPastDate] = useState("");

  if (matches.length === 0)
    return <Empty icon={<History className="h-6 w-6" />} title="No completed games yet" body="Approved match wins will land here." />;

  // Group by calendar date (uses startedAt timestamp)
  const toDateKey = (ts: number) =>
    new Date(ts).toLocaleDateString("en-TT", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  // toISODateKey produces a YYYY-MM-DD string for comparison with the date input value
  const toISODateKey = (ts: number) => {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const grouped = matches.reduce<Record<string, typeof matches>>((acc, m) => {
    const key = toDateKey(m.startedAt);
    (acc[key] ??= []).push(m);
    return acc;
  }, {});

  // Sort date groups newest first
  const dateKeys = Object.keys(grouped).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  );

  const searchTerm = pastSearch.trim().toLowerCase();

  // Apply filters: date filter narrows to one group; team search filters within groups
  const filteredDateKeys = dateKeys.filter((dateKey) => {
    // Date filter: match the ISO date of any match in this group
    if (pastDate) {
      const hasDate = grouped[dateKey].some((m) => toISODateKey(m.startedAt) === pastDate);
      if (!hasDate) return false;
    }
    // Team search: at least one match in the group must mention the term
    if (searchTerm) {
      const hasMatch = grouped[dateKey].some(
        (m) =>
          m.teamA.name.toLowerCase().includes(searchTerm) ||
          m.teamB.name.toLowerCase().includes(searchTerm),
      );
      if (!hasMatch) return false;
    }
    return true;
  });

  const inputStyle: React.CSSProperties = {
    background: "oklch(0.16 0.04 150)",
    border: "1px solid oklch(0.83 0.16 88 / 25%)",
    color: "var(--color-foreground)",
    padding: "0.55rem 0.75rem",
    borderRadius: "0.5rem",
    fontSize: "0.875rem",
    outline: "none",
  };

  return (
    <div className="space-y-8">
      {/* Search + date filter bar */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40 pointer-events-none" />
          <input
            value={pastSearch}
            onChange={(e) => setPastSearch(e.target.value)}
            placeholder="Search by team name…"
            style={{ ...inputStyle, paddingLeft: "2.25rem", paddingRight: pastSearch ? "2.25rem" : "0.75rem", width: "100%" }}
          />
          {pastSearch && (
            <button
              type="button"
              onClick={() => setPastSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground/70 transition"
              title="Clear"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="relative">
          <input
            type="date"
            value={pastDate}
            onChange={(e) => setPastDate(e.target.value)}
            style={{ ...inputStyle, paddingRight: pastDate ? "2.25rem" : "0.75rem", colorScheme: "dark" }}
          />
          {pastDate && (
            <button
              type="button"
              onClick={() => setPastDate("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground/70 transition"
              title="Clear date"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {filteredDateKeys.length === 0 && (
        <p className="text-sm text-foreground/50">No games match.</p>
      )}

      {filteredDateKeys.map((dateKey) => {
        // Within a group, apply team search filter
        const groupMatches = searchTerm
          ? grouped[dateKey].filter(
              (m) =>
                m.teamA.name.toLowerCase().includes(searchTerm) ||
                m.teamB.name.toLowerCase().includes(searchTerm),
            )
          : grouped[dateKey];

        return (
        <div key={dateKey}>
          {/* Date separator — ornate border style */}
          <div className="flex items-center gap-4 mb-4">
            <div
              className="flex-1 h-px"
              style={{
                background: "linear-gradient(to right, transparent, oklch(0.83 0.16 88 / 60%), transparent)",
              }}
            />
            <div
              className="px-4 py-1.5 rounded-full font-marquee tracking-[0.25em] text-xs"
              style={{
                background: "linear-gradient(var(--color-card), var(--color-card)) padding-box, var(--gradient-gold) border-box",
                border: "2px solid transparent",
                color: "oklch(0.83 0.16 88)",
              }}
            >
              {dateKey}
            </div>
            <div
              className="flex-1 h-px"
              style={{
                background: "linear-gradient(to left, transparent, oklch(0.83 0.16 88 / 60%), transparent)",
              }}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {groupMatches.map((m) => (
              <div key={m.id} className="ornate-border p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-marquee tracking-[0.3em] text-xs text-foreground/60">{m.tableName} · R{m.round}</span>
                  <div className="flex items-center gap-2">
                    {m.disqualifiedTeamId && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: "oklch(0.55 0.22 25 / 30%)", color: "oklch(0.80 0.18 25)", border: "1px solid oklch(0.55 0.22 25 / 50%)" }}>
                        DQ
                      </span>
                    )}
                    <span className="text-xs font-bold gold-text">FINAL</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <TeamLine
                    name={m.teamA.name}
                    score={m.scoreA}
                    color={m.teamA.color}
                    winner={m.winnerId === m.teamA.id}
                    disqualified={m.disqualifiedTeamId === m.teamA.id}
                  />
                  <span className="font-display font-black text-foreground/50">—</span>
                  <TeamLine
                    name={m.teamB.name}
                    score={m.scoreB}
                    color={m.teamB.color}
                    winner={m.winnerId === m.teamB.id}
                    disqualified={m.disqualifiedTeamId === m.teamB.id}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        );
      })}
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
        const winner = m.winnerId === m.teamA.id ? m.teamA : m.teamB;
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
  const entries = useApp((s) => s.entries);
  const matches = useApp((s) => s.matches);
  if (entries.length === 0)
    return <Empty icon={<History className="h-6 w-6" />} title="No entries yet" body="Every team's submitted round will be logged here." />;

  return (
    <div className="ornate-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-widest text-foreground/60"
              style={{ background: "oklch(0.20 0.06 150)" }}>
            <th className="px-4 py-3">Time</th>
            <th className="px-4 py-3">Table</th>
            <th className="px-4 py-3">Team</th>
            <th className="px-4 py-3">Breakdown</th>
            <th className="px-4 py-3 text-right">Pts</th>
            <th className="px-4 py-3">Submitted by</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => {
            const m = matches.find((mm) => mm.id === e.matchId);
            return (
              <tr key={e.id} className="border-t" style={{ borderColor: "oklch(0.83 0.16 88 / 20%)" }}>
                <td className="px-4 py-3 text-foreground/65">{new Date(e.ts).toLocaleTimeString()}</td>
                <td className="px-4 py-3">{m?.tableName ?? e.tableId}</td>
                <td className="px-4 py-3 font-bold" style={{ color: `var(--${e.teamId === m?.teamA.id ? m?.teamA.color : m?.teamB.color})` }}>
                  {e.teamName}
                  {m?.disqualifiedTeamId === e.teamId && (
                    <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded"
                          style={{ background: "oklch(0.55 0.22 25 / 25%)", color: "oklch(0.75 0.18 25)" }}>
                      DQ
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-foreground/70 text-xs">
                  {[e.high && "High", e.low && "Low", e.jack === 3 ? "Hang Jack" : e.jack === 1 ? "Jack" : null, e.game && "Game"]
                    .filter(Boolean).join(" · ") || "—"}
                  {(() => {
                    if (!m?.disqualifiedTeamId) return null;
                    const isWinner = m.winnerId === e.teamId;
                    const isLoser = m.disqualifiedTeamId === e.teamId;
                    if (isWinner) return <span className="ml-1.5 font-bold" style={{ color: "oklch(0.75 0.18 25)" }}>(Won by DQ)</span>;
                    if (isLoser) return <span className="ml-1.5 font-bold" style={{ color: "oklch(0.60 0.18 25)" }}>(Disqualified)</span>;
                    return null;
                  })()}
                </td>
                <td className="px-4 py-3 text-right font-display font-black gold-text">{e.total}</td>
                <td className="px-4 py-3 text-foreground/60 text-xs">{e.submittedBy}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
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

function Empty({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="ornate-border p-12 text-center">
      <div className="h-14 w-14 mx-auto rounded-full grid place-items-center mb-3"
           style={{ background: "var(--gradient-gold)", color: "oklch(0.18 0.05 150)" }}>
        {icon}
      </div>
      <div className="font-display font-bold text-xl gold-text">{title}</div>
      <div className="text-sm text-foreground/65 mt-1">{body}</div>
    </div>
  );
}
