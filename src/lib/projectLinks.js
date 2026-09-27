/**
 * projectLinks.js
 * Utility for resolving and handling intra-project hyperlinks in markdown documents,
 * chats, and previews within productOS.
 */

/**
 * Normalizes a relative path against a base directory.
 * @param {string} baseDir - Directory of the current document (e.g. "initiatives/sub" or "")
 * @param {string} relativePath - Target relative path (e.g. "../roadmap.md" or "./us-1.md")
 * @returns {string} Normalized relative path from project root
 */
export function normalizeRelativePath(baseDir, relativePath) {
  const baseSegments = baseDir ? baseDir.split('/').filter(Boolean) : [];
  const targetSegments = relativePath.split('/').filter(Boolean);

  for (const seg of targetSegments) {
    if (seg === '.') continue;
    if (seg === '..') {
      if (baseSegments.length > 0) {
        baseSegments.pop();
      }
    } else {
      baseSegments.push(seg);
    }
  }

  return baseSegments.join('/');
}

/**
 * Resolves a hyperlink clicked within a document or chat.
 *
 * @param {string} href - Raw link href (e.g. "user-story-1.md", "./init-1.md", "#heading", "https://...")
 * @param {string} [currentFilePath] - File path of the document containing the link (e.g. "roadmaps/roadmap.md")
 * @param {string[]} [knownFiles] - Optional list of known project documents/artifacts
 * @returns {{
 *   type: 'anchor' | 'document' | 'peek' | 'external' | 'ignore',
 *   fileName?: string,
 *   hash?: string,
 *   url?: string
 * }}
 */
