import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Click Engineer",
  description: "Architect irresistible video titles and thumbnails the algorithm cannot ignore.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
