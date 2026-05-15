const fs = require('fs');

function updatePrototype() {
  let text = fs.readFileSync('docs/features/ux/productos-simplified-prototype.html', 'utf8');
  
  // Replace Ask ProductOS with Ask Maven
  text = text.replace(/Ask ProductOS/g, 'Ask Maven');
  
  // Update colors
  text = text.replace(/--bg: #080b0d;/g, '--bg: #0b0f19;');
  text = text.replace(/--surface: #0f1417;/g, '--surface: #111827;');
  text = text.replace(/--raised: #151c20;/g, '--raised: #1f2937;');
  text = text.replace(/--text: #f4f7f6;/g, '--text: #f8fafc;');
  text = text.replace(/--muted: #a8b3af;/g, '--muted: #94a3b8;');
  text = text.replace(/--soft: #6f7b77;/g, '--soft: #64748b;');
  text = text.replace(/--accent: #6ee7b7;/g, '--accent: #38bdf8;');
  text = text.replace(/--accent-muted: rgba\(110, 231, 183, \.12\);/g, '--accent-muted: rgba(56, 189, 248, .12);');
  text = text.replace(/rgba\(110, 231, 183/g, 'rgba(56, 189, 248');
  text = text.replace(/rgba\(8, 11, 13/g, 'rgba(11, 15, 25');
  text = text.replace(/rgba\(15, 20, 23/g, 'rgba(17, 24, 39');
  
  // Update CSS for nav-section
  if (!text.includes('.nav-section')) {
    text = text.replace(/\.nav a \{/, '.nav-section {\n      padding: 16px 14px 4px;\n      font-size: 11px;\n      text-transform: uppercase;\n      color: var(--soft);\n      font-weight: 800;\n      letter-spacing: 0.1em;\n    }\n\n    .nav a {');
  }

  // Update navigation HTML
  const navHtml = `<nav class="nav" aria-label="Simplified ProductOS navigation">
          <div class="nav-section">General</div>
          <a href="#home" class="active">Home <span>⌂</span></a>
          <a href="#automations">Automation <span>↻</span></a>
          <div class="nav-section">Content</div>
          <a href="#context">Files <span>◎</span></a>
          <a href="#outputs">Outputs <span>□</span></a>
          <a href="#settings" class="settings">Settings <span>⚙</span></a>
        </nav>`;
  text = text.replace(/<nav class="nav"[\s\S]*?<\/nav>/, navHtml);

  fs.writeFileSync('docs/features/ux/productos-simplified-prototype.html', text);
}

function updateMockups() {
  let text = fs.readFileSync('docs/features/ux/visual-mockups/productos-visual-mockups.html', 'utf8');
  
  // Replace Ask ProductOS with Ask Maven
  text = text.replace(/Ask ProductOS/g, 'Ask Maven');
  
  // Update colors
  text = text.replace(/--bg:#06090b;/g, '--bg:#0b0f19;');
  text = text.replace(/--panel:#0e1518;/g, '--panel:#111827;');
  text = text.replace(/--panel2:#121b20;/g, '--panel2:#1f2937;');
  text = text.replace(/--text:#f6fbf9;/g, '--text:#f8fafc;');
  text = text.replace(/--muted:#aab8b2;/g, '--muted:#94a3b8;');
  text = text.replace(/--dim:#71817b;/g, '--dim:#64748b;');
  text = text.replace(/--mint:#72efb8;/g, '--mint:#38bdf8;');
  text = text.replace(/--mint2:#35d18f;/g, '--mint2:#0284c7;');
  text = text.replace(/--cyan:#80dcff;/g, '--cyan:#bae6fd;');
  text = text.replace(/114,239,184/g, '56,189,248'); // old mint rgb
  text = text.replace(/53,209,143/g, '2,132,199'); // old mint2 rgb
  text = text.replace(/128,220,255/g, '186,230,253'); // old cyan rgb
  text = text.replace(/rgba\(6,9,11/g, 'rgba(11,15,25'); // bg rgb
  text = text.replace(/rgba\(8,13,15/g, 'rgba(11,15,25'); // top rgb
  text = text.replace(/rgba\(10,15,18/g, 'rgba(17,24,39'); // rail rgb
  text = text.replace(/Mint action layer/g, 'Blue action layer');
  
  fs.writeFileSync('docs/features/ux/visual-mockups/productos-visual-mockups.html', text);
}

updatePrototype();
updateMockups();
console.log("Done");
