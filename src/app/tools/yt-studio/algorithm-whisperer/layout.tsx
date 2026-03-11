import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Algorithm Whisperer",
  description: "Generate YouTube SEO tags, competitor analysis, and growth strategies with AI.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
