/**
 * Dashboard News Configuration
 * 
 * Edit this file to update the news banners on the dashboard.
 * Simply modify the title, description, and tag fields below.
 */

export type NewsItem = {
  id: string;
  title: string;
  description: string;
  tag: string;
  icon: "sparkles" | "zap" | "rocket" | "star" | "bell";
};

export const dashboardNews: NewsItem[] = [
  {
    id: "1",
    title: "AI Video Editor in Development",
    description: "Natural language video editing capabilities are coming soon. Edit your generated videos with simple text commands.",
    tag: "In Progress",
    icon: "sparkles"
  },
  {
    id: "2",
    title: "Batch Generation Feature",
    description: "Generate multiple content variations simultaneously for A/B testing and experimentation.",
    tag: "Coming Soon",
    icon: "zap"
  },
  {
    id: "3",
    title: "Enhanced Analytics",
    description: "Track your content performance with detailed insights and optimization recommendations.",
    tag: "Planned",
    icon: "rocket"
  }
];
