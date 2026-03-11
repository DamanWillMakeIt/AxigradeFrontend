import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Quality Critic",
  description: "AI scene-by-scene script audit — rewrites, additions, deletions, merges, and splits.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
