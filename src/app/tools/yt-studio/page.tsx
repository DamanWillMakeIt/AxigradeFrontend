"use client";

import React from "react";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { useRouter } from "next/navigation";

type ProjectSummary = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

const personas = [
  {
    id: "architect",
    title: "THE ARCHITECT",
    subtitle: "Narrative masterplanner",
    description: "Design the spine of your video: beats, reveals, and retention architecture.",
    href: "/tools/yt-studio/architect",
    gradient: "from-cyan-400 via-sky-500 to-fuchsia-500",
    glow: "shadow-[0_0_45px_rgba(56,189,248,0.4)]",
  },
  {
    id: "click-engineer",
    title: "CLICK ENGINEER",
    subtitle: "Title & thumbnail tactician",
    description: "Engineer irresistible entry points that the algorithm can’t ignore.",
    href: "/tools/yt-studio/click-engineer",
    gradient: "from-amber-400 via-orange-500 to-rose-500",
    glow: "shadow-[0_0_45px_rgba(251,191,36,0.4)]",
  },
  {
    id: "algorithm-whisperer",
    title: "ALGO WHISPERER",
    subtitle: "Signal sculptor",
    description: "Shape watch-time, CTR, and session metrics into a consistent growth curve.",
    href: "/tools/yt-studio/algorithm-whisperer",
    gradient: "from-emerald-400 via-teal-500 to-cyan-500",
    glow: "shadow-[0_0_45px_rgba(52,211,153,0.4)]",
  },
  {
    id: "quality-critic",
    title: "QUALITY CRITIC",
    subtitle: "Brutally honest reviewer",
    description: "Audit structure, pacing, and clarity before the audience ever sees it.",
    href: "/tools/yt-studio/quality-critic",
    gradient: "from-rose-400 via-fuchsia-500 to-purple-500",
    glow: "shadow-[0_0_45px_rgba(244,114,182,0.4)]",
  },
  {
    id: "visual-hook",
    title: "THE VISUAL HOOK",
    subtitle: "First-frame alchemist",
    description: "Prototype visual moments that freeze the scroll in the first three seconds.",
    href: "/tools/yt-studio/visual-hook",
    gradient: "from-indigo-400 via-violet-500 to-cyan-400",
    glow: "shadow-[0_0_45px_rgba(129,140,248,0.4)]",
  },
] as const;

