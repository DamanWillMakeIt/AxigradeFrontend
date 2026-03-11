"use client";

import React, { Suspense, useCallback, useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';

// --- Types ---
type MetaData = {
  topic: string;
  niche: string;
  language: string;
  duration_seconds: number;
  total_scenes: number;
  total_words: number;
  viral_score_vph: number;
  competitors: string[];
  pdf_url: string;
};

type ScriptScene = {
  scene_number: number;
  estimated_time_seconds: number;
  color_code: string;
  script_dialogue: string;
  veo_prompt: string;
  shoot_instructions: string;
};

type ArchitectData = {
  status: string;
  meta: MetaData;
  script: ScriptScene[];
};

type JobRecord = {
  job_id: string;
  status: "processing" | "done" | "error";
  created_at: string;
  result?: ArchitectData;
};

// --- Futuristic Background Orbs ---
const CyberBackground = () => {
  const colors = ["bg-cyan-500", "bg-fuchsia-600", "bg-violet-600"];
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const orbConfigs = React.useMemo(
    () =>
      [...Array(6)].map(() => ({
        width: Math.random() * 400 + 200,
        height: Math.random() * 400 + 200,
        x: [
          Math.random() * 100 + "vw",
          Math.random() * 100 + "vw",
          Math.random() * 100 + "vw",
        ],
        y: [
          Math.random() * 100 + "vh",
          Math.random() * 100 + "vh",
          Math.random() * 100 + "vh",
        ],
        duration: Math.random() * 15 + 15,
      })),
    []
  );

  return (
    <div className="fixed inset-0 overflow-hidden bg-slate-950 -z-10">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,#000_20%,transparent_100%)]"></div>

      {isMounted &&
        orbConfigs.map((config, i) => (
          <motion.div
            key={i}
            className={`absolute rounded-full opacity-20 blur-[100px] ${colors[i % colors.length]}`}
            style={{ width: config.width, height: config.height }}
            animate={{
              x: config.x,
              y: config.y,
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: config.duration,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
    </div>
  );
};

// --- Animation Variants ---
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.15 } }
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 50, scale: 0.9 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 100, damping: 15 } },
};

function TheArchitect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");
  
  // States
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [sceneOverrides, setSceneOverrides] = useState<Record<number, string | undefined>>({});

  // API Key State (Script generation)
  const [apiKey, setApiKey] = useState<string>("");
  const [keyLoading, setKeyLoading] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [keyVisible, setKeyVisible] = useState(false);

  // xAI Video API Key State — user brings their own key each session
  const [veoApiKey, setVeoApiKey] = useState<string>("");
  const [veoKeyVisible, setVeoKeyVisible] = useState(false);

  // Generate Modal State
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [genNiche, setGenNiche] = useState("");
  const [genTopic, setGenTopic] = useState("");
  const [genDuration, setGenDuration] = useState("1.0");
  const [genLanguage, setGenLanguage] = useState("English");
  const [genBudget, setGenBudget] = useState("0");

  // Scene collapse-all state
  const [allCollapsed, setAllCollapsed] = useState(false);

  // Active Job Data
  const activeJob = jobs.find(j => j.job_id === activeJobId);
  const projectData = activeJob?.result;

  // Load architect key from DB on mount — clear any stale localStorage value
  useEffect(() => {
    // Wipe old localStorage key unconditionally — keys live in DB now
    localStorage.removeItem("architectapikey");
    // xAI video key was removed — it now lives in XAI_API_KEY server env var
    localStorage.removeItem("xaivideoapikey");

    fetch("/api/architect-key")
      .then(r => r.json())
      .then(d => { setApiKey(d.api_key ?? ""); })
      .catch(() => {});
    // XAI video key is NOT loaded from anywhere - user must enter each time
  }, []);

  // 1. Generate API Key via server proxy (persisted to DB)
  const handleGenerateApiKey = async (regenerate = false) => {
    setKeyLoading(true);
    setKeyError(null);
    try {
      const res = await fetch('/api/architect-key', {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: regenerate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Server returned ${res.status}`);
      const newKey = data.api_key;
      if (!newKey) throw new Error("No API key in response: " + JSON.stringify(data));
      setApiKey(newKey);
    } catch (err: any) {
      setKeyError(err.message || "Failed to generate API key");
    } finally {
      setKeyLoading(false);
    }
  };

  const handleClearApiKey = () => {
    setApiKey("");
    setKeyError(null);
  };

  const handleSaveManualKey = (val: string) => {
    // Input is read-only display — manual edits not persisted
    setApiKey(val.trim());
  };

  // 2. Persist Jobs to Next.js Backend
  const saveJobsToBackend = async (currentJobs: JobRecord[]) => {
    if (!projectId) return;
    try {
      await fetch(`/api/yt-projects/${projectId}/architect`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: { jobs: currentJobs } }),
      });
    } catch (err) {
      console.error("Failed to save jobs to DB:", err);
    }
  };

  // 3. Polling Mechanism
  // 3. Polling Mechanism
  const pollJobStatus = useCallback(async (jobId: string, apiKey: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/architect-generate?jobId=${jobId}`);
        
        const data = await res.json();

        // Poll response: { job_id, status, result: { meta, script, ... } }
        const rawResult = data.result;
        if (data.status === "done" && rawResult && rawResult.meta && rawResult.script) {
          clearInterval(interval);
          
          setJobs(prev => {
            const updatedJobs: JobRecord[] = prev.map((job): JobRecord => 
              job.job_id === jobId 
                ? { ...job, status: "done", result: rawResult } 
                : job
            );
            saveJobsToBackend(updatedJobs);
            return updatedJobs;
          });
        } else if (data.status === "error") {
          clearInterval(interval);
          setJobs(prev => {
            // Added strict typings here too
            const updatedJobs: JobRecord[] = prev.map((job): JobRecord => 
              job.job_id === jobId 
                ? { ...job, status: "error" } 
                : job
            );
            saveJobsToBackend(updatedJobs);
            return updatedJobs;
          });
        }
      } catch (err) {
        console.error(`Polling error for ${jobId}:`, err);
      }
    }, 5000); // Poll every 5 seconds
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 4. Start New Script Generation
  const handleGenerateNew = async () => {
    setShowGenerateModal(true);
  };

  const handleGenerateSubmit = async () => {
    if (!genNiche.trim()) return;
    if (!apiKey.trim()) {
      setLoadError("No API key found. Click 'Generate Key' in the API KEY section below to get one.");
      return;
    }
    setShowGenerateModal(false);
    setLoading(true);
    setLoadError(null);
    try {

      const payload = {
        niche: genNiche.trim(),
        topic: genTopic.trim() || undefined,
        budget: parseFloat(genBudget) || 0,
        duration_minutes: parseFloat(genDuration) || 1.0,
        target_language: genLanguage || "English"
      };

      const res = await fetch("/api/architect-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),  // apiKey is fetched server-side from DB now
      });

      if (!res.ok) {
        const errBody = await res.text();
        // 401 = key is invalid/revoked — clear it from state so UI shows Generate Key
        if (res.status === 401) {
          setApiKey("");
          // Also delete from DB so next GET returns null
          await fetch("/api/architect-key", {
            method: "DELETE",
          }).catch(() => {});
          throw new Error("API key is invalid or revoked. Click 'Generate Key' to get a new one.");
        }
        throw new Error(`Generate API returned ${res.status}: ${errBody}`);
      }
      
      const data = await res.json();
      
      // Expected response contains a job_id (or similar identifier)
      const jobId = data.job_id || data.id; 
      
      if (!jobId) throw new Error("No job_id in response: " + JSON.stringify(data));

      if (jobId) {
        const newJob: JobRecord = {
          job_id: jobId,
          status: "processing",
          created_at: new Date().toISOString(),
        };
        
        setJobs(prev => {
          const updated = [newJob, ...prev];
          saveJobsToBackend(updated);
          return updated;
        });
        setActiveJobId(jobId);
        pollJobStatus(jobId, apiKey);
      }
    } catch (err: any) {
      console.error("Generation error:", err);
      setLoadError(err.message || "Failed to start generation.");
    } finally {
      setLoading(false);
    }
  };

  // 5. Initial Load (Fetch from DB)
  useEffect(() => {
    let isMounted = true;
    
    const loadInitialData = async () => {
      if (!projectId) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/yt-projects/${projectId}/architect`);
        if (res.ok) {
          const { document } = await res.json();
          if (document?.data?.jobs && document.data.jobs.length > 0) {
            // CAST AS JobRecord[] HERE
            const loadedJobs = document.data.jobs as JobRecord[];
            
            if (isMounted) {
              setJobs(loadedJobs);
              setActiveJobId(loadedJobs[0].job_id);
              
              // Resume polling for any jobs that were left in processing state
              // apiKey is fetched from DB on mount — use a ref-safe approach
              loadedJobs.forEach((job: JobRecord) => {
                if (job.status === "processing") {
                  // Fetch the key from DB and resume polling
                  fetch("/api/architect-key")
                    .then(r => r.json())
                    .then(d => { if (d.api_key) pollJobStatus(job.job_id, d.api_key); })
                    .catch(() => {});
                }
              });
            }
          }
        }
      } catch (error) {
        console.error("Failed to load project data", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadInitialData();

    return () => { isMounted = false; };
  }, [projectId, pollJobStatus]);

  const handleOpenQualityCritic = () => {
    if (!projectData || !projectId) return;
    // Do NOT pass script in the URL — large scripts cause HTTP 431 (headers too large).
    // Quality Critic fetches the script from DB using projectId instead.
    const topic = encodeURIComponent(projectData.meta.topic || "");
    const niche = encodeURIComponent(projectData.meta.niche || "");
    router.push(`/tools/yt-studio/quality-critic?source=architect&topic=${topic}&niche=${niche}&projectId=${projectId}`);
  };

  // --- ROBUST LOADING STATE ---
  if (loading && jobs.length === 0) {
    return (
      <div className="relative min-h-[100dvh] w-full flex flex-col items-center justify-center text-cyan-400 font-sans p-6 overflow-hidden">
        <CyberBackground />
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="relative z-10 flex flex-col items-center">
          <div className="relative w-40 h-40 flex items-center justify-center mb-8">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 3, ease: "linear" }} className="absolute inset-0 rounded-full border-t-2 border-l-2 border-cyan-400/50 shadow-[0_0_15px_rgba(34,211,238,0.3)]" />
            <motion.div animate={{ rotate: -360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }} className="absolute inset-4 rounded-full border-b-2 border-r-2 border-fuchsia-500/50 shadow-[0_0_15px_rgba(217,70,239,0.3)]" />
            <motion.div animate={{ scale: [0.9, 1.1, 0.9], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }} className="absolute inset-8 bg-cyan-500/10 rounded-full backdrop-blur-sm border border-cyan-400/20 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-cyan-300"><path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" /></svg>
            </motion.div>
          </div>
          <h2 className="text-3xl md:text-4xl font-black tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500 uppercase animate-pulse drop-shadow-[0_0_10px_rgba(34,211,238,0.5)] text-center">Architecting Blueprint</h2>
        </motion.div>
      </div>
    );
  }

  // --- MAIN RENDER ---
  return (
    <div className="relative min-h-[100dvh] w-full text-slate-200 font-sans overflow-x-hidden p-6 md:p-12">
      <CyberBackground />

      {/* Generate New Script Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-white/10 p-8 flex flex-col gap-6 shadow-2xl">
            <h2 className="text-xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500">Generate New Script</h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs uppercase tracking-widest text-cyan-400/80 mb-2">Niche / Category <span className="text-rose-400">*</span></label>
                <input
                  type="text"
                  value={genNiche}
                  onChange={e => setGenNiche(e.target.value)}
                  placeholder="e.g. Personal Finance"
                  className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-cyan-400/80 mb-2">Video Title / Topic</label>
                <textarea
                  value={genTopic}
                  onChange={e => setGenTopic(e.target.value)}
                  placeholder="e.g. How to win everywhere — 5 habits that change everything"
                  rows={2}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 resize-none"
                />
                <p className="text-[10px] text-slate-500 mt-1">This is your exact video title. Leave blank to let the API choose.</p>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-cyan-400/80 mb-2">Budget (USD)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-mono">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={genBudget}
                    onChange={e => setGenBudget(e.target.value)}
                    placeholder="0"
                    className="w-full bg-slate-800 border border-white/10 rounded-xl pl-7 pr-3 py-3 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Set 0 for no budget limit.</p>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs uppercase tracking-widest text-cyan-400/80 mb-2">Duration (mins)</label>
                  <select
                    value={genDuration}
                    onChange={e => setGenDuration(e.target.value)}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-cyan-400"
                  >
                    <option value="0.5">30 seconds</option>
                    <option value="1.0">1 minute</option>
                    <option value="2.0">2 minutes</option>
                    <option value="3.0">3 minutes</option>
                    <option value="4.0">4 minutes</option>
                    <option value="5.0">5 minutes</option>
                    <option value="6.0">6 minutes</option>
                    <option value="7.0">7 minutes</option>
                    <option value="8.0">8 minutes</option>
                    <option value="9.0">9 minutes</option>
                    <option value="10.0">10 minutes</option>
                    <option value="12.0">12 minutes</option>
                    <option value="15.0">15 minutes</option>
                    <option value="20.0">20 minutes</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs uppercase tracking-widest text-cyan-400/80 mb-2">Language</label>
                  <select
                    value={genLanguage}
                    onChange={e => setGenLanguage(e.target.value)}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-cyan-400"
                  >
                    <option>English</option>
                    <option>Hindi</option>
                    <option>Spanish</option>
                    <option>French</option>
                    <option>German</option>
                    <option>Portuguese</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowGenerateModal(false)}
                className="flex-1 py-3 rounded-xl border border-white/10 text-sm font-semibold text-slate-400 hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateSubmit}
                disabled={!genNiche.trim()}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-sm font-bold text-slate-950 disabled:opacity-40 hover:opacity-90 transition-opacity"
              >
                Generate
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Top Navigation & Job Selector */}
      <div className="relative z-10 flex flex-col gap-6 mb-8">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <motion.button 
              onClick={() => { router.back() }}
              whileHover={{ scale: 1.1, x: -5, boxShadow: "0px 0px 15px rgba(6,182,212,0.5)" }}
              whileTap={{ scale: 0.9 }}
              className="flex items-center justify-center w-12 h-12 rounded-full bg-white/5 border border-white/10 backdrop-blur-md text-cyan-400 transition-colors hover:bg-white/10 shrink-0"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
            </motion.button>

            <div className="flex flex-col gap-1">
              <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-violet-500 drop-shadow-[0_0_10px_rgba(217,70,239,0.3)]">
                THE ARCHITECT
              </h1>
              {projectId && (
                <p className="text-xs text-slate-400 font-mono uppercase tracking-[0.2em]">
                  Project: {projectId}
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-4">
            <motion.button
              onClick={handleGenerateNew}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              className="inline-flex items-center gap-2 rounded-2xl bg-white/5 border border-cyan-500/30 hover:bg-cyan-500/10 px-4 py-2 text-xs md:text-sm font-semibold uppercase tracking-[0.1em] text-cyan-400 transition-colors"
            >
              <span>+ Generate New</span>
            </motion.button>

            {projectData && (
              <motion.button
                onClick={handleOpenQualityCritic}
                whileHover={{ scale: 1.03, boxShadow: "0px 0px 18px rgba(244,114,182,0.6)" }}
                whileTap={{ scale: 0.96 }}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 via-fuchsia-500 to-purple-500 px-4 py-2 text-xs md:text-sm font-semibold uppercase tracking-[0.18em] text-slate-950 shadow-[0_0_30px_rgba(236,72,153,0.6)]"
              >
                <span>Validate Script</span>
              </motion.button>
            )}
          </div>
        </div>

        {/* Past Jobs Ribbon */}
        {jobs.length > 0 && (
          <div className="w-full overflow-x-auto pb-4 hide-scrollbar">
            <div className="flex gap-4">
              {jobs.map((job) => (
                <button
                  key={job.job_id}
                  onClick={() => setActiveJobId(job.job_id)}
                  className={`flex flex-col flex-shrink-0 p-3 rounded-xl border min-w-[200px] text-left transition-all ${
                    activeJobId === job.job_id 
                      ? 'bg-cyan-900/40 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.2)]' 
                      : 'bg-slate-900/40 border-white/10 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-mono text-slate-400 uppercase">
                      {new Date(job.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                    {job.status === "processing" ? (
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                      </span>
                    ) : job.status === "error" ? (
                      <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-slate-200 truncate w-full">
                    {job.result?.meta?.topic || `Job ${job.job_id.slice(0, 6)}`}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest">
                    {job.status}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── STEP 1: API KEY PANEL ── */}
      <div className="relative z-10 mb-6 rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-2xl p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${apiKey ? "bg-emerald-500 text-slate-950" : "bg-cyan-500/20 border border-cyan-500/40 text-cyan-400"}`}>
              {apiKey ? "✓" : "1"}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-cyan-400">API Key</p>
              <p className="text-[11px] text-slate-400">{apiKey ? "Key active — ready to generate" : "Generate or paste your key to begin"}</p>
            </div>
          </div>

          <div className="flex flex-1 items-center gap-3 md:ml-4">
            {/* Key input — display only, not editable */}
            <div className="relative flex-1">
              <input
                type={keyVisible ? "text" : "password"}
                value={apiKey}
                readOnly
                placeholder="No key yet — click Generate Key below"
                className="w-full bg-slate-800/70 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-mono text-slate-200 placeholder:text-slate-500 focus:outline-none cursor-default pr-20"
              />
              {apiKey && (
                <button
                  onClick={() => setKeyVisible(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-widest text-slate-400 hover:text-slate-200"
                >
                  {keyVisible ? "Hide" : "Show"}
                </button>
              )}
            </div>

            {/* Generate / Regenerate key button */}
            <button
              onClick={() => handleGenerateApiKey(!!apiKey)}
              disabled={keyLoading}
              className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-slate-950 disabled:opacity-50 shadow-[0_0_15px_rgba(56,189,248,0.35)]"
            >
              {keyLoading ? (
                <><svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Generating…</>
              ) : apiKey ? "Regenerate" : "Generate Key"}
            </button>

            {/* Clear key */}
            {apiKey && (
              <button onClick={handleClearApiKey} className="shrink-0 px-3 py-2.5 rounded-xl border border-white/10 text-xs text-slate-400 hover:text-rose-400 hover:border-rose-400/30 transition-colors uppercase tracking-widest">
                Clear
              </button>
            )}
          </div>
        </div>

        {keyError && (
          <div className="mt-3 flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
            <p className="text-xs font-mono text-rose-300">{keyError}</p>
          </div>
        )}
      </div>



      {/* ── STEP 2: xAI VIDEO API KEY PANEL ── */}
      <div className="relative z-10 mb-6 rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-2xl p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${veoApiKey ? "bg-emerald-500 text-slate-950" : "bg-fuchsia-500/20 border border-fuchsia-500/40 text-fuchsia-400"}`}>
              {veoApiKey ? "✓" : "2"}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-fuchsia-400">xAI Video Key</p>
              <p className="text-[11px] text-slate-400">{veoApiKey ? "Key active for this session" : "Enter your xAI Video API key (not stored)"}</p>
            </div>
          </div>
          <div className="flex flex-1 items-center gap-3 md:ml-4">
            <div className="relative flex-1">
              <input
                type={veoKeyVisible ? "text" : "password"}
                value={veoApiKey}
                onChange={e => setVeoApiKey(e.target.value.trim())}
                placeholder="Enter your xAI Video API key"
                className="w-full bg-slate-800/70 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-mono text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-fuchsia-400 pr-20"
              />
              {veoApiKey && (
                <button onClick={() => setVeoKeyVisible(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-widest text-slate-400 hover:text-slate-200">
                  {veoKeyVisible ? "Hide" : "Show"}
                </button>
              )}
            </div>
            {veoApiKey && (
              <button onClick={() => setVeoApiKey("")} className="shrink-0 px-3 py-2.5 rounded-xl border border-white/10 text-xs text-slate-400 hover:text-rose-400 hover:border-rose-400/30 transition-colors uppercase tracking-widest">
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {activeJob?.status === "processing" && (
        <div className="relative z-10 w-full rounded-3xl bg-slate-900/60 border border-amber-500/30 p-12 flex flex-col items-center justify-center">
          <svg className="animate-spin h-10 w-10 text-amber-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          <h3 className="text-xl text-amber-400 font-bold tracking-widest uppercase">Processing Generation</h3>
          <p className="text-slate-400 text-sm mt-2 font-mono">Poll ID: {activeJob.job_id}</p>
        </div>
      )}

      {/* Metadata Dashboard & Script Stack (Only show if projectData exists) */}
      {projectData && activeJob?.status === "done" && (
        <>
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12"
          >
            {/* Main Stats Panel */}
            <div className="lg:col-span-2 bg-slate-900/60 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 md:p-8 flex flex-col justify-between shadow-2xl">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-bold font-mono text-slate-950 bg-cyan-400 px-3 py-1 rounded-full uppercase tracking-widest shadow-[0_0_10px_rgba(34,211,238,0.5)]">
                    {projectData.meta.niche}
                  </span>
                  <span className="text-xs font-mono text-slate-400 border border-white/10 px-3 py-1 rounded-full uppercase">
                    {projectData.meta.language}
                  </span>
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-slate-100 leading-tight">
                  {projectData.meta.topic}
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-4 mt-8">
                <StatBadge icon={<TimeIcon />} label="Duration" value={`${projectData.meta.duration_seconds}s`} />
                <StatBadge icon={<FilmIcon />} label="Scenes" value={projectData.meta.total_scenes} />
                <StatBadge icon={<DocumentIcon />} label="Words" value={projectData.meta.total_words} />
                <StatBadge icon={<TrendingIcon />} label="Viral Score" value={`${projectData.meta.viral_score_vph} VPH`} highlight />
              </div>
            </div>

            {/* Resources & Competitors Panel */}
            <div className="bg-slate-900/60 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 md:p-8 flex flex-col justify-between shadow-2xl">
              <div className="mb-6">
                <h3 className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                  Competitor Radar
                </h3>
                <div className="flex flex-col gap-2">
                  {projectData.meta.competitors?.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noreferrer" className="flex items-center justify-between px-4 py-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all group">
                      <span className="text-sm font-medium text-slate-300 group-hover:text-white truncate max-w-[80%]">
                        Reference {i + 1}
                      </span>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-slate-500 group-hover:text-cyan-400"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
                    </a>
                  ))}
                </div>
              </div>

              <a href={projectData.meta.pdf_url} target="_blank" rel="noreferrer" className="w-full relative overflow-hidden rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 p-[1px] group/pdf transition-transform hover:scale-[1.02] active:scale-[0.98]">
                <div className="relative flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 transition-colors group-hover/pdf:bg-transparent">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-cyan-400 group-hover/pdf:text-slate-950"><path fillRule="evenodd" d="M10 3a.75.75 0 0 1 .75.75v6.827l2.122-2.122a.75.75 0 1 1 1.06 1.06l-3.404 3.405a.75.75 0 0 1-1.06 0L6.07 8.515a.75.75 0 1 1 1.06-1.06l2.12 2.122V3.75A.75.75 0 0 1 10 3ZM4.25 15a.75.75 0 0 1 .75-.75h10a.75.75 0 0 1 0 1.5H5a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" /></svg>
                  <span className="text-sm font-black uppercase tracking-widest text-cyan-400 group-hover/pdf:text-slate-950">Download PDF</span>
                </div>
              </a>
            </div>
          </motion.div>

          {/* Vertical Card Stack */}
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="relative z-10 pl-10">
            {/* Collapse All / Expand All */}
            <div className="flex items-center justify-between mb-8 pl-0">
              <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">{projectData.script.length} scenes</span>
              <button
                onClick={() => setAllCollapsed(v => !v)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/10 transition-colors uppercase tracking-widest"
              >
                {allCollapsed ? (
                  <><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg> Expand All</>
                ) : (
                  <><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg> Collapse All</>
                )}
              </button>
            </div>
            <div aria-hidden="true" className="pointer-events-none absolute left-3 top-0 bottom-0 border-l border-cyan-500/30" />
            <div className="flex flex-col gap-12">
              {projectData.script.map((scene, index) => (
                <ScriptCard
                  key={index}
                  scene={scene}
                  index={index}
                  overrideDialogue={sceneOverrides[index]}
                  veoApiKey={veoApiKey}
                  forceCollapsed={allCollapsed}
                  onSceneChange={async (updatedScenes) => {
                    // Update the local storage array/DB here if you support individual scene overrides
                  }}
                />
              ))}
            </div>
          </motion.div>
        </>
      )}

      {!projectData && jobs.length === 0 && !loading && (
        <div className="relative z-10 w-full rounded-3xl bg-slate-900/60 border border-white/10 p-12 text-center">
          {loadError ? (
            <>
              <div className="mb-6 inline-flex items-center gap-3 px-5 py-3 rounded-2xl bg-rose-500/10 border border-rose-500/30">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                <p className="text-sm font-mono text-rose-300">{loadError}</p>
              </div>
              <br />
            </>
          ) : null}
          <h3 className="text-xl text-slate-300 font-bold mb-4">No Architecture Blueprints Found</h3>
          <p className="text-slate-500 mb-6">Hit &quot;Generate New&quot; to synthesize a script.</p>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-fuchsia-500 px-6 py-3 text-sm font-bold uppercase tracking-widest text-slate-950"
          >
            + Generate New
          </button>
        </div>
      )}
    </div>
  );
}

// --- Icons & Mini Components ---
function StatBadge({ icon, label, value, highlight = false }: { icon: React.ReactNode, label: string, value: string | number, highlight?: boolean }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-2 rounded-2xl border ${highlight ? 'bg-fuchsia-500/10 border-fuchsia-500/30' : 'bg-white/5 border-white/10'} backdrop-blur-md`}>
      <div className={`${highlight ? 'text-fuchsia-400' : 'text-cyan-400'}`}>{icon}</div>
      <div className="flex flex-col">
        <span className="text-[10px] font-bold tracking-widest uppercase text-slate-500">{label}</span>
        <span className={`text-sm font-black ${highlight ? 'text-fuchsia-300 drop-shadow-[0_0_8px_rgba(217,70,239,0.5)]' : 'text-slate-200'}`}>{value}</span>
      </div>
    </div>
  );
}

const TimeIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>);
const FilmIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" /></svg>);
const DocumentIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>);
const TrendingIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" /></svg>);

// --- Helper for Dynamic Color Codes ---
function getColorStyles(colorCode: string) {
  const code = colorCode?.toLowerCase() || "blue";
  if (code === "green") return { text: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/20", glow: "rgba(52,211,153,0.3)" };
  if (code === "yellow") return { text: "text-amber-400", bg: "bg-amber-400/10", border: "border-amber-400/20", glow: "rgba(251,191,36,0.3)" };
  if (code === "red") return { text: "text-rose-400", bg: "bg-rose-400/10", border: "border-rose-400/20", glow: "rgba(244,63,94,0.3)" };
  return { text: "text-cyan-400", bg: "bg-cyan-400/10", border: "border-cyan-400/20", glow: "rgba(34,211,238,0.3)" };
}

// --- Script Card Component ---
type ScriptCardProps = {
  scene: ScriptScene;
  index: number;
  overrideDialogue?: string;
  veoApiKey: string;
  forceCollapsed?: boolean;
  onSceneChange?: (scenes: string[]) => Promise<void> | void;
};

function ScriptCard({ scene, index, overrideDialogue, veoApiKey, forceCollapsed, onSceneChange }: ScriptCardProps) {
  const [currentScriptDialogue, setCurrentScriptDialogue] = useState(overrideDialogue || scene.script_dialogue);
  const [currentVeoPrompt, setCurrentVeoPrompt] = useState(scene.veo_prompt);
  const [isCopiedDialogue, setIsCopiedDialogue] = useState(false);
  const [isCopiedPrompt, setIsCopiedPrompt] = useState(false);
  const [isCopiedShoot, setIsCopiedShoot] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Sync with parent collapse-all
  useEffect(() => { if (forceCollapsed !== undefined) setIsCollapsed(forceCollapsed); }, [forceCollapsed]);
  
  const [instruction, setInstruction] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Images: store as { file: File, previewUrl: string }
  const [imageFiles, setImageFiles] = useState<{ file: File; previewUrl: string }[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [veoResult, setVeoResult] = useState<{ videoUrl?: string; jobId?: string; error?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const colors = getColorStyles(scene.color_code);
  const MAX_IMAGES = 1;

  const handleCopyDialogue = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(currentScriptDialogue);
    setIsCopiedDialogue(true);
    setTimeout(() => setIsCopiedDialogue(false), 2000);
  };

  const handleCopyPrompt = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(currentVeoPrompt);
    setIsCopiedPrompt(true);
    setTimeout(() => setIsCopiedPrompt(false), 2000);
  };

  const handleCopyShoot = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(scene.shoot_instructions);
    setIsCopiedShoot(true);
    setTimeout(() => setIsCopiedShoot(false), 2000);
  };

  const [modifyError, setModifyError] = useState<string | null>(null);

  const handleModifySubmit = async () => {
    if (!instruction.trim()) return;
    setIsLoading(true);
    setModifyError(null);
    try {
      const res = await fetch("/api/scene-modify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instruction,
          currentDialogue: currentScriptDialogue,
          currentVeoPrompt,
          shootInstructions: scene.shoot_instructions,
          sceneNumber: scene.scene_number,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setModifyError(data.error || `API error ${res.status}`);
        return;
      }
      setCurrentScriptDialogue(data.dialogue);
      setCurrentVeoPrompt(data.veo_prompt);
      setInstruction("");
    } catch (error: any) {
      setModifyError(error.message || "Failed to modify scene");
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setImageFiles(prev => {
      const remaining = MAX_IMAGES - prev.length;
      if (remaining <= 0) return prev;
      const toAdd = files.slice(0, remaining).map(file => ({
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      return [...prev, ...toAdd];
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setImageFiles(prev => {
      URL.revokeObjectURL(prev[idx].previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  };

  // Convert File to base64
  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleGenerate = async () => {
    if (!veoApiKey.trim()) {
      setVeoResult({ error: "Please enter your xAI Video API key (Step 2 above)." });
      return;
    }
    setIsGenerating(true);
    setVeoResult(null);
    try {
      // Convert images to base64
      const images = await Promise.all(
        imageFiles.map(async ({ file }) => ({
          base64: await fileToBase64(file),
          mimeType: file.type,
        }))
      );

      const res = await fetch("/api/xai-video-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          xaiApiKey: veoApiKey,
          prompt: currentVeoPrompt,
          duration: 15,
          images,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setVeoResult({ error: data.error || `xAI Video API error ${res.status}` });
      } else {
        setVeoResult({
          videoUrl: data.video_url || data.url || data.output,
          jobId: data.job_id || data.id,
        });
      }
    } catch (err: any) {
      setVeoResult({ error: err.message || "Generation failed" });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="relative flex flex-col xl:flex-row items-start gap-6" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      <div className="relative w-full max-w-xl">
        {/* Scene header with collapse toggle */}
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-bold tracking-[0.2em] text-cyan-400 uppercase">
              SCENE {String(scene.scene_number).padStart(2, '0')}
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono bg-white/5 border border-white/10 px-2 py-0.5 rounded text-slate-400 flex items-center gap-1">
                <TimeIcon /> {scene.estimated_time_seconds}s
              </span>
              <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded border ${colors.bg} ${colors.text} ${colors.border}`}>
                {scene.color_code}
              </span>
            </div>
          </div>
          {/* Collapse / Expand button */}
          <button
            onClick={() => setIsCollapsed(c => !c)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 border border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-colors shrink-0"
          >
            {isCollapsed ? (
              <><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg> Expand</>
            ) : (
              <><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg> Collapse</>
            )}
          </button>
        </div>
        
        <AnimatePresence initial={false}>
          {isCollapsed ? (
            /* Collapsed pill — shows dialogue preview */
            <motion.div
              key="collapsed"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div
                onClick={() => setIsCollapsed(false)}
                className={`cursor-pointer rounded-2xl bg-slate-900/60 backdrop-blur-2xl border border-white/10 px-6 py-4 flex items-center gap-4 hover:border-cyan-400/40 transition-colors`}
              >
                <div aria-hidden="true" style={{ background: colors.glow, boxShadow: `0 0 8px ${colors.glow}` }} className="w-2 h-2 rounded-full shrink-0" />
                <p className="text-sm text-slate-400 truncate flex-1 italic">{currentScriptDialogue.slice(0, 80)}{currentScriptDialogue.length > 80 ? "…" : ""}</p>
                <span className="text-[10px] text-slate-500 uppercase tracking-widest shrink-0">click to expand</span>
              </div>
            </motion.div>
          ) : (
            /* Expanded full card */
            <motion.div
              key="expanded"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
        <div className={`group relative rounded-3xl bg-slate-900/60 backdrop-blur-2xl border border-white/10 p-6 md:p-8 transition-colors duration-300 hover:border-cyan-400/50 hover:shadow-[0px_20px_40px_-10px_rgba(6,182,212,0.2)]`}>
          <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
            <div className="absolute -inset-24 bg-gradient-to-br from-cyan-500/10 via-transparent to-fuchsia-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl" />
            <div className={`absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 ${colors.border} rounded-tl-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
          </div>

          <div aria-hidden="true" style={{ borderColor: colors.glow, boxShadow: `0 0 12px ${colors.glow}` }} className={`absolute -left-[45px] top-12 w-4 h-4 rounded-full border-2 bg-slate-950`} />
          
          <div className="relative z-10 flex flex-col gap-6">
            <div>
              <div className="flex flex-wrap items-center justify-between border-b border-white/10 pb-3 mb-3 gap-4">
                <span className="text-xs font-mono text-slate-400 uppercase tracking-widest flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />Script / Dialogue</span>
                <button onClick={handleCopyDialogue} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 hover:text-white transition-colors opacity-100 md:opacity-0 group-hover:opacity-100">
                  {isCopiedDialogue ? "Copied" : "Copy"}
                </button>
              </div>
              <textarea value={currentScriptDialogue} onChange={e => setCurrentScriptDialogue(e.target.value)} className="w-full bg-transparent text-lg leading-relaxed text-slate-200 whitespace-pre-wrap resize-none focus:outline-none focus:ring-1 focus:ring-cyan-400/50 rounded-lg p-1 min-h-[160px]" />
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
              <div className="flex flex-wrap items-center justify-between pb-2 mb-2 gap-4">
                <span className="text-xs font-mono text-slate-400 uppercase tracking-widest flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />Shoot Instructions</span>
                <button onClick={handleCopyShoot} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 hover:text-white transition-colors opacity-100 md:opacity-0 group-hover:opacity-100">
                  {isCopiedShoot ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="text-sm leading-relaxed text-amber-200/80 whitespace-pre-wrap">{scene.shoot_instructions}</p>
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-between border-b border-white/10 pb-3 mb-3 gap-4">
                <span className="text-xs font-mono text-slate-400 uppercase tracking-widest flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-fuchsia-500 animate-pulse" />Veo Generation Prompt</span>
                <div className="flex items-center gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <button onClick={handleCopyPrompt} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 hover:text-white transition-colors">
                    {isCopiedPrompt ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
              <textarea value={currentVeoPrompt} onChange={e => setCurrentVeoPrompt(e.target.value)} className="w-full bg-transparent text-md leading-relaxed text-slate-300 italic resize-none focus:outline-none focus:ring-1 focus:ring-fuchsia-400/50 rounded-lg p-1 min-h-[80px]" />
            </div>

            <AnimatePresence>
              {isHovered && (
                <motion.div initial={{ height: 0, opacity: 0, marginTop: 0 }} animate={{ height: 'auto', opacity: 1, marginTop: 16 }} exit={{ height: 0, opacity: 0, marginTop: 0 }} className="overflow-hidden">
                  <div className="p-4 rounded-xl bg-slate-950/50 border border-cyan-500/20 backdrop-blur-md">
                    <label className="block text-xs uppercase tracking-widest text-cyan-400/80 mb-2">Make changes to the script and veo prompt</label>
                    <textarea value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="e.g. Make it darker and raining..." className="w-full bg-slate-900/50 border border-white/10 rounded-lg p-3 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 resize-none h-24" />
                    {modifyError && (
                      <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                        <p className="text-xs font-mono text-rose-300">{modifyError}</p>
                      </div>
                    )}
                    <div className="flex justify-end mt-3">
                      <button onClick={handleModifySubmit} disabled={isLoading || !instruction.trim()} className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                        {isLoading ? "Re-writing..." : "Send to API"}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* OFF-HANGING ATTACHMENT MODULE */}
      <div className="relative flex-shrink-0 xl:mt-9">
        <div className="hidden xl:block absolute top-12 -left-6 w-6 h-[2px] bg-gradient-to-r from-cyan-500/20 to-cyan-500/80" />
        <div className="hidden xl:block absolute top-[45px] -left-1 w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]" />

        <div className="flex flex-col gap-3 p-5 rounded-3xl bg-slate-900/80 backdrop-blur-2xl border border-white/10 shadow-2xl relative group/module transition-colors duration-300 w-[220px]">
          
          {/* Reference Frames header — always visible */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold">
              Reference Frames
            </span>
            <span className="text-[10px] text-slate-500 font-mono">{imageFiles.length}/{MAX_IMAGES}</span>
          </div>

          {/* Image grid — always visible */}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            ref={fileInputRef}
            onChange={handleImageUpload}
          />

          <div className="grid grid-cols-3 gap-2">
            {imageFiles.map(({ previewUrl }, idx) => (
              <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-white/10 group/img">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt={`Ref ${idx + 1}`} className="w-full h-full object-cover" />
                <button
                  onClick={(e) => removeImage(idx, e)}
                  className="absolute inset-0 bg-black/60 text-white text-xs font-bold opacity-0 group-hover/img:opacity-100 flex items-center justify-center hover:bg-red-500/80 transition-all"
                >
                  ✕
                </button>
              </div>
            ))}
            {/* Add slot — show if under limit */}
            {imageFiles.length < MAX_IMAGES && (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square rounded-xl border-2 border-dashed border-white/10 bg-white/5 hover:bg-white/10 hover:border-emerald-500/50 cursor-pointer flex flex-col items-center justify-center text-slate-500 hover:text-emerald-400 transition-colors"
              >
                <span className="text-lg leading-none">+</span>
                <span className="text-[8px] uppercase tracking-widest mt-0.5">Add</span>
              </div>
            )}
          </div>

          {/* xAI Video result */}
          {veoResult && (
            <div className={`rounded-xl p-3 text-xs font-mono ${veoResult.error ? "bg-rose-500/10 border border-rose-500/30 text-rose-300" : "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"}`}>
              {veoResult.error ? (
                <span>⚠ {veoResult.error}</span>
              ) : veoResult.videoUrl ? (
                <a href={veoResult.videoUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                  ▶ View Video
                </a>
              ) : (
                <span>✓ Job queued: {veoResult.jobId?.slice(0, 8)}</span>
              )}
            </div>
          )}

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 p-[1px] group/btn transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            <div className="relative flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 transition-colors group-hover/btn:bg-transparent">
              {isGenerating ? (
                <><svg className="animate-spin h-3 w-3 text-emerald-400 group-hover/btn:text-slate-950" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                <span className="text-xs font-black uppercase tracking-widest text-emerald-400 group-hover/btn:text-slate-950">Generating...</span></>
              ) : (
                <span className="text-xs font-black uppercase tracking-widest text-emerald-400 group-hover/btn:text-slate-950">Generate xAI Video</span>
              )}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
// Next.js 14 requires useSearchParams() to be inside a Suspense boundary.
// This wrapper satisfies that constraint without changing any component logic.
export default function TheArchitectRoot() {
  return (
    <Suspense>
      <TheArchitect />
    </Suspense>
  );
}
