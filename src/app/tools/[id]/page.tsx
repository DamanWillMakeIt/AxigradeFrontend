import { notFound } from "next/navigation";
import { getToolById } from "@/lib/tools";

type ToolPageProps = {
  params: { id: string };
};

export default function ToolPage({ params }: ToolPageProps) {
  const tool = getToolById(params.id);

  if (!tool) {
    notFound();
  }

  return (
    <main className="min-h-screen p-8 bg-theme-bg text-theme-fg">
      <header className="mb-8 flex items-end justify-between gap-6">
        <div>
          <p className="brutal-kicker mb-2">Tool</p>
          <h1 className="brutal-title text-6xl">{tool.name}</h1>
          <p className="font-mono text-xs uppercase tracking-[0.35em] mt-4">
            ID {tool.id}
          </p>
        </div>
        <div className="brutal-kicker whitespace-nowrap">DETAIL</div>
      </header>

      <section className="brutal-panel p-8 max-w-2xl">
        <p className="font-body text-base leading-relaxed">{tool.description}</p>
      </section>
    </main>
  );
}

