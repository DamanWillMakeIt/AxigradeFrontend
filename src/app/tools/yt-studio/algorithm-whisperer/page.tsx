"use client";

import React, { Suspense, useEffect, useState } from "react";
import { motion, type Variants } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";

type SeoApiKey = { id: string; key: string; credits: number; callCount: number; isActive: boolean; createdAt: string; };
type Competitor = { title: string; video_url: string; views: string };
type CommunityPost = { caption: string; image_prompt: string };
type Strategy = { type: string; description: string; pinned_comments: string[]; community_posts: CommunityPost[]; };
type SEOResult = { title: string; tag_string: string; tag_stats: { proven: number; search: number; unique: number; total: number }; tag_reasoning: string; competitors: Competitor[]; strategies: Strategy[]; pdf_url?: string; status: string; };

const containerVariants: Variants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { staggerChildren: 0.08, delayChildren: 0.05 } } };
const cardVariants: Variants = { hidden: { opacity: 0, y: 24, scale: 0.97 }, show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 130, damping: 20 } } };

const STRATEGY_META: Record<string, { color: string; bg: string; border: string }> = {
  "Controversial (High CTR)": { color: "text-rose-300",   bg: "bg-rose-950/25",   border: "border-rose-500/30"   },
  "Story-Driven (Relatable)": { color: "text-amber-300",  bg: "bg-amber-950/25",  border: "border-amber-500/30"  },
  "Mystery (Curiosity Gap)":  { color: "text-violet-300", bg: "bg-violet-950/25", border: "border-violet-500/30" },
};
function getStrategyMeta(type: string) {
  return STRATEGY_META[type] ?? { color: "text-cyan-300", bg: "bg-cyan-950/25", border: "border-cyan-500/30" };
}

