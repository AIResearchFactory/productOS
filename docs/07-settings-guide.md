# Settings Guide

[← Previous: Workflows Guide](06-workflows-guide.md) | [Back to Documentation Home](README.md) | [Next: Data Portability Guide →](08-data-portability.md)

---

## Table of Contents
- [Settings Overview](#settings-overview)
- [Global Settings](#global-settings)
- [Project Settings](#project-settings)
- [API Keys and Security](#api-keys-and-security)
- [MCP Server Configuration](#mcp-server-configuration)
- [Troubleshooting Settings](#troubleshooting-settings)

---

## Settings Overview

productOS has two types of settings:

### Global Settings
Apply to the entire application:
- Theme and appearance
- Default AI provider
- API keys and secrets
- MCP server connections
- Data directory location

**Access**: Menu (☰) → Settings

### Project Settings
Apply to individual projects:
- Project name and goal
- Assigned skills
- Auto-save preferences
- Project-specific configurations

**Access**: Select project → Settings icon (⚙️)

---

## Global Settings

### Accessing Global Settings

1. Click the **menu icon** (☰) in the top-left
2. Select **"Settings"**
3. The Global Settings page opens

### General Settings

#### Theme

Choose your preferred visual theme:

- **Light** - Light background, dark text
- **Dark** - Dark background, light text (recommended for extended use)
- **System** - Automatically matches your operating system theme

**How to change**:
1. Go to Settings → General
2. Select your preferred theme from the dropdown
3. Changes apply immediately

#### Data Directory

Where productOS stores all your data.

**Default locations**:
- **macOS**: `~/Library/Application Support/ai-researcher`
- **Windows**: `%APPDATA%\ai-researcher`
- **Linux**: `~/.local/share/ai-researcher`

**How to change**:
1. Go to Settings → General
2. Click **"Change Data Directory"**
3. Select a new folder
4. productOS will move your data (or you can move it manually)
5. Restart the application

**When to change**:
- You want data on a different drive
- You need more storage space
- You want to use a cloud-synced folder (Dropbox, etc.)

#### Notifications

Enable or disable system notifications.

**What gets notified**:
- Workflow completion
- Long-running task completion
- Errors or warnings

**How to toggle**:
1. Go to Settings → General
2. Toggle **"Enable Notifications"**

---

### AI Configuration

This is where you configure which AI provider to use and how to connect to it.

#### Active Provider

Choose which AI service to use:

**Available providers**:
- **Ollama via MCP** - Local AI models (requires Ollama installed)
- **Claude Code** - Anthropic's coding assistant (requires Claude Code)
- **LiteLLM** - The "universal adapter" for AI (connects to 100+ LLMs)
- **Hosted API** - Cloud-based AI services (Claude, OpenAI, Gemini, etc.)

**How to select**:
1. Go to Settings → AI Configuration
2. Click the **"Active Provider"** dropdown
3. Select your preferred provider
4. Configure provider-specific settings below

#### Ollama Configuration

**When to use**: You want to run AI models locally on your computer.

**Requirements**: Ollama must be installed and running.

**Settings**:
- **Model**: Select which Ollama model to use
  - `llama3` - General purpose, good balance
  - `mistral` - Fast, efficient
  - `codellama` - Specialized for code
  - Custom models you've downloaded
- **MCP Server ID**: Usually `ollama` (default)

**How to configure**:
1. Ensure Ollama is installed and running: `ollama serve`
2. Download a model: `ollama pull llama3`
3. In Settings, select the model from the dropdown
4. Test by sending a chat message

**Advantages**:
- ✅ Free (no API costs)
- ✅ Private (runs locally)
- ✅ Works offline
- ✅ Fast responses

**Limitations**:
- ❌ Requires powerful computer
- ❌ Limited model selection
- ❌ May be slower than cloud APIs

#### Claude Code Configuration

**When to use**: You need advanced coding assistance and code analysis.

**Requirements**: Claude Code must be installed.

**Settings**:
- **Model**: Usually auto-detected

**How to configure**:
1. Install Claude Code (see [Installation Guide](03-installation.md))
2. Select "Claude Code" as active provider
3. The model is automatically configured

#### LiteLLM Configuration

**When to use**: You want to connect to a provider not explicitly listed (like Perplexity, Mistral, or Groq) or you already use LiteLLM's proxy.

**Requirements**: A running LiteLLM instance or a LiteLLM-compatible API endpoint.

**Settings**:
- **Base URL**: The endpoint where LiteLLM is listening (e.g., `http://localhost:4000`).
- **Model**: The model name as defined in your LiteLLM config (e.g., `gpt-4o`, `bedrock/anthropic.claude-v3`).
- **API Key**: Your LiteLLM secret/token.

**Advantages**:
- ✅ One interface for ANY model.
- ✅ Load balancing and fallbacks.
- ✅ Unified cost tracking across providers.

---

#### Hosted API Configuration

**When to use**: You want the best AI models without local setup.

**Requirements**: API key from your chosen provider.

**Settings**:
- **Provider**: Select the API provider
  - `anthropic` - Claude 3.5 Sonnet / Opus (highest intelligence)
  - `openai` - GPT-4o / GPT-4 Turbo (industry standard)
  - `google` - Gemini 1.5 Pro / Flash (huge context window)
- **Model**: Select the specific model
  - Claude: `claude-3-5-sonnet-20241022` (recommended)
  - OpenAI: `gpt-4o`, `gpt-4-turbo`
  - Gemini: `gemini-1.5-pro`
- **API Key Secret ID**: Where your API key is stored (usually `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc.)

**How to configure**:
1. Get an API key from your provider:
   - [Anthropic Console](https://console.anthropic.com)
   - [OpenAI Platform](https://platform.openai.com)
   - [Google AI Studio](https://makersuite.google.com)
2. In Settings → AI Configuration:
   - Select "Hosted API" as active provider
   - Choose your provider (e.g., "anthropic")
   - Select your model
3. Add your API key (see [API Keys section](#api-keys-and-security))

**Advantages**:
- ✅ Best AI models available
- ✅ No local setup required
- ✅ Fast, reliable responses
- ✅ Regular model updates

**Limitations**:
- ❌ Requires API costs
- ❌ Needs internet connection
- ❌ Data sent to external servers

---

### API Keys and Security

productOS takes security seriously. Your API keys are encrypted at rest and never shared.

#### How Security Works

1. **Master Key Storage**: Unlike many AI tools that store keys in plain text, productOS uses your **OS Keyring** (macOS Keychain, Windows Credential Manager) to store a unique master encryption key.
2. **Encryption**: All your API tokens are encrypted using **AES-256-GCM** before being saved to your local disk.
3. **Local Storage**: Your secrets stay on your machine. We never send your keys to our servers.
4. **Zero-Knowledge Architecture**: Only you (via your OS-level authentication) can unlock your master key to decrypt your provider tokens.

#### Why You Need a Password

Every time you launch productOS, you'll be asked for your password. This is **by design** for security:

- Your password decrypts your API keys
- Without it, your keys remain encrypted and unusable
- This protects your keys if someone accesses your computer
- It's similar to how password managers work

**Important**: There is no way to recover your password. If you forget it, you'll need to re-enter your API keys.

#### Adding an API Key

1. Go to Settings → AI Configuration
2. Scroll to **"API Keys and Secrets"**
3. Click **"Add API Key"**
4. Enter:
   - **Secret ID**: Name for this key (e.g., `ANTHROPIC_API_KEY`)
   - **Secret Value**: Your actual API key
5. Click **"Save"**
6. The key is encrypted and stored

**Security note**: Once saved, the key is shown as `••••••••••••••••` for security.

#### Managing API Keys

**To update a key**:
1. Go to Settings → API Keys
2. Find the key you want to update
3. Click **"Edit"**
4. Enter the new value
5. Click **"Save"**

**To delete a key**:
1. Find the key
2. Click **"Delete"**
3. Confirm deletion

**Best practices**:
- Use descriptive Secret IDs
- Rotate keys periodically
- Don't share your password
- Keep a secure backup of your keys (separately from productOS)

#### Common API Keys

| Secret ID | Used For | Get Key From |
|-----------|----------|--------------|
| `ANTHROPIC_API_KEY` | Claude models | [console.anthropic.com](https://console.anthropic.com) |
| `OPENAI_API_KEY` | GPT models | [platform.openai.com](https://platform.openai.com) |
| `GOOGLE_API_KEY` | Gemini models | [makersuite.google.com](https://makersuite.google.com) |
| `GITHUB_TOKEN` | GitHub MCP | [github.com/settings/tokens](https://github.com/settings/tokens) |

---

### MCP Server Configuration

**MCP (Model Context Protocol)** allows AI to connect to external tools and data sources.

#### What is MCP?

MCP gives your AI assistant the ability to:
- Read from GitHub repositories
- Search the web
- Access local files
- Query databases
- Interact with Jira, Notion, and other tools

**Think of it as**: Giving your AI assistant hands to interact with your tools.

#### Why Use MCP?

**Without MCP**:
- You manually copy data from tools to AI
- AI can't access real-time information
- No cross-tool automation

**With MCP**:
- AI reads directly from your tools
- Real-time data access
- Automated cross-tool workflows

[See Use Case 3 for a detailed example →](use-cases/Use-Case3-Using_MCP.md)

#### Available MCP Servers

Popular MCP servers you can configure:

| Server | Purpose | Use Case |
|--------|---------|----------|
| **Brave Search** | Web search | Research current information |
| **Filesystem** | Local file access | Read/write project files |
| **Ollama** | Local AI models | Use local models via MCP |
| **GitHub** | Repository access | Analyze code, issues, PRs |
| **Git** | Git operations | Repository analysis |
| **PostgreSQL** | Database queries | Data analysis |

#### Adding an MCP Server

1. Go to Settings → AI Configuration
2. Scroll to **"MCP Servers"**
3. Click **"+ Add MCP Server"**
4. Fill in the configuration:
   - **ID**: Unique identifier (e.g., `brave-search`)
   - **Name**: Display name (e.g., `Brave Search`)
   - **Command**: Usually `npx`
   - **Args**: Server-specific arguments
   - **Enabled**: Toggle on to activate
5. Click **"Save"**

#### Example: Adding Brave Search

```
ID: brave-search
Name: Brave Search
Command: npx
Args: -y @modelcontextprotocol/server-brave-search
Enabled: ✓
```

**What you need**: Brave Search API key (add to API Keys section)

#### Example: Adding Filesystem Access

```
ID: filesystem
Name: Filesystem
Command: npx
Args: -y @modelcontextprotocol/server-filesystem /Users/yourname/Documents
Enabled: ✓
```

**Note**: Replace `/Users/yourname/Documents` with the path you want to grant access to.

#### Example: Adding GitHub

```
ID: github
Name: GitHub
Command: npx
Args: -y @modelcontextprotocol/server-github
Enabled: ✓
```

**What you need**: GitHub personal access token (add to API Keys as `GITHUB_TOKEN`)

#### Managing MCP Servers

**To enable/disable**:
1. Find the server in the list
2. Toggle the **"Enabled"** switch
3. Changes apply immediately

**To edit**:
1. Click the server
2. Modify settings
3. Click **"Save"**

**To remove**:
1. Click the server
2. Click **"Delete"**
3. Confirm removal

#### MCP Server Documentation

For detailed setup instructions for specific MCP servers, refer to:
- [MCP Documentation](https://modelcontextprotocol.io)
- [MCP Server Registry](https://github.com/modelcontextprotocol/servers)
- Provider-specific documentation

**Note**: productOS provides the general MCP configuration interface. Specific server setup may require additional steps (API keys, permissions, etc.).

---

## Project Settings

Project settings override global settings for a specific project.

### Accessing Project Settings

1. Select your project in the sidebar
2. Click the **settings icon** (⚙️)
3. Or right-click the project → **"Settings"**

### General Project Settings

#### Project Name

The display name for your project.

**How to change**:
1. Go to Project Settings → General
2. Update the **"Project Name"** field
3. Click **"Save"**

**Note**: This changes the display name only, not the folder name.

#### Project Goal

The objective or purpose of this project.

**Why it matters**: AI uses this to understand context and provide relevant assistance.

**How to update**:
1. Go to Project Settings → General
2. Update the **"Project Goal"** field
3. Click **"Save"**

**Example goals**:
- "Research top 5 competitors and create a comprehensive comparison report"
- "Analyze customer feedback from Q1 and identify key themes"
- "Evaluate technical feasibility of implementing dark mode"

#### Assigned Skills

Which skills are available for use in this project.

**How to manage**:
1. Go to Project Settings → General
2. In the **"Assigned Skills"** section:
   - Click **"+ Add Skill"** to assign a skill
   - Click **"✕"** next to a skill to remove it
3. Click **"Save"**

**Best practice**: Only assign skills you'll actually use in this project.

### Feature Settings

#### Auto-Save

Automatically save changes to files.

**Recommended**: Enabled (✓)

**How to toggle**:
1. Go to Project Settings → Features
2. Toggle **"Auto-Save"**
3. Click **"Save"**

#### Encryption

Encrypt sensitive project files.

**When to use**: Projects containing confidential information.

**How to enable**:
1. Go to Project Settings → Features
2. Toggle **"Encrypt Data"**
3. Click **"Save"**

**Note**: Encrypted files require your password to access.

---

## Troubleshooting Settings

### Common Issues

#### "API Key Invalid" Error

**Possible causes**:
- Key was entered incorrectly
- Key has expired or been revoked
- No API credits remaining

**Solutions**:
1. Verify the key in your provider's dashboard
2. Check your API usage and billing
3. Re-enter the key in Settings
4. Try a different key

#### "Cannot Connect to Ollama"

**Possible causes**:
- Ollama is not running
- Ollama is not installed
- Wrong port or configuration

**Solutions**:
1. Start Ollama: `ollama serve`
2. Verify installation: `ollama --version`
3. Check if Ollama is running on port 11434
4. In Settings, click "Re-detect Dependencies"

#### "MCP Server Not Responding"

**Possible causes**:
- Server not installed
- Missing dependencies
- Incorrect configuration
- Missing API keys

**Solutions**:
1. Verify the server is installed
2. Check the command and args are correct
3. Ensure required API keys are added
4. Check server-specific documentation
5. Try disabling and re-enabling the server

#### "Password Incorrect"

**Possible causes**:
- Wrong password entered
- Caps Lock is on
- Password was changed

**Solutions**:
1. Try entering the password again carefully
2. Check Caps Lock
3. If forgotten, you'll need to reset (see below)

#### Forgot Password

Unfortunately, there's no way to recover a forgotten password. Your options:

1. **Reset and re-enter keys**:
   - Close productOS
   - Delete `.secrets.encrypted` from your data directory
   - Restart productOS
   - Re-enter all API keys with a new password

2. **Keep a secure backup**:
   - Store API keys in a password manager
   - Keep a secure note of your productOS password

### Settings Not Saving

**Possible causes**:
- File permissions issue
- Disk full
- Settings file corrupted

**Solutions**:
1. Check disk space
2. Verify you have write permissions to the data directory
3. Try restarting productOS
4. Check the logs for error messages

### Performance Issues

**If productOS is slow**:
1. Check your data directory size
2. Close unused projects
3. Disable unused MCP servers
4. Clear old chat transcripts
5. Restart the application

---

## Best Practices

### Security

- **Use strong passwords** for encryption
- **Rotate API keys** periodically
- **Don't share** your password or keys
- **Keep backups** of your keys (securely, outside productOS)
- **Use project encryption** for sensitive research

### Organization

- **Set clear project goals** to help AI understand context
- **Assign relevant skills** to projects
- **Use descriptive names** for everything
- **Review settings** periodically

### Performance

- **Disable unused MCP servers** to reduce overhead
- **Choose appropriate models** (smaller = faster)
- **Use local models** (Ollama) for simple tasks
- **Use hosted APIs** for complex tasks

### Cost Management

If using hosted APIs:
- **Monitor usage** in your provider's dashboard
- **Set spending limits** if available
- **Use local models** for development/testing
- **Choose cost-effective models** for simple tasks

---

## What's Next?

Now that you've configured productOS, explore:

1. **[Data Portability Guide](08-data-portability.md)** - Backup, migrate, and share your work
2. **[Projects Guide](04-projects-guide.md)** - Start using your configured AI
3. **[Workflows Guide](06-workflows-guide.md)** - Leverage MCP in workflows

---

[← Previous: Workflows Guide](06-workflows-guide.md) | [Back to Documentation Home](README.md) | [Next: Data Portability Guide →](08-data-portability.md)