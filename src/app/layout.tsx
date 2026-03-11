import type { Metadata } from "next";
import { Italiana, Cormorant_Garamond, Space_Mono } from "next/font/google";
import "./globals.css";
import { getSession } from "@/lib/auth";
import { ThemeProvider } from "@/components/theme-provider";
import { SidebarWrapper } from "@/components/sidebar-wrapper";

const italiana = Italiana({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-italiana",
});

const cormorant = Cormorant_Garamond({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-cormorant",
});

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-space-mono",
});

export const metadata: Metadata = {
  title: { default: "Axigrade", template: "%s | Axigrade" },
  description: "Axigrade — AI-powered YouTube Studio tools. Script writing, SEO optimization, quality critique, and visual hook creation for serious creators.",
  keywords: ["YouTube SEO", "AI script writer", "YouTube tools", "video SEO tags", "content creator tools", "Axigrade"],
  openGraph: {
    title: { default: "Axigrade", template: "%s | Axigrade" },
    description: "AI-powered YouTube Studio tools — script architecture, SEO tags, quality critique, and visual hooks.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: { default: "Axigrade", template: "%s | Axigrade" },
    description: "AI-powered YouTube Studio tools for serious creators.",
  },
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();

  return (
    <html
      lang="en"
      className={`${italiana.variable} ${cormorant.variable} ${spaceMono.variable}`}
      suppressHydrationWarning
    >
      <body className="font-body antialiased min-h-screen bg-theme-bg text-theme-fg">
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('axigrade-theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);}catch(e){}})()`,
          }}
        />
        <ThemeProvider>
          <SidebarWrapper session={session}>{children}</SidebarWrapper>
        </ThemeProvider>
      </body>
    </html>
  );
}
