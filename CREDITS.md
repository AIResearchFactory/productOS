# Credits & Attributions

This repository **productOS** (https://github.com/AIResearchFactory/productOS) is released under the **Apache-2.0** license.  Below you will find a complete list of third‑party software, libraries, and assets that are bundled with the project, together with the version used, the license under which each component is distributed, and a link to the upstream source.

---

## Project

- **Name:** productOS
- **Version:** 0.2.5
- **Repository:** https://github.com/AIResearchFactory/productOS
- **Maintainers:** Avia Tam, Assaf Miron
- **License:** Apache-2.0

---
## Node.js (backend) dependencies

The backend is powered by **Node.js** using standard built‑in modules (`node:http`, `node:fs`, `node:path`, `node:crypto`) to ensure cross‑platform compatibility and security. Native OS integrations are handled via standard system utilities.

---

## JavaScript / TypeScript (frontend) dependencies  

| Package | Version | License* | Source |
|---------|---------|----------|--------|
| `@radix-ui/react-context-menu` | 2.2.16 | MIT | https://www.npmjs.com/package/@radix-ui/react-context-menu |
| `@radix-ui/react-dialog` | 1.1.15 | MIT | https://www.npmjs.com/package/@radix-ui/react-dialog |
| `@radix-ui/react-icons` | 1.3.2 | MIT | https://www.npmjs.com/package/@radix-ui/react-icons |
| `@radix-ui/react-menubar` | 1.1.16 | MIT | https://www.npmjs.com/package/@radix-ui/react-menubar |
| `@radix-ui/react-select` | 2.2.6 | MIT | https://www.npmjs.com/package/@radix-ui/react-select |
| `@radix-ui/react-toast` | 1.2.15 | MIT | https://www.npmjs.com/package/@radix-ui/react-toast |
| `@tiptap/extension-bubble-menu` | 3.22.1 | MIT | https://www.npmjs.com/package/@tiptap/extension-bubble-menu |
| `@tiptap/extension-floating-menu` | 3.22.1 | MIT | https://www.npmjs.com/package/@tiptap/extension-floating-menu |
| `@tiptap/extension-link` | 3.22.1 | MIT | https://www.npmjs.com/package/@tiptap/extension-link |
| `@tiptap/extension-placeholder` | 3.22.1 | MIT | https://www.npmjs.com/package/@tiptap/extension-placeholder |
| `@tiptap/extension-table` | 3.22.1 | MIT | https://www.npmjs.com/package/@tiptap/extension-table |
| `@tiptap/extension-table-cell` | 3.22.1 | MIT | https://www.npmjs.com/package/@tiptap/extension-table-cell |
| `@tiptap/extension-table-header` | 3.22.1 | MIT | https://www.npmjs.com/package/@tiptap/extension-table-header |
| `@tiptap/extension-table-row` | 3.22.1 | MIT | https://www.npmjs.com/package/@tiptap/extension-table-row |
| `@tiptap/markdown` | 3.22.1 | MIT | https://www.npmjs.com/package/@tiptap/markdown |
| `@tiptap/pm` | 3.22.1 | MIT | https://www.npmjs.com/package/@tiptap/pm |
| `@tiptap/react` | 3.22.1 | MIT | https://www.npmjs.com/package/@tiptap/react |
| `@tiptap/starter-kit` | 3.22.1 | MIT | https://www.npmjs.com/package/@tiptap/starter-kit |
| `@tiptap/suggestion` | 3.22.1 | MIT | https://www.npmjs.com/package/@tiptap/suggestion |
| `@types/tippy.js` | 6.3.0 | MIT | https://www.npmjs.com/package/@types/tippy.js |
| `@xyflow/react` | 12.10.0 | MIT | https://www.npmjs.com/package/@xyflow/react |
| `class-variance-authority` | 0.7.1 | MIT | https://www.npmjs.com/package/class-variance-authority |
| `clsx` | 2.1.1 | MIT | https://www.npmjs.com/package/clsx |
| `date-fns` | 4.1.0 | MIT | https://www.npmjs.com/package/date-fns |
| `framer-motion` | 12.29.0 | MIT | https://www.npmjs.com/package/framer-motion |
| `lucide-react` | 0.263.1 | MIT | https://www.npmjs.com/package/lucide-react |
| `papaparse` | 5.5.3 | MIT | https://www.npmjs.com/package/papaparse |
| `pptxgenjs` | 4.0.1 | MIT | https://www.npmjs.com/package/pptxgenjs |
| `react` | 18.3.1 | MIT | https://www.npmjs.com/package/react |
| `react-dom` | 18.3.1 | MIT | https://www.npmjs.com/package/react-dom |
| `react-markdown` | 10.1.0 | MIT | https://www.npmjs.com/package/react-markdown |
| `remark-gfm` | 4.0.1 | MIT | https://www.npmjs.com/package/remark-gfm |
| `tailwind-merge` | 3.4.0 | MIT | https://www.npmjs.com/package/tailwind-merge |
| `tippy.js` | 6.3.7 | MIT | https://www.npmjs.com/package/tippy.js |

*License information for the npm packages was obtained via `npm view <pkg> license`. The vast majority of these packages are released under the permissive **MIT** license; a few Tauri‑related packages carry a dual MIT/Apache‑2.0 license, which is compatible with the project’s Apache‑2.0 licensing.*

---

## Assets & Fonts  

| Asset | Author / Source | License | Required attribution |
|-------|----------------|---------|----------------------|
| **Inter** (font) | Rasmus Andersson – https://rsms.me/inter/ | SIL Open Font License 1.1 | “Inter font by Rasmus Andersson” |
| **Icons** (used via `lucide-react`) | Lucide – https://lucide.dev/ | MIT | “Icons from Lucide (https://lucide.dev/)” |
| **Tailwind CSS** (utility classes) | Tailwind Labs – https://tailwindcss.com/ | MIT | “Tailwind CSS © Tailwind Labs” |
| **Other SVG/PNG assets** | Created in‑house by the productOS team | – | No external attribution required |

---

## How this file is kept up‑to‑date  

- **Rust:** `cargo metadata` (or `cargo about`) can be run to regenerate the Rust‑crate table.  
- **JavaScript:** `npm ls --depth=0 --json` provides the current version list; `npm view <pkg> license` is used to fetch the license for each entry.  
- The CI pipeline includes a lint step that checks that every dependency listed in `CREDITS.md` exists in `Cargo.toml` or `package.json`. If a new dependency is added, the file should be updated accordingly before merging.

---

### Contact

For any licensing questions or concerns, please reach out to the maintainers:

- **Avia Tam** – avia@productos.ai
- **Assaf Miron** – assaf@productos.ai

*This file is intentionally placed at the repository root so that it is automatically included in source‑distribution archives and visible on GitHub’s file list.*
