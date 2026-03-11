"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────

type ArchitectScene = {
  scene_number: number;
  script_dialogue: string;
  veo_prompt: string;
  shoot_instructions?: string;
  estimated_time_seconds?: number;
  color_code?: string;
};

type RewriteOp  = { type: "rewrite"; scene_number: number; reason: string; updated_dialogue: string; updated_veo_prompt: string };
type DeleteOp   = { type: "delete";  scene_number: number; reason: string };
type AddOp      = { type: "add";     after_scene_number: number; reason: string; new_dialogue: string; new_veo_prompt: string };
type MergeOp    = { type: "merge";   scene_numbers: number[]; reason: string; merged_dialogue: string; merged_veo_prompt: string };
type SplitOp    = { type: "split";   scene_number: number; reason: string; new_scenes: { dialogue: string; veo_prompt: string }[] };
type Operation  = RewriteOp | DeleteOp | AddOp | MergeOp | SplitOp;

type FinalScene = {
  scene_number: number;
  script_dialogue: string;
  veo_prompt: string;
  status: "original" | "rewritten" | "added" | "merged" | "split";
  operation_reason?: string;
};

type ValidationResult = {
  analysis: { score: number; critique: string[] };
  operations: Operation[];
  final_scenes: FinalScene[];
  pdf_download_url?: string;
};

type ReviewStatus = "pending" | "accepted" | "denied";

// ── Constants ─────────────────────────────────────────────────────────────

const TONE_OPTIONS = ["professional", "casual", "educational", "entertaining", "inspirational", "conversational"];

const OP_META: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  rewrite: { label: "REWRITE",   color: "text-amber-300",   bg: "bg-amber-950/30",   border: "border-amber-500/30",   dot: "bg-amber-400" },
  delete:  { label: "DELETE",    color: "text-rose-400",    bg: "bg-rose-950/30",    border: "border-rose-500/30",    dot: "bg-rose-400"  },
  add:     { label: "NEW SCENE", color: "text-emerald-400", bg: "bg-emerald-950/30", border: "border-emerald-500/30", dot: "bg-emerald-400"},
  merge:   { label: "MERGE",     color: "text-blue-400",    bg: "bg-blue-950/30",    border: "border-blue-500/30",    dot: "bg-blue-400"  },
  split:   { label: "SPLIT",     color: "text-violet-400",  bg: "bg-violet-950/30",  border: "border-violet-500/30",  dot: "bg-violet-400"},
};

const STATUS_BADGE: Record<string, string> = {
  rewritten: "text-amber-300 bg-amber-500/10 border-amber-500/30",
  added:     "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
  merged:    "text-blue-300 bg-blue-500/10 border-blue-500/30",
  split:     "text-violet-300 bg-violet-500/10 border-violet-500/30",
  original:  "text-slate-500 bg-white/5 border-white/10",
};

const containerVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};
const cardVariants: Variants = {
  hidden: { opacity: 0, y: 24, scale: 0.97 },
  show:   { opacity: 1, y: 0,  scale: 1,    transition: { type: "spring", stiffness: 130, damping: 20 } },
};

// ── Helper: apply accepted operations to original scenes ──────────────────

function computeFinalScenes(
  originals: ArchitectScene[],
  operations: Operation[],
  statuses: Record<number, ReviewStatus>
): FinalScene[] {
  const accepted = operations.filter((_, i) => statuses[i] !== "denied");

  const deleted = new Set<number>();
  const mergeConsumed = new Set<number>();
  const mergeOps: Record<number, MergeOp> = {};
  const rewriteOps: Record<number, RewriteOp> = {};
  const splitOps: Record<number, SplitOp> = {};
  const addOps: Record<number, AddOp> = {};

  for (const op of accepted) {
    if (op.type === "delete")  deleted.add(op.scene_number);
    if (op.type === "merge")   { mergeOps[op.scene_numbers[0]] = op; op.scene_numbers.slice(1).forEach(n => mergeConsumed.add(n)); }
    if (op.type === "rewrite") rewriteOps[op.scene_number] = op;
    if (op.type === "split")   splitOps[op.scene_number] = op;
    if (op.type === "add")     addOps[op.after_scene_number] = op;
  }

  const result: FinalScene[] = [];

  for (const scene of originals) {
    const sn = scene.scene_number;
    if (deleted.has(sn) || mergeConsumed.has(sn)) continue;

    if (splitOps[sn]) {
      const op = splitOps[sn];
      for (const ns of op.new_scenes) {
        result.push({ scene_number: 0, script_dialogue: ns.dialogue, veo_prompt: ns.veo_prompt, status: "split", operation_reason: op.reason });
      }
    } else if (mergeOps[sn]) {
      const op = mergeOps[sn];
      result.push({ scene_number: 0, script_dialogue: op.merged_dialogue, veo_prompt: op.merged_veo_prompt, status: "merged", operation_reason: op.reason });
    } else if (rewriteOps[sn]) {
      const op = rewriteOps[sn];
      result.push({ scene_number: 0, script_dialogue: op.updated_dialogue, veo_prompt: op.updated_veo_prompt, status: "rewritten", operation_reason: op.reason });
    } else {
      result.push({ scene_number: 0, script_dialogue: scene.script_dialogue, veo_prompt: scene.veo_prompt, status: "original" });
    }

    if (addOps[sn]) {
      const op = addOps[sn];
      result.push({ scene_number: 0, script_dialogue: op.new_dialogue, veo_prompt: op.new_veo_prompt, status: "added", operation_reason: op.reason });
    }
  }

  result.forEach((s, i) => { s.scene_number = i + 1; });
  return result;
}

// ── Operation Card ────────────────────────────────────────────────────────

