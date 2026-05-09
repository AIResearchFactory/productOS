# 🚀 productOS: Research smarter. Own your data.

![License](https://img.shields.io/github/license/AIResearchFactory/productOS?style=flat-square)
![Version](https://img.shields.io/github/v/release/AIResearchFactory/productOS?style=flat-square)
![Build Status](https://img.shields.io/github/actions/workflow/status/AIResearchFactory/productOS/test.yml?branch=main&style=flat-square)

### Your AI-powered command center for product management.

![productOS UI Workspace](docs/assets/product_os_hero.png)

**productOS** is an AI-powered research workspace built around a **Local-First Progressive Web App (PWA)**, seamlessly powered by a native **Node.js** backend. The result is a faster iteration loop for the core product surface while maintaining local-first storage, native offline-capabilities, and secure key handling.

You can leverage local AI models (Ollama), hosted AI services (Claude), local code agents (**Claude Code**), and specialized CLI tools (**Gemini CLI**) as first-class citizens. All of these can be enhanced with **MCP (Model Context Protocol)** tools to create autonomous agents that define your workflow.

---

## 📥 Installation

**productOS** is distributed as a native Node.js application — no Rust, no Electron, no platform-specific binaries required.

### 📋 Prerequisites

- **Node.js (v18+)**: Required to run the core application.
- **Ollama** (Optional): For running local AI models.
- **Claude Code CLI** (Optional): For advanced coding assistance.
- **Gemini CLI** (Optional): For Google's Gemini models.

### Option 1: One-shot via npx (Recommended)

```bash
npx productos
```

This downloads and runs the latest version directly. Your browser will open automatically.

### Option 2: Install globally

```bash
npm install -g productos
productos
```

### Option 3: Build from source (For Developers)

If you want to contribute or run from source:

```bash
git clone https://github.com/AIResearchFactory/productOS.git
cd productOS
npm install
npm run dev
```

> Run `npm install` before any `npm run ...` or `npx vite` command. The source clone does not include `node_modules`, so Vite plugins such as `@vitejs/plugin-react` and `vite-plugin-pwa` are unavailable until dependencies are installed.


---

## ⚡ Quick Start

### 1. Install & launch

```bash
npx productos
```

This will:
- Start the **Node.js backend** on `http://localhost:51423`
- Open the **productos UI** in your browser at `http://localhost:5173`
- Store all your data in your system's App Data directory:
  - **macOS:** `~/Library/Application Support/productos/`
  - **Linux:** `~/.local/share/productos/`
  - **Windows:** `%APPDATA%\productos\`

### 2. Connect an AI provider

Open **Settings → Models** and pick your preferred provider:

| Provider | Setup |
| :--- | :--- |
| **Gemini CLI** | Run `gemini --auth` or add a Gemini API key in Settings |
| **Claude Code CLI** | Run `claude login` |
| **OpenAI CLI / API** | Add your OpenAI API key in Settings |
| **Ollama** | Start Ollama locally and pull a model: `ollama pull llama3` |
| **OpenCode** | Optional custom CLI: install separately with `npm install -g opencode-ai`, then add it under Settings → Models → Custom Model CLIs |

Once a provider is ready, start chatting in any project workspace. If chat says a provider is not ready, verify that the same provider is selected, installed/authenticated, and configured in **Settings → Models**.

### 3. Production build (from source)

```bash
npm run build   # builds frontend (TypeScript + Vite)
npm start       # serves the production build
```


---

## ✨ Key Goals

The primary mission of **productOS** is to give you ownership and power over your research data:

*   🤖 **Intelligent Research:** Orchestrate custom AI agents (skills) to conduct complex research tasks.
*   📂 **Project Management:** Keep your context, artifacts, and history in one place. All data is stored as **human-readable Markdown files**, making it easy to audit and reuse.
*   🔒 **Total Ownership:** No external databases. You own your data.
*   ⚡ **Local-First Runtime:** Browser-first shared flows, with native capabilities available through the local Node.js companion server.
*   🧩 **Automation:** A registry of reusable "skills" to automate repetitive workflows.

---

## 🌟 Main Capabilities

| Feature | Technology | Benefits |
| :--- | :--- | :--- |
| **Portability** | **Pure Markdown Files** | *No database required.* Your research is human-readable and move-ready. |
| **Cross-Platform** | **React + Node.js Companion** | Seamless experience on Windows, macOS, and Linux using standard web technologies. |
| **Control** | **Shared App API** | Browser-safe flows where possible, honest gating for native-only capabilities. |
| **Extensibility** | **MCP Support** | Connect custom servers to expand agent capabilities. |
| **Smart Chat** | **Agent Reasoning** | Collapsible thinking process, `@file` referencing, and table support. |
| **Workflows** | **Canvas UI** | Drag-and-drop experience for orchestrating complex agent workflows. |
| **Research Log** | **Timeline UI** | Chronological audit trail of all AI actions, commands, and research steps. |

### 🚀 Recent Improvements
*   🧠 **Agent Thinking**: Collapsible "Thinking Process" accordion for better visibility into agent reasoning.
*   📎 **@File Referencing**: Mention any file in your project using `@` in the chat for instant context.
*   💾 **Auto-State Persistence**: Never lose your progress—scroll positions and chat states are preserved.
*   🛠️ **Skill Customization**: Define custom environment variables for your AI skills and agents.
*   📊 **Rich Markdown**: Enhanced support for tables and complex formatting in both chat and the viewer.
*   🍎 **Native Integration**: Improved OS-level integrations for a more seamless experience.
*   🆕 **New Chat**: Easily clear and start new conversations with a single click.
*   📜 **Project Log Timeline**: A full, searchable audit trail of AI research history with export capabilities.

### 🔌 Enhanced Workflows with MCP
**productOS** now includes **MCP (Model Context Protocol)** support. Connect any MCP server to give your agents real-time access to external data, tools, and integrations.

Check out the [MCP Marketplace](src/data/mcp_marketplace.ts) for supported integrations.

---

## 🛠️ Technical Architecture

This application follows a **Local-First PWA architecture** powered by a native Node.js backend.

### Architecture Overview

The React app talks to a shared application API. In browser mode, that API uses browser-safe fallbacks and local persistence where appropriate. In native mode, the same app routes into the Node.js backend for filesystem and OS-level capabilities.

```mermaid
flowchart TD
    subgraph Frontend [React / TypeScript]
        A[Chat UI]
        B[Workspace UI]
        C[Workflow & Artifact UI]
    end

    subgraph SharedRuntime [Shared App API]
        D[appApi runtime facade]
        E[Browser-safe runtime adapters]
        F[Node.js runtime adapters]
    end

    subgraph NativeBackend [Node.js Backend]
        G[Project Manager]
        H[AI Service Layer]
        I[Secret Store (OS Keychain)]
        J[CLI Runner]
    end

    A --> D
    B --> D
    C --> D
    D --> E
    D --> F
    F --> G
    G --> H
    G -->|Read/Write| K(Local Filesystem\nMarkdown & Configs)
    H -->|HTTPS| L(LLM APIs / Ollama)
    H -->|Spawn| J
    J -->|Execute| M(Gemini CLI / Claude Code)
    I -->|Encrypted| K

    style Frontend fill:#e1f5fe,stroke:#01579b
    style SharedRuntime fill:#e8f5e9,stroke:#2e7d32
    style NativeBackend fill:#fff3e0,stroke:#ff6f00
```

### Technology Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | **React + Tailwind** | Main product surface and browser-first UI. |
| **Runtime Layer** | **Shared `appApi` facade** | Routes features to browser-safe adapters or native Node.js-backed implementations. |
| **Backend** | **Node.js** | Handles system operations, file I/O, encryption (via native modules), and AI logic. |
| **Data Format** | **Markdown (.md)** | Portable, git-friendly, and human-readable project data. |
| **Encryption** | **Native secret storage** | Protects API keys using OS-level secure storage (keychain/keyring). |
| **AI Client** | **HTTP + local CLI integrations** | Supports hosted APIs and local CLI execution (Gemini, Claude Code, Ollama, etc.). |

---

## 📂 Data Structure

Application data is stored within your system's standard `AppDataDirectory`.

| File/Directory | Purpose |
| :--- | :--- |
| **`secrets.encrypted.json`** | **Encrypted global secrets** (e.g., AI API keys). Stored securely. |
| **`settings.json`** | Global application configuration settings. |
| **`skills/`** | Directory for **reusable agent skills**. |
| **`projects/`** | Main directory containing individual research projects. |
| **`projects/project-alpha/.metadata/project.json`** | Project metadata (id, name, goal, skills, etc.). |
| **`projects/project-alpha/.metadata/settings.json`** | Project-specific configuration settings. |
| **`projects/project-alpha/chat-001.md`** | AI conversation artifacts/history. |
| **`projects/project-alpha/*.md`** | All research notes, analyses, and project outputs. |
| ---

## ⚙️ Development & Testing

### Repo Structure

- `src/` — React application and shared runtime-facing UI
- `src/api/` — shared app/runtime API layer and native adapters
- `node-backend/` — native Node.js backend
- `tests/` — Node test runner unit/integration coverage
- `e2e/` — Playwright browser-first end-to-end coverage
- `docs/` — architecture and usage guides

### Prerequisites
1.  **Node.js (v18+):** Required for the React frontend and Node.js backend. 
2.  **Claude API Key:** (Optional, for hosted Claude AI features)

### Running Locally

1.  **Clone the repo:**
    ```bash
    git clone https://github.com/AIResearchFactory/productOS.git
    cd productOS
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Run the dev app:**
    ```bash
    npm run dev
    ```

### Testing
- **Backend/Unit tests:**
    ```bash
    npm run test:backend
    ```
- **Browser-first e2e with Playwright:**
    ```bash
    npm run test:e2e
    ```

---

## 🤝 Contributing

We welcome contributions! Whether it's adding a new feature, fixing a bug, or improving documentation, your help is appreciated.

1.  Fork & Clone.
2.  Create branch: `git checkout -b feature/cool-feature`
3.  **Make your changes.**
4.  Commit & Push.
5.  Open a Pull Request.

---

## ⚖️ License

This project is licensed under the **Apache License 2.0**. See [`LICENSE`](./LICENSE) for details.

 
  
   
    
     
