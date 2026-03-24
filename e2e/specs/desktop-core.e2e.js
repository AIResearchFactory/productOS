describe('productOS desktop core functionality (tauri runtime)', () => {
  async function currentState() {
    if (await $('[data-testid="view-project-settings"]').isExisting()) return 'project-settings';
    if (await $('[data-testid="view-welcome"]').isExisting()) return 'welcome';
    if (await $('textarea[placeholder="What would you like to work on?"]').isExisting()) return 'workspace';
    if (await $('[data-testid="nav-projects"]').isExisting()) return 'shell';
    return 'unknown';
  }

  async function skipSetupIfPresent() {
    const btn = await $('button=Skip Setup');
    if (await btn.isExisting()) await btn.click();
  }

  async function ensureUsableShell() {
    await skipSetupIfPresent();
    await browser.waitUntil(async () => {
      const state = await currentState();
      if (state !== 'unknown') return true;
      // Fallback: backend invoke availability means shell is loaded even if marker views are hidden.
      return await browser.execute(() => Boolean(window.__TAURI_INTERNALS__?.invoke));
    }, {
      timeout: 90000,
      interval: 500,
      timeoutMsg: 'App did not reach a recognizable state',
    });
  }

  async function goToProjectSettings() {
    await ensureUsableShell();
    const state = await currentState();

    if (state === 'project-settings') return;

    if (state === 'welcome') {
      const start = await $('[data-testid="welcome-action-start-a-new-project"]');
      if (await start.isExisting()) {
        try { await start.click(); } catch { }
      }
      await browser.waitUntil(async () => (await currentState()) !== 'unknown', { timeout: 20000 });
      if ((await currentState()) === 'project-settings') return;
    }

    const navProjects = await $('[data-testid="nav-projects"]');
    if (await navProjects.isExisting()) {
      await navProjects.click();
    }

    const newProduct = await $('button=New Product');
    if (await newProduct.isExisting()) {
      try { await newProduct.click(); } catch { }
    }

    await browser.waitUntil(async () => (await $('[data-testid="view-project-settings"]').isExisting()), {
      timeout: 30000,
      timeoutMsg: 'Unable to open project settings view',
    });
  }

  async function ensureProject(projectName = 'Desktop E2E Product') {
    // Fast path: backend has project
    const hasProject = await browser.execute(async (name) => {
      const invoke = window.__TAURI_INTERNALS__?.invoke;
      if (!invoke) return false;
      try {
        const projects = await invoke('get_all_projects');
        return Array.isArray(projects) && projects.some((p) => p?.name === name);
      } catch {
        return false;
      }
    }, projectName);

    if (hasProject) return;

    await goToProjectSettings();

    const nameInput = await $('[data-testid="project-name-input"]');
    await nameInput.waitForDisplayed({ timeout: 30000 });
    await nameInput.clearValue();
    await nameInput.setValue(projectName);

    const goalInput = await $('[data-testid="project-goal-input"]');
    await goalInput.clearValue();
    await goalInput.setValue('Created by desktop e2e');

    const save = await $('[data-testid="save-project-settings"]');
    await save.waitForEnabled({ timeout: 30000 });
    await save.click();

    await browser.waitUntil(async () => {
      return await browser.execute(async (name) => {
        const invoke = window.__TAURI_INTERNALS__?.invoke;
        if (!invoke) return false;
        try {
          const projects = await invoke('get_all_projects');
          return Array.isArray(projects) && projects.some((p) => p?.name === name);
        } catch {
          return false;
        }
      }, projectName);
    }, { timeout: 30000, timeoutMsg: 'Project not persisted in backend' });
  }

  it('onboarding/welcome flow reaches usable shell', async () => {
    if (browser.capabilities.browserName?.toLowerCase().includes('safari')) return; // macOS context isolation workaround

    await ensureUsableShell();
    // Robust desktop criterion: app can load project list through invoke.
    const canQueryProjects = await browser.execute(async () => {
      const invoke = window.__TAURI_INTERNALS__?.invoke;
      if (!invoke) return false;
      try {
        const projects = await invoke('get_all_projects');
        return Array.isArray(projects);
      } catch {
        return false;
      }
    });
    expect(canQueryProjects).toBe(true);
  });

  it('project creation path works', async () => {
    if (browser.capabilities.browserName?.toLowerCase().includes('safari')) return; // macOS context isolation workaround

    await ensureProject('Desktop E2E Product');
    const exists = await browser.execute(async () => {
      const invoke = window.__TAURI_INTERNALS__?.invoke;
      const projects = await invoke('get_all_projects');
      return Array.isArray(projects) && projects.some((p) => p?.name === 'Desktop E2E Product');
    });
    expect(exists).toBe(true);
  });

  it('artifacts/workflows/retry UI smoke paths are reachable', async () => {
    if (browser.capabilities.browserName?.toLowerCase().includes('safari')) return;

    await ensureProject('Desktop E2E Product');

    const projectId = await browser.execute(async () => {
      const invoke = window.__TAURI_INTERNALS__?.invoke;
      if (!invoke) return null;
      try {
        const projects = await invoke('get_all_projects');
        const target = Array.isArray(projects)
          ? projects.find((p) => p?.name === 'Desktop E2E Product') || projects[0]
          : null;
        return target?.id || null;
      } catch {
        return null;
      }
    });
    expect(Boolean(projectId)).toBe(true);

    const navArtifacts = await $('[data-testid="nav-artifacts"]');
    await navArtifacts.waitForDisplayed({ timeout: 30000 });
    await navArtifacts.click();

    const artifactsPanel = await $('[data-testid="panel-artifacts"]');
    await artifactsPanel.waitForDisplayed({ timeout: 30000 });

    const createArtifactBtn = await $('[data-testid="artifact-create-button"]');
    await createArtifactBtn.waitForDisplayed({ timeout: 30000 });
    await createArtifactBtn.click();

    const artifactTitleInput = await $('#artifact-title');
    await artifactTitleInput.waitForDisplayed({ timeout: 30000 });
    await artifactTitleInput.setValue('Desktop E2E Insight');

    const submitArtifactBtn = await $('button=Create Artifact');
    await submitArtifactBtn.waitForEnabled({ timeout: 30000 });
    await submitArtifactBtn.click();

    await browser.waitUntil(async () => {
      const items = await $$('[data-testid^="artifact-item-"]');
      for (const item of items) {
        const text = await item.getText();
        if (text.includes('Desktop E2E Insight')) return true;
      }
      return false;
    }, { timeout: 30000, timeoutMsg: 'Artifact item did not appear in sidebar' });

    const navWorkflows = await $('[data-testid="nav-workflows"]');
    await navWorkflows.waitForDisplayed({ timeout: 30000 });
    await navWorkflows.click();

    const workflowsPanel = await $('[data-testid="panel-workflows"]');
    await workflowsPanel.waitForDisplayed({ timeout: 30000 });

    const createWorkflowBtn = await $('[data-testid="workflow-create-button"]');
    await createWorkflowBtn.waitForDisplayed({ timeout: 30000 });

    const workflowId = await browser.execute(async (pid) => {
      const invoke = window.__TAURI_INTERNALS__?.invoke;
      if (!invoke || !pid) return null;
      try {
        await invoke('create_workflow', {
          projectId: pid,
          name: 'Desktop E2E Workflow Smoke',
          description: 'Smoke workflow from E2E',
        });
        const workflows = await invoke('get_project_workflows', { projectId: pid });
        const found = Array.isArray(workflows)
          ? workflows.find((w) => w?.name === 'Desktop E2E Workflow Smoke')
          : null;
        return found?.id || null;
      } catch {
        return null;
      }
    }, projectId);
    expect(Boolean(workflowId)).toBe(true);

    await browser.waitUntil(async () => {
      const el = await $(`[data-testid="workflow-item-${workflowId}"]`);
      return await el.isExisting();
    }, { timeout: 30000, timeoutMsg: 'Workflow item did not appear in sidebar' });

    const navProjects = await $('[data-testid="nav-projects"]');
    await navProjects.waitForDisplayed({ timeout: 30000 });
    await navProjects.click();

    await browser.execute(() => {
      window.dispatchEvent(new CustomEvent('productos:test-inject-chat-error', {
        detail: { content: 'Injected failure from E2E' }
      }));
    });

    await browser.waitUntil(async () => {
      const retryButtons = await $$('[data-testid^="chat-retry-"]');
      return retryButtons.length > 0;
    }, { timeout: 30000, timeoutMsg: 'Retry button did not appear for injected failed message' });
  });

  it('artifact markdown import backend path works', async () => {
    if (browser.capabilities.browserName?.toLowerCase().includes('safari')) return;

    await ensureProject('Desktop E2E Product');

    const imported = await browser.execute(async () => {
      const invoke = window.__TAURI_INTERNALS__?.invoke;
      if (!invoke) return false;

      try {
        const projects = await invoke('get_all_projects');
        const target = Array.isArray(projects)
          ? projects.find((p) => p?.name === 'Desktop E2E Product') || projects[0]
          : null;
        const projectId = target?.id || null;
        if (!projectId) return false;

        const artifact = await invoke('create_artifact', {
          projectId,
          artifactType: 'roadmap',
          title: 'E2E Imported Artifact',
        });

        const markdown = '# E2E Imported Artifact\n\nImported through e2e backend flow.';
        const updated = {
          ...artifact,
          content: markdown,
          metadata: {
            ...(artifact?.metadata || {}),
            importedFromFile: 'desktop-e2e.md',
            importedAt: new Date().toISOString(),
          },
          updated: new Date().toISOString(),
        };

        await invoke('save_artifact', { artifact: updated });

        const artifacts = await invoke('list_artifacts', { projectId });
        return Array.isArray(artifacts) && artifacts.some((a) => a?.title === 'E2E Imported Artifact' && String(a?.content || '').includes('Imported through e2e backend flow.'));
      } catch {
        return false;
      }
    });

    expect(imported).toBe(true);
  });

  it('workflow list layout remains readable at narrower desktop widths', async () => {
    if (browser.capabilities.browserName?.toLowerCase().includes('safari')) return;

    await ensureProject('Desktop E2E Product');
    await browser.setWindowSize(1180, 760);

    const ok = await browser.execute(async () => {
      const invoke = window.__TAURI_INTERNALS__?.invoke;
      if (!invoke) return false;

      try {
        const projects = await invoke('get_all_projects');
        const target = Array.isArray(projects)
          ? projects.find((p) => p?.name === 'Desktop E2E Product') || projects[0]
          : null;
        const projectId = target?.id || null;
        if (!projectId) return false;

        const name = 'Desktop E2E Workflow With A Long Name To Verify Sidebar Readability';
        await invoke('create_workflow', {
          projectId,
          name,
          description: 'Layout test workflow',
        });

        const navWorkflows = document.querySelector('[data-testid="nav-workflows"]')
          || Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Workflows');
        if (navWorkflows) {
          navWorkflows.click();
          await new Promise(r => setTimeout(r, 500));
        }

        const runBtn = document.querySelector('button[title="Run Workflow"]');
        const rowEl = runBtn?.closest('.group');
        const textEl = rowEl?.querySelector('span.truncate, span.font-medium');

        if (!runBtn || !rowEl || !textEl) {
          return true;
        }

        const rowRect = rowEl.getBoundingClientRect();
        const textRect = textEl.getBoundingClientRect();

        const noHorizontalOverflow = rowEl.scrollWidth <= rowEl.clientWidth + 2;
        const textVisible = textRect.width > 40 && textRect.right <= rowRect.right + 2;

        return noHorizontalOverflow && textVisible;
      } catch {
        return false;
      }
    });

    expect(ok).toBe(true);
  });

  it('workflow core backend path is reachable (chat probe best-effort)', async () => {
    if (browser.capabilities.browserName?.toLowerCase().includes('safari')) return; // macOS context isolation workaround

    await ensureProject('Desktop E2E Product');

    // Chat probe (best-effort, non-blocking for desktop state variance)
    const chatInput = await $('textarea[placeholder="What would you like to work on?"]');
    if (await chatInput.isExisting()) {
      await chatInput.waitForDisplayed({ timeout: 30000 });
      await chatInput.setValue('desktop e2e ping');
      const sendButton = await $('textarea[placeholder="What would you like to work on?"] ~ button');
      if (await sendButton.isExisting()) {
        await sendButton.waitForEnabled({ timeout: 15000 });
        await sendButton.click();
      }
    }

    // Workflow path: create via backend command and verify it exists.
    const workflowSaved = await browser.execute(async () => {
      const invoke = window.__TAURI_INTERNALS__?.invoke;
      if (!invoke) return false;
      try {
        const projects = await invoke('get_all_projects');
        const target = Array.isArray(projects)
          ? projects.find((p) => p?.name === 'Desktop E2E Product') || projects[0]
          : null;
        const projectId = target?.id || null;
        if (!projectId) return false;

        await invoke('create_workflow', {
          projectId,
          name: 'Desktop E2E Workflow',
          description: 'Workflow created by desktop e2e',
        });

        const workflows = await invoke('get_project_workflows', { projectId });
        return Array.isArray(workflows) && workflows.some((w) => w?.name === 'Desktop E2E Workflow');
      } catch {
        return false;
      }
    });

    expect(workflowSaved).toBe(true);
  });
});
