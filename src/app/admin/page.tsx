"use client";

import { useEffect, useState } from "react";
import { Users, FolderOpen, Key, Shield, Trash2, UserCheck, RefreshCw } from "lucide-react";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
};

type Stats = {
  totalUsers: number;
  totalProjects: number;
  seoKeyCount: number;
  architectKeyCount: number;
  recentUsers: UserRow[];
};

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  async function loadStats() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/stats");
      if (!res.ok) throw new Error(`Failed to load stats (${res.status})`);
      setStats(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadStats(); }, []);

  async function setRole(userId: string, role: string, name: string) {
    if (!confirm(`Set ${name} as ${role}?`)) return;
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role }),
    });
    const data = await res.json();
    if (!res.ok) { setActionMsg(`Error: ${data.error}`); return; }
    setActionMsg(`✓ ${name} is now ${role}`);
    loadStats();
  }

  async function deleteUser(userId: string, email: string) {
    if (!confirm(`Permanently delete user ${email} and ALL their data? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/users?id=${userId}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) { setActionMsg(`Error: ${data.error}`); return; }
    setActionMsg(`✓ User ${email} deleted`);
    loadStats();
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-8">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between pb-6 border-b border-white/10">
          <div>
            <div className="text-xs font-bold font-mono text-red-400/70 uppercase tracking-widest mb-2 flex items-center gap-2">
              <Shield className="w-4 h-4" /> ADMIN PANEL
            </div>
            <h1 className="text-5xl font-black tracking-tight text-white">Control Centre</h1>
          </div>
          <button
            onClick={loadStats}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition text-sm font-semibold"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {actionMsg && (
          <div className="px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-400/30 text-emerald-300 text-sm font-semibold flex justify-between">
            {actionMsg}
            <button onClick={() => setActionMsg(null)} className="opacity-50 hover:opacity-100">✕</button>
          </div>
        )}

        {error && (
          <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-400/30 text-red-300 text-sm font-semibold">{error}</div>
        )}

        {/* Stats cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Users,      label: "Total Users",      value: stats.totalUsers },
              { icon: FolderOpen, label: "Total Projects",   value: stats.totalProjects },
              { icon: Key,        label: "SEO Keys",         value: stats.seoKeyCount },
              { icon: Key,        label: "Architect Keys",   value: stats.architectKeyCount },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="bg-slate-900/80 rounded-2xl border border-white/10 p-6 flex flex-col gap-2">
                <Icon className="w-5 h-5 text-cyan-400" />
                <div className="text-3xl font-black">{value}</div>
                <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Users table */}
        <div className="bg-slate-900/80 rounded-2xl border border-white/10 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10 flex items-center gap-3">
            <Users className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-bold">Recent Users</h2>
            {loading && <span className="text-xs text-slate-500 font-mono animate-pulse">loading…</span>}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-slate-400 text-xs uppercase tracking-wider">
                  <th className="text-left px-6 py-3 font-semibold">Name</th>
                  <th className="text-left px-6 py-3 font-semibold">Email</th>
                  <th className="text-left px-6 py-3 font-semibold">Role</th>
                  <th className="text-left px-6 py-3 font-semibold">Joined</th>
                  <th className="text-left px-6 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {stats?.recentUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-white/[0.02] transition">
                    <td className="px-6 py-3 font-semibold">{u.name}</td>
                    <td className="px-6 py-3 text-slate-300 font-mono text-xs">{u.email}</td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-0.5 rounded-md text-xs font-bold border ${
                        u.role === "admin"
                          ? "bg-red-500/10 border-red-400/30 text-red-300"
                          : "bg-slate-700/50 border-white/10 text-slate-300"
                      }`}>{u.role}</span>
                    </td>
                    <td className="px-6 py-3 text-slate-400 text-xs">
                      {new Date(u.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        {u.role !== "admin" ? (
                          <button
                            onClick={() => setRole(u.id, "admin", u.name)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan-500/10 border border-cyan-400/20 text-cyan-300 text-xs font-semibold hover:bg-cyan-500/20 transition"
                          >
                            <UserCheck className="w-3 h-3" /> Make Admin
                          </button>
                        ) : (
                          <button
                            onClick={() => setRole(u.id, "user", u.name)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-700/50 border border-white/10 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition"
                          >
                            Remove Admin
                          </button>
                        )}
                        <button
                          onClick={() => deleteUser(u.id, u.email)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/10 border border-red-400/20 text-red-300 text-xs font-semibold hover:bg-red-500/20 transition"
                        >
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && stats?.recentUsers.length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">No users found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </main>
  );
}
