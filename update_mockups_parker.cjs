const fs = require('fs');

function updateMockups() {
  let text = fs.readFileSync('docs/features/ux/visual-mockups/productos-visual-mockups.html', 'utf8');

  // Terminology updates
  text = text.replace(/Copilot/g, 'Parker');
  text = text.replace(/Ask Maven/g, 'Ask Parker');
  text = text.replace(/Ask ProductOS/g, 'Ask Parker');
  text = text.replace(/Artifacts/g, 'Outputs');
  
  // Section 2: Context / Files Context Menu
  // Find `<li class="item"><div><div class="title">README.md</div>...` and add an ellipsis `⋮`
  text = text.replace(/<li class="item(.*?)"><div><div class="title">(.*?)<\/div><div class="meta">(.*?)<\/div><\/div><span>(.*?)<\/span><\/li>/g, 
  `<li class="item$1"><div><div class="title">$2</div><div class="meta">$3</div></div><div style="display:flex; gap:8px; align-items:center;"><span>$4</span> <span style="cursor:pointer; color:var(--muted); font-weight:bold; padding:0 4px;" title="Actions: Rename, Delete, Export, Convert to Output">⋮</span></div></li>`);

  // Section 3: Outputs Confidence Levels
  // Add Confidence level badge inside the doc card
  text = text.replace(/<span class="badge">Fresh<\/span>/g, `<span class="badge">Fresh</span> <span class="badge manual" style="background:rgba(56,189,248,.1); color:var(--mint); border-color:var(--line);" title="Confidence Level: High">High Confidence</span>`);
  text = text.replace(/<span class="badge stale">Stale<\/span>/g, `<span class="badge stale">Stale</span> <span class="badge manual" style="background:rgba(255,209,102,.1); color:var(--amber); border-color:var(--line);" title="Confidence Level: Low">Low Confidence</span>`);

  // Section 4: Automations Segments (Workflows vs Skills)
  // Find `<div class="eyebrow">Automations</div><h3>Recurring product work...`
  text = text.replace(/<div class="eyebrow">Automations<\/div><h3>Recurring product work, not workflow jargon.<\/h3><p>Create scans, output refreshes, checklists, and scheduled reviews. Advanced canvas editing remains available after setup.<\/p><\/div><div><a class="btn">Browse tools<\/a> <a class="btn primary">New automation<\/a><\/div><\/div>/,
  `<div class="eyebrow">Automations</div><h3>Manage Workflows and Skills.</h3><p>Workflows are automated routines. Skills are reusable AI tools.</p><div class="chips" style="margin-top:12px;"><span class="chip on">Workflows</span><span class="chip">Skills</span></div></div><div style="display:flex; gap:8px;"><a class="btn">Import Skill</a> <a class="btn primary">New Workflow</a></div></div>`);

  fs.writeFileSync('docs/features/ux/visual-mockups/productos-visual-mockups.html', text);
}

function updateBriefs() {
    // Also update brief to use Parker
    const files = [
        'docs/features/ux/productos-compact-layout-spec.md',
        'docs/features/ux/productos-ux-simplification-brief.md',
        'docs/features/ux/productos-visual-flow-spec.md',
        'docs/features/ux/productos-simplified-user-journeys.md',
        'docs/features/ux/productos-simplified-prototype.html'
    ];
    for (const f of files) {
        if(fs.existsSync(f)) {
            let content = fs.readFileSync(f, 'utf8');
            content = content.replace(/Ask Maven/g, 'Ask Parker');
            content = content.replace(/Ask ProductOS/g, 'Ask Parker');
            content = content.replace(/Copilot/g, 'Parker');
            fs.writeFileSync(f, content);
        }
    }
}

updateMockups();
updateBriefs();