function TagChip({ tag, proven }: { tag: string; proven: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(tag); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${proven ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20" : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-slate-200"}`}>
      {proven && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />}
      {copied ? "✓ copied" : tag}
    </button>
  );
}

function AlgorithmWhispererPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");

  const [seoKey, setSeoKey] = useState<SeoApiKey | null>(null);
  const [keyLoading, setKeyLoading] = useState(true);
  const [keyGenerating, setKeyGenerating] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  const [resultLoading, setResultLoading] = useState(true);
  const [result, setResult] = useState<SEOResult | null>(null);
  const [activeStrategy, setActiveStrategy] = useState(0);
  const [tagsCopied, setTagsCopied] = useState(false);

  useEffect(() => {
    fetch("/api/seo-key")
      .then(r => r.json())
      .then(d => { if (d.seoKey) setSeoKey(d.seoKey); })
      .catch(() => {})
      .finally(() => setKeyLoading(false));

    if (!projectId) { setResultLoading(false); return; }

    // Load saved document — if job is still processing, start polling
    fetch(`/api/yt-projects/${projectId}/algorithm-whisperer`)
      .then(r => r.json())
      .then(async d => {
        const docData = d.document?.data as { status?: string; result?: SEOResult; job_id?: string } | null;

        if (docData?.status === "done" && docData?.result) {
          setResult(docData.result as SEOResult);
          return;
        }

        // Job is mid-flight — auto-poll so the page updates when it completes
        if (docData?.status === "processing" && docData?.job_id) {
          const jobId = docData.job_id;
          const MAX_POLLS = 36; // 36 × 5s = 3 min max
          for (let i = 0; i < MAX_POLLS; i++) {
            await new Promise(r => setTimeout(r, 5000));
            try {
              const pollRes = await fetch(`/api/yt-projects/${projectId}/algorithm-whisperer?jobId=${jobId}`);
              const pollData = await pollRes.json();
              if (pollData.status === "done" && pollData.result) {
                setResult(pollData.result as SEOResult);
                break;
              }
              if (pollData.status === "error") break;
            } catch {
              // Non-fatal — keep polling
            }
          }
        }
      })
      .catch(() => {})
      .finally(() => setResultLoading(false));
  }, [projectId]);

  const handleGenerateKey = async () => {
    setKeyGenerating(true);
    setKeyError(null);
    try {
      const res = await fetch("/api/seo-key", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Key generation failed");
      setSeoKey(data.seoKey);
    } catch (e: unknown) {
      setKeyError(e instanceof Error ? e.message : "Key generation failed");
    } finally {
      setKeyGenerating(false);
    }
  };

  const allTags = result?.tag_string?.split(",").map(t => t.trim()).filter(Boolean) ?? [];
  const provenCount = result?.tag_stats?.proven ?? 0;
  const provenTags = allTags.slice(0, provenCount);
  const uniqueTags = allTags.slice(provenCount);

  return (
    <div className="relative min-h-[100dvh] w-full text-slate-200 font-sans overflow-y-auto p-6 md:p-12">
      <div className="fixed inset-0 -z-10 bg-slate-950">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.18),transparent_55%),radial-gradient(circle_at_bottom_right,_rgba(45,212,191,0.22),transparent_55%)]" />
      </div>

      <motion.div variants={containerVariants} initial="hidden" animate="show" className="relative z-10 max-w-7xl mx-auto flex flex-col gap-8">

        {/* Header */}
        <div className="flex items-center gap-5">
          <motion.button onClick={() => router.back()} whileHover={{ scale: 1.08, x: -4 }} whileTap={{ scale: 0.9 }}
            className="flex-shrink-0 w-11 h-11 rounded-full bg-white/5 border border-emerald-300/35 flex items-center justify-center text-emerald-200 hover:bg-emerald-500/10">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </motion.button>
          <div>
            <motion.h1 variants={cardVariants} className="text-3xl md:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400">
              THE ALGORITHM WHISPERER
            </motion.h1>
            <motion.p variants={cardVariants} className="mt-1.5 text-sm text-slate-400">
              {result ? `SEO & Tags — "${result.title}"` : "SEO optimization, tags, and growth strategies."}
            </motion.p>
          </div>
        </div>

        {/* SEO API Key Section */}
        <motion.div variants={cardVariants}
          className={`rounded-3xl border backdrop-blur-2xl p-6 ${!seoKey ? "border-white/10 bg-slate-900/60" : seoKey.credits === 0 ? "border-rose-500/25 bg-rose-950/10" : seoKey.credits <= 10 ? "border-amber-500/25 bg-amber-950/10" : "border-emerald-500/20 bg-emerald-950/10"}`}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <p className="text-sm font-bold uppercase tracking-[0.15em] text-slate-400 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-emerald-400">
                  <path fillRule="evenodd" d="M8 7a5 5 0 1 1 3.61 4.804l-1.903 1.903A1 1 0 0 1 9 14H8v1a1 1 0 0 1-1 1H6v1a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-2a1 1 0 0 1 .293-.707L7.196 9.39A5.002 5.002 0 0 1 8 7Zm5-1a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" clipRule="evenodd" />
                </svg>
                SEO API Key
              </p>
              {/* Generate key button — for users who come here directly without going through Quality Critic */}
              {!seoKey && !keyLoading && (
                <button onClick={handleGenerateKey} disabled={keyGenerating}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                  {keyGenerating ? (
                    <><svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Generating...</>
                  ) : "Generate My Key"}
                </button>
              )}
            </div>

            {keyLoading ? (
              <p className="text-sm text-slate-500">Loading...</p>
            ) : seoKey ? (
              <div className="flex flex-col gap-3">
                {/* Key value row */}
                <div className="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-emerald-400 flex-shrink-0">
                    <path fillRule="evenodd" d="M8 7a5 5 0 1 1 3.61 4.804l-1.903 1.903A1 1 0 0 1 9 14H8v1a1 1 0 0 1-1 1H6v1a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-2a1 1 0 0 1 .293-.707L7.196 9.39A5.002 5.002 0 0 1 8 7Zm5-1a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" clipRule="evenodd" />
                  </svg>
                  <span className="font-mono text-xs text-emerald-300 flex-1 truncate">{seoKey.key}</span>
                  <button onClick={() => { navigator.clipboard.writeText(seoKey.key); }}
                    className="flex-shrink-0 text-[10px] uppercase tracking-widest text-slate-400 hover:text-emerald-300 transition-colors px-2 py-1 rounded-lg bg-white/5 hover:bg-emerald-500/10 border border-white/10">
                    Copy
                  </button>
                </div>
                {/* Stats row */}
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold border ${
                    seoKey.credits > 10 ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                    : seoKey.credits > 0 ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
                    : "text-rose-400 border-rose-500/30 bg-rose-500/10"
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${seoKey.credits > 10 ? "bg-emerald-400" : seoKey.credits > 0 ? "bg-amber-400 animate-pulse" : "bg-rose-400"}`} />
                    {seoKey.credits} credit{seoKey.credits !== 1 ? "s" : ""} remaining
                  </span>
                  <span className="text-xs text-slate-500">{seoKey.callCount} call{seoKey.callCount !== 1 ? "s" : ""} made</span>
                  {seoKey.credits === 0 && (
                    <p className="w-full text-sm text-rose-400">No credits remaining. Please contact support to top up.</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">No API key yet. Click <span className="text-emerald-400 font-semibold">Generate My Key</span> above to get started, or run SEO from Quality Critic and one will be created automatically.</p>
            )}
            {keyError && <p className="text-sm text-rose-400 font-mono">{keyError}</p>}
          </div>
        </motion.div>

        {/* Loading */}
        {resultLoading && (
          <motion.div variants={cardVariants} className="rounded-3xl border border-white/10 bg-slate-900/60 p-12 flex flex-col items-center gap-4">
            <svg className="animate-spin h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
            <p className="text-slate-400 text-sm">Loading SEO data...</p>
            <p className="text-slate-500 text-xs">If a job is in progress, this will auto-update when it completes.</p>
          </motion.div>
        )}

        {/* Empty state */}
        {!resultLoading && !result && (
          <motion.div variants={cardVariants} className="rounded-3xl border border-dashed border-white/10 bg-slate-900/60 p-12 flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-8 h-8 text-emerald-400">
                <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-lg font-bold text-slate-200 mb-1">No SEO data yet</p>
              <p className="text-sm text-slate-500">Go to the <span className="text-emerald-400 font-semibold">Quality Critic</span>, validate your script, then click <span className="text-emerald-400 font-semibold">Generate SEO & Tags</span>.</p>
            </div>
          </motion.div>
        )}

        {/* Results */}
        {result && (
          <>
            <motion.div variants={cardVariants} className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[{ label: "Total Tags", value: result.tag_stats?.total, color: "text-emerald-400" }, { label: "Proven Tags", value: result.tag_stats?.proven, color: "text-cyan-400" }, { label: "Unique Tags", value: result.tag_stats?.unique, color: "text-violet-400" }, { label: "Competitors", value: result.competitors?.length, color: "text-amber-400" }].map(stat => (
                <div key={stat.label} className="rounded-2xl border border-white/8 bg-slate-900/60 p-5 flex flex-col gap-1">
                  <span className={`text-3xl font-black ${stat.color}`}>{stat.value ?? 0}</span>
                  <span className="text-sm text-slate-500 uppercase tracking-wider font-medium">{stat.label}</span>
                </div>
              ))}
            </motion.div>

            <motion.div variants={cardVariants} className="rounded-3xl border border-emerald-500/20 bg-emerald-950/10 backdrop-blur-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-emerald-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />Tags — {allTags.length} total
                </h3>
                <button onClick={() => { navigator.clipboard.writeText(result.tag_string ?? ""); setTagsCopied(true); setTimeout(() => setTagsCopied(false), 2000); }}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 transition-colors">
                  {tagsCopied ? "✓ Copied!" : "Copy All Tags"}
                </button>
              </div>
              {result.tag_reasoning && <p className="text-sm text-slate-400 italic mb-4 pb-4 border-b border-white/5">{result.tag_reasoning}</p>}
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-400/60 mb-3">Proven ({provenTags.length})</p>
              <div className="flex flex-wrap gap-2 mb-5">{provenTags.map(tag => <TagChip key={tag} tag={tag} proven />)}</div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Unique / Niche ({uniqueTags.length})</p>
              <div className="flex flex-wrap gap-2">{uniqueTags.map(tag => <TagChip key={tag} tag={tag} proven={false} />)}</div>
            </motion.div>

            {result.competitors?.length > 0 && (
              <motion.div variants={cardVariants} className="rounded-3xl border border-amber-500/20 bg-amber-950/10 backdrop-blur-2xl p-6">
                <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-amber-400 mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />Top Competing Videos
                </h3>
                <div className="flex flex-col gap-3">
                  {result.competitors.map((c, i) => (
                    <a key={i} href={c.video_url} target="_blank" rel="noreferrer"
                      className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-white/6 bg-slate-900/50 hover:bg-slate-900/80 hover:border-amber-500/20 transition-all group">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-black flex items-center justify-center">{i + 1}</span>
                        <p className="text-sm text-slate-200 truncate group-hover:text-white">{c.title}</p>
                      </div>
                      <span className="text-sm font-bold text-amber-300 flex-shrink-0">{c.views}</span>
                    </a>
                  ))}
                </div>
              </motion.div>
            )}

            {result.strategies?.length > 0 && (
              <motion.div variants={cardVariants} className="flex flex-col gap-4">
                <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-slate-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-fuchsia-400 animate-pulse" />Content Strategies ({result.strategies.length})
                </h3>
                <div className="flex gap-2 flex-wrap">
                  {result.strategies.map((s, i) => {
                    const meta = getStrategyMeta(s.type);
                    return <button key={i} onClick={() => setActiveStrategy(i)} className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${activeStrategy === i ? `${meta.bg} ${meta.border} ${meta.color}` : "bg-white/5 border-white/10 text-slate-500 hover:text-slate-300"}`}>{s.type}</button>;
                  })}
                </div>
                {result.strategies[activeStrategy] && (() => {
                  const s = result.strategies[activeStrategy];
                  const meta = getStrategyMeta(s.type);
                  return (
                    <motion.div key={activeStrategy} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      className={`rounded-3xl border ${meta.border} ${meta.bg} backdrop-blur-xl p-6 flex flex-col gap-6`}>
                      <div>
                        <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${meta.color}`}>Video Description</p>
                        <p className="text-base text-slate-200 leading-relaxed">{s.description}</p>
                      </div>
                      {s.pinned_comments?.length > 0 && (
                        <div>
                          <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${meta.color}`}>Pinned Comments</p>
                          <div className="flex flex-col gap-2">
                            {s.pinned_comments.map((comment, i) => (
                              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-black/20 border border-white/5">
                                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white/5 border border-white/10 text-slate-400 text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                                <p className="text-sm text-slate-300 leading-relaxed">{comment}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {s.community_posts?.length > 0 && (
                        <div>
                          <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${meta.color}`}>Community Posts</p>
                          <div className="grid md:grid-cols-3 gap-3">
                            {s.community_posts.map((post, i) => (
                              <div key={i} className="rounded-2xl border border-white/8 bg-black/20 p-4 flex flex-col gap-3">
                                <p className="text-sm font-semibold text-slate-200 leading-snug">&ldquo;{post.caption}&rdquo;</p>
                                <div className="mt-auto p-2.5 rounded-lg bg-white/3 border border-white/5">
                                  <p className="text-xs text-slate-500 italic leading-relaxed"><span className="text-violet-400 font-bold not-italic">Image: </span>{post.image_prompt}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  );
                })()}
              </motion.div>
            )}

            {result.pdf_url && (
              <motion.div variants={cardVariants} className="flex justify-center pb-8">
                <a href={result.pdf_url} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-4 rounded-2xl bg-white/5 border border-white/10 text-sm font-bold uppercase tracking-widest text-slate-300 hover:bg-white/10 hover:text-white transition-all">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-cyan-400">
                    <path fillRule="evenodd" d="M10 3a.75.75 0 0 1 .75.75v6.827l2.122-2.122a.75.75 0 1 1 1.06 1.06l-3.404 3.405a.75.75 0 0 1-1.06 0L6.07 8.515a.75.75 0 1 1 1.06-1.06l2.12 2.122V3.75A.75.75 0 0 1 10 3ZM4.25 15a.75.75 0 0 1 .75-.75h10a.75.75 0 0 1 0 1.5H5a.75.75 0 0 1-.75-.75Z" clipRule="evenodd"/>
                  </svg>
                  Download SEO Report PDF
                </a>
              </motion.div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}
// Next.js 14 requires useSearchParams() to be inside a Suspense boundary.
// This wrapper satisfies that constraint without changing any component logic.
export default function AlgorithmWhispererRoot() {
  return (
    <Suspense>
      <AlgorithmWhispererPage />
    </Suspense>
  );
}
