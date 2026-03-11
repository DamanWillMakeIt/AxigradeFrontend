import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your Axigrade credit balance and API key usage overview.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
