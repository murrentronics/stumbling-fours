import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { Settings, Shield, UserPlus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Stumbling Fours" },
      { name: "description", content: "App settings and admin controls." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { isAdmin, loading } = useAuth();

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="pt-2 space-y-6">
      <div>
        <h1 className="font-display font-black text-4xl gold-text flex items-center gap-3">
          <Settings className="h-8 w-8" /> Settings
        </h1>
        <p className="text-foreground/65 text-sm mt-1">Admin controls and app configuration.</p>
      </div>

      <AdminPromotionPanel />
    </div>
  );
}

function AdminPromotionPanel() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null); setMsg(null);
    const { error } = await supabase.rpc("promote_to_admin", { _email: email });
    setBusy(false);
    if (error) setErr(error.message);
    else { setMsg(`${email} is now an admin.`); setEmail(""); }
  };

  return (
    <section className="ornate-border p-6">
      <h2 className="font-display font-black text-2xl gold-text flex items-center gap-2 mb-1">
        <Shield className="h-6 w-6" /> Admin Controls
      </h2>
      <p className="text-sm text-foreground/65 mb-4">
        Promote a registered user to admin. They must already have an account.
      </p>
      <form onSubmit={submit} className="flex flex-wrap gap-2 items-center">
        <input
          type="email"
          required
          placeholder="user@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 min-w-[200px] h-10 rounded-lg text-sm px-3 outline-none border bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white/50 transition-colors"
        />
        <button disabled={busy || !email} type="submit" className="chip-button chip-button-hover">
          <UserPlus className="h-4 w-4 mr-2" />
          {busy ? "Promoting…" : "Make Admin"}
        </button>
      </form>
      {err && <div className="mt-3 text-xs text-red-300 bg-red-950/40 rounded-md p-2">{err}</div>}
      {msg && <div className="mt-3 text-xs text-emerald-200 bg-emerald-950/40 rounded-md p-2">{msg}</div>}
    </section>
  );
}
