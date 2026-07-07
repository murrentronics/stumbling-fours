/**
 * pdf.ts — zero-dependency PDF generation using raw PDF syntax.
 * Produces a clean A4 tournament report downloadable on web and Android.
 */

import type { Match, RoundEntry } from "./store";

// ── helpers ────────────────────────────────────────────────────────────────────

const PAGE_W = 595;   // A4 points
const PAGE_H = 842;
const MARGIN = 40;
const LINE   = 14;

function esc(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-TT", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function winnerName(m: Match): string {
  if (m.disqualifiedTeamId) {
    return m.disqualifiedTeamId === m.teamA.id ? m.teamB.name : m.teamA.name;
  }
  return m.scoreA >= m.scoreB ? m.teamA.name : m.teamB.name;
}

// ── PDF builder ────────────────────────────────────────────────────────────────

interface PdfState {
  lines: string[];
  objects: string[];
  offsets: number[];
  bodyLines: string[];
  y: number;
}

function builder() {
  const state: PdfState = {
    lines: [],
    objects: [],
    offsets: [],
    bodyLines: [],
    y: PAGE_H - MARGIN,
  };

  function obj(content: string) {
    state.offsets.push(state.lines.join("").length);
    state.objects.push(content);
  }

  function text(x: number, y: number, str: string, size = 10, bold = false) {
    const font = bold ? "/F2" : "/F1";
    state.bodyLines.push(`BT ${font} ${size} Tf ${x} ${y} Td (${esc(str)}) Tj ET`);
  }

  function line(x1: number, y1: number, x2: number, y2: number, width = 0.5) {
    state.bodyLines.push(`${width} w ${x1} ${y1} m ${x2} ${y2} l S`);
  }

  function rect(x: number, y: number, w: number, h: number, fill = "0.15 g") {
    state.bodyLines.push(`${fill} ${x} ${y} ${w} ${h} re f`);
  }

  return { obj, text, line, rect, state };
}

// ── main export ───────────────────────────────────────────────────────────────

export type TournamentGroup = {
  id: string;
  name: string;
  matches: Match[];
};

