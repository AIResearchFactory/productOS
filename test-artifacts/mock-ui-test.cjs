const { chromium } = require('playwright');
const fs = require('fs');

(async() => {
  const outDir = 'C:/Users/User/.openclaw/workspace/products/ai-researcher/test-artifacts';
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1510, height: 920 } });

  await context.addInitScript(() => {
    const fakeProject = {
      id: 'p1',
      name: 'Demo Project',
      goal: 'Validate end-to-end flows',
      path: '/demo/project',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const fakeSettings = {
      activeProvider: 'ollama',
      ollama: { model: 'qwen2.5:0.5b', apiUrl: 'http://localhost:11434' },
      hostedApi: { provider: 'claude', model: 'claude-3-5-sonnet' },
      claudeCode: { enabled: false },
      geminiCli: { enabled: false },
      liteLlm: { enabled: false, baseUrl: '', apiKey: '', model: '' },
      customProviders: []
    };

    const inv = async (cmd, args) => {
      switch (cmd) {
        case 'is_first_install': return false;
        case 'get_all_projects': return [fakeProject];
        case 'get_project': return fakeProject;
        case 'get_project_files': return [];
        case 'get_chat_files': return [];
        case 'load_chat_history': return [];
        case 'get_all_skills': return [{ id: 's1', name: 'Research Skill', description: 'Demo skill' }];
        case 'get_skill': return { id: 's1', name: 'Research Skill', description: 'Demo skill' };
        case 'list_artifacts': return [];
        case 'get_global_settings': return fakeSettings;
        case 'save_global_settings': return fakeSettings;
        case 'list_available_providers': return ['ollama', 'hostedApi', 'claudeCode', 'geminiCli'];
        case 'get_ollama_models': return ['qwen2.5:0.5b', 'llama3.2:1b'];
        case 'detect_ollama': return { installed: true, running: true, version: '0.17.0', path: 'C:/Users/User/AppData/Local/Programs/Ollama/ollama.exe' };
        case 'detect_claude_code': return { installed: false };
        case 'detect_gemini': return { installed: false };
        case 'detect_all_cli_tools': return [{ installed: false }, { installed: true, running: true }, { installed: false }];
        case 'has_claude_api_key': return false;
        case 'has_gemini_api_key': return false;
        case 'get_mcp_servers': return [];
        case 'fetch_mcp_marketplace': return [];
        case 'create_project': return fakeProject;
        case 'create_skill': return { id: 's2', name: 'New Skill', description: '' };
        case 'create_workflow': return { id: 'w1', name: 'Flow 1', nodes: [], edges: [] };
        case 'get_project_workflows': return [];
        case 'get_app_data_directory': return 'C:/Users/User/AppData/Roaming/ai-researcher';
        case 'get_system_username': return 'User';
        case 'get_formatted_owner_name': return 'User';
        case 'check_installation_status': return { complete: true };
        case 'verify_installation_integrity': return { ok: true };
        case 'check_and_preserve_structure': return true;
        case 'verify_directory_structure': return true;
        case 'send_message': return { message: 'Mock response', done: true };
        case 'switch_provider': return { ok: true };
        case 'save_chat': return true;
        case 'read_markdown_file': return '# Demo';
        case 'search_in_files': return [];
        case 'replace_in_files': return [];
        case 'write_markdown_file': return true;
        default: return null;
      }
    };

    window.__TAURI_INTERNALS__ = {
      transformCallback: (cb) => cb,
      invoke: (cmd, args) => inv(cmd, args)
    };

    window.__TAURI__ = {
      core: { invoke: (cmd, args) => inv(cmd, args), transformCallback: (cb) => cb },
      event: {
        listen: async () => () => {},
        emit: async () => {}
      }
    };
  });

  const page = await context.newPage();
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.goto('http://127.0.0.1:5173', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4500);

  await page.screenshot({ path: `${outDir}/10-mock-home.png`, fullPage: true });

  const clicks = [
    ['Create a workflow', '11-workflow.png'],
    ['Create a skill', '12-skill.png'],
    ['Install MCP server', '13-mcp.png'],
    ['Configure LLM', '14-llm.png'],
    ['No Skill', '15-noskill.png'],
    ['Help', '16-help.png']
  ];

  for (const [label, file] of clicks) {
    const loc = page.getByText(label, { exact: false }).first();
    if (await loc.count()) {
      try {
        await loc.click({ timeout: 3000 });
        await page.waitForTimeout(1000);
        await page.screenshot({ path: `${outDir}/${file}`, fullPage: true });
      } catch (e) {
        errors.push(`Click failed for ${label}: ${e}`);
      }
    } else {
      errors.push(`Missing UI label: ${label}`);
    }
  }

  fs.writeFileSync(`${outDir}/mock-console-errors.txt`, errors.join('\n'));
  await browser.close();
})();
