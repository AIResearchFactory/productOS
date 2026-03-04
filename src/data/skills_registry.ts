
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
        name: "PRD Generator",
        id: "productos/pm/generate-prd-draft",
        description: "Generates an initial PRD draft from a high-level feature concept.",
        tags: ["pm", "prd", "discovery"],
        command: "builtin:pm-skill"
    },
    {
        name: "PRD Refiner",
        id: "productos/pm/refine-prd-contextually",
        description: "Refines a PRD by analyzing project context and asking clarifying questions.",
        tags: ["pm", "prd", "refinement"],
        command: "builtin:pm-skill"
    },
    {
        name: "User Story Generator",
        id: "productos/pm/generate-user-stories",
        description: "Breaks down a PRD into detailed user stories and acceptance criteria.",
        tags: ["pm", "user-stories", "backlog"],
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
