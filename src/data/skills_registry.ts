
export interface RegistrySkill {
    name: string;
    id: string; // owner/repo/skill-name
    description?: string;
    tags?: string[];
    command: string;
}

export const SKILL_REGISTRY: RegistrySkill[] = [
    {
        name: "Web Researcher",
        id: "research-skills/web-researcher",
        description: "Deep web research and analysis capability.",
        tags: ["research", "web", "analysis"],
        command: "npx --yes skills add vercel-labs/agent-skills/web-browser"
    },
    {
        name: "Data Analyst",
        id: "analysis-skills/data-analyst",
        description: "Analyze data sets and provide insights.",
        tags: ["analysis", "data", "processing"],
        command: "npx --yes skills add anthropics/skills/csv-analysis"
    },
    {
        name: "Content Writer",
        id: "writing-skills/content-writer",
        description: "Generate high-quality written content.",
        tags: ["writing", "content", "markdown"],
        command: "npx --yes skills add coreyhaines31/marketingskills/copywriting"
    },
    {
        name: "Software Engineer",
        id: "coding-skills/software-engineer",
        description: "Write and review code.",
        tags: ["coding", "development", "engineering"],
        command: "npx --yes skills add vercel-labs/agent-skills/vercel-react-best-practices"
    },
    {
        name: "SEO Auditor",
        id: "coreyhaines31/marketingskills/seo-audit",
        description: "Perform comprehensive SEO audits on websites.",
        tags: ["marketing", "seo", "audit"],
        command: "npx --yes skills add coreyhaines31/marketingskills/seo-audit"
    },
    {
        name: "PDF Tools",
        id: "anthropics/skills/pdf",
        description: "Capabilities for reading and manipulating PDF documents.",
        tags: ["document", "pdf", "tools"],
        command: "npx --yes skills add anthropics/skills/pdf"
    },
    {
        name: "Browser Use",
        id: "browser-use/browser-use/browser-use",
        description: "Control a web browser to automate tasks.",
        tags: ["automation", "browser", "testing"],
        command: "npx --yes skills add browser-use/browser-use/browser-use"
    },
    {
        name: "Initiative Generator",
        id: "productos/pm/generate-initiative-draft",
        description: "Explains the 'Why' behind a concept (persona, market, reasoning).",
        tags: ["pm", "initiative", "strategy"],
        command: "builtin:pm-skill"
    },
    {
        name: "PRD Generator",
        id: "productos/pm/generate-prd-draft",
        description: "Organizes background, assumptions, requirements, and NFRs.",
        tags: ["pm", "prd", "technical"],
        command: "builtin:pm-skill"
    },
    {
        name: "PRD Refiner",
        id: "productos/pm/refine-prd-contextually",
        description: "Refines requirements based on technical context and identifies gaps.",
        tags: ["pm", "prd", "refinement"],
        command: "builtin:pm-skill"
    },
    {
        name: "User Story Generator",
        id: "productos/pm/generate-user-stories",
        description: "Breaks down requirements into granular stories with edge cases.",
        tags: ["pm", "user-stories", "testable"],
        command: "builtin:pm-skill"
    },
    {
        name: "Data Formatter",
        id: "productos/pm/format-data",
        description: "Structures data for various MCP integrations (Jira, Aha, Monday, etc.).",
        tags: ["pm", "mcp", "integration"],
        command: "builtin:pm-skill"
    }
];
