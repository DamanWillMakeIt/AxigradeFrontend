import Link from "next/link";
import {
  LayoutDashboard,
  Wrench,
  Shield,
} from "lucide-react";
import type { SessionUser } from "@/lib/auth";
import { LogoutButton } from "./logout-button";
import { ThemeToggle } from "./theme-toggle";

type SidebarProps = {
  user: SessionUser;
};

export function Sidebar({ user }: SidebarProps) {
  const isAdmin = user.role === "admin";

  return (
    <aside className="w-[300px] min-h-screen border-r border-white/10 flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white relative overflow-hidden">
      {/* Subtle ambient background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-48 h-48 bg-violet-500/[0.05] rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-cyan-500/[0.05] rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 p-6 border-b border-white/10">
        <h1 className="font-display text-6xl leading-none mb-6 bg-gradient-to-r from-white via-violet-200 to-cyan-300 bg-clip-text text-transparent font-bold">
          Axigrade
        </h1>
        <div className="space-y-2">
          <p className="font-body text-lg leading-none text-slate-100 font-bold">{user.name}</p>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400/70">
            {user.email}
          </p>
          <div className="flex items-center gap-2 pt-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]"></div>
            <p className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-400/80">
              {user.role}
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 flex flex-col gap-2 relative z-10">
        <Link
          href="/dashboard"
          className="group flex items-center gap-3 px-4 py-3.5 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-cyan-400/30 transition-all backdrop-blur-sm"
        >
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-400/20 flex items-center justify-center group-hover:scale-110 transition-transform backdrop-blur-sm">
            <LayoutDashboard size={18} className="text-cyan-300" />
          </div>
          <span className="font-bold text-base tracking-tight text-slate-200 group-hover:text-white transition-colors">Dashboard</span>
        </Link>
        
        <Link
          href="/tools"
          className="group flex items-center gap-3 px-4 py-3.5 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-violet-400/30 transition-all backdrop-blur-sm"
        >
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-400/20 flex items-center justify-center group-hover:scale-110 transition-transform backdrop-blur-sm">
            <Wrench size={18} className="text-violet-300" />
          </div>
          <span className="font-bold text-base tracking-tight text-slate-200 group-hover:text-white transition-colors">Tools</span>
        </Link>
        
        {isAdmin && (
          <Link
            href="/admin"
            className="group flex items-center gap-3 px-4 py-3.5 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-emerald-400/30 transition-all backdrop-blur-sm"
          >
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-400/20 flex items-center justify-center group-hover:scale-110 transition-transform backdrop-blur-sm">
              <Shield size={18} className="text-emerald-300" />
            </div>
            <span className="font-bold text-base tracking-tight text-slate-200 group-hover:text-white transition-colors">Admin</span>
          </Link>
        )}
      </nav>

      <div className="relative z-10 p-4 border-t border-white/10 space-y-2 bg-slate-900/50 backdrop-blur-sm">
        <ThemeToggle />
        <LogoutButton />
      </div>
    </aside>
  );
}
