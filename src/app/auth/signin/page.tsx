"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Sign in failed");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-8 bg-theme-bg text-theme-fg">
      <div className="w-full max-w-md">
        <div className="brutal-panel p-8">
          <header className="flex items-end justify-between gap-6 border-b border-theme-border pb-6 mb-8">
            <h1 className="brutal-title text-5xl">Sign in</h1>
            <div className="brutal-kicker whitespace-nowrap">AXIGRADE</div>
          </header>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="brutal-invert p-3 shadow-brutal">
                <p className="font-mono text-xs uppercase tracking-[0.22em]">
                  {error}
                </p>
              </div>
            )}

            <div>
              <label htmlFor="email" className="brutal-kicker block mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="brutal-input"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="brutal-kicker block mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="brutal-input"
                placeholder="••••••••"
              />
            </div>

            <button type="submit" disabled={loading} className="brutal-btn w-full">
              {loading ? "SIGNING IN" : "SIGN IN"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center font-body text-sm">
          Don&apos;t have an account?{" "}
          <Link href="/auth/signup" className="brutal-link">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
