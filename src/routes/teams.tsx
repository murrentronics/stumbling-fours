import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Users, Plus, Trash2, UserMinus, Shield } from "lucide-react";

export const Route = createFileRoute("/teams")({
  head: () => ({
    meta: [
      { title: "Teams — Stumbling Fours" },
      { name: "description", content: "Create and manage the standing teams for your All Fours league." },
    ],
  }),
  component: TeamsPage,
});

type RosterTeam = { id: string; name: string; color: "team-a" | "team-b" };
type Member = { team_id: string; user_id: string; display_name: string; email: string | null };
type Profile = { id: string; email: string; display_name: string | null };

function TeamsPage() {
  const { isAdmin, loading } = useAuth();
  const [teams, setTeams] = useState<RosterTeam[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState<"team-a" | "team-b">("team-a");
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    const [{ data: t }, { data: m }, { data: p }] = await Promise.all([
      supabase.from("roster_teams").select("*").order("created_at"),
      supabase.from("roster_team_members").select("*"),
      supabase.from("profiles").select("id,email,display_name").order("display_name"),
    ]);
    setTeams((t as RosterTeam[]) ?? []);
    setMembers((m as Member[]) ?? []);
    setProfiles((p as Profile[]) ?? []);
  };

  useEffect(() => {
    void load();
    const ch = supabase
      .channel("teams_page_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "roster_teams" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "roster_team_members" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;

  const createTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const trimmed = name.trim();
    if (!trimmed) return;
    const { error } = await supabase.from("roster_teams").insert({ name: trimmed, color });
    if (error) setErr(error.message);
    else setName("");
  };

  const removeTeam = async (id: string) => {
    if (!confirm("Delete this team and all its members?")) return;
    await supabase.from("roster_teams").delete().eq("id", id);
  };

  const assign = async (teamId: string, userId: string) => {
    const prof = profiles.find((p) => p.id === userId);
    if (!prof) return;
    // Remove any existing membership for this user first (single-team constraint)
    await supabase.from("roster_team_members").delete().eq("user_id", userId);
    await supabase.from("roster_team_members").insert({
      team_id: teamId,
      user_id: userId,
      display_name: prof.display_name || prof.email.split("@")[0],
      email: prof.email,
    });
  };

  const unassign = async (teamId: string, userId: string) => {
    await supabase.from("roster_team_members").delete().eq("team_id", teamId).eq("user_id", userId);
  };

  const assignedUserIds = new Set(members.map((m) => m.user_id));

  return (
    <div className="pt-2 space-y-6">
      <div>
        <h1 className="font-display font-black text-4xl gold-text flex items-center gap-3">
          <Users className="h-8 w-8" /> Teams
        </h1>
        <p className="text-foreground/65 text-sm">
          Build your standing teams. Members can also self-assign at sign-up.
        </p>
      </div>

      <section className="ornate-border p-6">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-5 w-5 text-foreground/70" />
          <h2 className="font-display font-black text-xl gold-text">Create a Team</h2>
        </div>
        <form onSubmit={createTeam} className="flex flex-wrap gap-2 items-center">
          <input
            className="ts-input flex-1 min-w-[220px]"
            placeholder="Team name (e.g. Port of Spade)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <select className="ts-input w-32" value={color} onChange={(e) => setColor(e.target.value as "team-a" | "team-b")}>
            <option value="team-a">Red</option>
            <option value="team-b">Blue</option>
          </select>
          <button type="submit" className="chip-button chip-button-hover">
            <Plus className="h-4 w-4 mr-2" /> Add Team
          </button>
        </form>
        {err && <div className="mt-2 text-xs text-red-300 bg-red-950/40 rounded-md p-2">{err}</div>}
      </section>

      {teams.length === 0 && (
        <div className="ornate-border p-8 text-center text-foreground/60 text-sm">
          No teams yet — add one above to get started.
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {teams.map((t) => {
          const roster = members.filter((m) => m.team_id === t.id);
          return (
            <div
              key={t.id}
              className="rounded-xl p-5 border-2"
              style={{ borderColor: `var(--${t.color})`, background: "oklch(0.18 0.05 150 / 80%)" }}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="font-display font-black text-xl" style={{ color: `var(--${t.color})` }}>
                    {t.name}
                  </div>
                  <div className="text-[10px] uppercase tracking-widest text-foreground/50">
                    {roster.length} member{roster.length === 1 ? "" : "s"}
                  </div>
                </div>
                <button onClick={() => removeTeam(t.id)} className="p-2 rounded-md hover:bg-white/5">
                  <Trash2 className="h-4 w-4 text-foreground/60" />
                </button>
              </div>

              <div className="space-y-1.5 mb-3">
                {roster.length === 0 && (
                  <div className="text-xs italic text-foreground/45">No members yet.</div>
                )}
                {roster.map((m) => (
                  <div key={m.user_id} className="flex items-center justify-between rounded-md px-3 py-2"
                       style={{ background: "oklch(0.20 0.06 150)" }}>
                    <div className="text-sm">
                      <div className="font-bold">{m.display_name}</div>
                      <div className="text-[10px] text-foreground/50">{m.email}</div>
                    </div>
                    <button onClick={() => unassign(t.id, m.user_id)}
                            className="p-1.5 rounded-md hover:bg-white/5" title="Remove">
                      <UserMinus className="h-4 w-4 text-foreground/60" />
                    </button>
                  </div>
                ))}
              </div>

              <select
                className="ts-input"
                value=""
                onChange={(e) => e.target.value && assign(t.id, e.target.value)}
              >
                <option value="">+ Assign a member…</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id} disabled={assignedUserIds.has(p.id)}>
                    {(p.display_name || p.email.split("@")[0]) + ` (${p.email})`}
                    {assignedUserIds.has(p.id) ? " · assigned" : ""}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

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
