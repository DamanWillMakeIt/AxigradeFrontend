"use client";

import { useEffect, useState } from "react";
import { Activity, Zap, TrendingUp, Sparkles, Star, Bell, ArrowRight } from "lucide-react";
import { dashboardNews } from "@/lib/dashboard-news";
import Link from "next/link";

type UserData = {
  email: string;
  name?: string;
  createdAt: string;
};

export default function DashboardPage() {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) setUser(d.user);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case "sparkles":
        return <Sparkles className="w-5 h-5" />;
      case "zap":
        return <Zap className="w-5 h-5" />;
      case "rocket":
        return <TrendingUp className="w-5 h-5" />;
      case "star":
        return <Star className="w-5 h-5" />;
      case "bell":
        return <Bell className="w-5 h-5" />;
      default:
        return <Sparkles className="w-5 h-5" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Enhanced ambient background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/3 w-[500px] h-[500px] bg-cyan-500/[0.08] rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/3 w-[500px] h-[500px] bg-violet-500/[0.08] rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-fuchsia-500/[0.05] rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 max-w-[1600px] mx-auto px-8 py-12 space-y-10">
        {/* Header */}
        <div className="flex items-end justify-between pb-8 border-b border-white/10">
          <div>
            <div className="text-xs font-bold font-mono text-cyan-400/70 uppercase tracking-[0.25em] mb-4 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></div>
              DASHBOARD
            </div>
            <h1 className="text-8xl font-black tracking-tight bg-gradient-to-r from-white via-cyan-200 to-violet-300 bg-clip-text text-transparent leading-none">
              Welcome Back
            </h1>
          </div>
          <div className="text-right space-y-2">
            <p className="text-xs font-bold font-mono text-slate-400 uppercase tracking-[0.2em]">
              {new Date().toLocaleDateString("en-US", { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric',
                year: 'numeric'
              })}
            </p>
            <div className="flex items-center gap-2 justify-end">
              <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"></div>
              <span className="text-xs font-bold text-emerald-400/80 uppercase tracking-wider">SYSTEMS ONLINE</span>
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Account Card */}
          <div className="lg:col-span-4 bg-gradient-to-br from-slate-900/80 to-slate-800/80 backdrop-blur-2xl rounded-3xl border border-white/10 p-8 hover:border-cyan-400/30 transition-all group shadow-2xl shadow-black/20">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-cyan-500/5 to-violet-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
            
            <div className="relative">
              <div className="flex items-center gap-3 mb-8 pb-6 border-b border-white/10">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border border-cyan-400/20 flex items-center justify-center backdrop-blur-sm">
                  <Activity className="w-7 h-7 text-cyan-300" />
                </div>
                <h2 className="text-2xl font-black tracking-tight">Account Overview</h2>
              </div>

              {loading ? (
                <div className="space-y-5">
                  <div className="h-4 bg-white/5 rounded-lg animate-pulse"></div>
                  <div className="h-4 bg-white/5 rounded-lg w-2/3 animate-pulse"></div>
                </div>
              ) : user ? (
                <div className="space-y-6">
                  <div>
                    <p className="text-xs font-bold text-cyan-400/60 uppercase tracking-[0.15em] mb-2">EMAIL ADDRESS</p>
                    <p className="text-base font-semibold font-mono text-slate-100 break-all">{user.email}</p>
                  </div>
                  
                  {user.name && (
                    <div>
                      <p className="text-xs font-bold text-cyan-400/60 uppercase tracking-[0.15em] mb-2">DISPLAY NAME</p>
                      <p className="text-base font-semibold text-slate-100">{user.name}</p>
                    </div>
                  )}
                  
                  <div>
                    <p className="text-xs font-bold text-cyan-400/60 uppercase tracking-[0.15em] mb-2">MEMBER SINCE</p>
                    <p className="text-base font-semibold text-slate-100">
                      {new Date(user.createdAt).toLocaleDateString("en-US", {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>
                  </div>

                  <div className="pt-5 mt-5 border-t border-white/10">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]"></div>
                      <p className="text-xs font-bold text-emerald-400/80 uppercase tracking-wider">ACTIVE ACCOUNT</p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Unable to load account data</p>
              )}
            </div>
          </div>

          {/* Quick Access Cards */}
          <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Link 
              href="/tools"
              className="group relative bg-gradient-to-br from-slate-900/80 to-slate-800/80 backdrop-blur-2xl rounded-3xl border border-white/10 p-8 hover:border-cyan-400/50 transition-all overflow-hidden shadow-2xl shadow-black/20"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/0 via-cyan-500/0 to-cyan-500/0 group-hover:from-cyan-500/10 group-hover:via-cyan-500/5 group-hover:to-transparent transition-all duration-700"></div>
              
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-400/20 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(34,211,238,0.3)] transition-all duration-300 backdrop-blur-sm">
                  <Zap className="w-8 h-8 text-cyan-300" />
                </div>
                <h3 className="text-3xl font-black mb-3 bg-gradient-to-r from-white to-cyan-200 bg-clip-text text-transparent">All Tools</h3>
                <p className="text-base font-semibold text-slate-300 mb-6 leading-relaxed">Browse the complete AI suite</p>
                <div className="flex items-center gap-2 text-sm text-cyan-400 font-bold uppercase tracking-wider">
                  <span>EXPLORE</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>

            <Link 
              href="/tools/yt-studio"
              className="group relative bg-gradient-to-br from-slate-900/80 to-slate-800/80 backdrop-blur-2xl rounded-3xl border border-white/10 p-8 hover:border-violet-400/50 transition-all overflow-hidden shadow-2xl shadow-black/20"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500/0 via-violet-500/0 to-violet-500/0 group-hover:from-violet-500/10 group-hover:via-violet-500/5 group-hover:to-transparent transition-all duration-700"></div>
              
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-400/20 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all duration-300 backdrop-blur-sm">
                  <TrendingUp className="w-8 h-8 text-violet-300" />
                </div>
                <h3 className="text-3xl font-black mb-3 bg-gradient-to-r from-white to-violet-200 bg-clip-text text-transparent">YouTube Studio</h3>
                <p className="text-base font-semibold text-slate-300 mb-6 leading-relaxed">Content creation powerhouse</p>
                <div className="flex items-center gap-2 text-sm text-violet-400 font-bold uppercase tracking-wider">
                  <span>LAUNCH</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>

            <Link 
              href="/tools/prompt-to-ppt"
              className="group relative bg-gradient-to-br from-slate-900/80 to-slate-800/80 backdrop-blur-2xl rounded-3xl border border-white/10 p-8 hover:border-emerald-400/50 transition-all overflow-hidden sm:col-span-2 shadow-2xl shadow-black/20"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/0 via-emerald-500/0 to-emerald-500/0 group-hover:from-emerald-500/10 group-hover:via-emerald-500/5 group-hover:to-transparent transition-all duration-700"></div>
              
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-400/20 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(52,211,153,0.3)] transition-all duration-300 backdrop-blur-sm">
                  <Sparkles className="w-8 h-8 text-emerald-300" />
                </div>
                <h3 className="text-3xl font-black mb-3 bg-gradient-to-r from-white to-emerald-200 bg-clip-text text-transparent">Prompt to PPT</h3>
                <p className="text-base font-semibold text-slate-300 mb-6 leading-relaxed">Generate presentations with AI magic</p>
                <div className="flex items-center gap-2 text-sm text-emerald-400 font-bold uppercase tracking-wider">
                  <span>CREATE</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Latest Updates */}
        <div className="bg-gradient-to-br from-slate-900/80 to-slate-800/80 backdrop-blur-2xl rounded-3xl border border-white/10 overflow-hidden shadow-2xl shadow-black/20">
          <div className="flex items-center justify-between px-8 py-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border border-cyan-400/20 flex items-center justify-center backdrop-blur-sm">
                <Sparkles className="w-6 h-6 text-cyan-300" />
              </div>
              <h2 className="text-2xl font-black tracking-tight">Latest Updates</h2>
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">WHAT&apos;S NEW</p>
          </div>

          <div className="divide-y divide-white/5">
            {dashboardNews.map((item) => (
              <div 
                key={item.id} 
                className="px-8 py-6 hover:bg-white/[0.03] transition-all group"
              >
                <div className="flex items-start gap-5">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-800/80 to-slate-700/80 border border-white/10 flex items-center justify-center group-hover:border-cyan-400/30 group-hover:scale-105 transition-all backdrop-blur-sm">
                    {getIcon(item.icon)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <h3 className="font-bold text-xl leading-tight text-slate-50">{item.title}</h3>
                      <span className="px-3 py-1.5 rounded-lg bg-slate-800/80 border border-white/10 text-xs font-bold uppercase tracking-wider text-cyan-400/80 whitespace-nowrap backdrop-blur-sm">
                        {item.tag}
                      </span>
                    </div>
                    <p className="text-base font-medium text-slate-400 leading-relaxed">{item.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="px-8 py-5 border-t border-white/10 bg-slate-900/50">
            <p className="text-xs text-center text-slate-500 font-semibold">
              Got feedback?{" "}
              <a href="mailto:feedback@axigrade.com" className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition-colors font-bold">
                We&apos;d love to hear it
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