export function generateTournamentPdf(groups: TournamentGroup[], entries: RoundEntry[]): Uint8Array {
  // Build content stream
  const lines: string[] = [];

  const push = (s: string) => lines.push(s + "\n");

  // We'll accumulate page content manually
  type Chunk = { type: "text"; x: number; y: number; s: string; size: number; bold: boolean }
             | { type: "line"; x1: number; y1: number; x2: number; y2: number }
             | { type: "rect"; x: number; y: number; w: number; h: number };

  const chunks: Chunk[] = [];
  let y = PAGE_H - MARGIN;

  const t = (x: number, yy: number, s: string, size = 10, bold = false) =>
    chunks.push({ type: "text", x, y: yy, s, size, bold });
  const ln = (x1: number, y1: number, x2: number, y2: number) =>
    chunks.push({ type: "line", x1, y1, x2, y2 });
  const bx = (x: number, yy: number, w: number, h: number) =>
    chunks.push({ type: "rect", x, y: yy, w, h });

  const gap = (n = 1) => { y -= LINE * n; };

  // ── Cover header ────────────────────────────────────────────────────────────
  t(MARGIN, y, "STUMBLING FOURS", 20, true);
  gap(1.6);
  t(MARGIN, y, "Tournament History Report", 12);
  gap(1);
  t(MARGIN, y, `Generated: ${fmtDate(Date.now())}`, 9);
  gap(0.5);
  ln(MARGIN, y, PAGE_W - MARGIN, y);
  gap(1.5);

  // ── Each tournament ─────────────────────────────────────────────────────────
  for (const grp of groups) {
    const timestamps = grp.matches.map((m) => m.startedAt);
    const minTs = Math.min(...timestamps);
    const maxTs = Math.max(...timestamps);
    const dateRange = minTs === maxTs ? fmtDate(minTs) : `${fmtDate(minTs)} – ${fmtDate(maxTs)}`;

    // Tournament heading bar
    bx(MARGIN, y - 4, PAGE_W - MARGIN * 2, LINE + 6);
    t(MARGIN + 4, y, grp.name, 12, true);
    t(PAGE_W - MARGIN - 120, y, dateRange, 9);
    gap(1.8);

    // Column headers
    t(MARGIN,       y, "Round / Table", 8, true);
    t(MARGIN + 130, y, "Team A",        8, true);
    t(MARGIN + 240, y, "Score",         8, true);
    t(MARGIN + 280, y, "Team B",        8, true);
    t(MARGIN + 390, y, "Winner",        8, true);
    gap(0.3);
    ln(MARGIN, y, PAGE_W - MARGIN, y);
    gap(1);

    const sorted = [...grp.matches].sort((a, b) =>
      a.round !== b.round ? a.round - b.round : a.startedAt - b.startedAt
    );

    for (const m of sorted) {
      if (y < MARGIN + 40) {
        // Simple page break marker — we'll handle it below
        y = PAGE_H - MARGIN;
      }

      const matchEntries = entries.filter((e) => e.matchId === m.id);
      const wA = m.disqualifiedTeamId
        ? m.disqualifiedTeamId !== m.teamA.id
        : m.scoreA >= m.scoreB;

      const scoreStr = `${m.scoreA}  –  ${m.scoreB}`;
      const winner   = winnerName(m);
      const dq       = m.disqualifiedTeamId ? " (DQ)" : "";

      t(MARGIN,       y, `R${m.round} · ${m.tableName}`, 9);
      t(MARGIN + 130, y, m.teamA.name, 9);
      t(MARGIN + 240, y, scoreStr,     9, true);
      t(MARGIN + 280, y, m.teamB.name, 9);
      t(MARGIN + 390, y, winner + dq,  9, wA ? false : false);
      gap(1);

      // Round entries summary
      if (matchEntries.length > 0) {
        const totalA = matchEntries.filter((e) => e.teamId === m.teamA.id).reduce((s, e) => s + e.total, 0);
        const totalB = matchEntries.filter((e) => e.teamId === m.teamB.id).reduce((s, e) => s + e.total, 0);
        t(MARGIN + 4, y, `  ${m.teamA.name}: ${totalA} pts   ${m.teamB.name}: ${totalB} pts`, 8);
        gap(1);
      }

      // Players
      const playersA = m.teamA.players.map((p) => p.name || p.email.split("@")[0]).join(", ");
      const playersB = m.teamB.players.map((p) => p.name || p.email.split("@")[0]).join(", ");
      if (playersA || playersB) {
        t(MARGIN + 4, y, `  ${playersA}  vs  ${playersB}`, 7);
        gap(0.9);
      }

      ln(MARGIN, y + 2, PAGE_W - MARGIN, y + 2);
      gap(0.8);
    }

    gap(1.5);
  }

  // ── Build raw PDF ────────────────────────────────────────────────────────────
  // We build a minimal but valid PDF manually.
  const enc = (s: string) => s;

  // Content stream
  const stream = buildStream(chunks);

  const objects: string[] = [];
  const offsets: number[] = [];

  // Object 1: Catalog
  objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);
  // Object 2: Pages
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`);
  // Object 3: Page
  objects.push(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
    `/Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n`
  );
  // Object 4: Content stream
  const streamBytes = new TextEncoder().encode(stream);
  objects.push(
    `4 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n${stream}\nendstream\nendobj\n`
  );
  // Object 5: Helvetica (regular)
  objects.push(
    `5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n`
  );
  // Object 6: Helvetica-Bold
  objects.push(
    `6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n`
  );

  // Assemble bytes
  const header = "%PDF-1.4\n";
  let body = header;
  for (let i = 0; i < objects.length; i++) {
    offsets.push(body.length);
    body += objects[i];
  }

  // Cross-reference table
  const xrefOffset = body.length;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    xref += String(off).padStart(10, "0") + " 00000 n \n";
  }
  body += xref;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return new TextEncoder().encode(body);
}

function buildStream(chunks: Array<
  { type: "text"; x: number; y: number; s: string; size: number; bold: boolean }
| { type: "line"; x1: number; y1: number; x2: number; y2: number }
| { type: "rect"; x: number; y: number; w: number; h: number }
>): string {
  const ops: string[] = [];
  for (const c of chunks) {
    if (c.type === "text") {
      const font = c.bold ? "/F2" : "/F1";
      ops.push(`BT ${font} ${c.size} Tf ${c.x} ${c.y} Td (${esc(c.s)}) Tj ET`);
    } else if (c.type === "line") {
      ops.push(`0.4 w 0.5 0.5 0.5 RG ${c.x1} ${c.y1} m ${c.x2} ${c.y2} l S`);
    } else if (c.type === "rect") {
      ops.push(`0.85 0.85 0.85 rg ${c.x} ${c.y} ${c.w} ${c.h} re f`);
    }
  }
  return ops.join("\n");
}

export function downloadPdf(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