// --- Futuristic Background Orbs ---
const CyberBackground = () => {
  const colors = ["bg-cyan-500", "bg-fuchsia-600", "bg-violet-600", "bg-emerald-500"];
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const orbConfigs = React.useMemo(
    () =>
      [...Array(8)].map(() => ({
        width: Math.random() * 380 + 220,
        height: Math.random() * 380 + 220,
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
        duration: Math.random() * 18 + 14,
      })),
    []
  );

  return (
    <div className="fixed inset-0 overflow-hidden bg-slate-950 -z-10">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,#000_20%,transparent_100%)]" />
      {isMounted &&
        orbConfigs.map((config, i) => (
          <motion.div
            key={i}
            className={`absolute rounded-full opacity-25 blur-[110px] mix-blend-screen ${colors[i % colors.length]}`}
            style={{ width: config.width, height: config.height }}
            animate={{
              x: config.x,
              y: config.y,
              scale: [0.9, 1.4, 1],
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
  hidden: { opacity: 0, y: 40 },
  show: {
    opacity: 1,
    y: 0,
    transition: { staggerChildren: 0.12, delayChildren: 0.15, ease: "easeOut" },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 40, scale: 0.9, rotateX: 12 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    rotateX: 0,
    transition: { type: "spring", stiffness: 130, damping: 18 },
  },
};

export default function ArchitectSuite() {
  const router = useRouter();
  const [projects, setProjects] = React.useState<ProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = React.useState<string | null>(null);
  const [loadingProjects, setLoadingProjects] = React.useState(false);
  const [creatingProject, setCreatingProject] = React.useState(false);
  const [projectName, setProjectName] = React.useState("");
  const [projectDescription, setProjectDescription] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const loadProjects = async () => {
      try {
        setLoadingProjects(true);
        setError(null);
        const res = await fetch("/api/yt-projects");
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (!res.ok) {
          throw new Error("Failed to load projects");
        }
        const data = await res.json();
        setProjects(data.projects ?? []);
      } catch (err) {
        console.error(err);
        setError("Unable to load projects right now.");
      } finally {
        setLoadingProjects(false);
      }
    };

    loadProjects();
  }, [router]);

  const handleCreateProject = async () => {
    if (!projectName.trim()) return;
    try {
      setCreatingProject(true);
      setError(null);
      const res = await fetch("/api/yt-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectName.trim(),
          description: projectDescription.trim() || undefined,
        }),
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        throw new Error("Failed to create project");
      }
      const data = await res.json();
      const created: ProjectSummary = data.project;
      setProjects((prev) => [created, ...prev]);
      setSelectedProjectId(created.id);
      setProjectName("");
      setProjectDescription("");
    } catch (err) {
      console.error(err);
      setError("Unable to create project.");
    } finally {
      setCreatingProject(false);
    }
  };

  return (
    <div className="relative min-h-[100dvh] w-full text-slate-200 font-sans overflow-x-hidden p-6 md:p-12 perspective-[1000px]">
      <CyberBackground />

      {/* --- Top Navigation Bar --- */}
      <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-6 mb-10 max-w-7xl mx-auto">
        <motion.button
          onClick={() => router.back()}
          whileHover={{ scale: 1.08, x: -4, boxShadow: "0px 0px 18px rgba(56,189,248,0.7)" }}
          whileTap={{ scale: 0.9 }}
          className="flex items-center justify-center w-12 h-12 rounded-full bg-white/5 border border-cyan-400/40 backdrop-blur-md text-cyan-300 transition-colors hover:bg-cyan-500/10 flex-shrink-0"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </motion.button>

        <div className="flex-1 flex flex-col gap-2">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="text-4xl md:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-amber-400 drop-shadow-[0_0_18px_rgba(56,189,248,0.5)] uppercase"
          >
            YouTube Suite
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
            className="max-w-2xl text-sm md:text-base text-slate-300"
          >
            Create or select a project, then open one of the five hyper-focused roles to architect, optimize, and weaponize every second of your YouTube videos.
          </motion.p>
        </div>
      </div>

      {/* --- Project Selection / Creation --- */}
      <div className="relative z-10 max-w-7xl mx-auto mb-10 grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="rounded-3xl border border-white/10 bg-slate-950/70 backdrop-blur-2xl p-5 md:p-6">
          <h2 className="text-xs font-bold tracking-[0.2em] text-cyan-300 uppercase mb-3">
            Project Info
          </h2>
          <p className="text-xs text-slate-400 mb-4">
            This is your base document for the video: high-level idea, target audience, and any constraints you want every submodule to respect.
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] uppercase tracking-[0.18em] text-slate-400 mb-1.5">
                Project Name
              </label>
              <input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g. 0 to 10K subs in 90 days"
                className="w-full rounded-xl bg-slate-900/70 border border-white/10 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-[0.18em] text-slate-400 mb-1.5">
                Project Description
              </label>
              <textarea
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="Short description, channel niche, and what success looks like for this project."
                className="w-full rounded-xl bg-slate-900/70 border border-white/10 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 resize-none h-24"
              />
            </div>
            <button
              onClick={handleCreateProject}
              disabled={creatingProject || !projectName.trim()}
              className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-950 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(56,189,248,0.4)]"
            >
              {creatingProject ? "Creating..." : "Create Project"}
            </button>
            {error && (
              <p className="text-xs text-rose-400 mt-2">
                {error}
              </p>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/70 backdrop-blur-2xl p-5 md:p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold tracking-[0.2em] text-cyan-300 uppercase">
              Select Existing Project
            </h2>
            {loadingProjects && (
              <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                Loading...
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mb-3">
            All five submodules will read from and write back to this project&apos;s documents.
          </p>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {projects.length === 0 && !loadingProjects && (
              <p className="text-xs text-slate-500">
                No projects yet. Create your first project on the left.
              </p>
            )}
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => setSelectedProjectId(project.id)}
                className={`w-full text-left rounded-2xl border px-3 py-2.5 text-sm transition-colors ${
                  selectedProjectId === project.id
                    ? "border-cyan-400/60 bg-cyan-500/10"
                    : "border-white/10 bg-slate-900/50 hover:border-cyan-400/40 hover:bg-slate-900/80"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-50">
                    {project.name}
                  </span>
                  {selectedProjectId === project.id && (
                    <span className="text-[10px] uppercase tracking-[0.18em] text-cyan-300">
                      Active
                    </span>
                  )}
                </div>
                {project.description && (
                  <p className="mt-1 text-[11px] text-slate-400 line-clamp-2">
                    {project.description}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* --- Centered Flex Wrapping Container --- */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="relative z-10 flex flex-wrap justify-center gap-8 max-w-[1400px] mx-auto"
      >
        {personas.map((persona, index) => {
          const href =
            selectedProjectId != null
              ? {
                  pathname: persona.href,
                  query: { projectId: selectedProjectId },
                }
              : undefined;

          const disabled = !href;

          return (
            <motion.div key={persona.id} variants={cardVariants} className="w-full max-w-[300px] sm:w-[280px]">
              {href ? (
                <Link href={href} className="block focus:outline-none group">
                  <PersonaCard persona={persona} index={index} />
                </Link>
              ) : (
                <div className="opacity-50 cursor-not-allowed">
                  <PersonaCard persona={persona} index={index} locked />
                </div>
              )}
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}

type Persona = (typeof personas)[number];

function PersonaCard({
  persona,
  index,
  locked,
}: {
  persona: Persona;
  index: number;
  locked?: boolean;
}) {
  return (
    <motion.div
      whileHover={
        locked
          ? undefined
          : {
              y: -12,
              scale: 1.05,
              rotateY: 6,
              rotateX: 4,
            }
      }
      whileTap={locked ? undefined : { scale: 0.98 }}
      className={`relative flex flex-col justify-between aspect-[5/8] overflow-hidden rounded-[24px] border border-white/10 bg-slate-900/60 backdrop-blur-3xl p-6 md:p-7 transition-all duration-300 ${
        persona.glow
      } ${locked ? "" : "cursor-pointer group-hover:border-white/30"}`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${persona.gradient} opacity-10 mix-blend-screen blur-xl transition-opacity duration-500`} />
      <div className="absolute inset-0 bg-gradient-to-tr from-white/5 via-transparent to-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none rounded-[24px]" />

      <div className="relative z-10 flex items-start justify-between mb-8">
        <svg className="w-10 h-10 text-slate-400/50 group-hover:text-amber-300/60 transition-colors duration-300" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="4" y="8" width="40" height="32" rx="6" stroke="currentColor" strokeWidth="2" />
          <path d="M4 24H20M28 24H44M16 8V40M32 8V40M4 16H16M32 16H44M4 32H16M32 32H44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span className="font-mono text-2xl font-bold text-slate-400/30 group-hover:text-slate-100/80 transition-colors">
          {index + 1 < 10 ? `0${index + 1}` : index + 1}
        </span>
      </div>

      <div className="relative z-10 flex flex-col flex-1 justify-end">
        <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-300/80 mb-2 font-semibold">
          {persona.subtitle}
        </div>
        <h2 className="text-2xl font-black tracking-widest text-slate-50 mb-4 group-hover:text-white uppercase leading-none drop-shadow-md">
          {persona.title}
        </h2>
        <p className="text-sm text-slate-300/80 group-hover:text-slate-100 transition-colors line-clamp-3 mb-6">
          {persona.description}
        </p>
      </div>

      <div className="relative z-10 flex items-center justify-between text-xs text-slate-300/80 border-t border-white/10 pt-4 mt-auto">
        <span className="uppercase tracking-[0.2em] text-[10px] font-medium">
          {locked ? "Select Project First" : "Initialize"}
        </span>
        <motion.span
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-slate-900/60 text-slate-100 group-hover:bg-cyan-500 group-hover:border-cyan-400 transition-colors duration-300"
          whileHover={locked ? undefined : { x: 3 }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12h15m0 0-6.5-6.5M19.5 12l-6.5 6.5" />
          </svg>
        </motion.span>
      </div>
    </motion.div>
  );
}
