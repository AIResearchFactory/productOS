# Team Context Sharing

ProductOS already stores product context as ordinary files: Markdown documents in each product folder, JSON metadata under `.metadata/`, and reusable skills in `skills/`. That makes team sharing possible without a central ProductOS server.

This guide describes the recommended setup for teams that want shared product context, shared Markdown files, and optional remote work through GitHub or shared storage.

---

## Recommended Mental Model

Use ProductOS as a **local-first workspace** with a shared filesystem backend:

```text
team-productos-workspace/
  projects/
    customer-portal/
      README.md
      research_log.md
      prd.md
      roadmap.md
      .metadata/
        project.json
        artifacts/
        workflows/
  skills/
    prd-writer/
      SKILL.md
  README.md
  .gitignore
```

Each teammate runs ProductOS locally and points **Settings → System → Projects path** at the shared workspace root. If that root contains a `projects/` folder, ProductOS will use:

- `team-productos-workspace/projects` for products/projects
- `team-productos-workspace/skills` for shared skills

API keys and local secrets remain outside the shared workspace in each user's app-data directory.

---

## Option A: GitHub Repository (Recommended for Teams)

Use this when the team needs history, review, branches, async collaboration, or remote work.

### Setup

1. Create a private GitHub repo, for example `company/product-context`.
2. Clone it locally:

```bash
git clone git@github.com:company/product-context.git team-productos-workspace
cd team-productos-workspace
mkdir projects skills
```

3. Add a `.gitignore`:

```gitignore
# OS/editor noise
.DS_Store
Thumbs.db
.vscode/
.idea/

# Local ProductOS/runtime files if this repo is used as a full data root
secrets.encrypted.json
settings.json
logs/
backups/
*.tmp

# Local Chats and Research logs (to prevent sync conflicts)
/projects/*/research_log.md
/projects/*/chats/*.md

# Optional: keep generated exports out of source control
exports/
*.pdf
*.docx
```

4. Commit the initial workspace:

```bash
git add .gitignore README.md projects skills
git commit -m "Initialize ProductOS team context workspace"
git push -u origin main
```

5. In ProductOS, open **Settings → System → Projects path** and choose the repo root (`team-productos-workspace`). Restart if prompted.

### Daily workflow

```bash
# Before opening ProductOS or starting work
git pull --rebase

# Work in ProductOS: edit PRDs, research, workflows, skills

# End of session
git status
git add projects skills
git commit -m "Update customer portal PRD and roadmap"
git push
```

### Collaboration rules

- One owner per active product document at a time, especially `research_log.md` and large PRDs.
- Use short-lived branches for major rewrites or sensitive strategic changes.
- Review important PRDs/roadmaps through pull requests.
- Prefer smaller Markdown files (`prd.md`, `roadmap.md`, `customer-feedback.md`) over one giant shared document.
- Treat `.metadata/project.json`, workflow JSON, and skill folders as shared source files; review conflicts carefully.

### GitHub strengths

- Full history and rollback.
- PR review for product docs.
- Async remote collaboration.
- Works well with Markdown diffs.
- Easy to mirror into docs sites or knowledge bases later.

### GitHub limitations

- Git does not support real-time collaborative editing.
- Merge conflicts can happen if two people edit the same Markdown file.
- Non-technical teammates may need GitHub Desktop or another GUI.

---

## Option B: Shared Storage Folder

Use this for small teams that want lower ceremony and near-real-time file availability.

Supported examples:

- Dropbox
- Google Drive for Desktop
- OneDrive
- iCloud Drive
- Synology Drive
- SMB/NAS mounted folder

### Setup

1. Create a shared folder, for example `ProductOS Team Workspace`.
2. Inside it, create:

```text
projects/
skills/
```

3. In ProductOS, set **Settings → System → Projects path** to the shared folder root.
4. Ask each teammate to choose the same shared folder root.

### Collaboration rules

- Avoid simultaneous edits to the same file.
- Wait for cloud sync to finish before opening or closing ProductOS.
- If the storage provider creates conflict copies, resolve them manually in a text editor.
- Keep sensitive projects in restricted subfolders or separate workspaces.

