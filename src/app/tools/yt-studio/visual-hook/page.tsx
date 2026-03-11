"use client";

import React, { Suspense, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";

// ─── Types ────────────────────────────────────────────────────────────────────

interface VisualHookEntry {
  id: string;
  prompt: string;
  videoUrl: string;
  model: "veo3" | "grok";
  createdAt: string;
}

interface VisualHookDocument {
  id: string;
  projectId: string;
  data: {
    history?: VisualHookEntry[];
    currentEntry?: VisualHookEntry;
  };
  createdAt: string;
  updatedAt: string;
}

interface ApiGetResponse {
  document: VisualHookDocument | null;
}

interface ApiGenerateResponse {
  videoUrl: string;
}

// ─── Animation Variants ───────────────────────────────────────────────────────

const containerVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 30, scale: 0.96 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 120, damping: 20 },
  },
};

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.25 } },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function proxyUrl(url: string): string {
  // Route xAI CORS-blocked domains through our server proxy
  try {
    const parsed = new URL(url);
    const CORS_BLOCKED = ["vidgen.x.ai", "cdn.x.ai"];
    if (CORS_BLOCKED.some(h => parsed.hostname === h || parsed.hostname.endsWith("." + h))) {
      return `/api/video-proxy?url=${encodeURIComponent(url)}`;
    }
  } catch {}
  return url;
}

function VideoPlayer({ url }: { url: string }) {
  const [errored, setErrored] = React.useState(false);
  const proxied = proxyUrl(url);
  React.useEffect(() => { setErrored(false); }, [url]);
  return (
    <div className="relative w-full rounded-2xl overflow-hidden bg-black/40 border border-white/10">
      {errored ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 px-6 text-center">
          <svg className="w-10 h-10 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-sm text-rose-300 font-medium">Could not play video</p>
          <p className="text-xs text-slate-400">Click to open in a new tab:</p>
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="text-xs font-mono text-indigo-400 underline underline-offset-2 break-all px-4">{url}</a>
        </div>
      ) : (
        <video
          key={proxied}
          src={proxied}
          controls
          preload="metadata"
          onError={() => setErrored(true)}
          className="w-full aspect-video object-contain"
          style={{ background: "#080b12" }}
        />
      )}
    </div>
  );
}

