import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "The Architect",
  description: "Design your video's narrative spine — beats, reveals, and retention architecture.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
