import Link from "next/link";
import { tools } from "@/lib/tools";
import { Zap, ArrowRight } from "lucide-react";

export default function ToolsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Enhanced ambient background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-violet-500/[0.08] rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-cyan-500/[0.08] rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-fuchsia-500/[0.05] rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 max-w-[1600px] mx-auto px-8 py-12">
        {/* Header */}
        <div className="mb-14">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-violet-400/20 flex items-center justify-center backdrop-blur-sm">
              <Zap className="w-7 h-7 text-violet-300" />
            </div>
            <div className="text-xs font-bold font-mono text-violet-400/70 uppercase tracking-[0.25em] flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse"></div>
              TOOL SUITE
            </div>
          </div>
          
          <div className="flex items-end justify-between pb-8 border-b border-white/10">
            <div>
              <h1 className="text-8xl font-black tracking-tight bg-gradient-to-r from-white via-violet-200 to-cyan-300 bg-clip-text text-transparent mb-5 leading-none">
                Tools
              </h1>
              <p className="text-xl font-semibold text-slate-300 max-w-2xl leading-relaxed">
                Professional AI-powered tools for content creation, optimization, and analysis.
              </p>
            </div>
            
            <div className="hidden md:block">
              <div className="text-right">
                <p className="text-xs font-bold text-violet-400/60 uppercase tracking-[0.15em] mb-2">AVAILABLE TOOLS</p>
                <div className="flex items-baseline gap-3 justify-end">
                  <span className="text-6xl font-black bg-gradient-to-r from-white to-violet-200 bg-clip-text text-transparent leading-none">{tools.length.toString().padStart(2, "0")}</span>
                  <span className="text-base font-bold text-slate-500 uppercase tracking-wider">ACTIVE</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tools Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {tools.map((tool, index) => {
            const gradients = [
              { bg: "from-cyan-500/20 to-blue-500/20", border: "border-cyan-400/20", hover: "hover:border-cyan-400/50", shadow: "group-hover:shadow-[0_0_25px_rgba(34,211,238,0.25)]", text: "text-cyan-300" },
              { bg: "from-violet-500/20 to-fuchsia-500/20", border: "border-violet-400/20", hover: "hover:border-violet-400/50", shadow: "group-hover:shadow-[0_0_25px_rgba(139,92,246,0.25)]", text: "text-violet-300" },
              { bg: "from-emerald-500/20 to-teal-500/20", border: "border-emerald-400/20", hover: "hover:border-emerald-400/50", shadow: "group-hover:shadow-[0_0_25px_rgba(52,211,153,0.25)]", text: "text-emerald-300" },
              { bg: "from-orange-500/20 to-rose-500/20", border: "border-orange-400/20", hover: "hover:border-orange-400/50", shadow: "group-hover:shadow-[0_0_25px_rgba(251,146,60,0.25)]", text: "text-orange-300" },
              { bg: "from-pink-500/20 to-rose-500/20", border: "border-pink-400/20", hover: "hover:border-pink-400/50", shadow: "group-hover:shadow-[0_0_25px_rgba(236,72,153,0.25)]", text: "text-pink-300" },
              { bg: "from-blue-500/20 to-indigo-500/20", border: "border-blue-400/20", hover: "hover:border-blue-400/50", shadow: "group-hover:shadow-[0_0_25px_rgba(59,130,246,0.25)]", text: "text-blue-300" },
            ];

            const colors = gradients[index % gradients.length];

            return (
              <Link
                key={tool.id}
                href={`/tools/${tool.id}`}
                className={`group relative bg-gradient-to-br from-slate-900/80 to-slate-800/80 backdrop-blur-2xl rounded-3xl border border-white/10 ${colors.hover} p-8 transition-all duration-500 hover:scale-[1.02] overflow-hidden shadow-2xl shadow-black/20 ${colors.shadow}`}
              >
                {/* Hover effect background */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/0 via-white/0 to-white/0 group-hover:from-white/[0.03] group-hover:via-white/[0.01] group-hover:to-transparent transition-all duration-700 rounded-3xl"></div>
                
                <div className="relative">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-6">
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${colors.bg} border ${colors.border} flex items-center justify-center group-hover:scale-110 transition-all duration-300 backdrop-blur-sm`}>
                      <Zap className={`w-7 h-7 ${colors.text}`} />
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs font-bold font-mono text-slate-500 uppercase tracking-wider">#{(index + 1).toString().padStart(2, "0")}</span>
                      <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-slate-300 group-hover:translate-x-1 transition-all duration-300" />
                    </div>
                  </div>

                  {/* Content */}
                  <h2 className="text-3xl font-black mb-4 bg-gradient-to-r from-white to-slate-200 bg-clip-text text-transparent group-hover:from-white group-hover:to-slate-100 transition-all duration-300">
                    {tool.name}
                  </h2>
                  
                  <p className="text-base font-medium text-slate-400 leading-relaxed mb-6">
                    {tool.description}
                  </p>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-6 border-t border-white/10">
                    <span className="text-sm font-bold uppercase tracking-wider text-slate-500 group-hover:text-slate-300 transition-colors">
                      LAUNCH TOOL
                    </span>
                    <div className={`w-10 h-10 rounded-xl bg-white/5 group-hover:bg-white/10 border ${colors.border} flex items-center justify-center transition-all duration-300 backdrop-blur-sm`}>
                      <span className="text-slate-400 group-hover:text-white transition-all text-lg">→</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Footer */}
        <div className="bg-gradient-to-br from-slate-900/80 to-slate-800/80 backdrop-blur-2xl rounded-3xl border border-white/10 px-8 py-6 shadow-2xl shadow-black/20">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-base font-semibold text-slate-300">
              All tools powered by cutting-edge AI models, optimized for professional use.
            </p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"></div>
              <span className="text-xs font-bold font-mono uppercase tracking-wider text-emerald-400/80">
                ALL SYSTEMS ONLINE
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
