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

## Rust (backend) dependencies  

| Crate | Version | License | Source |
|-------|---------|---------|--------|
| `serde_json` | 1.0.138 | MIT/Apache-2.0 | https://crates.io/crates/serde_json |
| `serde` | 1.0.217 | MIT/Apache-2.0 | https://crates.io/crates/serde |
| `log` | 0.4.25 | MIT/Apache-2.0 | https://crates.io/crates/log |
| `tauri` | 2.10.3 | MIT/Apache-2.0 | https://crates.io/crates/tauri |
| `tauri-plugin-log` | 2.2.1 | MIT/Apache-2.0 | https://crates.io/crates/tauri-plugin-log |
| `tauri-plugin-updater` | 2.10.1 | MIT/Apache-2.0 | https://crates.io/crates/tauri-plugin-updater |
| `tauri-plugin-process` | 2.3.1 | MIT/Apache-2.0 | https://crates.io/crates/tauri-plugin-process |
| `tokio` | 1.43.0 | MIT/Apache-2.0 | https://crates.io/crates/tokio |
| `async-trait` | 0.1.86 | MIT/Apache-2.0 | https://crates.io/crates/async-trait |
| `serde_yaml` | 0.9.34 | MIT/Apache-2.0 | https://crates.io/crates/serde_yaml |
| `notify` | 6.1.1 | MIT/Apache-2.0 | https://crates.io/crates/notify |
| `walkdir` | 2.5.0 | MIT/Apache-2.0 | https://crates.io/crates/walkdir |
| `chrono` | 0.4.39 | MIT/Apache-2.0 | https://crates.io/crates/chrono |
| `chrono-tz` | 0.10.1 | MIT/Apache-2.0 | https://crates.io/crates/chrono-tz |
| `cron` | 0.12.1 | MIT/Apache-2.0 | https://crates.io/crates/cron |
| `thiserror` | 1.0.69 | MIT/Apache-2.0 | https://crates.io/crates/thiserror |
| `anyhow` | 1.0.95 | MIT/Apache-2.0 | https://crates.io/crates/anyhow |
| `tauri-plugin-shell` | 2.3.5 | MIT/Apache-2.0 | https://crates.io/crates/tauri-plugin-shell |
| `tauri-plugin-opener` | 2.2.6 | MIT/Apache-2.0 | https://crates.io/crates/tauri-plugin-opener |
| `reqwest` | 0.11.27 | MIT/Apache-2.0 | https://crates.io/crates/reqwest |
| `futures` | 0.3.31 | MIT/Apache-2.0 | https://crates.io/crates/futures |
| `futures-util` | 0.3.31 | MIT/Apache-2.0 | https://crates.io/crates/futures-util |
| `tokio-stream` | 0.1.17 | MIT/Apache-2.0 | https://crates.io/crates/tokio-stream |
| `dirs` | 5.0.1 | MIT/Apache-2.0 | https://crates.io/crates/dirs |
| `glob` | 0.3.2 | MIT/Apache-2.0 | https://crates.io/crates/glob |
| `pulldown-cmark` | 0.9.6 | MIT/Apache-2.0 | https://crates.io/crates/pulldown-cmark |
| `async-stream` | 0.3.6 | MIT/Apache-2.0 | https://crates.io/crates/async-stream |
| `aes-gcm` | 0.10.3 | Apache-2.0 | https://crates.io/crates/aes-gcm |
| `argon2` | 0.5.3 | Apache-2.0 | https://crates.io/crates/argon2 |
| `rand` | 0.8.5 | MIT/Apache-2.0 | https://crates.io/crates/rand |
| `base64` | 0.21.7 | MIT/Apache-2.0 | https://crates.io/crates/base64 |
| `keyring` | 2.3.2 | MIT/Apache-2.0 | https://crates.io/crates/keyring |
| `tauri-plugin-os` | 2.3.2 | MIT/Apache-2.0 | https://crates.io/crates/tauri-plugin-os |
| `tauri-plugin-dialog` | 2.6.0 | MIT/Apache-2.0 | https://crates.io/crates/tauri-plugin-dialog |
| `tempfile` | 3.17.1 | MIT/Apache-2.0 | https://crates.io/crates/tempfile |
| `regex` | 1.11.1 | MIT/Apache-2.0 | https://crates.io/crates/regex |
| `once_cell` | 1.20.3 | MIT/Apache-2.0 | https://crates.io/crates/once_cell |
| `tokio-util` | 0.7.13 | MIT/Apache-2.0 | https://crates.io/crates/tokio-util |
| `uuid` | 1.13.1 | MIT/Apache-2.0 | https://crates.io/crates/uuid |
| `sha2` | 0.10.8 | MIT/Apache-2.0 | https://crates.io/crates/sha2 |
| `urlencoding` | 2.1.3 | MIT/Apache-2.0 | https://crates.io/crates/urlencoding |
| `pdf-extract` | 0.10.0 | MIT/Apache-2.0 | https://crates.io/crates/pdf-extract |

*All Rust crates are listed in `src-tauri/Cargo.toml`. The project’s own crate (`productos`) is licensed under Apache-2.0 (see the `license` field in the manifest).*

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
| `@tauri-apps/api` | 2.10.1 | MIT/Apache-2.0 | https://www.npmjs.com/package/@tauri-apps/api |
| `@tauri-apps/plugin-dialog` | 2.6.0 | MIT/Apache-2.0 | https://www.npmjs.com/package/@tauri-apps/plugin-dialog |
| `@tauri-apps/plugin-os` | 2.3.2 | MIT/Apache-2.0 | https://www.npmjs.com/package/@tauri-apps/plugin-os |
| `@tauri-apps/plugin-process` | 2.3.1 | MIT/Apache-2.0 | https://www.npmjs.com/package/@tauri-apps/plugin-process |
| `@tauri-apps/plugin-shell` | 2.3.5 | MIT/Apache-2.0 | https://www.npmjs.com/package/@tauri-apps/plugin-shell |
| `@tauri-apps/plugin-updater` | 2.10.1 | MIT/Apache-2.0 | https://www.npmjs.com/package/@tauri-apps/plugin-updater |
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
