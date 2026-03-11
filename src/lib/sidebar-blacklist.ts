/**
 * URLs where the sidebar is hidden.
 * Paths are matched exactly (e.g. "/tools/abcabc01").
 */
export const SIDEBAR_BLACKLIST = [
  "/tools/yt-studio",
] as const;

export function isSidebarBlacklisted(pathname: string): boolean {
  return SIDEBAR_BLACKLIST.some((path) => pathname.includes(path));
}