function OperationCard({
  op, index, originals, status,
  onAccept, onDeny, onReset,
}: {
  op: Operation; index: number; originals: ArchitectScene[];
  status: ReviewStatus; onAccept: () => void; onDeny: () => void; onReset: () => void;
}) {
  const meta = OP_META[op.type];
  const originalScene = op.type !== "add"
    ? originals.find(s => s.scene_number === (op.type === "merge" ? op.scene_numbers[0] : op.scene_number))
    : null;

  const sceneRef =
    op.type === "merge"  ? `Scenes ${op.scene_numbers.join(" + ")}` :
    op.type === "add"    ? `After Scene ${op.after_scene_number}` :
    `Scene ${(op as any).scene_number}`;

  return (
    <motion.div
      variants={cardVariants}
      className={`rounded-2xl border ${meta.border} ${meta.bg} backdrop-blur-xl overflow-hidden`}
    >
      {/* Header */}
      <div className={`flex items-center justify-between px-5 py-3.5 border-b ${meta.border} bg-black/10`}>
        <div className="flex items-center gap-3">
          <span className={`w-2.5 h-2.5 rounded-full ${meta.dot}`} />
          <span className={`text-sm font-black tracking-[0.15em] uppercase ${meta.color}`}>{meta.label}</span>
          <span className="text-sm font-mono text-slate-400 uppercase tracking-wider">{sceneRef}</span>
        </div>
        <div className="flex items-center gap-2">
          {status === "accepted" && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                ✓ Accepted
              </span>
              <button
                onClick={onReset}
                className="text-sm text-slate-500 hover:text-slate-300 border border-white/10 hover:border-white/25 px-2.5 py-1 rounded-full transition-all"
              >
                Undo
              </button>
            </div>
          )}
          {status === "denied" && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-black uppercase tracking-wider text-rose-400 bg-rose-500/10 border border-rose-500/30 px-2.5 py-1 rounded-full">
                ✗ Denied
              </span>
              <button
                onClick={onReset}
                className="text-sm text-slate-500 hover:text-slate-300 border border-white/10 hover:border-white/25 px-2.5 py-1 rounded-full transition-all"
              >
                Undo
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Reason */}
      <div className="px-5 py-3 border-b border-white/5">
        <p className="text-base text-slate-300 italic leading-relaxed">{op.reason}</p>
      </div>

      {/* Body */}
      <div className="px-5 py-5 flex flex-col gap-4">

        {/* REWRITE */}
        {op.type === "rewrite" && (
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <p className="text-sm font-bold tracking-[0.1em] uppercase text-slate-500 mb-2">Original</p>
              <div className={`p-4 rounded-xl border text-sm leading-relaxed ${status === "accepted" ? "line-through opacity-40 bg-slate-950/40 border-slate-800 text-slate-400" : "bg-rose-950/10 border-rose-500/15 text-slate-300"}`}>
                {originalScene?.script_dialogue ?? "—"}
              </div>
            </div>
            <div className="hidden lg:flex items-center text-slate-600 text-xl pt-6">→</div>
            <div className="flex-1">
              <p className="text-sm font-bold tracking-[0.1em] uppercase text-amber-400/80 mb-2">Improved</p>
              <div className="p-4 rounded-xl border bg-amber-950/20 border-amber-500/20 text-sm leading-relaxed text-amber-100">
                {op.updated_dialogue}
              </div>
              {op.updated_veo_prompt && (
                <div className="mt-2 p-3 rounded-lg bg-black/20 border border-white/5 text-sm text-slate-400 italic leading-relaxed">
                  <span className="text-violet-400 font-bold not-italic">VEO: </span>{op.updated_veo_prompt}
                </div>
              )}
            </div>
          </div>
        )}

        {/* DELETE */}
        {op.type === "delete" && originalScene && (
          <div className={`p-4 rounded-xl border text-sm leading-relaxed ${status === "accepted" ? "line-through opacity-30 bg-slate-950/40 border-slate-800 text-slate-500" : "bg-rose-950/15 border-rose-500/20 text-slate-300"}`}>
            {originalScene.script_dialogue}
          </div>
        )}

        {/* ADD */}
        {op.type === "add" && (
          <div>
            <p className="text-sm font-bold tracking-[0.1em] uppercase text-emerald-400/80 mb-2">New Scene</p>
            <div className="p-4 rounded-xl border bg-emerald-950/20 border-emerald-500/20 text-sm leading-relaxed text-emerald-100">
              {op.new_dialogue}
            </div>
            {op.new_veo_prompt && (
              <div className="mt-2 p-3 rounded-lg bg-black/20 border border-white/5 text-sm text-slate-400 italic leading-relaxed">
                <span className="text-violet-400 font-bold not-italic">VEO: </span>{op.new_veo_prompt}
              </div>
            )}
          </div>
        )}

        {/* MERGE */}
        {op.type === "merge" && (
          <div className="flex flex-col gap-3">
            <div className="flex gap-3">
              {op.scene_numbers.map(sn => {
                const s = originals.find(o => o.scene_number === sn);
                return s ? (
                  <div key={sn} className="flex-1 p-4 rounded-xl border bg-rose-950/10 border-rose-500/15 text-sm text-slate-300 leading-relaxed">
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-2">Scene {sn}</p>
                    {s.script_dialogue}
                  </div>
                ) : null;
              })}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-sm text-blue-400 font-bold tracking-widest uppercase">Merged Into</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>
            <div className="p-4 rounded-xl border bg-blue-950/20 border-blue-500/20 text-sm leading-relaxed text-blue-100">
              {op.merged_dialogue}
            </div>
          </div>
        )}

        {/* SPLIT */}
        {op.type === "split" && (
          <div className="flex flex-col gap-3">
            {originalScene && (
              <div className="p-4 rounded-xl border bg-rose-950/10 border-rose-500/15 text-sm text-slate-300 leading-relaxed">
                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-2">Original Scene {op.scene_number}</p>
                {originalScene.script_dialogue}
              </div>
            )}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-sm text-violet-400 font-bold tracking-widest uppercase">Split Into</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>
            <div className="flex gap-3">
              {op.new_scenes.map((ns, i) => (
                <div key={i} className="flex-1 p-4 rounded-xl border bg-violet-950/20 border-violet-500/20 text-sm text-violet-100 leading-relaxed">
                  <p className="text-sm font-bold text-violet-400/60 uppercase tracking-widest mb-2">Part {String.fromCharCode(65 + i)}</p>
                  {ns.dialogue}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons — only show when pending */}
        {status === "pending" && (
          <div className="flex gap-3 mt-1">
            <button
              onClick={onAccept}
              className="flex-1 py-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-base font-bold uppercase tracking-wider hover:bg-emerald-500/25 transition-colors"
            >
              Accept
            </button>
            <button
              onClick={onDeny}
              className="flex-1 py-3.5 rounded-xl bg-slate-800/50 border border-slate-700 text-slate-400 text-base font-bold uppercase tracking-wider hover:bg-rose-500/15 hover:text-rose-300 hover:border-rose-500/30 transition-colors"
            >
              Deny
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Workspace ─────────────────────────────────────────────────────────────

type WorkspaceProps = {
  initialScenes?: ArchitectScene[];
  initialTopic?: string;
  initialNiche?: string;
  projectId?: string;
};

function QualityCriticWorkspace({ initialScenes, initialTopic, initialNiche, projectId }: WorkspaceProps) {
  const [scenes, setScenes] = useState<ArchitectScene[]>(initialScenes ?? []);
  const [topic, setTopic]   = useState(initialTopic ?? "");
  const [tone, setTone]     = useState("professional");
  const [scenesLoading, setScenesLoading] = useState(!initialScenes && !!projectId);

  const [validating, setValidating] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [result, setResult]         = useState<ValidationResult | null>(null);
  const [statuses, setStatuses]     = useState<Record<number, ReviewStatus>>({});

  // Fetch script from DB if not passed via props (normal flow — avoids HTTP 431)
  // DB shape: document.data.jobs[0].result.script[]
  useEffect(() => {
    if (initialScenes || !projectId) return;
    setScenesLoading(true);
    fetch(`/api/yt-projects/${projectId}/architect`)
      .then(r => r.json())
      .then(d => {
        const jobs = d.document?.data?.jobs;
        // Find the most recent completed job
        const doneJob = Array.isArray(jobs)
          ? jobs.find((j: { status: string; result?: { script?: ArchitectScene[] } }) => j.status === "done" && Array.isArray(j.result?.script))
          : null;
        const script = doneJob?.result?.script;
        if (Array.isArray(script) && script.length > 0) {
          setScenes(script.map((s: ArchitectScene, i: number) => ({
            scene_number: typeof s.scene_number === "number" ? s.scene_number : i + 1,
            script_dialogue: s.script_dialogue ?? "",
            veo_prompt: s.veo_prompt ?? "",
            shoot_instructions: s.shoot_instructions ?? "",
            estimated_time_seconds: s.estimated_time_seconds ?? 0,
            color_code: s.color_code ?? "blue",
          })));
        }
      })
      .catch(() => {})
      .finally(() => setScenesLoading(false));
  }, [projectId, initialScenes]);

  const hasScenes = scenes.length > 0;

  // ── SEO Generation state ──────────────────────────────────────────────
  const [seoLoading, setSeoLoading] = useState(false);
  const [seoError, setSeoError] = useState<string | null>(null);
  const [seoSuccess, setSeoSuccess] = useState(false);

  const handleValidate = async () => {
    if (!hasScenes) return;
    setValidating(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/script-validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenes: scenes.map(s => ({
            scene_number: s.scene_number,
            script_dialogue: s.script_dialogue,
            veo_prompt: s.veo_prompt,
            shoot_instructions: s.shoot_instructions ?? "",
            estimated_time_seconds: s.estimated_time_seconds ?? 0,
            color_code: s.color_code ?? "blue",
          })),
          tone,
          topic: topic.trim() || initialNiche || "General",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `API error ${res.status}`);

      setResult(data);
      const init: Record<number, ReviewStatus> = {};
      (data.operations ?? []).forEach((_: Operation, i: number) => { init[i] = "pending"; });
      setStatuses(init);
    } catch (e: any) {
      setError(e.message || "Validation failed. Please try again.");
    } finally {
      setValidating(false);
    }
  };

  const accept = (i: number) => setStatuses(p => ({ ...p, [i]: "accepted" }));
  const deny   = (i: number) => setStatuses(p => ({ ...p, [i]: "denied"   }));
  // ── NEW: reset a single op back to pending ──
  const reset  = (i: number) => setStatuses(p => ({ ...p, [i]: "pending"  }));

  const acceptAll = () => {
    const all: Record<number, ReviewStatus> = {};
    result?.operations.forEach((_, i) => { all[i] = "accepted"; });
    setStatuses(all);
  };
  const denyAll = () => {
    const all: Record<number, ReviewStatus> = {};
    result?.operations.forEach((_, i) => { all[i] = "denied"; });
    setStatuses(all);
  };
  // ── NEW: reset all back to pending ──
  const resetAll = () => {
    const all: Record<number, ReviewStatus> = {};
    result?.operations.forEach((_, i) => { all[i] = "pending"; });
    setStatuses(all);
  };

  // Re-validate with the current live (post-edit) scenes
  const handleReValidate = async () => {
    if (!liveScenes.length) return;
    // Promote liveScenes to become the new base
    const newScenes: ArchitectScene[] = liveScenes.map(s => ({
      scene_number: s.scene_number,
      script_dialogue: s.script_dialogue,
      veo_prompt: s.veo_prompt,
      shoot_instructions: "",
      estimated_time_seconds: 0,
      color_code: "blue",
    }));
    setScenes(newScenes);
    setResult(null);
    setStatuses({});
    setError(null);
    setValidating(true);
    try {
      const res = await fetch("/api/script-validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenes: newScenes,
          tone,
          topic: topic.trim() || initialNiche || "General",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `API error ${res.status}`);
      setResult(data);
      const init: Record<number, ReviewStatus> = {};
      (data.operations ?? []).forEach((_: Operation, i: number) => { init[i] = "pending"; });
      setStatuses(init);
    } catch (e: any) {
      setError(e.message || "Re-validation failed. Please try again.");
      setScenes(newScenes); // keep the promoted scenes even on error
    } finally {
      setValidating(false);
    }
  };

  const pendingCount  = result ? Object.values(statuses).filter(s => s === "pending").length  : 0;
  const acceptedCount = result ? Object.values(statuses).filter(s => s === "accepted").length : 0;
  const deniedCount   = result ? Object.values(statuses).filter(s => s === "denied").length   : 0;

  const liveScenes: FinalScene[] = useMemo(() => {
    if (!result) return [];
    return computeFinalScenes(scenes, result.operations, statuses);
  }, [result, statuses, scenes]);

  const esc = (s: string) =>
    s.split("&").join("&amp;").split("<").join("&lt;").split(">").join("&gt;").split("\n").join("<br/>");

  const handleDownloadScript = () => {
    if (!result) return;
    const topicEsc = esc(topic || "Script Audit");
    const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const acceptedOps = result.operations.filter((_, i) => statuses[i] === "accepted");

    const scenesHtml = liveScenes.map(scene => {
      const badge = scene.status !== "original"
        ? '<span class="badge badge-' + scene.status + '">' + scene.status.toUpperCase() + '</span>'
        : "";
      return '<div class="scene scene-' + scene.status + '">' +
        '<div class="scene-header"><span class="scene-num">SCENE ' + String(scene.scene_number).padStart(2, "0") + '</span>' + badge + '</div>' +
        '<p class="dialogue">' + esc(scene.script_dialogue) + '</p>' +
        '<p class="veo"><span class="veo-label">VEO</span>' + esc(scene.veo_prompt) + '</p>' +
        '</div>';
    }).join("");

    const opsHtml = acceptedOps.map((op) => {
      const ref = op.type === "merge" ? "Scenes " + op.scene_numbers.join("+") :
                  op.type === "add"   ? "After Scene " + op.after_scene_number :
                  "Scene " + (op as any).scene_number;
      return '<div class="op op-' + op.type + '">' +
        '<div class="op-label">' + op.type.toUpperCase() + '</div>' +
        '<div class="op-ref">' + ref + '</div>' +
        '<div class="op-reason">' + esc(op.reason) + '</div>' +
        '</div>';
    }).join("");

    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/>
<title>${topicEsc} — Updated Script</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:system-ui,sans-serif;background:#020617;color:#e2e8f0;font-size:13px;line-height:1.6}
.cover{min-height:100vh;background:linear-gradient(135deg,#020617 0%,#0f172a 40%,#1a0a3a 100%);display:flex;flex-direction:column;justify-content:space-between;padding:64px;page-break-after:always;position:relative}
.cover::before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse 70% 50% at 15% 20%,rgba(168,85,247,.2) 0%,transparent 60%),radial-gradient(ellipse 60% 50% at 85% 80%,rgba(34,211,238,.12) 0%,transparent 55%);pointer-events:none}
.brand{font-size:10px;font-weight:800;letter-spacing:.35em;text-transform:uppercase;color:rgba(168,85,247,.7)}
.cover-main{position:relative}
.eyebrow{font-size:10px;font-weight:700;letter-spacing:.3em;text-transform:uppercase;color:rgba(34,211,238,.7);margin-bottom:18px}
.cover-title{font-size:52px;font-weight:900;line-height:1.05;letter-spacing:-.02em;background:linear-gradient(135deg,#f8fafc,#94a3b8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:12px}
.cover-topic{font-size:20px;font-weight:600;color:rgba(168,85,247,.85);font-style:italic;margin-bottom:28px}
.stats{display:flex;gap:28px;flex-wrap:wrap;margin-top:12px}
.stat{display:flex;flex-direction:column;gap:3px}
.stat-val{font-size:28px;font-weight:900;color:#f8fafc}
.stat-label{font-size:8px;font-weight:700;letter-spacing:.25em;text-transform:uppercase;color:rgba(148,163,184,.5)}
.score-pill{display:inline-flex;align-items:center;gap:20px;background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.25);border-radius:20px;padding:18px 28px;margin-top:36px}
.score-num{font-size:52px;font-weight:900;background:linear-gradient(135deg,#34d399,#22d3ee);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.score-side{font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:rgba(52,211,153,.7)}
.cover-footer{display:flex;justify-content:space-between;font-size:9px;color:rgba(148,163,184,.35);letter-spacing:.1em;border-top:1px solid rgba(255,255,255,.05);padding-top:20px}
.page{max-width:900px;margin:0 auto;padding:52px 60px}
.page-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:36px;padding-bottom:14px;border-bottom:1px solid rgba(255,255,255,.06)}
.page-head-brand{font-size:9px;font-weight:700;letter-spacing:.3em;text-transform:uppercase;color:rgba(168,85,247,.5)}
.section{margin-bottom:44px}
.section-title{font-size:9px;font-weight:800;letter-spacing:.3em;text-transform:uppercase;color:rgba(148,163,184,.4);margin-bottom:16px;display:flex;align-items:center;gap:8px}
.section-title::before{content:"";width:3px;height:13px;border-radius:2px;background:linear-gradient(180deg,#a855f7,#22d3ee);display:inline-block}
.critique-list{display:flex;flex-direction:column;gap:10px}
.critique-item{display:flex;gap:12px;align-items:flex-start;padding:12px 16px;background:rgba(251,191,36,.04);border:1px solid rgba(251,191,36,.12);border-radius:12px}
.critique-num{flex-shrink:0;width:20px;height:20px;border-radius:50%;background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.25);color:#fbbf24;font-size:8px;font-weight:800;display:flex;align-items:center;justify-content:center}
.critique-text{font-size:12px;color:#cbd5e1;line-height:1.55}
.ops-list{display:flex;flex-direction:column;gap:8px}
.op{display:flex;gap:12px;align-items:flex-start;padding:12px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.02);page-break-inside:avoid}
.op-label{flex-shrink:0;font-size:8px;font-weight:900;letter-spacing:.2em;padding:3px 8px;border-radius:8px}
.op-rewrite .op-label{background:rgba(251,191,36,.1);color:#fbbf24}
.op-delete  .op-label{background:rgba(244,63,94,.1);color:#fb7185}
.op-add     .op-label{background:rgba(16,185,129,.1);color:#34d399}
.op-merge   .op-label{background:rgba(59,130,246,.1);color:#60a5fa}
.op-split   .op-label{background:rgba(168,85,247,.1);color:#c084fc}
.op-ref{font-size:9px;font-weight:700;color:rgba(148,163,184,.6);padding-top:3px;white-space:nowrap}
.op-reason{font-size:11px;color:#94a3b8;font-style:italic;flex:1;line-height:1.5;padding-top:2px}
.scene{border:1px solid rgba(255,255,255,.06);border-radius:16px;margin-bottom:14px;overflow:hidden;page-break-inside:avoid}
.scene-original{border-color:rgba(255,255,255,.06)}
.scene-rewritten{border-color:rgba(251,191,36,.25);background:rgba(120,80,0,.06)}
.scene-added    {border-color:rgba(16,185,129,.25);background:rgba(0,80,40,.06)}
.scene-merged   {border-color:rgba(59,130,246,.25);background:rgba(0,30,100,.06)}
.scene-split    {border-color:rgba(168,85,247,.25);background:rgba(60,0,100,.06)}
.scene-header{display:flex;align-items:center;gap:10px;padding:9px 16px;background:rgba(255,255,255,.02);border-bottom:1px solid rgba(255,255,255,.04)}
.scene-num{font-size:8px;font-weight:800;letter-spacing:.3em;text-transform:uppercase;color:#22d3ee}
.badge{font-size:7px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;padding:2px 7px;border-radius:20px}
.badge-rewritten{background:rgba(251,191,36,.12);color:#fbbf24}
.badge-added    {background:rgba(16,185,129,.12);color:#34d399}
.badge-merged   {background:rgba(59,130,246,.12);color:#60a5fa}
.badge-split    {background:rgba(168,85,247,.12);color:#c084fc}
.dialogue{padding:12px 16px;font-size:12.5px;color:#e2e8f0;line-height:1.7}
.veo{padding:0 16px 12px;font-size:10px;font-style:italic;color:rgba(148,163,184,.5)}
.veo-label{font-weight:800;font-style:normal;color:rgba(168,85,247,.5);margin-right:6px}
@media print{
  .cover{page-break-after:always;min-height:100vh}
  body{background:#020617!important}
  *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
}
</style></head><body>
<div class="cover">
  <div class="brand">AXIGRADE · QUALITY CRITIC</div>
  <div class="cover-main">
    <p class="eyebrow">Updated Script — Audit Report</p>
    <h1 class="cover-title">Script Quality<br/>Analysis</h1>
    <p class="cover-topic">&ldquo;${topicEsc}&rdquo;</p>
    <div class="stats">
      <div class="stat"><span class="stat-val">${result.analysis.score}</span><span class="stat-label">Quality Score</span></div>
      <div class="stat"><span class="stat-val">${liveScenes.length}</span><span class="stat-label">Final Scenes</span></div>
      <div class="stat"><span class="stat-val">${acceptedOps.length}</span><span class="stat-label">Changes Applied</span></div>
      <div class="stat"><span class="stat-val">${liveScenes.filter(s => s.status !== "original").length}</span><span class="stat-label">Scenes Modified</span></div>
    </div>
    <div class="score-pill">
      <span class="score-num">${result.analysis.score}</span>
      <div><div class="score-side" style="margin-bottom:4px">Quality Score</div><div style="font-size:28px;font-weight:900;color:rgba(255,255,255,.15)">/100</div></div>
    </div>
  </div>
  <div class="cover-footer"><span>AXIGRADE · THE QUALITY CRITIC · CONFIDENTIAL</span><span>${date}</span></div>
</div>
<div class="page">
  <div class="page-head"><span class="page-head-brand">Axigrade · Quality Critic</span><span style="font-size:11px;color:rgba(148,163,184,.4)">${topicEsc}</span></div>
  ${result.analysis.critique.length > 0 ? '<div class="section"><h2 class="section-title">CRITIC\'S NOTES</h2><div class="critique-list">' +
    result.analysis.critique.map((p, i) => '<div class="critique-item"><div class="critique-num">' + (i+1) + '</div><p class="critique-text">' + esc(p) + '</p></div>').join("") +
    '</div></div>' : ""}
  ${acceptedOps.length > 0 ? '<div class="section"><h2 class="section-title">APPLIED OPERATIONS (' + acceptedOps.length + ')</h2><div class="ops-list">' + opsHtml + '</div></div>' : ""}
  <div class="section"><h2 class="section-title">UPDATED SCRIPT (${liveScenes.length} SCENES)</h2>${scenesHtml}</div>
</div>
<script>window.onload=function(){window.print();}<\/script>
</body></html>`;

    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); }
  };

  // ── Generate SEO & Tags ─────────────────────────────────────────────────
  // Step 1: POST submits the job and returns 202 immediately (< 3s).
  // Step 2: We poll GET ?jobId=xxx every 5s until status === "done" or "error".
  // This means the serverless function is never held open for >3s,
  // so 50+ concurrent users can all submit without blocking each other.
  const handleGenerateSEO = async () => {
    if (!projectId || !result) return;
    setSeoLoading(true);
    setSeoError(null);
    setSeoSuccess(false);

    const scriptSummary = liveScenes
      .map(s => s.script_dialogue)
      .join(" ")
      .slice(0, 2000);

    const videoTitle = topic.trim() || initialNiche || "My Video";

    try {
      // Submit — expect 202 { status: "processing", job_id } or 200 { status: "done" } (cache hit)
      const res = await fetch(`/api/yt-projects/${projectId}/algorithm-whisperer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: videoTitle, script: scriptSummary }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `SEO API error ${res.status}`);

      // Cache hit — already done
      if (data.status === "done") {
        setSeoSuccess(true);
        setSeoLoading(false);
        return;
      }

      // Job submitted — poll until done (max 3 min, every 5s = 36 attempts)
      const jobId = data.job_id;
      if (!jobId) throw new Error("No job_id returned");

      const MAX_POLLS = 36;
      for (let i = 0; i < MAX_POLLS; i++) {
        await new Promise(r => setTimeout(r, 5000));
        const pollRes = await fetch(`/api/yt-projects/${projectId}/algorithm-whisperer?jobId=${jobId}`);
        const pollData = await pollRes.json();

        if (pollData.status === "done") {
          setSeoSuccess(true);
          setSeoLoading(false);
          return;
        }
        if (pollData.status === "error") {
          throw new Error("SEO job failed on server. Please try again.");
        }
        // status === "processing" → keep polling
      }

      // Timed out after 3 min — job is still running in the background
      setSeoSuccess(true); // Show "view results" link — they can check back
      setSeoLoading(false);

    } catch (e: unknown) {
      setSeoError(e instanceof Error ? e.message : "SEO generation failed.");
      setSeoLoading(false);
    }
  };

  // ── PRE-VALIDATION ───────────────────────────────────────────────────────
  if (scenesLoading) {
    return (
      <div className="mt-8 flex flex-col items-center justify-center gap-4 py-24">
        <svg className="animate-spin h-8 w-8 text-rose-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
        </svg>
        <p className="text-slate-400 text-sm">Loading script from project...</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="mt-8 flex flex-col lg:flex-row gap-8">
        <div className="flex-1 rounded-3xl border border-white/10 bg-slate-900/70 backdrop-blur-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Script Under Review</p>
              <p className="text-xs text-slate-500 mt-1">Scene-by-scene from The Architect.</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{scenes.length} scenes</span>
            </div>
          </div>

          {!hasScenes ? (
            <div className="rounded-2xl border border-dashed border-slate-600/50 bg-slate-950/50 p-5 text-sm text-slate-400">
              <p className="font-semibold text-slate-200 mb-2">No script detected.</p>
              <p className="text-xs">Go to <span className="font-mono text-rose-300">THE ARCHITECT</span>, open a completed script, then click <span className="font-semibold text-rose-300">Validate Script</span>.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {scenes.map(scene => (
                <motion.div key={scene.scene_number} variants={cardVariants} initial="hidden" animate="show"
                  className="rounded-2xl border border-white/8 bg-slate-900/80 p-4">
                  <p className="text-xs font-mono uppercase tracking-[0.25em] text-cyan-400 mb-1.5">
                    Scene {String(scene.scene_number).padStart(2, "0")}
                    {scene.estimated_time_seconds ? <span className="ml-2 text-slate-500">· {scene.estimated_time_seconds}s</span> : null}
                  </p>
                  <p className="text-sm text-slate-200 leading-relaxed">{scene.script_dialogue}</p>
                  {scene.veo_prompt && (
                    <p className="mt-2 text-xs text-slate-500 italic">
                      <span className="text-violet-400 font-bold not-italic">VEO: </span>{scene.veo_prompt.slice(0, 100)}{scene.veo_prompt.length > 100 ? "…" : ""}
                    </p>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>

        <div className="w-full lg:w-[340px] flex-shrink-0 rounded-3xl border border-white/10 bg-slate-950/80 backdrop-blur-2xl p-6 flex flex-col gap-5">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400 mb-1">Quality Panel</p>
            <p className="text-xs text-slate-500">AI will audit every scene individually — suggesting rewrites, deletions, additions, merges, and splits.</p>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-slate-500 mb-2">Topic / Title</label>
            <input type="text" value={topic} onChange={e => setTopic(e.target.value)}
              placeholder="e.g. System Design, Personal Finance..."
              className="w-full bg-slate-800/70 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-rose-400" />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-slate-500 mb-2">Tone</label>
            <div className="grid grid-cols-2 gap-2">
              {TONE_OPTIONS.map(t => (
                <button key={t} onClick={() => setTone(t)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                    tone === t
                      ? "bg-gradient-to-r from-rose-500/25 to-fuchsia-500/25 border border-fuchsia-500/40 text-fuchsia-300"
                      : "bg-slate-800/50 border border-white/5 text-slate-500 hover:text-slate-300"
                  }`}>{t}</button>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
              <p className="text-xs font-mono text-rose-300">{error}</p>
            </div>
          )}

          <button onClick={handleValidate} disabled={!hasScenes || validating}
            className="mt-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400 via-cyan-400 to-sky-500 px-6 py-4 text-sm font-bold uppercase tracking-[0.2em] text-slate-950 shadow-[0_0_30px_rgba(34,211,238,0.5)] disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all">
            {validating ? (
              <><svg className="animate-spin h-4 w-4 text-slate-950" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>Analyzing Scenes...</>
            ) : "Validate Script"}
          </button>
        </div>
      </div>
    );
  }

  // ── POST-VALIDATION ──────────────────────────────────────────────────────
  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="mt-8 flex flex-col gap-8">

      {/* Score Board */}
      <motion.div variants={cardVariants}
        className="flex flex-col md:flex-row items-center justify-between rounded-3xl border border-emerald-500/25 bg-emerald-950/15 backdrop-blur-2xl p-6 md:p-8 shadow-[0_0_40px_rgba(16,185,129,0.1)]">
        <div>
          <p className="text-sm uppercase tracking-[0.15em] text-emerald-400 mb-1">Analysis Complete</p>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-100">Script Quality Score</h2>
          {topic && <p className="text-sm text-slate-400 mt-1 italic">&ldquo;{topic}&rdquo;</p>}
          <button
            onClick={handleReValidate}
            disabled={validating || acceptedCount + deniedCount === 0}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500/15 to-fuchsia-500/15 border border-cyan-500/30 text-sm font-bold uppercase tracking-wider text-cyan-300 hover:from-cyan-500/25 hover:to-fuchsia-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {validating ? (
              <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>Re-analyzing...</>
            ) : (
              <><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H5.498a.75.75 0 0 0-.75.75v3.498a.75.75 0 0 0 1.5 0v-1.166l.308.31a7 7 0 0 0 11.57-3.135.75.75 0 0 0-1.454-.374Zm-4.44-9.924a7 7 0 0 0-6.218 3.917.75.75 0 1 0 1.338.672A5.5 5.5 0 0 1 14.542 8.48l.31.31h-2.432a.75.75 0 0 0 0 1.5h3.433a.75.75 0 0 0 .75-.75V6.11a.75.75 0 0 0-1.5 0v1.17l-.308-.31a7 7 0 0 0-3.922-1.47Z" clipRule="evenodd"/></svg>Re-validate Updated Script</>
            )}
          </button>
        </div>
        <div className="mt-4 md:mt-0 flex items-center gap-6">
          <div className="relative w-20 h-20">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="34" stroke="rgba(255,255,255,0.05)" strokeWidth="6" fill="none"/>
              <circle cx="40" cy="40" r="34" stroke="url(#sg)" strokeWidth="6" fill="none"
                strokeDasharray={`${2*Math.PI*34}`}
                strokeDashoffset={`${2*Math.PI*34*(1-(result.analysis.score??0)/100)}`}
                strokeLinecap="round"/>
              <defs><linearGradient id="sg" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#34d399"/><stop offset="100%" stopColor="#22d3ee"/></linearGradient></defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">{result.analysis.score}</span>
            </div>
          </div>
          <div className="text-sm text-slate-400 flex flex-col gap-0.5">
            <span className="font-bold text-emerald-400 text-lg">/ 100</span>
            <span>Quality Rating</span>
            <span className="text-xs text-slate-600 capitalize">{tone}</span>
          </div>
          <div className="hidden md:flex flex-col gap-1.5 border-l border-white/10 pl-6">
            {[["pending", pendingCount, "text-amber-400"], ["accepted", acceptedCount, "text-emerald-400"], ["denied", deniedCount, "text-rose-400"]].map(([label, count, cls]) => (
              <div key={String(label)} className="flex items-center gap-2 text-sm">
                <span className={`w-1.5 h-1.5 rounded-full ${cls}`} />
                <span className="text-slate-400">{count} {label}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Critique */}
      {result.analysis.critique.length > 0 && (
        <motion.div variants={cardVariants} className="rounded-3xl border border-amber-500/20 bg-amber-950/10 backdrop-blur-2xl p-6">
          <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-amber-400 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />Critic&apos;s Notes
          </h3>
          <div className="flex flex-col gap-3">
            {result.analysis.critique.map((point, i) => (
              <div key={i} className="flex items-start gap-3 text-sm text-slate-300 leading-relaxed">
                <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400 text-xs font-bold flex items-center justify-center">{i+1}</span>
                {point}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Operations */}
      {result.operations.length > 0 && (
        <motion.div variants={cardVariants} className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-slate-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-fuchsia-400 animate-pulse" />
              Scene Operations ({result.operations.length})
            </h3>
            <div className="flex gap-2">
              <button onClick={acceptAll} className="px-3 py-1.5 rounded-lg text-sm font-bold uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/20 transition-colors">Accept All</button>
              <button onClick={denyAll}   className="px-3 py-1.5 rounded-lg text-sm font-bold uppercase tracking-wider bg-rose-500/10 border border-rose-500/25 text-rose-300 hover:bg-rose-500/20 transition-colors">Deny All</button>
              {(acceptedCount > 0 || deniedCount > 0) && (
                <button onClick={resetAll} className="px-3 py-1.5 rounded-lg text-sm font-bold uppercase tracking-wider bg-slate-700/50 border border-slate-600 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors">Reset All</button>
              )}
            </div>
          </div>
          <motion.div variants={containerVariants} className="flex flex-col gap-3">
            {result.operations.map((op, i) => (
              <OperationCard key={i} op={op} index={i} originals={scenes}
                status={statuses[i] ?? "pending"}
                onAccept={() => accept(i)}
                onDeny={() => deny(i)}
                onReset={() => reset(i)}
              />
            ))}
          </motion.div>
        </motion.div>
      )}

      {/* Live Preview */}
      <motion.div variants={cardVariants} className="rounded-3xl border border-fuchsia-500/20 bg-fuchsia-950/8 backdrop-blur-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-fuchsia-400 animate-pulse" />
            <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-fuchsia-300">Updated Script Preview</h3>
          </div>
          <span className="text-sm text-slate-500 font-mono">
            {liveScenes.length} scenes · {acceptedCount} change{acceptedCount !== 1 ? "s" : ""} applied
          </span>
        </div>
        <div className="p-5 space-y-3">
          {liveScenes.map(scene => (
            <div key={scene.scene_number}
              className={`rounded-2xl border p-4 transition-colors ${
                scene.status === "rewritten" ? "border-amber-500/25 bg-amber-950/15"  :
                scene.status === "added"     ? "border-emerald-500/25 bg-emerald-950/15" :
                scene.status === "merged"    ? "border-blue-500/25 bg-blue-950/15"   :
                scene.status === "split"     ? "border-violet-500/25 bg-violet-950/15":
                "border-white/5 bg-slate-950/40"
              }`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-mono uppercase tracking-[0.2em] text-cyan-400">
                  Scene {String(scene.scene_number).padStart(2, "0")}
                </span>
                {scene.status !== "original" && (
                  <span className={`text-sm font-bold uppercase tracking-wider border px-2 py-1 rounded-full ${STATUS_BADGE[scene.status]}`}>
                    {scene.status}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-200 leading-relaxed">{scene.script_dialogue}</p>
              {scene.veo_prompt && (
                <p className="mt-2 text-sm text-slate-400 italic">
                  <span className="text-violet-400 font-bold not-italic">VEO: </span>
                  {scene.veo_prompt.slice(0, 120)}{scene.veo_prompt.length > 120 ? "…" : ""}
                </p>
              )}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Download buttons */}
      <motion.div variants={cardVariants} className="flex flex-col sm:flex-row gap-4 justify-center pb-8">
        {result.pdf_download_url && (
          <a href={result.pdf_download_url} target="_blank" rel="noreferrer"
            className="inline-flex items-center justify-center gap-3 rounded-2xl bg-white/5 border border-white/10 px-6 py-4 text-sm font-bold uppercase tracking-widest text-slate-300 hover:bg-white/10 hover:text-white transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-cyan-400">
              <path fillRule="evenodd" d="M10 3a.75.75 0 0 1 .75.75v6.827l2.122-2.122a.75.75 0 1 1 1.06 1.06l-3.404 3.405a.75.75 0 0 1-1.06 0L6.07 8.515a.75.75 0 1 1 1.06-1.06l2.12 2.122V3.75A.75.75 0 0 1 10 3ZM4.25 15a.75.75 0 0 1 .75-.75h10a.75.75 0 0 1 0 1.5H5a.75.75 0 0 1-.75-.75Z" clipRule="evenodd"/>
            </svg>
            Download Audit PDF
          </a>
        )}
        <button onClick={handleDownloadScript}
          className="inline-flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-violet-500 px-6 py-4 text-sm font-black uppercase tracking-widest text-slate-950 shadow-[0_0_30px_rgba(168,85,247,0.4)] hover:opacity-90 transition-opacity">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z"/>
            <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z"/>
          </svg>
          Download Updated Script
          {acceptedCount > 0 && (
            <span className="bg-slate-950/30 px-2 py-0.5 rounded-full text-xs font-bold">
              {acceptedCount} change{acceptedCount !== 1 ? "s" : ""}
            </span>
          )}
        </button>
      </motion.div>

      {/* SEO & Tags CTA */}
      {projectId && (
        <motion.div variants={cardVariants} className="rounded-3xl border border-emerald-500/20 bg-emerald-950/10 backdrop-blur-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-5 pb-8">
          <div className="flex-1">
            <p className="text-sm font-bold uppercase tracking-[0.15em] text-emerald-400 mb-1 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Next Step — SEO & Tags
            </p>
            <p className="text-base text-slate-300">Your script is validated. Now let the Algorithm Whisperer generate tags, descriptions and community post strategies.</p>
            {seoError && <p className="mt-2 text-sm text-rose-400 font-mono">{seoError}</p>}
            {seoSuccess && <p className="mt-2 text-sm text-emerald-400 font-semibold">✓ SEO generated! Head to the Algorithm Whisperer to see your results.</p>}
          </div>
          <div className="flex-shrink-0">
            {seoSuccess ? (
              <a
                href={`/tools/yt-studio/algorithm-whisperer?projectId=${projectId}`}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-400 px-6 py-4 text-sm font-black uppercase tracking-widest text-slate-950 shadow-[0_0_30px_rgba(16,185,129,0.4)] hover:opacity-90 transition-opacity"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
                </svg>
                View SEO Results
              </a>
            ) : (
              <button
                onClick={handleGenerateSEO}
                disabled={seoLoading}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 px-6 py-4 text-sm font-black uppercase tracking-widest text-emerald-300 hover:from-emerald-500/30 hover:to-teal-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {seoLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                    Generating SEO... (up to 2 min)
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                      <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
                    </svg>
                    Generate SEO & Tags
                  </>
                )}
              </button>
            )}
          </div>
        </motion.div>
      )}

    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

function QualityCriticPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialTopic = searchParams.get("topic") ? decodeURIComponent(searchParams.get("topic")!) : undefined;
  const projectId = searchParams.get("projectId") ?? undefined;
  const initialNiche = searchParams.get("niche") ? decodeURIComponent(searchParams.get("niche")!) : undefined;

  // Script is no longer passed via URL (caused HTTP 431 for long scripts).
  // We fetch it from the DB in QualityCriticWorkspace using projectId instead.
  const initialScenes: ArchitectScene[] | undefined = undefined;

  return (
    <div className="relative min-h-[100dvh] w-full text-slate-200 font-sans overflow-y-auto p-6 md:p-12">
      <div className="fixed inset-0 -z-10 bg-slate-950">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(244,114,182,0.18),transparent_50%),radial-gradient(circle_at_bottom_right,_rgba(168,85,247,0.18),transparent_50%)]"/>
      </div>
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="relative z-10 max-w-7xl mx-auto">
        <div className="flex items-center gap-5 mb-2">
          <motion.button onClick={() => router.back()} whileHover={{ scale: 1.08, x: -4 }} whileTap={{ scale: 0.9 }}
            className="flex-shrink-0 w-11 h-11 rounded-full bg-white/5 border border-rose-300/35 flex items-center justify-center text-rose-200 hover:bg-rose-500/10">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"/>
            </svg>
          </motion.button>
          <div>
            <motion.h1 variants={cardVariants}
              className="text-3xl md:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-fuchsia-500 to-purple-500">
              THE QUALITY CRITIC
            </motion.h1>
            <motion.p variants={cardVariants} className="mt-1.5 text-sm text-slate-400">
              {initialTopic ? `Analyzing: "${initialTopic}"` : "Scene-by-scene AI audit — rewrites, additions, deletions, merges, and splits."}
            </motion.p>
          </div>
        </div>
        <QualityCriticWorkspace
          initialScenes={initialScenes}
          initialTopic={initialTopic}
          initialNiche={initialNiche}
          projectId={projectId}
        />
      </motion.div>
    </div>
  );
}
// Next.js 14 requires useSearchParams() to be inside a Suspense boundary.
// This wrapper satisfies that constraint without changing any component logic.
export default function QualityCriticRoot() {
  return (
    <Suspense>
      <QualityCriticPage />
    </Suspense>
  );
}
