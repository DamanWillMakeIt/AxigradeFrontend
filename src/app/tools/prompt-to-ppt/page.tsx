


"use client";

import { useState, useEffect, useRef } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────
interface GeneratedPdf {
  pdfUrl: string;
  generatedAt: string;
}

interface PptGeneration {
  _id: string;
  prompt: string;
  numPages: number;
  colors: { primary: string; secondary: string; accent: string };
  pdfs: GeneratedPdf[];
  createdAt: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function hueToHex(hue: number): string {
  const h = hue / 360;
  const r = Math.round(hueToRgb(h + 1 / 3) * 255);
  const g = Math.round(hueToRgb(h) * 255);
  const b = Math.round(hueToRgb(h - 1 / 3) * 255);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function hueToRgb(t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return 6 * t;
  if (t < 1 / 2) return 1;
  if (t < 2 / 3) return (2 / 3 - t) * 6;
  return 0;
}

function hexToHue(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return Math.round((h / 6) * 360);
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function Spinner() {
  return (
    <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-white/20 border-t-white animate-spin flex-shrink-0" />
  );
}

// ── SPECTRUM SLIDER (vertical, left sidebar) ───────────────────────────────────
function SpectrumSlider({ hue, onChange }: { hue: number; onChange: (h: number) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const getHueFromEvent = (clientY: number) => {
    const rect = trackRef.current!.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    return Math.round(ratio * 360);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    onChange(getHueFromEvent(e.clientY));
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    onChange(getHueFromEvent(e.clientY));
  };
  const onPointerUp = () => { isDragging.current = false; };

  const thumbTop = `${(hue / 360) * 100}%`;
  const thumbColor = hueToHex(hue);

  return (
    <div className="relative flex justify-center select-none" style={{ height: "100%" }}>
      {/* Rainbow track */}
      <div
        ref={trackRef}
        className="w-5 rounded-full cursor-crosshair relative"
        style={{
          background: "linear-gradient(to bottom, #ff0000, #ff8000, #ffff00, #00ff00, #00ffff, #0000ff, #8000ff, #ff00ff, #ff0000)",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.1)",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {/* Thumb */}
        <div
          className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 border-white shadow-lg pointer-events-none transition-none"
          style={{ top: thumbTop, background: thumbColor, boxShadow: `0 0 0 3px rgba(0,0,0,0.4), 0 0 12px ${thumbColor}88` }}
        />
      </div>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function PromptToPptPage() {
  const [generations, setGenerations] = useState<PptGeneration[]>([]);
  const [prompt, setPrompt] = useState("");
  const [numPages, setNumPages] = useState(8);
  const [hues, setHues] = useState({ primary: 220, secondary: 280, accent: 30 });
  const [hexInputs, setHexInputs] = useState({ primary: "#3b6aff", secondary: "#9333ea", accent: "#f97316" });
  const [isGenerating, setIsGenerating] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [activeGeneration, setActiveGeneration] = useState<PptGeneration | null>(null);
  const [activePdfIndex, setActivePdfIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fetchingAll, setFetchingAll] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  type ColorKey = "primary" | "secondary" | "accent";
  const colors = {
    primary: hueToHex(hues.primary),
    secondary: hueToHex(hues.secondary),
    accent: hueToHex(hues.accent),
  };

  const setHue = (key: ColorKey, h: number) => {
    setHues((prev) => ({ ...prev, [key]: h }));
    setHexInputs((prev) => ({ ...prev, [key]: hueToHex(h) }));
  };

  const handleHexInput = (key: ColorKey, val: string) => {
    setHexInputs((prev) => ({ ...prev, [key]: val }));
    if (/^#[0-9a-fA-F]{6}$/.test(val)) setHues((prev) => ({ ...prev, [key]: hexToHue(val) }));
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/ppt-generations");
        const json = await res.json();
        if (json.success) setGenerations(json.data);
      } catch { /* silent */ }
      finally { setFetchingAll(false); }
    })();
  }, []);

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
    const el = textareaRef.current;
    if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/ppt-generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), numPages, colors }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      const updated: PptGeneration = json.data;
      setGenerations((prev) => {
        const idx = prev.findIndex((g) => g._id === updated._id);
        if (idx >= 0) { const c = [...prev]; c[idx] = updated; return c; }
        return [updated, ...prev];
      });
      setActiveGeneration(updated);
      setActivePdfIndex(updated.pdfs.length - 1);
      setShowModal(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally { setIsGenerating(false); }
  };

  const handleRegenerate = async (gen: PptGeneration) => {
    setRegeneratingId(gen._id);
    setError(null);
    try {
      const res = await fetch(`/api/ppt-generations/${gen._id}`, { method: "PATCH" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      const updated: PptGeneration = json.data;
      setGenerations((prev) => prev.map((g) => (g._id === updated._id ? updated : g)));
      setActiveGeneration(updated);
      setActivePdfIndex(updated.pdfs.length - 1);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Regeneration failed");
    } finally { setRegeneratingId(null); }
  };

  const openGeneration = (gen: PptGeneration) => {
    setActiveGeneration(gen);
    setActivePdfIndex(gen.pdfs.length - 1);
    setShowModal(true);
  };

  return (
    <div className="flex flex-col h-screen bg-[#080810] text-white overflow-hidden">

      {/* ── TOP BAR ── */}
      <header className="flex items-center h-14 border-b border-white/[0.06] bg-[#080810]/90 backdrop-blur-xl shrink-0 z-10">
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-5 border-r border-white/[0.06] h-full shrink-0 min-w-[168px]">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shrink-0">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="1" y="1" width="4" height="4" rx="1" fill="white" fillOpacity="0.95"/>
              <rect x="7" y="1" width="4" height="4" rx="1" fill="white" fillOpacity="0.4"/>
              <rect x="1" y="7" width="4" height="4" rx="1" fill="white" fillOpacity="0.4"/>
              <rect x="7" y="7" width="4" height="4" rx="1" fill="white" fillOpacity="0.95"/>
            </svg>
          </div>
          <span className="font-bold text-sm tracking-tight">Prompt → PPT</span>
        </div>

        {/* Section label */}
        <span className="px-4 text-[10px] font-semibold tracking-[0.14em] uppercase text-white/25 border-r border-white/[0.06] h-full flex items-center shrink-0">
          Generated PDFs
        </span>

        {/* Chips */}
        <div className="flex items-center gap-1.5 px-3 flex-1 overflow-x-auto h-full" style={{ scrollbarWidth: "none" }}>
          {fetchingAll ? (
            <span className="text-xs text-white/20 italic">Loading…</span>
          ) : generations.length === 0 ? (
            <span className="text-xs text-white/20 italic">Your presentations will appear here once generated</span>
          ) : (
            generations.map((gen) => {
              const isActive = activeGeneration?._id === gen._id && showModal;
              return (
                <button
                  key={gen._id}
                  onClick={() => openGeneration(gen)}
                  className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs shrink-0 transition-all ${
                    isActive
                      ? "border-indigo-500/60 bg-indigo-500/10 text-white/80"
                      : "border-white/[0.07] bg-white/[0.03] text-white/50 hover:border-indigo-500/40 hover:bg-indigo-500/[0.07]"
                  }`}
                >
                  <span className="w-2 h-2 rounded-full border border-white/15 shrink-0" style={{ background: gen.colors.primary }} />
                  <span className="max-w-[130px] truncate">{gen.prompt}</span>
                  {gen.pdfs.length > 1 && (
                    <span className="text-[10px] bg-indigo-500/25 text-violet-300 rounded px-1 font-semibold">
                      v{gen.pdfs.length}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </header>

      {/* ── MAIN LAYOUT ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT SIDEBAR: 3 Spectrum Sliders ── */}
        <aside className="w-24 shrink-0 border-r border-white/[0.06] bg-[#080810]/70 backdrop-blur-xl flex flex-col items-center py-5 gap-4">
          <p className="text-[9px] font-semibold tracking-[0.14em] uppercase text-white/20">Colors</p>

          {(["primary", "secondary", "accent"] as const).map((key) => (
            <div key={key} className="flex flex-col items-center gap-2 flex-1 w-full px-3">
              <span className="text-[9px] uppercase tracking-widest text-white/25 font-semibold">{key}</span>
              {/* Spectrum slider */}
              <div className="flex-1 w-full flex justify-center">
                <SpectrumSlider hue={hues[key]} onChange={(h) => setHue(key, h)} />
              </div>
              {/* Swatch */}
              <div
                className="w-7 h-7 rounded-lg border border-white/20"
                style={{ background: colors[key], boxShadow: `0 0 12px ${colors[key]}55` }}
              />
              {/* Hex input */}
              <input
                type="text"
                value={hexInputs[key]}
                onChange={(e) => handleHexInput(key, e.target.value)}
                className="w-full text-center text-[9px] font-mono bg-white/[0.05] border border-white/10 rounded-md px-1 py-1 text-white/50 focus:outline-none focus:border-white/30 transition-colors"
                maxLength={7}
                spellCheck={false}
              />
            </div>
          ))}
        </aside>

        {/* ── CENTER ── */}
        <main className="flex-1 flex flex-col items-center justify-center gap-7 px-8 py-10 overflow-y-auto">

          {/* Hero */}
          <div className="text-center max-w-lg">
            <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.13em] uppercase text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-3 py-1 mb-4">
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <circle cx="4" cy="4" r="3" stroke="currentColor" strokeWidth="1.1"/>
                <path d="M4 2.2v2l1.1.8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
              </svg>
              AI-Powered Presentations
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight leading-tight mb-3 text-white/95">
              Turn ideas into{" "}
              <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
                beautiful slides
              </span>
            </h1>
            <p className="text-sm text-white/30 leading-relaxed">
              Describe your topic, pick a color from the left bar,<br />and get a polished deck in seconds.
            </p>
          </div>

          {/* Prompt box */}
          <div className="w-full max-w-[580px]">
            <div className="bg-white/[0.04] border border-white/[0.09] rounded-2xl p-4 flex flex-col gap-3 focus-within:border-indigo-500/45 focus-within:shadow-[0_0_0_4px_rgba(99,88,255,0.07)] transition-all">
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={handlePromptChange}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate(); }}
                placeholder="e.g. A 10-slide deck on the future of renewable energy for investors, focusing on solar breakthroughs…"
                className="w-full bg-transparent border-none outline-none text-sm text-white placeholder-white/20 leading-relaxed resize-none min-h-[52px] max-h-[160px] overflow-y-auto"
                rows={3}
              />

              {/* Footer row */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  {/* Slides stepper */}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-white/30">Slides</span>
                    <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg p-1">
                      <button
                        onClick={() => setNumPages(Math.max(3, numPages - 1))}
                        disabled={numPages <= 3}
                        className="w-5 h-5 rounded-md bg-white/5 text-white/50 text-sm flex items-center justify-center hover:bg-indigo-500/20 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      >−</button>
                      <span className="text-sm font-bold text-violet-400 min-w-[20px] text-center">{numPages}</span>
                      <button
                        onClick={() => setNumPages(Math.min(30, numPages + 1))}
                        disabled={numPages >= 30}
                        className="w-5 h-5 rounded-md bg-white/5 text-white/50 text-sm flex items-center justify-center hover:bg-indigo-500/20 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      >+</button>
                    </div>
                  </div>

                  {/* 3 color badges */}
                  <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.07] rounded-lg px-2.5 py-1">
                    {(["primary", "secondary", "accent"] as const).map((key) => (
                      <span key={key} className="w-2.5 h-2.5 rounded-full border border-white/15 shrink-0" style={{ background: colors[key] }} />
                    ))}
                    <span className="text-[11px] font-mono text-white/30 ml-0.5">{colors.primary}</span>
                  </div>
                </div>

                {/* Generate button */}
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !prompt.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-bold hover:shadow-[0_6px_24px_rgba(99,88,255,0.35)] hover:-translate-y-px disabled:opacity-45 disabled:cursor-not-allowed disabled:translate-y-0 transition-all"
                >
                  {isGenerating ? <><Spinner /> Generating…</> : (
                    <>
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                        <path d="M5.5 1v9M1 5.5h9" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                      </svg>
                      Generate
                    </>
                  )}
                </button>
              </div>
            </div>
            <p className="text-center text-[11px] text-white/15 mt-2">⌘ + Enter to generate</p>
          </div>

          {error && (
            <div className="w-full max-w-[580px] bg-red-500/[0.07] border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}
        </main>

        {/* ── RIGHT SIDEBAR: Theme previews ── */}
        <aside className="w-52 shrink-0 border-l border-white/[0.06] bg-[#080810]/70 backdrop-blur-xl flex flex-col overflow-y-auto" style={{ scrollbarWidth: "none" }}>
          <div className="sticky top-0 px-4 pt-5 pb-3 border-b border-white/[0.05] bg-[#080810]/90 backdrop-blur-md z-10">
            <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-white/25">Sample Themes</p>
            <p className="text-[11px] text-white/15 mt-0.5">Click to apply color</p>
          </div>

          <div className="flex flex-col gap-1.5 p-2.5">
            {[
              { label: "Ocean Blue",   colorCode: "#0369a1", preview: ["#0369a1", "#0284c7", "#38bdf8", "#e0f2fe"] },
              { label: "Royal Purple", colorCode: "#7c3aed", preview: ["#7c3aed", "#a855f7", "#c084fc", "#f3e8ff"] },
              { label: "Forest",       colorCode: "#166534", preview: ["#166534", "#16a34a", "#4ade80", "#f0fdf4"] },
              { label: "Crimson",      colorCode: "#991b1b", preview: ["#991b1b", "#dc2626", "#f87171", "#fef2f2"] },
              { label: "Midnight",     colorCode: "#0f172a", preview: ["#0f172a", "#1e293b", "#475569", "#f1f5f9"] },
              { label: "Amber",        colorCode: "#92400e", preview: ["#92400e", "#d97706", "#fbbf24", "#fffbeb"] },
              { label: "Rose Gold",    colorCode: "#9d174d", preview: ["#9d174d", "#ec4899", "#f9a8d4", "#fdf2f8"] },
              { label: "Slate",        colorCode: "#334155", preview: ["#334155", "#64748b", "#cbd5e1", "#f8fafc"] },
            ].map((theme) => {
            //   const isActive = colorCode === theme.colorCode;
            const isActive = colors.primary === theme.colorCode;
              return (
                <button
                  key={theme.label}
                  onClick={() => { setHue("primary", hexToHue(theme.colorCode)); }}
                  className={`w-full rounded-xl border overflow-hidden text-left transition-all ${
                    isActive
                      ? "border-indigo-500 shadow-[0_0_0_2px_rgba(99,88,255,0.14)]"
                      : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.14] hover:-translate-y-px"
                  }`}
                >
                  {/* Color preview strips */}
                  <div className="h-10 flex">
                    {theme.preview.map((c, i) => (
                      <div key={i} className="flex-1 h-full" style={{ background: c }} />
                    ))}
                  </div>
                  {/* Info */}
                  <div className="flex items-center justify-between px-2.5 py-1.5 bg-white/[0.02]">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full border border-white/15" style={{ background: theme.colorCode }} />
                      <p className="text-[11px] font-semibold text-white/70">{theme.label}</p>
                    </div>
                    {isActive && (
                      <div className="w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center shrink-0">
                        <svg width="7" height="7" viewBox="0 0 7 7" fill="none">
                          <path d="M1 3.5l2 2 3-3" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>
      </div>

      {/* ── PDF MODAL ── */}
      {showModal && activeGeneration && (
        <div
          className="fixed inset-0 z-50 bg-black/88 backdrop-blur-xl flex items-center justify-center p-6"
          style={{ animation: "fadeIn 0.2s ease" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <style>{`@keyframes fadeIn { from { opacity:0 } to { opacity:1 } } @keyframes modalIn { from { opacity:0; transform:scale(0.95) translateY(12px) } to { opacity:1; transform:scale(1) translateY(0) } }`}</style>
          <div
            className="w-full max-w-4xl bg-[#0d0d18] border border-white/[0.09] rounded-2xl flex flex-col overflow-hidden shadow-2xl"
            style={{ maxHeight: "88vh", animation: "modalIn 0.25s cubic-bezier(0.34,1.56,0.64,1)" }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/[0.07] shrink-0">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
                <rect x="2" y="1" width="8" height="12" rx="1.5" stroke="#818cf8" strokeWidth="1.2"/>
                <path d="M4 5h6M4 7.5h6M4 10h4" stroke="#818cf8" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              <span className="flex-1 text-sm text-white/55 truncate">{activeGeneration.prompt}</span>
              <span className="text-[10px] bg-indigo-500/14 text-violet-300 border border-indigo-500/24 rounded px-2 py-0.5 font-semibold shrink-0">
                {activeGeneration.numPages} slides
              </span>
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-white/30 bg-white/[0.04] border border-white/[0.08] rounded px-2 py-0.5 shrink-0">
                {(["primary", "secondary", "accent"] as const).map((key) => (
                  <span key={key} className="w-2.5 h-2.5 rounded-full border border-white/15" style={{ background: activeGeneration.colors[key] }} />
                ))}
                {activeGeneration.colors.primary}
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-7 h-7 rounded-lg bg-white/5 border border-white/[0.08] text-white/35 hover:bg-white/10 hover:text-white flex items-center justify-center transition-all shrink-0"
              >
                <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                  <path d="M1 1l7 7M8 1L1 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {/* Version tabs */}
            {activeGeneration.pdfs.length > 1 && (
              <div className="flex items-center gap-1.5 px-5 py-2 border-b border-white/[0.05] shrink-0 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                <span className="text-[10px] text-white/22 mr-1 shrink-0">Version:</span>
                {activeGeneration.pdfs.map((pdf, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActivePdfIndex(idx)}
                    className={`px-3 py-1 rounded-lg text-[11px] border shrink-0 transition-all ${
                      activePdfIndex === idx
                        ? "bg-indigo-500/10 border-indigo-500 text-violet-300 font-semibold"
                        : "bg-white/[0.04] border-white/[0.08] text-white/38 hover:border-indigo-500/40"
                    }`}
                  >
                    v{idx + 1} · {timeAgo(pdf.generatedAt)}
                  </button>
                ))}
              </div>
            )}

            {/* PDF iframe */}
            <div className="flex-1 min-h-0">
              {activeGeneration.pdfs[activePdfIndex] ? (
                <iframe
                  src={activeGeneration.pdfs[activePdfIndex].pdfUrl}
                  title={`PDF v${activePdfIndex + 1}`}
                  className="w-full h-full border-none block"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-white/20">No PDF available</div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-white/[0.07] shrink-0">
              {activeGeneration.pdfs[activePdfIndex] && (
                <a
                  href={activeGeneration.pdfs[activePdfIndex].pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/[0.04] border border-white/[0.09] text-white/55 text-xs hover:bg-white/[0.08] hover:text-white transition-all"
                >
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <path d="M5.5 1v7M3 5.5l2.5 2.5L8 5.5M1 9.5h9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Download
                </a>
              )}
              <button
                onClick={() => handleRegenerate(activeGeneration)}
                disabled={!!regeneratingId}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-semibold hover:shadow-[0_4px_16px_rgba(99,88,255,0.35)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {regeneratingId === activeGeneration._id ? (
                  <><Spinner /> Regenerating…</>
                ) : (
                  <>
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                      <path d="M9.5 2A4.5 4.5 0 1 0 10 5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                      <path d="M9.5 2H7.5M9.5 2V4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Regenerate
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
