import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import {
  Users, Clock, Ban, ShieldOff, Check, X, Trash2,
  Search, UserX, RefreshCw,
} from "lucide-react";

export const Route = createFileRoute("/players")({
  head: () => ({
    meta: [
      { title: "Players — Stumbling Fours" },
      { name: "description", content: "Manage player signups, members and bans." },
    ],
  }),
  component: PlayersPage,
});

type PlayerStatus = "pending" | "active" | "suspended" | "banned";
type Tab = "pending" | "members" | "suspended" | "banned";

type Player = {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  status: PlayerStatus;
  created_at: string;
};

type BannedEmail = {
  id: string;
  email: string;
  banned_at: string;
  reason: string | null;
};

function PlayersPage() {
  const { isAdmin, loading, user } = useAuth();
  const [tab, setTab] = useState<Tab>("pending");
  const [players, setPlayers] = useState<Player[]>([]);
  const [bannedEmails, setBannedEmails] = useState<BannedEmail[]>([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  // When a write is in flight, block realtime reloads so they don't race
  const writeLock = useRef(false);

  const load = useCallback(async () => {
    // Don't reload while a write is in flight — it would race and overwrite optimistic state
    if (writeLock.current) return;
    const [{ data: p, error: pErr }, { data: b }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,email,display_name,avatar_url,status,created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("banned_emails")
        .select("id,email,banned_at,reason")
        .order("banned_at", { ascending: false }),
    ]);

    if (pErr) {
      // Status column may not exist yet — fall back to fetching without it
      const { data: p2 } = await supabase
        .from("profiles")
        .select("id,email,display_name,avatar_url,created_at")
        .order("created_at", { ascending: false });
      const { data: statusRows } = await supabase.from("profiles").select("id,status");
      const statusMap = new Map<string, string>(
        (statusRows ?? []).map((r: { id: string; status: string | null }) => [r.id, r.status ?? "active"])
      );
      setPlayers(
        ((p2 as Omit<Player, "status">[]) ?? [])
          .filter((pl) => pl.id !== user?.id)
          .map((pl) => ({ ...pl, status: (statusMap.get(pl.id) ?? "active") as PlayerStatus }))
      );
    } else {
      setPlayers(
        ((p as Player[]) ?? [])
          .filter((pl) => pl.id !== user?.id)
          .map((pl) => ({
            ...pl,
            status: (pl.status ?? "active") as PlayerStatus,
          }))
      );
    }
    setBannedEmails((b as BannedEmail[]) ?? []);
  }, [user?.id]);

  useEffect(() => {
    if (!isAdmin) return;
    void load();
    const ch = supabase
      .channel("players_page_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "banned_emails" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isAdmin, load]);

  // Guards — after all hooks
  if (loading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;

  // ── Actions ────────────────────────────────────────────────────────────────

  const setStatus = async (id: string, status: PlayerStatus) => {
    setBusy(id);
    writeLock.current = true;
    // Optimistic update — move the card immediately in the UI
    setPlayers((prev) => prev.map((p) => p.id === id ? { ...p, status } : p));
    const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
    writeLock.current = false;
    if (error) {
      console.error("setStatus failed:", error);
      await load();
    }
    setBusy(null);
  };

  const approve = (id: string) => setStatus(id, "active");
  const suspend = (id: string) => setStatus(id, "suspended");

  const ban = async (player: Player) => {
    if (!confirm(`Ban ${player.display_name || player.email}? Their email will be blocklisted.`)) return;
    setBusy(player.id);
    writeLock.current = true;
    // Optimistic update — move card to banned tab immediately
    setPlayers((prev) => prev.map((p) => p.id === player.id ? { ...p, status: "banned" } : p));
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from("banned_emails").upsert({ email: player.email, banned_by: user?.id }, { onConflict: "email" }),
      supabase.from("profiles").update({ status: "banned" }).eq("id", player.id),
    ]);
    writeLock.current = false;
    if (e1 || e2) {
      console.error("ban failed:", e1, e2);
      await load();
    }
    setBusy(null);
  };

  const reject = async (player: Player) => {
    if (!confirm(`Reject and delete ${player.display_name || player.email}?`)) return;
    setBusy(player.id);
    writeLock.current = true;
    await supabase.from("banned_emails").upsert({ email: player.email, banned_by: user?.id, reason: "rejected signup" }, { onConflict: "email" });
    await supabase.from("profiles").update({ status: "banned" }).eq("id", player.id);
    writeLock.current = false;
    setBusy(null);
  };

  const deletePlayer = async (player: Player) => {
    if (!confirm(`Permanently delete ${player.display_name || player.email}? This cannot be undone.`)) return;
    setBusy(player.id);
    writeLock.current = true;
    // Optimistic remove immediately
    setPlayers((prev) => prev.filter((p) => p.id !== player.id));
    await supabase.from("profiles").delete().eq("id", player.id);
    writeLock.current = false;
    setBusy(null);
  };

  const unban = async (be: BannedEmail) => {
    if (!confirm(`Remove ban for ${be.email}?`)) return;
    await supabase.from("banned_emails").delete().eq("id", be.id);
    // Also restore the profile if it still exists
    await supabase.from("profiles").update({ status: "active" }).eq("email", be.email);
  };

  // ── Filtered lists ─────────────────────────────────────────────────────────
  const q = search.trim().toLowerCase();
  const pending    = players.filter((p) => p.status === "pending"    && (!q || matchQ(p, q)));
  const members    = players.filter((p) => p.status === "active"     && (!q || matchQ(p, q)));
  const suspended  = players.filter((p) => p.status === "suspended"  && (!q || matchQ(p, q)));
  const banned     = players.filter((p) => p.status === "banned"     && (!q || matchQ(p, q)));
  const bannedList = bannedEmails.filter((b) => !q || b.email.toLowerCase().includes(q));

  const counts: Record<Tab, number> = {
    pending:   players.filter((p) => p.status === "pending").length,
    members:   players.filter((p) => p.status === "active").length,
    suspended: players.filter((p) => p.status === "suspended").length,
    banned:    players.filter((p) => p.status === "banned").length + bannedEmails.filter(
      (b) => !players.some((p) => p.email === b.email)
    ).length,
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "pending",   label: "Pending",   icon: <Clock     className="h-4 w-4 flex-shrink-0" /> },
    { id: "members",   label: "Members",   icon: <Users     className="h-4 w-4 flex-shrink-0" /> },
    { id: "suspended", label: "Suspended", icon: <ShieldOff className="h-4 w-4 flex-shrink-0" /> },
    { id: "banned",    label: "Banned",    icon: <Ban       className="h-4 w-4 flex-shrink-0" /> },
  ];

  return (
    <div className="pt-2 space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display font-black text-4xl gold-text flex items-center gap-3">
          <Users className="h-8 w-8" /> Players
        </h1>
        <p className="text-foreground/65 text-sm mt-1">
          Approve signups, manage members and maintain the ban list.
        </p>
      </div>

      {/* Tab strip — icons only on mobile, icon+label on desktop */}
      <div className="flex items-center gap-1 p-1.5 rounded-full w-full"
           style={{ background: "oklch(0.20 0.06 150)", border: "1px solid oklch(0.83 0.16 88 / 30%)" }}>
        {tabs.map((t) => {
          const active = tab === t.id;
          const count  = counts[t.id];
          const badgeBg = active ? "rgba(0,0,0,0.2)"
            : t.id === "pending"   ? "var(--gradient-crimson)"
            : t.id === "banned"    ? "oklch(0.55 0.22 25 / 80%)"
            : t.id === "suspended" ? "oklch(0.64 0.16 55 / 80%)"
            : "oklch(0.83 0.16 88 / 25%)";
          const badgeColor = active ? "black"
            : t.id === "pending" || t.id === "banned" || t.id === "suspended" ? "white"
            : "oklch(0.83 0.16 88)";
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-1.5 font-bold uppercase tracking-widest transition text-xs min-w-0
                ${active ? "text-black" : "text-foreground/70"}`}
              style={active ? { background: "var(--gradient-gold)" } : {}}
            >
              {/* Mobile: icon only */}
              <span className="flex sm:hidden items-center justify-center">
                {t.icon}
              </span>
              {/* Desktop: icon + label */}
              <span className="hidden sm:flex items-center gap-1.5 truncate">
                {t.icon}
                <span className="truncate">{t.label}</span>
              </span>
              {count > 0 && (
                <span
                  className="flex-shrink-0 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-black leading-4 text-center"
                  style={{ background: badgeBg, color: badgeColor }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40 pointer-events-none" />
        <input
          className="ts-input"
          style={{ paddingLeft: "2.25rem", paddingRight: search ? "2.25rem" : undefined }}
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground/70 transition"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Tab content */}
      {tab === "pending"   && (
        <PendingTab players={pending} busy={busy} onApprove={approve} onReject={reject} />
      )}
      {tab === "members"   && (
        <MembersTab players={members} busy={busy} onSuspend={suspend} onBan={ban} onDelete={deletePlayer} />
      )}
      {tab === "suspended" && (
        <SuspendedTab players={suspended} busy={busy} onActivate={approve} onBan={ban} onDelete={deletePlayer} />
      )}
      {tab === "banned"    && (
        <BannedTab players={banned} bannedEmails={bannedList} allProfiles={players} busy={busy} onUnban={unban} onDelete={deletePlayer} />
      )}

      <style>{`
        .ts-input {
          background: oklch(0.16 0.04 150);
          border: 1px solid oklch(0.83 0.16 88 / 25%);
          color: var(--color-foreground);
          padding: 0.55rem 0.75rem;
          border-radius: 0.5rem;
          width: 100%;
          font-size: 0.875rem;
          outline: none;
        }
        .ts-input:focus { border-color: oklch(0.83 0.16 88); box-shadow: 0 0 0 3px oklch(0.83 0.16 88 / 25%); }
      `}</style>
    </div>
  );
}

function matchQ(p: Player, q: string) {
  return (
    p.email.toLowerCase().includes(q) ||
    (p.display_name ?? "").toLowerCase().includes(q)
  );
}

// ── Shared player row ──────────────────────────────────────────────────────────

function PlayerRow({
  player,
  busy,
  actions,
}: {
  player: Player;
  busy: string | null;
  actions: React.ReactNode;
}) {
  const isBusy    = busy === player.id;
  const initials  = (player.display_name || player.email).slice(0, 2).toUpperCase();
  const joined    = new Date(player.created_at).toLocaleDateString("en-TT", {
    day: "numeric", month: "short", year: "numeric",
  });

  const statusColor: Record<PlayerStatus, string> = {
    pending:   "oklch(0.74 0.18 70)",
    active:    "oklch(0.62 0.18 160)",
    suspended: "oklch(0.64 0.16 55)",
    banned:    "oklch(0.62 0.22 25)",
  };

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "oklch(0.18 0.05 150 / 80%)", border: "1px solid oklch(0.83 0.16 88 / 18%)", opacity: isBusy ? 0.6 : 1 }}
    >
      {/* Top row: avatar + info + status badge */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Avatar */}
        <div
          className="h-10 w-10 rounded-full flex-shrink-0 grid place-items-center overflow-hidden border-2 text-xs font-black"
          style={{ borderColor: statusColor[player.status], background: "oklch(0.22 0.06 150)" }}
        >
          {player.avatar_url
            ? <img src={player.avatar_url} alt="" className="w-full h-full object-cover" />
            : <span style={{ color: statusColor[player.status] }}>{initials}</span>
          }
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm truncate">{player.display_name || player.email.split("@")[0]}</div>
          <div className="text-[11px] text-foreground/50 truncate">{player.email}</div>
          <div className="text-[10px] text-foreground/35 mt-0.5">Joined {joined}</div>
        </div>

        {/* Status badge */}
        <span
          className="flex-shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider"
          style={{ background: `${statusColor[player.status]}25`, color: statusColor[player.status] }}
        >
          {player.status}
        </span>
      </div>

      {/* Bottom action row */}
      <div
        className="flex items-center gap-2 px-4 py-2.5 border-t"
        style={{ borderColor: "oklch(0.83 0.16 88 / 12%)", background: "oklch(0.15 0.04 150 / 60%)" }}
      >
        {isBusy
          ? <RefreshCw className="h-4 w-4 text-foreground/40 animate-spin" />
          : actions
        }
      </div>
    </div>
  );
}

// ── Pending tab ────────────────────────────────────────────────────────────────

function PendingTab({
  players, busy, onApprove, onReject,
}: {
  players: Player[];
  busy: string | null;
  onApprove: (id: string) => void;
  onReject: (player: Player) => void;
}) {
  if (players.length === 0) {
    return (
      <Empty
        icon={<Clock className="h-6 w-6" />}
        title="No pending signups"
        body="New signups will appear here for your approval."
      />
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-xs text-foreground/50 mb-3">
        {players.length} signup{players.length === 1 ? "" : "s"} awaiting approval
      </div>
      {players.map((p) => (
        <PlayerRow
          key={p.id}
          player={p}
          busy={busy}
          actions={
            <>
              <button
                onClick={() => onApprove(p.id)}
                className="flex flex-1 items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition"
                style={{ background: "oklch(0.62 0.18 160 / 15%)", color: "oklch(0.72 0.18 160)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "oklch(0.62 0.18 160 / 25%)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "oklch(0.62 0.18 160 / 15%)")}
              >
                <Check className="h-3.5 w-3.5" /> Approve
              </button>
              <button
                onClick={() => onReject(p)}
                className="flex flex-1 items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition"
                style={{ background: "oklch(0.62 0.22 25 / 15%)", color: "oklch(0.75 0.18 25)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "oklch(0.62 0.22 25 / 25%)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "oklch(0.62 0.22 25 / 15%)")}
              >
                <X className="h-3.5 w-3.5" /> Decline
              </button>
            </>
          }
        />
      ))}
    </div>
  );
}

// ── Members tab ────────────────────────────────────────────────────────────────

function MembersTab({
  players, busy, onSuspend, onBan, onDelete,
}: {
  players: Player[];
  busy: string | null;
  onSuspend: (id: string) => void;
  onBan: (player: Player) => void;
  onDelete: (player: Player) => void;
}) {
  if (players.length === 0) {
    return (
      <Empty
        icon={<Users className="h-6 w-6" />}
        title="No active members"
        body="Approved players will appear here."
      />
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-xs text-foreground/50 mb-3">
        {players.filter((p) => p.status === "active").length} active
      </div>      {players.map((p) => (
        <PlayerRow
          key={p.id}
          player={p}
          busy={busy}
          actions={
            <>
              <button
                onClick={() => onSuspend(p.id)}
                className="flex-1 py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition"
                style={{ background: "oklch(0.74 0.18 70 / 15%)", color: "oklch(0.74 0.18 70)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "oklch(0.74 0.18 70 / 25%)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "oklch(0.74 0.18 70 / 15%)")}
              >
                Suspend
              </button>
              <button
                onClick={() => onBan(p)}
                className="flex-1 py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition"
                style={{ background: "oklch(0.62 0.22 25 / 15%)", color: "oklch(0.75 0.18 25)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "oklch(0.62 0.22 25 / 25%)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "oklch(0.62 0.22 25 / 15%)")}
              >
                Ban
              </button>
              <button
                onClick={() => onDelete(p)}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition"
                style={{ background: "oklch(0.55 0.22 25 / 20%)", color: "oklch(0.75 0.18 25)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "oklch(0.55 0.22 25 / 35%)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "oklch(0.55 0.22 25 / 20%)")}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </>
          }
        />
      ))}
    </div>
  );
}

// ── Suspended tab ──────────────────────────────────────────────────────────────

function SuspendedTab({
  players, busy, onActivate, onBan, onDelete,
}: {
  players: Player[];
  busy: string | null;
  onActivate: (id: string) => void;
  onBan: (player: Player) => void;
  onDelete: (player: Player) => void;
}) {
  if (players.length === 0) {
    return (
      <Empty
        icon={<ShieldOff className="h-6 w-6" />}
        title="No suspended players"
        body="Suspended players will appear here."
      />
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-xs text-foreground/50 mb-3">
        {players.length} suspended
      </div>
      {players.map((p) => (
        <PlayerRow
          key={p.id}
          player={p}
          busy={busy}
          actions={
            <>
              <button
                onClick={() => onActivate(p.id)}
                className="flex-1 py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition"
                style={{ background: "oklch(0.62 0.18 160 / 15%)", color: "oklch(0.72 0.18 160)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "oklch(0.62 0.18 160 / 25%)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "oklch(0.62 0.18 160 / 15%)")}
              >
                Reinstate
              </button>
              <button
                onClick={() => onBan(p)}
                className="flex-1 py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition"
                style={{ background: "oklch(0.62 0.22 25 / 15%)", color: "oklch(0.75 0.18 25)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "oklch(0.62 0.22 25 / 25%)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "oklch(0.62 0.22 25 / 15%)")}
              >
                Ban
              </button>
              <button
                onClick={() => onDelete(p)}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition"
                style={{ background: "oklch(0.55 0.22 25 / 20%)", color: "oklch(0.75 0.18 25)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "oklch(0.55 0.22 25 / 35%)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "oklch(0.55 0.22 25 / 20%)")}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </>
          }
        />
      ))}
    </div>
  );
}

// ── Banned tab ─────────────────────────────────────────────────────────────────

function BannedTab({
  players, bannedEmails, allProfiles, busy, onUnban, onDelete,
}: {
  players: Player[];
  bannedEmails: BannedEmail[];
  allProfiles: Player[];
  busy: string | null;
  onUnban: (be: BannedEmail) => void;
  onDelete: (player: Player) => void;
}) {
  // Email-only entries (no profile row — deleted accounts that are still blocklisted)
  const emailOnlyBans = bannedEmails.filter(
    (b) => !allProfiles.some((p) => p.email === b.email)
  );

  if (players.length === 0 && emailOnlyBans.length === 0) {
    return (
      <Empty
        icon={<Ban className="h-6 w-6" />}
        title="No banned accounts"
        body="Banned players and blocklisted emails will appear here."
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Banned profiles with accounts */}
      {players.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-[0.25em] text-foreground/50 mb-2">Banned accounts</div>
          {players.map((p) => {
            const be = bannedEmails.find((b) => b.email === p.email);
            return (
              <PlayerRow
                key={p.id}
                player={p}
                busy={busy}
                actions={
                  <>
                    {be && (
                      <ActionButton
                        onClick={() => onUnban(be)}
                        title="Remove ban"
                        icon={<Check className="h-3.5 w-3.5" />}
                        color="oklch(0.62 0.18 160)"
                      />
                    )}
                    <ActionButton
                      onClick={() => onDelete(p)}
                      title="Delete account"
                      icon={<Trash2 className="h-3.5 w-3.5" />}
                      color="oklch(0.55 0.22 25)"
                      danger
                    />
                  </>
                }
              />
            );
          })}
        </div>
      )}

      {/* Email-only blocklist entries */}
      {emailOnlyBans.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-[0.25em] text-foreground/50 mb-2">Blocklisted emails (no account)</div>
          {emailOnlyBans.map((b) => (
            <div
              key={b.id}
              className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ background: "oklch(0.18 0.05 150 / 80%)", border: "1px solid oklch(0.62 0.22 25 / 25%)" }}
            >
              <div
                className="h-10 w-10 rounded-full flex-shrink-0 grid place-items-center border-2 text-xs"
                style={{ borderColor: "oklch(0.62 0.22 25)", background: "oklch(0.22 0.06 150)" }}
              >
                <UserX className="h-4 w-4 text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm truncate text-foreground/80">{b.email}</div>
                {b.reason && <div className="text-[11px] text-foreground/45 truncate">{b.reason}</div>}
                <div className="text-[10px] text-foreground/35 mt-0.5">
                  Banned {new Date(b.banned_at).toLocaleDateString("en-TT", { day: "numeric", month: "short", year: "numeric" })}
                </div>
              </div>
              <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider hidden sm:block"
                    style={{ background: "oklch(0.62 0.22 25 / 20%)", color: "oklch(0.75 0.18 25)" }}>
                email only
              </span>
              <button
                onClick={() => onUnban(b)}
                title="Remove from blocklist"
                className="p-1.5 rounded-md transition hover:bg-white/10"
              >
                <X className="h-4 w-4 text-foreground/50" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function ActionButton({
  onClick, title, icon, color, danger = false,
}: {
  onClick: () => void;
  title: string;
  icon: React.ReactNode;
  color: string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="p-1.5 rounded-md transition"
      style={{ color, background: danger ? `${color}18` : "transparent" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = `${color}22`)}
      onMouseLeave={(e) => (e.currentTarget.style.background = danger ? `${color}18` : "transparent")}
    >
      {icon}
    </button>
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
      <div className="text-sm text-foreground/55 mt-1">{body}</div>
    </div>
  );
}
