# Data Portability Guide

[← Previous: Settings Guide](07-settings-guide.md) | [Back to Documentation Home](README.md)

---

## Table of Contents
- [Your Data, Your Control](#your-data-your-control)
- [Understanding File Structure](#understanding-file-structure)
- [Migrating Between Machines](#migrating-between-machines)
- [Sharing with Your Team](#sharing-with-your-team)
- [Import & Export](#import--export)
- [Backup Best Practices](#backup-best-practices)
- [Version Control with Git](#version-control-with-git)
- [Data Format Benefits](#data-format-benefits)

---

## Your Data, Your Control

productOS is built on a fundamental principle: **you own your data**.

### What This Means

- **No proprietary database** - Everything is stored as standard files
- **Human-readable format** - All content in Markdown (.md files)
- **No vendor lock-in** - Works with any text editor
- **Easy to backup** - Simple file copy
- **Easy to migrate** - Move between computers effortlessly
- **Easy to share** - Share folders with teammates
- **Git-friendly** - Version control your research

### Where Your Data Lives

All data is stored in your **data directory**:

**Default locations**:
- **macOS**: `~/Library/Application Support/ai-researcher`
- **Windows**: `%APPDATA%\ai-researcher`
- **Linux**: `~/.local/share/ai-researcher`

**To find your data directory**:
1. Open productOS
2. Go to Settings → General
3. Look for "Data Directory" path

---

## Understanding File Structure

### Complete Directory Structure

```
ai-researcher/                    # Your data directory
├── projects/                     # All your research projects
│   ├── project-alpha/
│   │   ├── .metadata/
│   │   ├── artifacts/       # Persistent AI-generated content
│   │   │   └── art_123.md
│   │   └── project.json     # Project configuration
│   │   ├── .workflows/
│   │   │   ├── workflow-1.json  # Workflow definitions
│   │   │   └── workflow-2.json
│   │   ├── README.md            # Project overview
│   │   ├── research-notes.md    # Your research files
│   │   ├── chat-2026-01-15.md   # AI chat transcripts
│   │   └── *.md                 # Other Markdown files
│   │
│   └── project-beta/
│       └── ...
│
├── skills/                       # Reusable AI agent templates
│   ├── .metadata/
│   │   ├── research-assistant.json
│   │   └── competitive-analyst.json
│   ├── research-assistant.md
│   ├── competitive-analyst.md
│   └── *.md
│
├── templates/                    # Project and skill templates
│   ├── project-templates/
│   └── skill-templates/
│
├── backups/                      # Automatic backups
│   ├── backup-2026-01-15/
│   └── backup-2026-01-14/
│
├── logs/                         # Application logs
│
├── settings.json                 # Global settings
├── secrets.encrypted.json        # Encrypted API keys
└── README.md                     # Welcome documentation
```

### What Each Folder Contains

#### `projects/`
Your research projects. Each project is a folder containing:
- **`.metadata/project.json`** - Project configuration (name, goal, skills)
- **`.workflows/`** - Workflow definitions (JSON files)
- **`*.md`** - All your research files and chat transcripts

**Important for sharing**: The entire project folder is self-contained.

#### `skills/`
Reusable AI agent templates:
- **`.metadata/*.json`** - Skill metadata (name, description, version)
- **`*.md`** - Skill prompt templates

**Important for sharing**: Skills can be shared independently.

#### `templates/`
Default templates for new projects and skills. You can customize these.

#### `backups/`
Automatic backups created by productOS. Timestamped folders.

#### `settings.json`
Global application settings (theme, default model, etc.).

#### `secrets.encrypted.json`
Encrypted API keys and secrets. **Never share this file.**

---

## Migrating Between Machines

### Scenario 1: Moving to a New Computer

**Goal**: Transfer all your productOS data to a new machine.

#### Step 1: Backup on Old Computer

1. Close productOS
2. Navigate to your data directory
3. Copy the entire `ai-researcher` folder to:
   - External drive
   - Cloud storage (Dropbox, Google Drive, etc.)
   - Network location

**What to copy**: Everything in the data directory.

#### Step 2: Install on New Computer

1. Download and install productOS on the new machine
2. Launch productOS once (this creates the directory structure)
3. Close productOS

#### Step 3: Restore Data

1. Navigate to the new data directory
2. Replace the contents with your backup
3. Launch productOS
4. Enter your password to unlock secrets

**Important**: Your password must be the same on both machines to decrypt API keys.

### Scenario 2: Syncing Between Multiple Computers

**Goal**: Keep productOS data synchronized across multiple machines.

#### Option A: Cloud Sync (Recommended)

1. Move your data directory to a cloud-synced folder:
   - Dropbox: `~/Dropbox/ai-researcher`
   - Google Drive: `~/Google Drive/ai-researcher`
   - OneDrive: `~/OneDrive/ai-researcher`

2. In productOS Settings:
   - Change data directory to the cloud folder
   - Restart productOS

3. Repeat on all machines

**Benefits**:
- Automatic synchronization
- Always up-to-date
- Built-in backup

**Cautions**:
- Ensure cloud service is running
- Don't open productOS on multiple machines simultaneously
- Cloud service must sync `.secrets.encrypted` (some services skip hidden files)

#### Option B: Manual Sync

1. Backup data directory regularly
2. Copy to other machines as needed
3. More control, but requires discipline

### Scenario 3: Selective Migration

**Goal**: Move only specific projects or skills.

#### Moving Individual Projects

1. Navigate to `projects/` folder
2. Copy the project folder (e.g., `project-alpha/`)
3. Paste into `projects/` on the new machine
4. Restart productOS

**What gets moved**:
- All project files
- Project settings
- Workflows
- Chat history

#### Moving Individual Skills

1. Navigate to `skills/` folder
2. Copy:
   - The skill Markdown file (e.g., `research-assistant.md`)
   - The corresponding metadata file (`.metadata/research-assistant.json`)
3. Paste into `skills/` on the new machine
4. Restart productOS

---

## Sharing with Your Team

### What to Share

#### Sharing Projects

**When to share**: Collaborating on research, handing off work.

**What to include**:
- ✅ The entire project folder
- ✅ All `.md` files
- ✅ `.metadata/` folder
- ✅ `.workflows/` folder (if relevant)

**What NOT to include**:
- ❌ `.secrets.encrypted` (contains your API keys!)
- ❌ Personal notes (if any)

**How to share**:
1. Navigate to `projects/`
2. Copy the project folder
3. Share via:
   - Email (zip the folder)
   - Shared drive
   - Git repository (see below)
   - Cloud link

#### Sharing Skills

**When to share**: Standardizing team workflows, sharing expertise.

**What to include**:
- ✅ Skill Markdown file (e.g., `competitive-analyst.md`)
- ✅ Metadata file (`.metadata/competitive-analyst.json`)

**How to share**:
1. Navigate to `skills/`
2. Copy both files
3. Share with teammates
4. They paste into their `skills/` folder

#### Sharing Workflows

**When to share**: Standardizing processes, reusing automation.

**What to include**:
- ✅ Workflow JSON file from `.workflows/` folder
- ✅ Any required skills
- ✅ Documentation on how to use it

**How to share**:
1. Navigate to `projects/[project-name]/.workflows/`
2. Copy the workflow JSON file
3. Share with teammates
4. They paste into their project's `.workflows/` folder

### Team Collaboration Patterns

#### Pattern 1: Shared Project Repository

**Setup**:
1. Create a shared folder (Dropbox, Google Drive, etc.)
2. Each team member points their productOS to this folder
3. Everyone works on the same projects

**Best for**: Small teams, tight collaboration.

**Cautions**:
- Don't edit the same file simultaneously
- Communicate who's working on what
- Regular backups

#### Pattern 2: Git-Based Collaboration

**Setup**:
1. Initialize Git in your projects folder
2. Push to a shared repository (GitHub, GitLab, etc.)
3. Team members clone and pull updates

**Best for**: Larger teams, version control needs.

**Benefits**:
- Full version history
- Merge conflict resolution
- Code review workflows
- Audit trail

[See Git section below →](#version-control-with-git)

#### Pattern 3: Periodic Sharing

**Setup**:
1. Work independently
2. Share completed projects/skills periodically
3. Team members import as needed

**Best for**: Loose collaboration, independent work.

---

## Import & Export

productOS leverages **Pandoc** to ensure your data can flow in and out of the application seamlessly.

### Importing Documents
When you import a `.docx` or `.prd` file, it is converted into Markdown. This ensures that the AI can process the content efficiently while keeping the data in your preferred local format.

### Exporting Documents
Any research document in your project can be exported back to `.docx` or `.pdf`. This is ideal for formal reporting or sharing with stakeholders who do not use productOS.

### Portability of Artifacts
Artifacts are stored as structured JSON/Markdown files within the project's `.metadata/artifacts` directory. They are fully portable and can be opened with any text editor, though they are best viewed within productOS to leverage its visual previews.

---

## Backup Best Practices

### What to Backup

**Essential** (backup regularly):
- ✅ `projects/` - All your research
- ✅ `skills/` - Your skill library
- ✅ `.settings.md` - Your preferences

**Important** (backup occasionally):
- ✅ `templates/` - Custom templates
- ✅ `.secrets.encrypted` - Encrypted keys (keep secure!)

**Optional** (can skip):
- ❌ `backups/` - Already backups
- ❌ `logs/` - Diagnostic only

### Backup Frequency

**Recommended schedule**:
- **Daily**: If actively researching
- **Weekly**: For regular use
- **Before major changes**: Always
- **After completing projects**: Definitely

### Backup Methods

#### Method 1: Manual Copy

**Simplest approach**:
1. Close productOS
2. Copy data directory to backup location
3. Name with date: `ai-researcher-backup-2026-01-15`

**Backup locations**:
- External hard drive
- Network storage
- Cloud storage (encrypted)

#### Method 2: Automated Backup

**macOS** (Time Machine):
- Time Machine automatically backs up your data directory
- Restore from Time Machine if needed

**Windows** (File History):
- Enable File History for your data directory
- Restore previous versions as needed

**Linux** (rsync):
```bash
rsync -av ~/. local/share/ai-researcher/ /backup/location/
```

#### Method 3: Cloud Sync

**Automatic and continuous**:
- Move data directory to Dropbox/Google Drive/OneDrive
- Automatic backup and sync
- Access from anywhere

**Setup**:
1. Move data directory to cloud folder
2. Update path in Settings
3. Restart productOS

### Backup Verification

**Test your backups**:
1. Periodically restore a backup to a test location
2. Verify files are intact
3. Ensure you can open projects
4. Confirm nothing is corrupted

### Disaster Recovery

**If you lose your data**:
1. Install productOS on new machine
2. Restore from most recent backup
3. Update data directory path in Settings
4. Enter your password to unlock secrets

**If you lose your password**:
- Unfortunately, encrypted secrets cannot be recovered
- You'll need to re-enter API keys
- All other data (projects, skills) is unaffected

---

## Version Control with Git

### Why Use Git?

**Benefits**:
- **Version history** - See how research evolved
- **Collaboration** - Multiple people can contribute
- **Branching** - Try different approaches
- **Backup** - Remote repository is a backup
- **Audit trail** - Know who changed what and when

### Setting Up Git

#### Step 1: Initialize Repository

```bash
cd ~/Library/Application\ Support/ai-researcher/projects
git init
```

#### Step 2: Create .gitignore

Create a `.gitignore` file to exclude sensitive data:

```gitignore
# Ignore secrets (IMPORTANT!)
../secrets.encrypted.json

# Ignore logs
../logs/

# Ignore backups
../backups/

# Ignore OS files
.DS_Store
Thumbs.db

# Optional: Ignore chat transcripts if too large
# chat-*.md
```

#### Step 3: Initial Commit

```bash
git add .
git commit -m "Initial commit: productOS projects"
```

#### Step 4: Add Remote (Optional)

```bash
git remote add origin https://github.com/yourusername/ai-research.git
git push -u origin main
```

### Git Workflow

**Daily workflow**:
```bash
# Start of day: Get latest changes
git pull

# Work on your research...

# End of day: Commit your work
git add .
git commit -m "Completed competitive analysis for Q1"
git push
```

**Branching for experiments**:
```bash
# Create a branch for experimental research
git checkout -b experiment-new-approach

# Work on experiment...

# If successful, merge back
git checkout main
git merge experiment-new-approach

# If unsuccessful, just delete the branch
git branch -d experiment-new-approach
```

### Best Practices

**Commit messages**:
- ✅ "Added competitive analysis for Notion"
- ✅ "Updated research methodology skill"
- ✅ "Completed Q1 market research workflow"
- ❌ "Updated files"
- ❌ "Changes"

**Commit frequency**:
- After completing a research task
- After creating/updating a skill
- After building a workflow
- At the end of each work session

**What to commit**:
- ✅ Project files (`.md`)
- ✅ Project metadata
- ✅ Workflows
- ✅ Skills
- ❌ Secrets (`secrets.encrypted.json`)
- ❌ Logs

---

## Data Format Benefits

### Why Markdown?

productOS uses Markdown for all content. Here's why:

#### 1. Human-Readable

**Markdown**:
```markdown
# Competitive Analysis

## Notion
- **Pricing**: $8/user/month
- **Key Features**: Databases, wikis, docs
```

**vs. Proprietary format**:
```
�PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00...
```

You can read and edit Markdown in any text editor.

#### 2. Future-Proof

- Markdown has been around since 2004
- Will be readable in 50 years
- No dependency on productOS
- No vendor lock-in

#### 3. Tool-Agnostic

Works with:
- Any text editor (VS Code, Sublime, Notepad++)
- Any Markdown viewer
- GitHub, GitLab (renders automatically)
- Static site generators (Jekyll, Hugo)
- Documentation tools (MkDocs, Docusaurus)

#### 4. Git-Friendly

- Text-based = perfect for version control
- Easy to see changes (diffs)
- Merge conflicts are manageable
- Full history tracking

#### 5. Searchable

- Use any search tool (grep, Spotlight, Everything)
- Full-text search works perfectly
- No need for special indexing
- Fast and efficient

#### 6. Portable

- Copy files anywhere
- Email as attachments
- Share via cloud
- No export/import needed

### JSON for Metadata

Configuration files (project metadata, workflows) use JSON:

**Benefits**:
- Standard format
- Easy to parse
- Human-readable
- Tool-agnostic

**Example** (`project.json`):
```json
{
  "id": "competitive-analysis",
  "name": "Q1 2026 Competitive Analysis",
  "goal": "Research top 5 competitors...",
  "skills": ["research-assistant", "competitive-analyst"],
  "created": "2026-01-15T10:00:00Z"
}
```

---

## Advanced Topics

### Exporting to Other Formats

Since everything is Markdown, you can easily convert to:

**PDF**:
```bash
pandoc research-notes.md -o research-notes.pdf
```

**HTML**:
```bash
pandoc research-notes.md -o research-notes.html
```

**Word**:
```bash
pandoc research-notes.md -o research-notes.docx
```

**Presentation**:
```bash
pandoc research-notes.md -t beamer -o presentation.pdf
```

### Scripting and Automation

Because files are plain text, you can:

**Batch process files**:
```bash
# Find all competitive analyses
find projects/ -name "competitor-*.md"

# Count total research files
find projects/ -name "*.md" | wc -l

# Search across all projects
grep -r "pricing strategy" projects/
```

**Generate reports**:
```python
import os
import glob

# Collect all research findings
for file in glob.glob("projects/**/*.md", recursive=True):
    # Process and aggregate
    pass
```

### Integration with Other Tools

**Obsidian**: Open your projects folder as an Obsidian vault
**Notion**: Import Markdown files
**Confluence**: Upload Markdown files
**Jupyter**: Include Markdown in notebooks
**Static sites**: Use projects as content source

---

## Summary

### Key Takeaways

1. **You own your data** - Standard files, no lock-in
2. **Easy to backup** - Simple file copy
3. **Easy to migrate** - Move between machines effortlessly
4. **Easy to share** - Share folders with team
5. **Git-friendly** - Version control your research
6. **Future-proof** - Markdown will always be readable
7. **Tool-agnostic** - Works with any text editor

### Quick Reference

| Task | How To |
|------|--------|
| **Backup** | Copy data directory to safe location |
| **Migrate** | Copy data directory to new machine |
| **Share project** | Copy project folder, exclude `secrets.encrypted.json` |
| **Share skill** | Copy skill `.md` and `.metadata/*.json` files |
| **Version control** | Initialize Git in projects folder |
| **Export** | Use pandoc to convert Markdown to other formats |

---

## What's Next?

You now understand how productOS stores and manages your data. Ready to:

1. **[Start a project](04-projects-guide.md)** - Put your knowledge to use
2. **[Create workflows](06-workflows-guide.md)** - Automate your research
3. **[Review use cases](use-cases/)** - See real-world examples

---

[← Previous: Settings Guide](07-settings-guide.md) | [Back to Documentation Home](README.md)