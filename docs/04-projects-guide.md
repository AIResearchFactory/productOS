# Projects Guide

[← Previous: Installation Guide](03-installation.md) | [Back to Documentation Home](README.md) | [Next: Skills Guide →](05-skills-guide.md)

---

## Table of Contents
- [What is a Project?](#what-is-a-project)
- [Creating a Project](#creating-a-project)
- [Project Structure](#project-structure)
- [Managing Files](#managing-files)
- [Advanced File Operations](#advanced-file-operations)
- [Using AI Chat](#using-ai-chat)
- [Project Settings](#project-settings)
- [Best Practices](#best-practices)
- [Example Workflow](#example-workflow)

---

## What is a Project?

A **project** is an organized workspace for a specific research topic or goal. Think of it as a dedicated folder that contains:

- All your research notes and documents
- AI chat conversations (automatically saved)
- Workflows specific to this research
- Project-specific settings

**Example projects**:
- "Q1 2026 Competitive Analysis"
- "New Feature Research - Dark Mode"
- "Customer Interview Synthesis"
- "Market Research - AI Tools Landscape"

**Why use projects**:
- **Organization**: Keep different research topics separate
- **Context**: AI understands what you're working on
- **History**: Full record of your research process
- **Sharing**: Easy to share entire projects with teammates
- **Portability**: All data in simple Markdown files

---

## Creating a Project

### Step 1: Open the New Project Dialog

1. Click the **"Projects"** tab in the left sidebar
2. Click the **"+ New Project"** button
3. The "Create New Project" dialog appears

### Step 2: Fill in Project Details

**Project Name** (required)
- Give your project a clear, descriptive name
- Example: "Q1 2026 Competitive Analysis"
- This becomes the folder name (lowercase, with hyphens)

**Project Goal** (required)
- Describe what you want to achieve
- Be specific - this helps AI understand your context
- Example: "Research top 5 competitors in the AI research tools space, analyze their features, pricing, and positioning, and create a comprehensive comparison report"

**Assign Skills** (optional)
- Select pre-existing skills to use in this project
- You can add or change skills later
- Example: Select "Research Assistant" and "Competitive Analyst"

### Step 3: Create the Project

1. Click **"Create Project"**
2. productOS creates the project folder and initial files
3. Your new project appears in the sidebar
4. The project opens automatically

### What Gets Created

When you create a project, productOS automatically sets up:

```
your-project-name/
├── .metadata/
│   └── project.json          # Project metadata
├── README.md                  # Initial project overview
└── (your files will go here)
```

---

## Project Structure

### Understanding Your Project Folder

Each project is a folder in your data directory containing:

**Visible Files** (your content):
- `README.md` - Project overview and notes
- `research-notes.md` - Your research findings
- `chat-2026-01-15.md` - AI chat transcripts (auto-created)
- Any other `.md` files you create

**Hidden Folders** (system files):
- `.metadata/` - Project configuration and metadata
- `.workflows/` - Workflow definitions (JSON files)

**Important**: You can edit any `.md` file with any text editor. They're just plain Markdown!

### File Naming Conventions

productOS automatically names files based on their purpose:

- **Chat transcripts**: `chat-YYYY-MM-DD.md` or `chat-YYYY-MM-DD-HH-MM.md`
- **Project files**: Whatever you name them (e.g., `competitive-analysis.md`)

**Best practices**:
- Use lowercase with hyphens: `feature-research.md`
- Be descriptive: `competitor-pricing-analysis.md` not `notes.md`
- Date important files: `2026-01-15-interview-summary.md`

---

## Managing Files

### Creating a New File

**Method 1: From the Sidebar**
1. Select your project in the sidebar
2. Click the **"+ New File"** button (or right-click the project)
3. Enter a file name (e.g., "competitive-analysis")
4. Click **"Create"**
5. The file opens in the editor

**Method 2: From the Menu**
1. With a project open, click the menu (☰)
2. Select **"New File"**
3. Follow the same steps

### Editing Files

productOS includes a built-in Markdown editor with:

- **Live preview** - See formatted output as you type
- **Syntax highlighting** - Easy to read Markdown syntax
- **Auto-save** - Changes saved automatically
- **Toolbar** - Quick formatting buttons

**Markdown basics**:
```markdown
# Heading 1
## Heading 2
### Heading 3

**Bold text**
*Italic text*

- Bullet point
- Another point

1. Numbered list
2. Second item

[Link text](https://example.com)

> Quote or callout
```

### Organizing Files

**Tips for organization**:
- Create a `README.md` as your project overview
- Use descriptive file names
- Group related content in separate files
- Use headings within files for structure
- Link between files using Markdown links

**Example structure**:
```
competitive-analysis/
├── README.md                    # Project overview
├── research-plan.md             # Initial planning
├── competitor-1-analysis.md     # Individual analyses
├── competitor-2-analysis.md
├── competitor-3-analysis.md
├── comparison-table.md          # Summary comparison
└── final-report.md              # Conclusions
```

### Deleting Files

1. Right-click the file in the sidebar
2. Select **"Delete"**
3. Confirm the deletion

**Note**: Deleted files are moved to your system's trash/recycle bin, not permanently deleted.

---

## Advanced File Operations

productOS supports deeper integration with external documents and automated processing for common file formats.

### 1. Document Import

You can import external documents directly into your project:
- **Supported Formats**: `.docx`, `.prd`, `.txt`.
- **Conversion**: These files are automatically converted to clean Markdown for the best AI processing experience.
- **How to Import**: 
  - Right-click on a project in the sidebar and select **"Import Document"**.
  - Or, use the **File > Import Document...** menu.

### 2. Meeting Transcript Summarization

productOS has a specialized workflow for meeting transcripts (WebVTT):
- **Specialized Import**: When you import a `.vtt` file, productOS triggers an automated AI summarization.
- **Outcome**: It generates a structured markdown report including **Title, Date, Participants, Summary, Action Items,** and **Decisions Made**.
- **Usage**: Simply select a `.vtt` file during the "Import Document" process.

### 3. Document Export

Need to share your research results in a more traditional format?
- **Supported Formats**: `.docx`, `.pdf`.
- **How to Export**:
  - Right-click a document in the sidebar and select **"Export..."**.
  - Or, use the **File > Export Document...** menu while a document is active.
  - **Note**: Exporting requires `Pandoc` to be installed on your system.

---

## Using AI Chat

The AI Chat feature is where productOS really shines. It's like ChatGPT or Claude, but integrated directly into your workspace with automatic documentation.

### Opening the Chat Panel

**Method 1: Toggle Button**
- Click the **chat icon** (💬) in the top-right corner
- The chat panel slides in from the right

**Method 2: Keyboard Shortcut**
- Press `Cmd+K` (Mac) or `Ctrl+K` (Windows/Linux)

### Selecting Your AI Provider

At the top of the chat panel, you'll see a dropdown to select your AI provider:

- **Ollama via MCP** - Local AI models
- **Claude Code** - Anthropic's coding assistant
- **Hosted API** - Claude, OpenAI, Gemini, etc.

The selected provider is saved in your global settings.

### Starting a Conversation

1. Type your question or request in the text box
2. Press **Enter** or click the **Send** button (➤)
3. AI responds in the chat panel
4. Continue the conversation naturally

**Example conversation**:
```
You: Can you help me research the top AI research tools?

AI: I'd be happy to help! Let me research the top AI research 
tools for you. Based on current market analysis, here are the 
leading tools...

You: Can you create a comparison table of their pricing?

AI: Certainly! Here's a comparison table...
```

### How Chat History is Saved

**Automatic documentation** - This is the magic:

1. Every conversation is automatically saved to your project
2. Chat transcripts are saved as Markdown files
3. Files are named with timestamps: `chat-2026-01-15.md`
4. You can review any conversation later
5. No manual copy-pasting needed!

**What gets saved**:
```markdown
# Chat Session - 2026-01-15

## User
Can you help me research the top AI research tools?

## Assistant
I'd be happy to help! Let me research the top AI research 
tools for you...

## User
Can you create a comparison table of their pricing?

## Assistant
Certainly! Here's a comparison table...
```

### Using Project Context

The AI is aware of your project:

- It knows your project goal
- It can reference your project files
- It maintains context across conversations
- It can help organize your research

**Example**:
```
You: Based on my project goal, what should I research first?

AI: Given your goal of "analyzing top 5 competitors," I 
recommend starting with...
```

### Attaching Files and Workflows

You can reference project files and workflows directly in your conversation:

**Method 1: Using @ for Files**
1. Type `@` in the chat input
2. Select a file from the list
3. The AI can now read and reference that file

**Method 2: Using # for Workflows**
1. Type `#` in the chat input
2. Select a workflow from the list
3. Press Enter to run it or ask questions about it

**Method 3: Using the Paperclip**
1. Click the **paperclip icon** (📎) in the chat input
2. Select files from your project

**Example use cases**:
- "Summarize key points from @research-notes.md"
- "Run #CompetitiveResearch for these companies..."
- "Compare @competitor-1.md and @competitor-2.md"

### Chat Best Practices

**Be specific**:
- ❌ "Research competitors"
- ✅ "Research the top 5 AI research tools, focusing on their pricing models, key features, and target customers"

**Provide context**:
- Reference your project goal
- Mention what you've already researched
- Specify the format you want (table, bullet points, etc.)

**Iterate**:
- Start broad, then drill down
- Ask follow-up questions
- Request different formats or perspectives

**Use skills**:
- Assign relevant skills to your project
- Reference skills in your prompts: "Using the Research Assistant skill, analyze..."

---

## Project Settings

Each project has its own settings that override global settings.

### Accessing Project Settings

1. Select your project in the sidebar
2. Click the **settings icon** (⚙️) or right-click → **"Settings"**
3. The Project Settings page opens

### Available Settings

**General**:
- **Project Name** - Change the display name
- **Project Goal** - Update your research objective
- **Assigned Skills** - Add or remove skills

**Features**:
- **Auto-save** - Automatically save changes (recommended: ON)
- **Encrypt Data** - Encrypt sensitive project files (optional)

### When to Use Project Settings

- **Change project scope**: Update the goal as your research evolves
- **Add skills**: Assign new skills as you need them
- **Rename project**: Fix typos or clarify the name
- **Enable encryption**: For sensitive research

---

## Best Practices

### Project Organization

**One project per topic**:
- Don't mix unrelated research in one project
- Create separate projects for different goals
- Example: Separate projects for "Q1 Competitors" and "Q2 Competitors"

**Clear goals**:
- Write specific, actionable goals
- Update goals as your research evolves
- Good goal: "Analyze top 5 competitors' pricing strategies and create recommendations"
- Poor goal: "Research stuff"

**Consistent naming**:
- Use a naming convention for projects
- Example: "YYYY-QQ - Topic" → "2026-Q1 - Competitive Analysis"
- Makes projects easy to find and sort

### File Management

**Start with README**:
- Use `README.md` as your project overview
- Include project goal, status, and key findings
- Link to other important files

**Separate concerns**:
- One file per major topic or competitor
- Don't create one giant file
- Easier to navigate and share

**Use descriptive names**:
- `competitor-analysis-acme-corp.md` ✅
- `notes.md` ❌

### Chat Usage

**Save important insights**:
- While chat is auto-saved, copy key insights to your main files
- Create summary documents from chat findings
- Don't rely solely on chat transcripts for final deliverables

**Reference previous chats**:
- Review old chat files before starting new conversations
- Avoid asking the same questions twice
- Build on previous research

**Organize chat files**:
- Chat files accumulate over time
- Consider archiving old chats to a subfolder
- Keep active research chats easily accessible

---

## Example Workflow

Let's walk through a complete example: researching a new feature.

### Scenario
You're a product manager researching whether to add a "dark mode" feature to your app.

### Step 1: Create the Project

1. Click **"+ New Project"**
2. Name: "Dark Mode Feature Research"
3. Goal: "Research dark mode implementations in competitor apps, user demand, technical feasibility, and create a PRD"
4. Assign skills: "Research Assistant", "PRD Generator"
5. Click **"Create"**

### Step 2: Initial Research

1. Open the chat panel
2. Ask: "What are the benefits of dark mode in applications?"
3. AI provides comprehensive answer
4. Ask: "Which popular apps have dark mode? How do they implement it?"
5. Continue researching

### Step 3: Document Findings

1. Create a new file: `dark-mode-research.md`
2. Copy key insights from chat
3. Organize into sections:
   - Benefits
   - User demand
   - Competitor implementations
   - Technical considerations

### Step 4: Analyze Competitors

1. Ask: "Can you create a comparison table of dark mode implementations in Slack, Discord, and Notion?"
2. AI creates the table
3. Save to `competitor-comparison.md`

### Step 5: Generate PRD

1. Ask: "Based on my research, can you create a PRD for implementing dark mode?"
2. AI generates a complete PRD
3. Save to `dark-mode-prd.md`
4. Review and refine

### Step 6: Review and Share

1. Review all files in your project
2. Update `README.md` with summary
3. Share the entire project folder with your team

**Time saved**: 3-4 hours → 45 minutes!

[See the complete use case →](use-cases/Use-Case1-Simple_research.md)

---

## What's Next?

Now that you know how to work with projects, explore:

1. **[Skills Guide](05-skills-guide.md)** - Create specialized AI agents for consistent results
2. **[Workflows Guide](06-workflows-guide.md)** - Automate multi-step research processes
3. **[Settings Guide](07-settings-guide.md)** - Customize your productOS experience

---

[← Previous: Installation Guide](03-installation.md) | [Back to Documentation Home](README.md) | [Next: Skills Guide →](05-skills-guide.md)