### Shared storage strengths

- Easier for non-technical teams.
- No Git knowledge required.
- Fast setup for a small PM/design/research group.

### Shared storage limitations

- Weak conflict handling.
- Less reliable audit history.
- Some providers hydrate files lazily, so large projects may briefly appear incomplete.
- Not ideal for regulated/audited workflows unless the storage provider has the required controls.

---

## Option C: Hybrid Git + Shared Storage

Use GitHub as the system of record and a shared drive for large or binary material.

```text
team-productos-workspace/
  projects/
    customer-portal/
      prd.md
      roadmap.md
      links.md              # links to recordings, designs, research folders
  skills/
  .gitignore
```

Recommended split:

- GitHub: Markdown, project metadata, workflows, reusable skills.
- Shared drive: call recordings, large exports, raw datasets, design files.
- ProductOS files: link to shared-drive assets from Markdown rather than committing binaries.

---

## Remote Work Patterns

### Pattern 1: Everyone runs ProductOS locally

Best default. Each teammate:

1. Clones/syncs the shared workspace.
2. Runs ProductOS on their own machine.
3. Uses their own AI provider credentials.
4. Pulls/pushes Markdown context through GitHub or shared storage.

This keeps secrets local while sharing durable product knowledge.

### Pattern 2: Remote machine / team VM

Useful when the team wants one always-on workspace.

- Host ProductOS on a secured internal machine or cloud VM.
- Store the workspace in a Git repo or mounted team storage.
- Require VPN/SSO/reverse proxy before access.
- Keep provider credentials scoped to a service account or designated operator.

Do **not** expose a ProductOS instance directly to the public internet without authentication, TLS, and access controls.

### Pattern 3: GitHub-first review flow

Best for product specs:

1. PM edits PRD locally in ProductOS.
2. PM opens a GitHub PR against the product-context repo.
3. Designers/engineering review Markdown changes.
4. Merge becomes the team's approved context.
5. Everyone pulls the updated context before using AI.

---

## What Should Be Shared?

Share:

- Product briefs and README files.
- PRDs, roadmaps, launch docs, research summaries.
- Reusable skills (`skills/<skill>/SKILL.md`).
- Workflow definitions under `.metadata/workflows/`.
- Non-secret project metadata.

Do not share:

- API keys or secrets.
- Personal auth tokens.
- Provider-specific local credentials.
- Raw sensitive data unless the team repo/storage is approved for it.
- Large generated exports unless the repo is intentionally configured for them.

---

## Conflict Strategy

Markdown conflicts are usually manageable if the team keeps files focused.

Recommended file split per product:

```text
README.md                 # product overview and canonical links
context.md                # stable product/team/customer context
prd.md                    # current PRD
roadmap.md                # planning and milestones
research_log.md           # chronological AI/human research notes
customer-feedback.md      # synthesized feedback
```

If a conflict happens:

1. Stop ProductOS for that workspace.
2. Resolve the conflict in a text editor or Git GUI.
3. Keep both useful sections; remove conflict markers.
4. Run `git status` and commit the resolved file.
5. Reopen ProductOS.

---

## Suggested First ProductOS UX Improvements

The current file model is already compatible with shared Git/storage. The next product work should make this obvious and safer:

1. **Team Workspace setup screen**
   - Choose: Local only, GitHub repo, shared folder.
   - Explain where projects and skills will live.

2. **Workspace health checks**
   - Detect if the selected path is a Git repo.
   - Show current branch, uncommitted changes, and last pull/push time.
   - Warn when conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`) appear in Markdown.

3. **Safe sharing defaults**
   - Offer to create `projects/`, `skills/`, `.gitignore`, and `README.md` in a selected shared root.
   - Keep secrets outside the workspace by default.

4. **GitHub Desktop-friendly docs**
   - Provide non-CLI instructions for product managers.

5. **Optional sync actions**
   - Pull latest.
   - Commit selected files.
   - Push.
   - Open GitHub PR.

Start with setup docs and health checks before automating Git writes. Git automation should be explicit and reviewable.