export function resolveProjectLink(href, currentFilePath = '', knownFiles = []) {
  if (!href || typeof href !== 'string') {
    return { type: 'ignore' };
  }

  const trimmedHref = href.trim();
  if (!trimmedHref || trimmedHref === '#') {
    return { type: 'ignore' };
  }

  // 1. In-page anchor links (e.g. "#acceptance-criteria")
  if (trimmedHref.startsWith('#')) {
    return {
      type: 'anchor',
      hash: trimmedHref.replace(/^#/, '')
    };
  }

  // 2. Protocols: mailto, tel
  if (trimmedHref.startsWith('mailto:') || trimmedHref.startsWith('tel:')) {
    return { type: 'external', url: trimmedHref };
  }

  // 3. Custom peek:// protocol
  if (trimmedHref.startsWith('peek://')) {
    return {
      type: 'peek',
      fileName: trimmedHref.replace(/^peek:\/\//, '')
    };
  }

  // 4. Custom project:// protocol
  if (trimmedHref.startsWith('project://')) {
    const rawPath = trimmedHref.replace(/^project:\/\//, '');
    return resolveDocumentTarget(rawPath, currentFilePath, knownFiles);
  }

  // 5. File URI (e.g. file:///path/to/project/doc.md or file://doc.md)
  if (trimmedHref.startsWith('file://')) {
    const cleanPath = trimmedHref.replace(/^file:\/\//, '');
    // If it points to a markdown file, extract the relative part
    const mdIndex = cleanPath.lastIndexOf('.md');
    if (mdIndex !== -1) {
      const parts = cleanPath.split('/');
      const fileName = parts.pop() || '';
      return resolveDocumentTarget(fileName, currentFilePath, knownFiles);
    }
  }

  // 6. External or Local HTTP/HTTPS URLs
  if (trimmedHref.startsWith('http://') || trimmedHref.startsWith('https://')) {
    try {
      const parsedUrl = new URL(trimmedHref);
      const isLocal = typeof window !== 'undefined' && parsedUrl.origin === window.location.origin;

      if (!isLocal) {
        // Genuine external web link
        return { type: 'external', url: trimmedHref };
      }

      // Local origin: The browser or DOM converted a relative link to absolute local URL
      // e.g. "http://localhost:5173/user-story-1.md" or "http://localhost:5173/initiatives/init-1.md#section"
      const pathname = decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, ''));
      const hash = parsedUrl.hash ? decodeURIComponent(parsedUrl.hash.replace(/^#/, '')) : undefined;

      if (!pathname) {
        if (hash) return { type: 'anchor', hash };
        return { type: 'ignore' };
      }

      return resolveDocumentTarget(pathname, currentFilePath, knownFiles, hash);
    } catch {
      return { type: 'external', url: trimmedHref };
    }
  }

  // 7. Relative or project root markdown file paths
  return resolveDocumentTarget(trimmedHref, currentFilePath, knownFiles);
}

/**
 * Resolves a clean document path string into an intra-project target document.
 *
 * @param {string} targetHref
 * @param {string} currentFilePath
 * @param {string[]} knownFiles
 * @param {string} [presetHash]
 */
function resolveDocumentTarget(targetHref, currentFilePath = '', knownFiles = [], presetHash) {
  const [pathWithQuery, hashPart] = targetHref.split('#');
  const [cleanPath] = pathWithQuery.split('?');
  const decodedPath = decodeURIComponent(cleanPath.trim());
  const hash = presetHash || (hashPart ? decodeURIComponent(hashPart.trim()) : undefined);

  if (!decodedPath) {
    if (hash) return { type: 'anchor', hash };
    return { type: 'ignore' };
  }

  // Determine current directory from currentFilePath
  let baseDir = '';
  if (currentFilePath && currentFilePath.includes('/')) {
    const parts = currentFilePath.split('/');
    parts.pop(); // Remove filename
    baseDir = parts.join('/');
  }

  let resolvedPath = '';

  if (decodedPath.startsWith('/')) {
    // Leading slash -> relative to project root
    resolvedPath = decodedPath.replace(/^\/+/, '');
  } else {
    // Relative to current file's directory
    resolvedPath = normalizeRelativePath(baseDir, decodedPath);
  }

  // Auto-append .md extension if missing and target has no extension
  if (!resolvedPath.includes('.')) {
    resolvedPath = `${resolvedPath}.md`;
  }

  // Check fuzzy matching against known project files
  if (knownFiles && knownFiles.length > 0) {
    // Exact match
    if (knownFiles.includes(resolvedPath)) {
      return { type: 'document', fileName: resolvedPath, hash };
    }

    // Try without baseDir (match root)
    const rootPath = decodedPath.startsWith('/') ? decodedPath.replace(/^\/+/, '') : decodedPath;
    const rootPathMd = rootPath.endsWith('.md') ? rootPath : `${rootPath}.md`;
    if (knownFiles.includes(rootPathMd)) {
      return { type: 'document', fileName: rootPathMd, hash };
    }

    // Basename fuzzy match (e.g. "user-story-1.md" -> "user-stories/user-story-1.md")
    const targetBasename = resolvedPath.split('/').pop()?.toLowerCase();
    if (targetBasename) {
      const match = knownFiles.find(kf => {
        const kfBasename = kf.split('/').pop()?.toLowerCase();
        return kfBasename === targetBasename;
      });
      if (match) {
        return { type: 'document', fileName: match, hash };
      }
    }
  }

  return {
    type: 'document',
    fileName: resolvedPath,
    hash
  };
}

/**
 * Smoothly scrolls to an anchor heading or element in the active document.
 * @param {string} hash
 */
export function scrollToAnchor(hash) {
  if (typeof document === 'undefined' || !hash) return;
  const cleanId = hash.replace(/^#/, '').toLowerCase().trim();
  if (!cleanId) return;

  // 1. Try exact ID match
  let element = document.getElementById(cleanId);

  // 2. Try match on data-heading-id or name attribute
  if (!element) {
    element = document.querySelector(`[data-heading-id="${cleanId}"], a[name="${cleanId}"]`);
  }

  // 3. Match heading text slug
  if (!element) {
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    for (const h of headings) {
      const text = h.textContent?.trim().toLowerCase() || '';
      const slug = text.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
      if (slug === cleanId || text === cleanId) {
        element = h;
        break;
      }
    }
  }

  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    element.classList.add('bg-primary/20', 'transition-colors', 'duration-500');
    setTimeout(() => {
      element?.classList.remove('bg-primary/20');
    }, 1500);
  }
}
