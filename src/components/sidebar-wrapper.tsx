"use client";

import { usePathname } from "next/navigation";
import type { SessionUser } from "@/lib/auth";
import { Sidebar } from "@/components/ui/sidebar";
import { isSidebarBlacklisted } from "@/lib/sidebar-blacklist";

type SidebarWrapperProps = {
  session: SessionUser | null;
  children: React.ReactNode;
};

export function SidebarWrapper({ session, children }: SidebarWrapperProps) {
  const pathname = usePathname();
  const hideSidebar = pathname === null || isSidebarBlacklisted(pathname);

  if (!session) {
    return <div className="min-h-screen">{children}</div>;
  }

  if (hideSidebar) {
    return <div className="min-h-screen">{children}</div>;
  }

  return (
    <div className="flex w-full min-h-screen">
      <Sidebar user={session} />
      <div className="flex-1 border-l border-theme-border overflow-y-auto bg-theme-bg text-theme-fg">
        {children}
      </div>
    </div>
  );
}
