import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Mail, Lock, User as UserIcon, LogIn, UserPlus, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { type TeamColor } from "@/lib/store";
import logoSrc from "@/assets/logo.png";

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
  const [rosterTeams, setRosterTeams] = useState<RosterTeam[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Uncontrolled refs — Android WebView handles native input events directly
  const emailRef    = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const nameRef     = useRef<HTMLInputElement>(null);
  const teamRef     = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    supabase.from("roster_teams").select("id,name,color").order("name").then(({ data }) => {
      setRosterTeams(((data as RosterTeam[]) ?? []).filter((t) => t.name !== "Admin"));
    });
  }, []);

  useEffect(() => {
    if (!loading && session) nav({ to: "/" });
  }, [session, loading, nav]);

  const switchMode = (next: "signin" | "signup") => {
    setErr(null);
    setMsg(null);
    setMode(next);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Read values directly from DOM — no controlled state needed
    const email    = emailRef.current?.value?.trim() ?? "";
    const password = passwordRef.current?.value ?? "";
    const name     = nameRef.current?.value?.trim() ?? "";
    const teamId   = teamRef.current?.value ?? "";

    if (!email || !password) {
      setErr("Email and password are required.");
      return;
    }

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

  return (
    <div className="pt-2 grid place-items-center min-h-[70vh]">
      <div className="w-full max-w-md ornate-border p-8">

        {/* Logo */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="rounded-full overflow-hidden mb-3 flex-shrink-0"
               style={{ width: 96, height: 96, boxShadow: "var(--shadow-gold)" }}>
            <img src={logoSrc} alt="Stumbling Fours" className="w-full h-full object-cover" />
          </div>
          <h1 className="font-display font-black text-3xl gold-text">Stumbling Fours</h1>
          <p className="text-sm text-foreground/65 mt-1">All Fours · Trinidad Card Game</p>
        </div>

        {/* Sign In / Register tabs */}
        <div className="flex rounded-full p-1 mb-6"
             style={{ background: "oklch(0.16 0.04 150)", border: "1px solid oklch(0.83 0.16 88 / 25%)" }}>
          <button type="button" onClick={() => switchMode("signin")}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-bold uppercase tracking-wider transition-all"
                  style={mode === "signin"
                    ? { background: "var(--gradient-gold)", color: "oklch(0.18 0.05 150)" }
                    : { color: "var(--color-foreground)", opacity: 0.6 }}>
            <LogIn className="h-4 w-4" /> Sign In
          </button>
          <button type="button" onClick={() => switchMode("signup")}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-bold uppercase tracking-wider transition-all"
                  style={mode === "signup"
                    ? { background: "var(--gradient-gold)", color: "oklch(0.18 0.05 150)" }
                    : { color: "var(--color-foreground)", opacity: 0.6 }}>
            <UserPlus className="h-4 w-4" /> Register
          </button>
        </div>

        {/* Form — uncontrolled inputs, values read on submit */}
        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <>
              <Field icon={<UserIcon className="h-4 w-4" />}>
                <input ref={nameRef} type="text" name="displayname"
                       autoComplete="name" placeholder="Display name"
                       className={inputCls} />
              </Field>
              <Field icon={<Users className="h-4 w-4" />}>
                <select ref={teamRef} className={inputCls}>
                  <option value="">— Choose your team (optional) —</option>
                  {rosterTeams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </Field>
            </>
          )}

          <Field icon={<Mail className="h-4 w-4" />}>
            <input ref={emailRef} type="email" name="email"
                   inputMode="email" autoComplete="email"
                   placeholder="Email" required
                   className={inputCls} />
          </Field>

          <Field icon={<Lock className="h-4 w-4" />}>
            <input ref={passwordRef} type="password" name="password"
                   autoComplete="current-password"
                   placeholder="Password" required
                   className={inputCls} />
          </Field>

          {err && <div className="text-xs text-red-300 bg-red-950/40 rounded-md p-2">{err}</div>}
          {msg && <div className="text-xs text-emerald-200 bg-emerald-950/40 rounded-md p-2">{msg}</div>}

          <button disabled={busy} type="submit"
                  className="chip-button chip-button-hover w-full justify-center mt-2">
            {mode === "signin"
              ? <LogIn className="h-4 w-4 mr-2" />
              : <UserPlus className="h-4 w-4 mr-2" />}
            {busy ? "Please wait…" : mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}

// Shared input styles — no oklch inline, plain Tailwind only
const inputCls =
  "w-full h-11 bg-white/10 border border-white/25 text-white placeholder:text-white/40 rounded-lg text-sm px-3 outline-none focus:border-white/60 focus:bg-white/15 transition-colors";

function Field({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/45 pointer-events-none z-10">
        {icon}
      </div>
      <div className="[&>input]:pl-9 [&>select]:pl-9">{children}</div>
    </div>
  );
}
