export type Tool = {
  id: string;
  name: string;
  description: string;
};

export const tools: Tool[] = [
  {
    id: "yt-studio",
    name: "YouTube Suite",
    description:
      "A YouTube video generator suite that guides you through script, thumbnail, and SEO to produce a VEO 3-ready video.",
  },
  {
    id: "prompt-to-ppt",
    name: "Prompt To PPT",
    description:
      "An AI-powered presentation generator that transforms your text prompts into complete, professionally formatted PowerPoint slide decks.",
  }
];

export function getToolById(id: string): Tool | undefined {
  return tools.find((tool) => tool.id === id);
}

