const fs = require('fs');

function updatePrototype() {
  let text = fs.readFileSync('docs/features/ux/productos-simplified-prototype.html', 'utf8');

  // Outputs Confidence Levels
  text = text.replace(/<h3>Current Product Status<\/h3>\s*<p>Updated 2d ago<\/p><button class="button">Open<\/button>/,
  `<h3>Current Product Status</h3>\n              <p>Updated 2d ago <span class="chip" style="color:var(--accent); border-color:var(--accent); font-size:10px; margin-left:8px; padding:2px 6px;">High Confidence</span></p><button class="button">Open</button>`);

  // Context Menu for Files
  text = text.replace(/<li class="selected">competitors.md<\/li>/,
  `<li class="selected" style="display:flex; justify-content:space-between;">competitors.md <span style="cursor:pointer; color:var(--muted); font-weight:bold; padding:0 4px;" title="Actions: Rename, Delete, Export, Convert to Output">⋮</span></li>`);
  
  text = text.replace(/<li>personas.md<\/li>/,
  `<li style="display:flex; justify-content:space-between;">personas.md <span style="cursor:pointer; color:var(--muted); font-weight:bold; padding:0 4px;" title="Actions: Rename, Delete, Export, Convert to Output">⋮</span></li>`);

  // Automations Segment
  text = text.replace(/<button class="button primary">New automation<\/button>/,
  `<div style="display:flex; gap:8px;"><button class="button">Import Skill</button> <button class="button primary">New Workflow</button></div>`);

  fs.writeFileSync('docs/features/ux/productos-simplified-prototype.html', text);
}

updatePrototype();
