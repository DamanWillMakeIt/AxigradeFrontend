import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "YouTube Studio",
  description:
    "Axigrade YouTube Studio — script architecture, SEO tags, quality critique, click engineering, and visual hooks for YouTube creators.",
};

export default function YtStudioLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
