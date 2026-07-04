import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Spade, Mail, Lock, User as UserIcon, LogIn, UserPlus, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { type TeamColor } from "@/lib/store";

type RosterTeam = { id: string; name: string; color: TeamColor };

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Stumbling Fours" },
      { name: "description", content: "Sign in or register to join Stumbling Fours tables." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [teamId, setTeamId] = useState("");
  const [rosterTeams, setRosterTeams] = useState<RosterTeam[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("roster_teams").select("id,name,color").order("name").then(({ data }) => {
      setRosterTeams(((data as RosterTeam[]) ?? []).filter((t) => t.name !== 'Admin'));
    });
  }, []);

  useEffect(() => {
    if (!loading && session) nav({ to: "/" });
  }, [session, loading, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: name || email.split("@")[0] },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        // Assign team if a session exists (email confirmation off)
        if (teamId && data.session) {
          const { error: e2 } = await supabase.rpc("set_my_team", { _team_id: teamId });
          if (e2) console.warn("set_my_team failed:", e2.message);
        }
        setMsg(
          data.session
            ? "You're in! Redirecting…"
            : "Check your email to confirm — then sign in.",
        );
        if (data.session) nav({ to: "/" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        nav({ to: "/" });
      }
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setErr(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) setErr(error.message);
  };

  return (
    <div className="pt-2 grid place-items-center min-h-[70vh]">
      <div className="w-full max-w-md ornate-border p-8">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="h-14 w-14 rounded-full grid place-items-center mb-3"
               style={{ background: "var(--gradient-gold)", boxShadow: "var(--shadow-gold)" }}>
            <Spade className="h-7 w-7" style={{ color: "oklch(0.18 0.05 150)" }} />
          </div>
          <h1 className="font-display font-black text-3xl gold-text">
            {mode === "signin" ? "Welcome Back" : "Join the Table"}
          </h1>
          <p className="text-sm text-foreground/65 mt-1">
            {mode === "signin" ? "Sign in to enter the casino." : "Create an account to play."}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <>
              <IconInput icon={<UserIcon className="h-4 w-4" />} placeholder="Display name"
                         value={name} onChange={setName} />
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/45">
                  <Users className="h-4 w-4" />
                </div>
                <select
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 rounded-lg text-sm outline-none transition appearance-none"
                  style={{
                    background: "oklch(0.16 0.04 150)",
                    border: "1px solid oklch(0.83 0.16 88 / 30%)",
                    color: "var(--color-foreground)",
                  }}
                >
                  <option value="">— Choose your team (optional) —</option>
                  {rosterTeams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}
          <IconInput icon={<Mail className="h-4 w-4" />} placeholder="Email" type="email"
                     value={email} onChange={setEmail} required />
          <IconInput icon={<Lock className="h-4 w-4" />} placeholder="Password" type="password"
                     value={password} onChange={setPassword} required />

          {err && <div className="text-xs text-red-300 bg-red-950/40 rounded-md p-2">{err}</div>}
          {msg && <div className="text-xs text-emerald-200 bg-emerald-950/40 rounded-md p-2">{msg}</div>}

          <button disabled={busy} type="submit" className="chip-button chip-button-hover w-full justify-center">
            {mode === "signin" ? <LogIn className="h-4 w-4 mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
            {busy ? "Please wait..." : mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3 text-[10px] tracking-[0.3em] text-foreground/40">
          <div className="h-px flex-1 bg-foreground/15" /> OR <div className="h-px flex-1 bg-foreground/15" />
        </div>

        <button onClick={google} type="button"
                className="chip-button chip-button-hover w-full justify-center"
                style={{ background: "white", color: "#111" }}>
          <svg className="h-4 w-4 mr-2" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.9 32.6 29.4 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35 26.7 36 24 36c-5.4 0-9.9-3.4-11.6-8.1l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.7l6.2 5.2C40.8 35.8 44 30.4 44 24c0-1.2-.1-2.3-.4-3.5z"/></svg>
          Continue with Google
        </button>

        <button
          type="button"
          onClick={() => { setErr(null); setMsg(null); setMode(mode === "signin" ? "signup" : "signin"); }}
          className="mt-5 w-full text-center text-xs text-foreground/60 hover:text-foreground"
        >
          {mode === "signin" ? "New here? Create an account →" : "Already have an account? Sign in →"}
        </button>
      </div>
    </div>
  );
}

function IconInput({
  icon, value, onChange, placeholder, type = "text", required,
}: {
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/45">{icon}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full pl-10 pr-3 py-2.5 rounded-lg text-sm outline-none transition"
        style={{
          background: "oklch(0.16 0.04 150)",
          border: "1px solid oklch(0.83 0.16 88 / 30%)",
          color: "var(--color-foreground)",
        }}
      />
    </div>
  );
}
