# Installation Guide

[← Previous: Main Components](02-main-components.md) | [Back to Documentation Home](README.md) | [Next: Projects Guide →](04-projects-guide.md)

---

## Table of Contents
- [System Requirements](#system-requirements)
- [Download and Install](#download-and-install)
- [First Launch Setup](#first-launch-setup)
- [Optional Dependencies](#optional-dependencies)
- [Initial Configuration](#initial-configuration)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)

---

## System Requirements

productOS runs on all major desktop platforms:

- **macOS**: 10.15 (Catalina) or later
- **Windows**: Windows 10 or later (64-bit)
- **Linux**: Most modern distributions (Ubuntu 20.04+, Fedora 35+, etc.)

**Minimum hardware**:
- 4 GB RAM (8 GB recommended)
- 500 MB free disk space (plus space for your projects)
- Internet connection (for AI API calls)

---

## Download and Install

### Recommended: Install via npm

The easiest way to install and run **productOS** is via npm. This works on macOS, Windows, and Linux.

```bash
# Launch directly with npx
npx productos

# Or install globally
npm install -g productos
productos
```

### Build from Source

This path is for contributors and developers.

For contributors running from a Git clone:

```bash
git clone https://github.com/AIResearchFactory/productOS.git
cd productOS
npm install
npm run dev
```

Run `npm install` before `npm run dev`, `npm run build`, or `npx vite`. A fresh clone does not include `node_modules`, so running Vite before installing dependencies can produce unresolved import errors for packages such as `@vitejs/plugin-react` and `vite-plugin-pwa`.

---

## First Launch Setup

When you launch productOS for the first time, you'll see the **Installation Wizard**. This will guide you through the initial setup.

### Installation Wizard Steps

#### 1. Welcome Screen
- Click **"Start Installation"** to begin

#### 2. Data Directory Selection
- productOS will suggest a default location for your data:
  - **macOS**: `~/Library/Application Support/ai-researcher`
  - **Windows**: `%APPDATA%\ai-researcher`
  - **Linux**: `~/.local/share/ai-researcher`
- You can change this location if you prefer
- Click **"Continue"**

#### 3. Directory Structure Creation
- productOS creates the necessary folders:
  - `projects/` - Your research projects
  - `skills/` - Reusable AI agent templates
  - `templates/` - Project and skill templates
  - `backups/` - Automatic backups
- This happens automatically

#### 4. Dependency Detection
- productOS checks for optional dependencies:
  - **Ollama** - For local AI models
  - **Claude Code** - For coding assistance
- Don't worry if these aren't found - they're optional!

#### 5. Installation Complete
- Click **"Get Started"** to open productOS

---

## Optional Dependencies

productOS works great with hosted AI services (Claude, OpenAI, Gemini), but you can optionally install local AI tools for additional capabilities.

### Ollama (Optional)

**What it is**: Run AI models locally on your computer without API keys.

**Why use it**: Privacy, no API costs, works offline.

**Installation**:

**macOS/Linux**:
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

**Windows**:
Download from [ollama.ai](https://ollama.ai) and run the installer.

**Verify installation**:
```bash
ollama --version
```

**Download a model**:
```bash
ollama pull llama3
```

### Claude Code (Optional)

**What it is**: Anthropic's coding assistant with advanced code analysis.

**Why use it**: Specialized for code review, debugging, and development tasks.

**Installation**:
Visit [Anthropic's documentation](https://docs.anthropic.com) for installation instructions specific to your platform.

### Gemini CLI (Optional)

**What it is**: Google's Gemini AI accessible via command line.

**Why use it**: Alternative to Claude/OpenAI with different capabilities.

**Installation**:
Follow Google's official Gemini CLI installation guide.

### OpenCode (Optional Custom CLI)

**What it is**: A third-party AI coding CLI that can be wired into productOS as a custom model CLI.

**Why use it**: Useful if your team already uses OpenCode and wants it available from productOS workflows.

**Installation**:

```bash
npm install -g opencode-ai
opencode --help
```

Then open **Settings → Models → Custom Model CLIs** and add an entry that runs the `opencode` command. OpenCode is not bundled with the productOS source clone or npm package.

### Important Notes

- **These are all optional** - productOS works perfectly with hosted APIs
- You can install them later if you want
- Use them as examples of what's possible
- Choose based on your needs and preferences

---

## Initial Configuration

After installation, you'll want to configure your AI provider and add API keys.

### Step 1: Open Settings

1. Click the **menu icon** (☰) in the top-left
2. Select **"Settings"**
3. You'll see the **Global Settings** page

### Step 2: Choose Your AI Provider

In the **AI Configuration** section:

1. Click the **"Active Provider"** dropdown
2. Choose your preferred provider:
   - **Ollama via MCP** - Local AI (requires Ollama installed)
   - **Claude Code** - Anthropic's coding assistant (requires Claude Code)
   - **Hosted API** - Claude, OpenAI, Gemini, etc.

### Step 3: Add API Keys (for Hosted APIs)

If you're using hosted APIs:

1. Scroll to **"API Keys"**
2. Click **"Add API Key"**
3. Enter your API key (get one from [Anthropic](https://console.anthropic.com), [OpenAI](https://platform.openai.com), etc.)
4. Click **"Save"**

**Security note**: Your API keys are encrypted using AES-256-GCM encryption and stored locally. productOS uses your system's native keychain (macOS Keychain, Windows Credential Manager, or Linux Secret Service) to securely manage the encryption master key.

### Step 4: Configure Your Provider

Depending on your chosen provider:

**For Ollama**:
- Select your preferred model (e.g., `llama3`, `mistral`)
- Ensure Ollama is running: `ollama serve`

**For Hosted APIs**:
- Select your model (e.g., `claude-3-5-sonnet-20241022`)
- Verify your API key is entered

### Step 5: Test Your Configuration

1. Create a test project (see [Projects Guide](04-projects-guide.md))
2. Open the AI Chat panel
3. Send a simple message like "Hello, can you help me?"
4. If you get a response, you're all set!

---

## Verification

To verify your installation is working correctly:

### 1. Check Data Directory
- Open Settings → General
- Verify the data directory path is correct
- Navigate to that folder in your file explorer
- You should see `projects/`, `skills/`, and other folders

### 2. Check AI Provider
- Open Settings → AI Configuration
- Verify your provider is selected
- Check that API keys are saved (shown as `••••••••`)

### 3. Test AI Chat
- Create a new project
- Open the chat panel
- Send a test message
- Verify you receive a response

### 4. Check File Creation
- Create a new file in your project
- Write some content
- Navigate to your data directory
- Verify the file exists as a `.md` file

---

## Troubleshooting

### Configuration Issues

**Problem**: `npx vite` or Vite cannot resolve `@vitejs/plugin-react` / `vite-plugin-pwa` from a source clone


**Problem**: Chat says the selected AI provider needs setup, but Settings looks correct
**Solution**: Confirm that the **active provider** in Settings → Models is the same provider you authenticated. For CLI providers, also confirm the CLI is available in your terminal PATH and logged in (`claude login`, Gemini auth, Codex/OpenAI login, etc.). Then refresh provider detection or restart productOS.

**Problem**: Skill import hangs at an agent-selection prompt
**Solution**: Use a non-interactive command such as `npx skills add https://github.com/anthropics/skills --skill frontend-design --yes --agent openclaw --copy`. The in-app importer now adds these flags automatically when they are omitted.

**Problem**: Can't find data directory
**Solution**: 
1. Open Settings
2. Click "Change Data Directory"
3. Select or create a new folder
4. Restart productOS

**Problem**: API key not working
**Solution**:
1. Verify the key is correct (check your AI provider's dashboard)
2. Ensure you have API credits/quota available
3. Try removing and re-adding the key
4. Check your internet connection

**Problem**: Ollama not detected
**Solution**:
1. Verify Ollama is installed: `ollama --version`
2. Start Ollama service: `ollama serve`
3. In productOS, go to Settings → Click "Re-detect Dependencies"

### Password Issues

**Problem**: Forgot password
**Solution**: Unfortunately, encrypted secrets cannot be recovered without the password. You'll need to:
1. Delete the `.secrets.encrypted` file from your data directory
2. Re-enter your API keys
3. Set a new password

**Problem**: Password prompt every time
**Solution**: This is by design for security. Your password unlocks your encrypted API keys. There's no way to disable this while maintaining encryption.

### Performance Issues

**Problem**: App is slow
**Solution**:
1. Check if you have many large files in projects
2. Close unused projects
3. Ensure you have enough RAM available
4. Try restarting the application

**Problem**: AI responses are slow
**Solution**:
1. This is usually due to the AI provider's response time
2. Try a different model (smaller models are faster)
3. Check your internet connection
4. For Ollama, ensure your computer meets the model's requirements

### Getting More Help

If you're still having issues:

1. Check the [GitHub Issues](https://github.com/AIResearchFactory/ai-researcher/issues) page
2. Search for similar problems
3. Create a new issue with:
   - Your operating system and version
   - productOS version
   - Steps to reproduce the problem
   - Any error messages

---

## What's Next?

Now that productOS is installed and configured, you're ready to:

1. **[Create your first project](04-projects-guide.md)** - Start organizing your research
2. **[Use AI Chat](04-projects-guide.md#using-ai-chat)** - Begin researching with AI assistance
3. **[Explore Skills](05-skills-guide.md)** - Create specialized AI agents
4. **[Build Workflows](06-workflows-guide.md)** - Automate repetitive tasks

---

[← Previous: Main Components](02-main-components.md) | [Back to Documentation Home](README.md) | [Next: Projects Guide →](04-projects-guide.md)
