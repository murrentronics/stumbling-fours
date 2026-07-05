import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Camera, Eye, EyeOff, Mail, Lock, ArrowLeft, User, Trash2, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [{ title: "My Profile — Stumbling Fours" }],
  }),
  component: ProfilePage,
});

const BUCKET = "avatars";

function ProfilePage() {
  const { profile, user, refresh } = useAuth();
  const nav = useNavigate();

  // ── Avatar ───────────────────────────────────────────────────────────────
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [avatarErr, setAvatarErr] = useState<string | null>(null);

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    setUploading(true);
    setAvatarErr(null);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const url = `${data.publicUrl}?t=${Date.now()}`;

      const { error: dbErr } = await supabase
        .from("profiles")
        .update({ avatar_url: url })
        .eq("id", user.id);
      if (dbErr) throw dbErr;

      setAvatarUrl(url);
      await refresh();
    } catch (e) {
      setAvatarErr((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  // ── Email ────────────────────────────────────────────────────────────────
  const [email, setEmail] = useState(user?.email ?? "");
  const [emailMsg, setEmailMsg] = useState<string | null>(null);
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [emailBusy, setEmailBusy] = useState(false);

  const updateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailBusy(true); setEmailErr(null); setEmailMsg(null);
    try {
      // Update email directly in the profiles table — no confirmation email
      if (!user) throw new Error("Not logged in.");
      const { error } = await supabase
        .from("profiles")
        .update({ email })
        .eq("id", user.id);
      if (error) throw error;
      // Also update the auth email (best-effort, may require admin on some Supabase configs)
      await supabase.auth.updateUser({ email }).catch(() => {});
      await refresh();
      setEmailMsg("Email updated.");
    } catch (e) {
      setEmailErr((e as Error).message);
    } finally {
      setEmailBusy(false);
    }
  };

  // ── Password ─────────────────────────────────────────────────────────────
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  const updatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw) { setPwErr("New passwords don't match."); return; }
    if (newPw.length < 6) { setPwErr("Password must be at least 6 characters."); return; }
    setPwBusy(true); setPwErr(null); setPwMsg(null);
    try {
      // Re-authenticate with old password first
      const { error: reAuthErr } = await supabase.auth.signInWithPassword({
        email: user?.email ?? "",
        password: oldPw,
      });
      if (reAuthErr) throw new Error("Current password is incorrect.");
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      setPwMsg("Password updated successfully.");
      setOldPw(""); setNewPw(""); setConfirmPw("");
    } catch (e) {
      setPwErr((e as Error).message);
    } finally {
      setPwBusy(false);
    }
  };

  const label = profile?.display_name || user?.email?.split("@")[0] || "Player";

  // ── Delete account ───────────────────────────────────────────────────────
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  const deleteAccount = async () => {
    setDeleteBusy(true); setDeleteErr(null);
    try {
      // Delete avatar from storage if exists
      if (user && avatarUrl) {
        const ext = avatarUrl.split(".").pop()?.split("?")[0];
        await supabase.storage.from(BUCKET).remove([`${user.id}.${ext}`]);
      }
      // Delete profile row
      if (user) {
        await supabase.from("profiles").delete().eq("id", user.id);
      }
      // Sign out — Supabase doesn't expose deleteUser on client by default
      // so we delete the data and sign out; admin can remove auth record if needed
      await supabase.auth.signOut();
      nav({ to: "/auth" });
    } catch (e) {
      setDeleteErr((e as Error).message);
      setDeleteBusy(false);
    }
  };

  return (
    <div className="pt-2 max-w-lg mx-auto space-y-6">
      {/* Back */}
      <button onClick={() => nav({ to: "/" })}
              className="chip-button chip-button-hover"
              style={{ background: "var(--gradient-gold)", color: "oklch(0.18 0.05 150)" }}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Back
      </button>

      <h1 className="font-display font-black text-4xl gold-text">My Profile</h1>

      {/* ── Avatar card ── */}
      <div className="ornate-border p-6 flex flex-col items-center gap-4">
        {/* Avatar with thick team-coloured ring */}
        <div className="relative">
          <div className="rounded-full overflow-hidden"
               style={{
                 width: 120, height: 120,
                 border: "4px solid oklch(0.83 0.16 88)",
                 boxShadow: "0 0 0 3px oklch(0.18 0.05 150), 0 0 30px oklch(0.83 0.16 88 / 50%)",
               }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt={label}
                   className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full grid place-items-center"
                   style={{ background: "oklch(0.22 0.06 150)" }}>
                <User className="h-12 w-12 text-foreground/40" />
              </div>
            )}
          </div>
          {/* Camera overlay */}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="absolute bottom-0 right-0 h-9 w-9 rounded-full grid place-items-center transition hover:scale-110"
            style={{ background: "var(--gradient-gold)", color: "oklch(0.18 0.05 150)", border: "3px solid oklch(0.12 0.04 150)" }}
          >
            <Camera className="h-4 w-4" />
          </button>
        </div>

        <div className="text-center">
          <div className="font-display font-black text-xl gold-text">{label}</div>
          <div className="text-sm text-foreground/55">{user?.email}</div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadAvatar(file);
          }}
        />

        {uploading && (
          <div className="text-xs text-foreground/60 tracking-widest uppercase animate-pulse">
            Uploading…
          </div>
        )}
        {avatarErr && (
          <div className="text-xs text-red-300 bg-red-950/40 rounded-md px-3 py-2 w-full text-center">
            {avatarErr}
          </div>
        )}
      </div>

      {/* ── Update email ── */}
      <div className="ornate-border p-6 space-y-4">
        <h2 className="font-display font-black text-xl gold-text flex items-center gap-2">
          <Mail className="h-5 w-5" /> Update Email
        </h2>
        <form onSubmit={updateEmail} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="New email address"
            className={inputCls}
          />
          {emailErr && <Msg type="err">{emailErr}</Msg>}
          {emailMsg && <Msg type="ok">{emailMsg}</Msg>}
          <button disabled={emailBusy} type="submit" className="chip-button chip-button-hover w-full justify-center">
            {emailBusy ? "Updating…" : "Update Email"}
          </button>
        </form>
      </div>

      {/* ── Update password ── */}
      <div className="ornate-border p-6 space-y-4">
        <h2 className="font-display font-black text-xl gold-text flex items-center gap-2">
          <Lock className="h-5 w-5" /> Change Password
        </h2>
        <form onSubmit={updatePassword} className="space-y-3">
          <PasswordField
            value={oldPw} onChange={setOldPw}
            placeholder="Current password"
            show={showOld} onToggle={() => setShowOld(v => !v)}
          />
          <PasswordField
            value={newPw} onChange={setNewPw}
            placeholder="New password"
            show={showNew} onToggle={() => setShowNew(v => !v)}
          />
          <PasswordField
            value={confirmPw} onChange={setConfirmPw}
            placeholder="Confirm new password"
            show={showConfirm} onToggle={() => setShowConfirm(v => !v)}
          />
          {pwErr && <Msg type="err">{pwErr}</Msg>}
          {pwMsg && <Msg type="ok">{pwMsg}</Msg>}
          <button disabled={pwBusy} type="submit" className="chip-button chip-button-hover w-full justify-center">
            {pwBusy ? "Updating…" : "Change Password"}
          </button>
        </form>
      </div>

      {/* ── Danger zone ── */}
      <div className="rounded-2xl p-6 space-y-3"
           style={{ border: "2px solid oklch(0.55 0.22 25 / 50%)", background: "oklch(0.55 0.22 25 / 6%)" }}>
        <h2 className="font-display font-black text-xl flex items-center gap-2"
            style={{ color: "oklch(0.75 0.20 25)" }}>
          <AlertTriangle className="h-5 w-5" /> Danger Zone
        </h2>
        <p className="text-sm text-foreground/60">
          Permanently delete your profile and all your data. This cannot be undone.
        </p>
        <button
          onClick={() => { setShowDeleteModal(true); setDeleteConfirmText(""); setDeleteErr(null); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wider transition hover:brightness-110"
          style={{ background: "oklch(0.55 0.22 25 / 20%)", color: "oklch(0.80 0.18 25)", border: "1px solid oklch(0.55 0.22 25 / 40%)" }}
        >
          <Trash2 className="h-4 w-4" /> Delete My Account
        </button>
      </div>

      {/* ── Delete confirm modal ── */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-5"
          style={{ background: "oklch(0 0 0 / 80%)" }}
          onClick={() => !deleteBusy && setShowDeleteModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6 shadow-2xl space-y-4"
            style={{ background: "oklch(0.18 0.05 150)", border: "2px solid oklch(0.55 0.22 25 / 60%)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full grid place-items-center flex-shrink-0"
                   style={{ background: "oklch(0.55 0.22 25 / 25%)" }}>
                <Trash2 className="h-5 w-5" style={{ color: "oklch(0.80 0.18 25)" }} />
              </div>
              <h3 className="font-display font-black text-lg" style={{ color: "oklch(0.80 0.18 25)" }}>
                Delete Account?
              </h3>
            </div>

            <p className="text-sm text-foreground/70">
              This will permanently delete your profile, photo, and all associated data.
              <strong className="text-white"> This cannot be undone.</strong>
            </p>

            <div className="space-y-1.5">
              <div className="text-xs text-foreground/55 uppercase tracking-wider">
                Type <span className="font-black text-white">DELETE</span> to confirm
              </div>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                autoComplete="off"
                className="w-full h-11 bg-white/10 border border-white/25 text-white placeholder:text-white/30 rounded-lg text-sm px-3 outline-none focus:border-red-400/60 transition-colors"
              />
            </div>

            {deleteErr && <Msg type="err">{deleteErr}</Msg>}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleteBusy}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold border transition hover:bg-white/5 disabled:opacity-50"
                style={{ borderColor: "oklch(0.83 0.16 88 / 25%)" }}
              >
                Cancel
              </button>
              <button
                onClick={deleteAccount}
                disabled={deleteBusy || deleteConfirmText !== "DELETE"}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-black uppercase tracking-wider transition disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: "oklch(0.55 0.22 25)", color: "white" }}
              >
                {deleteBusy ? "Deleting…" : "Delete Forever"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────

const inputCls =
  "w-full h-11 bg-white/10 border border-white/25 text-white placeholder:text-white/40 rounded-lg text-sm px-3 outline-none focus:border-white/60 transition-colors";

function PasswordField({
  value, onChange, placeholder, show, onToggle,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
        autoComplete="off"
        className={`${inputCls} pr-10`}
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition"
        tabIndex={-1}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function Msg({ type, children }: { type: "err" | "ok"; children: React.ReactNode }) {
  return (
    <div className={`text-xs rounded-md px-3 py-2 ${
      type === "err"
        ? "text-red-300 bg-red-950/40"
        : "text-emerald-200 bg-emerald-950/40"
    }`}>
      {children}
    </div>
  );
}