function HistoryItem({ entry, index }: { entry: VisualHookEntry; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="show"
      exit="exit"
      custom={index}
      layout
      className="group relative rounded-2xl border border-indigo-300/20 bg-slate-800/60 backdrop-blur-md overflow-hidden transition-all duration-300 hover:border-indigo-300/40 hover:bg-slate-800/80"
    >
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-start justify-between gap-4 px-5 py-4 text-left"
      >
        <div className="flex-1 min-w-0">
          <p className="text-base text-white leading-relaxed line-clamp-2">{entry.prompt}</p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-slate-300">
              {new Date(entry.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </p>
            <span className="text-slate-600">·</span>
            <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md border ${entry.model === "veo3"
              ? "text-cyan-300 bg-cyan-400/10 border-cyan-300/25"
              : "text-violet-300 bg-violet-400/10 border-violet-300/25"
              }`}>
              {entry.model === "veo3" ? "VEO3" : "GROK"}
            </span>
          </div>
        </div>
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.25 }}
          className="flex-shrink-0 mt-0.5 w-6 h-6 rounded-full bg-indigo-400/10 border border-indigo-300/30 flex items-center justify-center"
        >
          <svg className="w-3 h-3 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5">
              <div className="w-full h-px bg-indigo-300/10 mb-4" />
              <VideoPlayer url={entry.videoUrl} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Spinner() {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
      className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white"
    />
  );
}

function SkeletonCard() {
  return (
    <motion.div
      animate={{ opacity: [0.4, 0.7, 0.4] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      className="h-14 rounded-2xl bg-slate-800/60 border border-indigo-300/10"
    />
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

type ToastType = "success" | "error" | "warning";
interface ToastState { message: string; type: ToastType; id: number; }

function Toast({ toast }: { toast: ToastState }) {
  const styles: Record<ToastType, string> = {
    success: "border-cyan-400/40 bg-cyan-400/10 text-cyan-300",
    error: "border-red-400/40 bg-red-400/10 text-red-300",
    warning: "border-violet-400/40 bg-violet-400/10 text-violet-300",
  };
  const icons: Record<ToastType, string> = { success: "✓", error: "✕", warning: "⚠" };
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-xl text-sm font-medium shadow-2xl ${styles[toast.type]}`}
    >
      <span>{icons[toast.type]}</span>
      {toast.message}
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function VisualHookPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? "";

  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<"veo3" | "grok">("veo3");
  const [xaiApiKey, setXaiApiKey] = useState("");
  const [keyVisible, setKeyVisible] = useState(false);
  // Reference image state
  const [refImage, setRefImage] = useState<{ base64: string; mimeType: string; previewUrl: string } | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [history, setHistory] = useState<VisualHookEntry[]>([]);
  const [currentEntry, setCurrentEntry] = useState<VisualHookEntry | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const videoRef = useRef<HTMLDivElement>(null);

  // ── Reference image handler ──────────────────────────────────────────────
  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!ALLOWED.includes(file.type)) { setError("Unsupported image type. Use JPEG, PNG, WebP or GIF."); return; }
    if (file.size > 7.5 * 1024 * 1024) { setError("Image too large (max 7.5 MB)."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const base64 = dataUrl.split(",")[1];
      setRefImage({ base64, mimeType: file.type, previewUrl: dataUrl });
    };
    reader.readAsDataURL(file);
  }
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function showToast(message: string, type: ToastType) {
    const id = Date.now();
    setToasts((p) => [...p, { message, type, id }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3500);
  }

  function handlePromptChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setPrompt(e.target.value);
    if (error) setError(null);
    e.target.style.height = "auto";
    e.target.style.height = `${e.target.scrollHeight}px`;
  }

  useEffect(() => {
    async function loadHistory() {
      setIsFetching(true);
      try {
        const res = await fetch(`/api/yt-projects/${projectId}/visual-hook`);
        if (!res.ok) throw new Error(`Failed to load (${res.status})`);
        const json: ApiGetResponse = await res.json();
        if (json.document?.data) {
          setHistory(json.document.data.history ?? []);
          if (json.document.data.currentEntry) setCurrentEntry(json.document.data.currentEntry);
        }
      } catch {
        showToast("Could not load history", "warning");
      } finally {
        setIsFetching(false);
      }
    }
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function handleGenerate() {
    const trimmed = prompt.trim();
    if (!trimmed) { setError("Please enter a prompt before generating."); return; }
    if (!xaiApiKey.trim()) { setError("Please enter your xAI API key."); return; }
    if (!projectId) { setError("No project selected. Please open this page from a project."); return; }
    setError(null);
    setIsLoading(true);
    try {
      const genRes = await fetch(`/api/yt-projects/${projectId}/visual-hook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: trimmed,
          model,
          xaiApiKey: xaiApiKey.trim(),
          image: refImage ? { base64: refImage.base64, mimeType: refImage.mimeType } : undefined,
        }),
      });
      if (!genRes.ok) {
        const errJson = await genRes.json().catch(() => ({}));
        throw new Error(errJson?.error ?? `Generation failed (${genRes.status})`);
      }
      const genData = await genRes.json();

      // The API returns a job_id — poll for completion (same pattern as xai-video-generate)
      // Log raw response shape so we can see what the API actually returns
      console.info("[VisualHook] raw generate response:", JSON.stringify(genData).slice(0, 500));
      let videoUrl: string = genData.video_url ?? genData.url ?? genData.output ?? genData.videoUrl ?? "";

      const resolvedJobId: string | undefined = genData.job_id ?? genData.id ?? genData.jobId;
      if (!videoUrl && resolvedJobId) {
        const jobId: string = resolvedJobId;
        const MAX_POLLS = 36; // 36 × 5s = 3 min
        for (let i = 0; i < MAX_POLLS; i++) {
          await new Promise(r => setTimeout(r, 5000));
          try {
            const pollRes = await fetch(`/api/yt-projects/${projectId}/visual-hook?jobId=${encodeURIComponent(jobId)}`, {
              headers: { "x-xai-key": xaiApiKey.trim() },
            });
            const pollData = await pollRes.json();
            console.info("[VisualHook] poll response:", JSON.stringify(pollData).slice(0, 500));
            if (pollData.video_url || pollData.url || pollData.output || pollData.videoUrl) {
              videoUrl = pollData.video_url ?? pollData.url ?? pollData.output ?? pollData.videoUrl;
              break;
            }
            if (pollData.status === "error" || pollData.status === "failed") {
              throw new Error(pollData.error ?? "Video generation failed on server");
            }
          } catch (pollErr) {
            if (pollErr instanceof Error && pollErr.message.includes("failed")) throw pollErr;
          }
        }
      }

      if (!videoUrl) throw new Error("No video URL returned. The job may still be processing — please try again shortly.");
      const newEntry: VisualHookEntry = {
        id: crypto.randomUUID(),
        prompt: trimmed,
        videoUrl,
        model,
        createdAt: new Date().toISOString(),
      };
      const updatedHistory = currentEntry ? [currentEntry, ...history] : [...history];
      setCurrentEntry(newEntry);
      setHistory(updatedHistory);
      await fetch(`/api/yt-projects/${projectId}/visual-hook`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: { history: updatedHistory, currentEntry: newEntry } }),
      });
      setTimeout(() => videoRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
      showToast("Video generated successfully", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(message);
      showToast(message, "error");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="relative min-h-[100dvh] w-full text-slate-200 font-sans overflow-hidden p-6 md:p-12">

      {/* ── Background ── */}
      <div className="fixed inset-0 -z-10 bg-slate-950">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(129,140,248,0.2),transparent_55%),radial-gradient(circle_at_bottom_left,_rgba(56,189,248,0.22),transparent_55%)]" />
      </div>

      {/* ── Toast ── */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 items-end">
        <AnimatePresence>
          {toasts.map((t) => <Toast key={t.id} toast={t} />)}
        </AnimatePresence>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="relative z-10 flex flex-col gap-8 max-w-3xl mx-auto"
      >

        {/* ── Header ── */}
        <div className="flex items-center gap-6">
          <motion.button
            onClick={() => router.back()}
            whileHover={{ scale: 1.08, x: -4 }}
            whileTap={{ scale: 0.9 }}
            className="flex items-center justify-center w-11 h-11 rounded-full bg-white/5 border border-indigo-300/40 backdrop-blur-md text-indigo-200 hover:bg-indigo-500/10"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </motion.button>

          <div>
            <motion.h1
              variants={cardVariants}
              className="text-3xl md:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-500 to-cyan-400"
            >
              THE VISUAL HOOK
            </motion.h1>
            <motion.p variants={cardVariants} className="mt-2 max-w-xl text-sm md:text-base text-violet-300/80">
              Generate those first three seconds that freeze the scroll.
            </motion.p>
          </div>
        </div>

        {/* ── xAI API Key Panel ── */}
        <motion.div variants={cardVariants}
          className={`rounded-3xl border backdrop-blur-2xl p-6 ${xaiApiKey ? "border-indigo-500/25 bg-indigo-950/10" : "border-white/10 bg-slate-900/60"}`}>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${xaiApiKey ? "bg-indigo-500 text-slate-950" : "bg-amber-500/20 border border-amber-500/40 text-amber-400"}`}>
                {xaiApiKey ? "✓" : "!"}
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-indigo-300">xAI API Key</p>
                <p className="text-[11px] text-slate-400">{xaiApiKey ? "Key active — ready to generate" : "Required to generate visual hooks"}</p>
              </div>
            </div>
            <div className="relative">
              <input
                type={keyVisible ? "text" : "password"}
                value={xaiApiKey}
                onChange={(e) => setXaiApiKey(e.target.value.trim())}
                placeholder="Enter your xAI API key (not stored on server)"
                className="w-full bg-slate-800/70 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-mono text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-400 pr-16"
              />
              {xaiApiKey && (
                <button onClick={() => setKeyVisible(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-widest text-slate-400 hover:text-slate-200">
                  {keyVisible ? "Hide" : "Show"}
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-500">Get your key at <span className="text-indigo-400">console.x.ai</span>. Used only for this session, never stored.</p>
          </div>
        </motion.div>

        {/* ── Main Card ── */}
        <motion.div
          variants={cardVariants}
          className="rounded-3xl border border-white/10 bg-slate-900/60 px-6 py-8 md:px-10 md:py-10 backdrop-blur-2xl flex flex-col gap-8"
        >

          {/* Section 1 — History */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-cyan-400 uppercase tracking-widest">
                Previous Hooks
              </span>
              <AnimatePresence>
                {history.length > 0 && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="text-sm font-semibold text-cyan-300 bg-cyan-400/10 border border-cyan-300/30 rounded-full px-2.5 py-0.5"
                  >
                    {history.length}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            {isFetching ? (
              <div className="flex flex-col gap-3">
                <SkeletonCard /><SkeletonCard /><SkeletonCard />
              </div>
            ) : history.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-10 rounded-2xl border border-dashed border-indigo-300/20 flex flex-col items-center justify-center gap-2"
              >
                <div className="w-10 h-10 rounded-full bg-indigo-400/10 border border-indigo-300/20 flex items-center justify-center mb-1">
                  <svg className="w-5 h-5 text-indigo-300/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </div>
                <p className="text-base text-indigo-300">No previous hooks yet</p>
                <p className="text-sm text-slate-400">Generate your first one below</p>
              </motion.div>
            ) : (
              <div className="flex flex-col gap-3">
                <AnimatePresence>
                  {history.map((entry, i) => <HistoryItem key={entry.id} entry={entry} index={i} />)}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-indigo-300/20 to-transparent" />
            <span className="text-xs text-violet-400 uppercase tracking-widest font-semibold">New Hook</span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-indigo-300/20 to-transparent" />
          </div>

          {/* ── Model Toggle ── */}
          <div className="flex flex-col gap-3">
            <label className="text-sm font-semibold text-cyan-400 uppercase tracking-widest">
              Model
            </label>
            <div className="flex items-center gap-2">
              {(["veo3", "grok"] as const).map((m) => (
                <motion.button
                  key={m}
                  onClick={() => setModel(m)}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="relative px-5 py-2 rounded-xl text-base font-bold tracking-widest uppercase transition-all duration-200 overflow-hidden"
                >
                  {/* Active bg */}
                  <AnimatePresence>
                    {model === m && (
                      <motion.div
                        layoutId="model-active-bg"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className={`absolute inset-0 rounded-xl ${m === "veo3"
                          ? "bg-gradient-to-r from-indigo-500/40 to-cyan-500/40 border border-cyan-400/40"
                          : "bg-gradient-to-r from-violet-500/40 to-indigo-500/40 border border-violet-400/40"
                          }`}
                      />
                    )}
                  </AnimatePresence>
                  {/* Inactive bg */}
                  {model !== m && (
                    <div className="absolute inset-0 rounded-xl border border-indigo-300/15 bg-slate-800/40" />
                  )}
                  <span className={`relative transition-colors duration-200 ${model === m
                    ? m === "veo3" ? "text-cyan-200" : "text-violet-200"
                    : "text-slate-500 hover:text-slate-300"
                    }`}>
                    {m === "veo3" ? "VEO3" : "GROK"}
                  </span>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Section 2 — Prompt */}
          <div className="flex flex-col gap-3">
            <label className="text-sm font-semibold text-cyan-400 uppercase tracking-widest">
              Your Prompt
            </label>
            <div className={`relative rounded-2xl border transition-all duration-300 ${error
              ? "border-red-400/50 bg-red-400/5"
              : "border-indigo-300/20 bg-slate-800/50 focus-within:border-indigo-400/60 focus-within:bg-slate-800/70"
              }`}>
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={handlePromptChange}
                disabled={isLoading}
                placeholder="Describe your visual hook — e.g. 'A slow-motion shot of coffee dripping into a glass cup, backlit by golden morning light...'"
                rows={2}
                className="w-full bg-transparent px-5 py-4 text-base text-white placeholder-slate-400 resize-none outline-none leading-relaxed min-h-[112px]"
                style={{ overflow: "hidden" }}
              />
              <div className="absolute bottom-3 right-4 text-xs text-indigo-400/70">{prompt.length}</div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -6, height: 0 }}
                  className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-red-400/25 bg-red-400/8 text-red-300 text-sm overflow-hidden"
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  {error}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Section 2b — Reference Image (optional) */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-violet-400 uppercase tracking-widest">
                Reference Image <span className="text-slate-500 normal-case font-normal tracking-normal">optional</span>
              </label>
              {refImage && (
                <button onClick={() => { setRefImage(null); if (imageInputRef.current) imageInputRef.current.value = ""; }}
                  className="text-xs text-rose-400 hover:text-rose-300 transition-colors">
                  Remove
                </button>
              )}
            </div>
            {refImage ? (
              <div className="relative h-48 rounded-2xl overflow-hidden border border-violet-300/20 bg-slate-800/40">
                <Image
                  src={refImage.previewUrl}
                  alt="Reference"
                  fill
                  unoptimized
                  className="object-cover"
                />
                <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm text-xs text-violet-300 px-2 py-1 rounded-lg">
                  Reference image set
                </div>
              </div>
            ) : (
              <button onClick={() => imageInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 py-8 rounded-2xl border border-dashed border-violet-300/20 bg-slate-800/20 hover:border-violet-300/40 hover:bg-slate-800/40 transition-all text-slate-400 hover:text-violet-300">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
                <p className="text-sm font-medium">Upload reference image</p>
                <p className="text-xs text-slate-500">JPEG, PNG, WebP or GIF · max 7.5 MB</p>
              </button>
            )}
            <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleImageSelect} className="hidden" />
          </div>

          {/* Section 3 — Generate */}
          <motion.button
            onClick={handleGenerate}
            disabled={isLoading || !prompt.trim() || !xaiApiKey.trim()}
            whileHover={isLoading || !prompt.trim() || !xaiApiKey.trim() ? {} : { scale: 1.015, y: -2 }}
            whileTap={isLoading || !prompt.trim() || !xaiApiKey.trim() ? {} : { scale: 0.985 }}
            className="relative w-full rounded-2xl font-bold text-base overflow-hidden disabled:opacity-40 disabled:cursor-not-allowed transition-opacity duration-200"
            style={{ height: "52px" }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-500" />
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400 opacity-0 hover:opacity-100 transition-opacity duration-300" />
            <div className="absolute inset-0 bg-[linear-gradient(105deg,transparent_40%,rgba(255,255,255,0.1)_50%,transparent_60%)]" />
            <span className="relative flex items-center justify-center gap-2.5 text-white">
              {isLoading ? (
                <><Spinner /><span>Generating…</span></>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.82m5.84-2.56a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.63 2v5.84m6 2.53a6 6 0 01-7.38 5.84H4.07m7.52-7.38a6 6 0 00-5.84-5.84" />
                  </svg>
                  {currentEntry ? "Generate New Video" : "Generate Video"}
                </>
              )}
            </span>
          </motion.button>

          {/* Section 4 — Current Video */}
          <AnimatePresence>
            {currentEntry && (
              <motion.div
                ref={videoRef}
                key={currentEntry.id}
                variants={fadeInUp}
                initial="hidden"
                animate="show"
                exit="exit"
                className="flex flex-col gap-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-cyan-400 uppercase tracking-widest">
                    Generated Video
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md border ${currentEntry.model === "veo3"
                      ? "text-cyan-300 bg-cyan-400/10 border-cyan-300/25"
                      : "text-violet-300 bg-violet-400/10 border-violet-300/25"
                      }`}>
                      {currentEntry.model === "veo3" ? "VEO3" : "GROK"}
                    </span>
                    <motion.span
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center gap-1.5 text-sm font-semibold text-cyan-300 bg-cyan-400/10 border border-cyan-300/25 rounded-full px-2.5 py-0.5"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      Latest
                    </motion.span>
                  </div>
                </div>

                <div className="rounded-2xl border border-indigo-300/20 bg-slate-800/50 p-4">
                  <p className="text-sm text-slate-300 mb-3 line-clamp-1">
                    <span className="text-indigo-300 font-semibold">Prompt:</span> {currentEntry.prompt}
                  </p>
                  <VideoPlayer url={currentEntry.videoUrl} />
                </div>

                {/* Section 5 — Regenerate */}
                <motion.button
                  onClick={handleGenerate}
                  disabled={isLoading}
                  whileHover={isLoading ? {} : { scale: 1.01, y: -1 }}
                  whileTap={isLoading ? {} : { scale: 0.99 }}
                  className="w-full h-12 rounded-2xl border border-cyan-400/25 bg-cyan-400/5 hover:bg-cyan-400/10 hover:border-cyan-400/40 text-cyan-300 hover:text-cyan-100 text-base font-medium transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <><Spinner /><span>Regenerating…</span></>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                      </svg>
                      Regenerate with {model === "veo3" ? "VEO3" : "GROK"}
                    </>
                  )}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

        </motion.div>
      </motion.div>
    </div>
  );
}
// Next.js 14 requires useSearchParams() to be inside a Suspense boundary.
// This wrapper satisfies that constraint without changing any component logic.
export default function VisualHookRoot() {
  return (
    <Suspense>
      <VisualHookPage />
    </Suspense>
  );
}
