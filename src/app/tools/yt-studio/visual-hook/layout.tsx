import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Visual Hook",
  description: "Generate scroll-stopping visual hooks for the first three seconds of your video.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
