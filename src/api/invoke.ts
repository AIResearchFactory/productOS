export const invokeCommand = async <T>(cmd: string, args?: any): Promise<T> => {
  // Helper to safely get/set JSON in localStorage
  const getStore = (key: string, def: any = []) => {
    try { return JSON.parse(localStorage.getItem(key) || 'null') || def; } catch { return def; }
  };
  const setStore = (key: string, val: any) => localStorage.setItem(key, JSON.stringify(val));

  if (cmd === 'get_project_cost') return 0 as any;

  // Project Mocks
  if (cmd === 'get_all_projects') {
    const projs = getStore('mock_projects');
    if (projs.length === 0) {
      return [] as any;
    }
    return projs as any;
  }
  if (cmd === 'create_project') {
    const projs = getStore('mock_projects');
    const newProj = { id: `proj-${Date.now()}`, name: args?.info?.name || 'New Project', description: '', created_at: new Date().toISOString(), path: '/' };
    setStore('mock_projects', [...projs, newProj]);
    return newProj as any;
  }
  if (cmd === 'get_project') {
    const projs = getStore('mock_projects');
    return (projs.find((p: any) => p.id === args?.id) || projs[0] || null) as any;
  }

  // Artifact Mocks
  if (cmd === 'list_artifacts') {
    return getStore('mock_artifacts') as any;
  }
  if (cmd === 'create_artifact') {
    const arts = getStore('mock_artifacts');
    const newArt = { id: `art-${Date.now()}`, artifactType: args?.artifactType || 'prd', title: args?.title || 'New Artifact', content: '', projectId: args?.projectId || 'test', created: new Date().toISOString(), updated: new Date().toISOString() };
    setStore('mock_artifacts', [...arts, newArt]);
    return newArt as any;
  }
  if (cmd === 'get_artifact') {
    const arts = getStore('mock_artifacts');
    return arts.find((a: any) => a.id === args?.artifactId) as any;
  }
  if (cmd === 'save_artifact') {
    const arts = getStore('mock_artifacts');
    const idx = arts.findIndex((a: any) => a.id === args?.artifact?.id);
    if (idx >= 0) arts[idx] = args.artifact;
    else arts.push(args.artifact);
    setStore('mock_artifacts', arts);
    return undefined as any;
  }

  // Workflow Mocks
  if (cmd === 'get_all_workflows') {
    return getStore('mock_workflows') as any;
  }
  if (cmd === 'save_workflow') {
    const wfs = getStore('mock_workflows');
    const idx = wfs.findIndex((w: any) => w.id === args?.workflow?.id);
    if (idx >= 0) wfs[idx] = args.workflow;
    else wfs.push({ ...args.workflow, id: `wf-${Date.now()}` });
    setStore('mock_workflows', wfs);
    return args.workflow as any;
  }

  // Settings & Environment Mocks
  if (cmd === 'get_settings') {
    const userSettings = getStore('mock_settings', null);
    if (userSettings) return userSettings as any;
    return {
      defaultModel: 'test-model',
      theme: 'dark',
      notificationsEnabled: true,
      activeProvider: 'ollama',
      ollama: { model: 'llama2', apiUrl: 'http://localhost:11434' },
      claude: { model: 'claude-3-opus-20240229' },
      hosted: { provider: 'openrouter', model: 'anthropic/claude-3-opus', apiKeySecretId: '' },
      geminiCli: { command: 'gemini', modelAlias: 'gemini-1.5-pro', apiKeySecretId: '' },
      openAiCli: { command: 'codex', modelAlias: 'gpt-5.3-codex', apiKeySecretId: '' },
      liteLlm: { enabled: false, baseUrl: '', apiKeySecretId: '', strategy: { defaultModel: '', researchModel: '', codingModel: '', editingModel: '' }, shadowMode: false },
      customClis: [],
      mcpServers: [],
      autoEscalateThreshold: 5,
      budgetWarningThreshold: 10
    } as any;
  }
  if (cmd === 'save_settings') {
    setStore('mock_settings', args?.settings);
    return undefined as any;
  }

  // Filesystem Mocks
  if (cmd === 'check_file_exists') {
    const allFiles = getStore('mock_fs_contents', {});
    return (args?.fileName in allFiles) as any;
  }
  if (cmd === 'read_markdown_file') {
    const allFiles = getStore('mock_fs_contents', {});
    return (allFiles[args?.path] || '# New Document\nStart typing here...') as any;
  }
  if (cmd === 'write_markdown_file') {
    const allFiles = getStore('mock_fs_contents', {});
    allFiles[args?.path] = args?.content;
    setStore('mock_fs_contents', allFiles);
    return undefined as any;
  }
  if (cmd === 'get_file_path') {
    return `/mock/project/${args?.file_name}` as any;
  }

  // Dependency Detection Mocks
  if (cmd === 'check_installation_status') return {
    app_data_path: '/mock/app/data',
    is_first_install: true,
    claude_code_detected: true,
    ollama_detected: true,
    gemini_detected: false
  } as any;
  if (cmd === 'get_openai_auth_status') return { connected: false, method: 'openai-oauth', details: 'Not authenticated' } as any;
  if (cmd === 'get_google_auth_status') return { connected: false, method: 'google-antigravity-login', details: 'Not authenticated' } as any;
  if (cmd === 'authenticate_openai' || cmd === 'authenticate_gemini') return 'Authentication request sent.' as any;
  if (cmd === 'run_installation') return { success: true } as any;

  // Default Fallbacks
  if (cmd === 'list_models') return [] as any;
  if (cmd === 'get_cost_budget') return { monthly_limit_usd: 10, alert_threshold_usd: 8 } as any;
  if (cmd === 'get_files' || cmd === 'sync_mcp_with_clis' || cmd === 'get_skills') return [] as any;
  if (cmd === 'fetch_mcp_marketplace') return [
    { name: 'product-db-mcp', description: 'Connects productOS directly to the main telemetry databases for deep research queries.', repository: 'github.com/test/product-db-mcp' }
  ] as any;
  if (cmd === 'read_file') return '# Mock File\nHello' as any;
  if (cmd === 'install_mcp') return { success: true } as any;

  if (cmd === 'send_message') {
    const msgs = args?.messages || [];
    const lastMsg: string = msgs[msgs.length - 1]?.content?.toLowerCase() || '';

    if (lastMsg.includes('research') && lastMsg.includes('vibe')) {
      return {
        content: 'I have analyzed the current market for Vibe Coding tools. I can compile this into an artifact for you.\n\n<PROPOSE_CONFIG>{"type":"create_artifact", "payload": {"title":"Vibe Coding Tool Analysis", "artifactType":"roadmap"}}</PROPOSE_CONFIG>'
      } as any;
    }

    if (lastMsg.includes('execute') && lastMsg.includes('workflow')) {
      return {
        content: 'Initiating benchmark fetcher map.\n\n<SUGGEST_WORKFLOW>{"project_id":"demo-project", "workflow_id":"benchmark-fetcher", "parameters": {"vendor":"Anthropic", "metric":"MMLU"}}</SUGGEST_WORKFLOW>'
      } as any;
    }

    const safeMsg = lastMsg || '';
    return { content: `[Browser Mock] Received your message: "${safeMsg.substring(0, 50)}..."` } as any;
  }

  if (cmd === 'get_all_skills') return invokeCommand('get_skills', args);
  if (cmd === 'get_global_settings') return invokeCommand('get_settings', args);
  if (cmd === 'get_app_config') return {
    app_data_directory: '/mock/app/data',
    installation_date: new Date().toISOString(),
    version: '0.2.7',
    claude_code_enabled: true,
    ollama_enabled: true,
    gemini_enabled: true,
    openai_enabled: true
  } as any;
  if (cmd === 'is_first_install') return false as any;
  if (cmd === 'get_all_workflows') return [] as any;

  console.warn(`[Tauri Mock] Unhandled command: ${cmd}. Returning default empty/null.`);
  return (Array.isArray(args) ? [] : null) as any;
};
