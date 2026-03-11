import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8 bg-theme-bg text-theme-fg">
      <div className="w-full max-w-2xl">
        <div className="brutal-panel p-10">
          <header className="flex items-end justify-between gap-6 border-b border-theme-border pb-6 mb-8">
            <h1 className="brutal-title text-6xl">Axigrade</h1>
            <div className="brutal-kicker">ACCESS</div>
          </header>

          <p className="font-body text-lg leading-relaxed max-w-xl">
            High-end, stark, and fast. Pure monochrome. Zero softness.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4">
        <Link
          href="/auth/signin"
          className="brutal-btn w-full sm:w-auto"
        >
          Sign in
        </Link>
        <Link
          href="/auth/signup"
          className="brutal-btn w-full sm:w-auto"
        >
          Sign up
        </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
