import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { LiveTable } from "@/components/LiveTable";
import { Check, X, Clock, History } from "lucide-react";

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
  const matches = useMemo(() => allMatches.filter((m) => m.status === "live"), [allMatches]);

  // Auto-pick the user's own table if they're playing; otherwise first table.
  const myMatch = useMemo(
    () =>
      matches.find((m) =>
        [...m.teamA.players, ...m.teamB.players].some((p) => p.email === currentUserEmail),
      ),
    [matches, currentUserEmail],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (matches.length === 0) { setSelectedId(null); return; }
    if (selectedId && matches.some((m) => m.id === selectedId)) return;
    setSelectedId((myMatch ?? matches[0]).id);
  }, [matches, myMatch, selectedId]);

  if (matches.length === 0)
    return <Empty icon={<Clock className="h-6 w-6" />} title="No live tables" body="Start a tournament round to bring tables online." />;

  const active = matches.find((m) => m.id === selectedId) ?? matches[0];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-marquee tracking-[0.3em] text-xs text-foreground/60 mr-1">SPECTATING</span>
        {matches.map((m) => {
          const mine = m.id === myMatch?.id;
          const isActive = m.id === active.id;
          return (
            <button
              key={m.id}
              onClick={() => setSelectedId(m.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition border ${
                isActive ? "text-[oklch(0.18_0.05_150)]" : "text-foreground/75"
              }`}
              style={{
                background: isActive ? "var(--gradient-gold)" : "oklch(0.20 0.06 150)",
                borderColor: "oklch(0.83 0.16 88 / 30%)",
              }}
            >
              {m.tableName}
              {mine && <span className="ml-1.5 opacity-70">★</span>}
            </button>
          );
        })}
      </div>
      <LiveTable match={active} />
    </div>
  );
}

function PastTab() {
  const allMatches = useApp((s) => s.matches);
  const matches = allMatches.filter((m) => m.status === "completed");
  if (matches.length === 0)
    return <Empty icon={<History className="h-6 w-6" />} title="No completed games yet" body="Approved match wins will land here." />;
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {matches.map((m) => (
        <div key={m.id} className="ornate-border p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="font-marquee tracking-[0.3em] text-xs text-foreground/60">{m.tableName} · R{m.round}</span>
            <span className="text-xs font-bold gold-text">FINAL</span>
          </div>
          <div className="flex items-center justify-between">
            <TeamLine name={m.teamA.name} score={m.scoreA} color="team-a" winner={m.winnerId === m.teamA.id} />
            <span className="font-display font-black text-foreground/50">—</span>
            <TeamLine name={m.teamB.name} score={m.scoreB} color="team-b" winner={m.winnerId === m.teamB.id} />
          </div>
        </div>
      ))}
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
                <td className="px-4 py-3 font-bold" style={{ color: e.teamId === m?.teamA.id ? "var(--team-a)" : "var(--team-b)" }}>
                  {e.teamName}
                </td>
                <td className="px-4 py-3 text-foreground/70 text-xs">
                  {[e.high && "High", e.low && "Low", e.jack === 3 ? "Hang Jack" : e.jack === 1 ? "Jack" : null, e.game && "Game"]
                    .filter(Boolean).join(" · ") || "—"}
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

function TeamLine({ name, score, color, winner }: { name: string; score: number; color: "team-a" | "team-b"; winner: boolean }) {
  return (
    <div className="text-center">
      <div className="font-display font-bold text-sm" style={{ color: `var(--${color})` }}>{name}</div>
      <div className={`font-display font-black text-2xl ${winner ? "gold-text" : "text-foreground/80"}`}>{score}</div>
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
