import { useMemo } from 'react';
import DOMPurify from 'dompurify';

interface SafeHtmlViewerProps {
  content: string;
  title?: string;
  allowScripts?: boolean;
  className?: string;
}

const FAIL_CLOSED_HTML =
  '<!DOCTYPE html><html><head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'"></head><body style="font-family: system-ui, sans-serif; color: #ef4444; padding: 24px;">Unable to safely render HTML preview.</body></html>';

function isForbiddenUri(rawValue: string): boolean {
  const normalized = rawValue.replace(/[\u0000-\u0020]+/g, '').toLowerCase();
  return (
    normalized.startsWith('javascript:') ||
    normalized.startsWith('vbscript:') ||
    normalized.startsWith('data:text/html')
  );
}

function scrubDomTree(
  root: Document | DocumentFragment | Element,
  allowScripts: boolean,
  forbiddenSelectors: string[]
): void {
  root.querySelectorAll(forbiddenSelectors.join(',')).forEach((el) => el.remove());

  const elements = root.querySelectorAll('*');
  elements.forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const val = attr.value.trim().toLowerCase();
      if (!allowScripts && (name.startsWith('on') || name === 'srcdoc')) {
        el.removeAttribute(attr.name);
        continue;
      }
      if (
        (name === 'href' ||
          name === 'src' ||
          name === 'xlink:href' ||
          name === 'action' ||
          name === 'formaction' ||
          name === 'poster' ||
          name === 'data') &&
        (val.startsWith('javascript:') || isForbiddenUri(attr.value))
      ) {
        el.removeAttribute(attr.name);
      }
    }

    if (typeof HTMLTemplateElement !== 'undefined' && el instanceof HTMLTemplateElement && el.content) {
      scrubDomTree(el.content, allowScripts, forbiddenSelectors);
    }
  });
}

/**
 * Strips executable elements (<script>, <object>, <embed>, <applet>, <base>, <meta http-equiv="refresh">)
 * and inline event handlers (on*) using DOMPurify and DOMParser, plus strict CSP inside an opaque iframe.
 */
export function sanitizeHtmlDocument(rawHtml: string, allowScripts = false): string {
  if (!rawHtml || !rawHtml.trim()) {
    return '<!DOCTYPE html><html><body style="font-family: system-ui, sans-serif; color: #64748b; padding: 24px;">Empty HTML file</body></html>';
  }

  // Always inject a strict Content-Security-Policy meta tag inside the iframe document
  // - default-src 'none' blocks arbitrary outbound network exfiltration
  // - connect-src 'none' prevents fetch/XHR to localhost:51423 or external attacker endpoints
  // - form-action 'none' blocks form hijacking
  // - base-uri 'none' prevents <base> tag hijacking
  const cspContent = [
    "default-src 'none'",
    "style-src 'unsafe-inline'",
    "img-src data: blob:",
    "font-src data:",
    "media-src data: blob:",
    allowScripts ? "script-src 'unsafe-inline'" : "script-src 'none'",
    "connect-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');

  try {
    let workingHtml = rawHtml;
    if (!allowScripts && typeof window !== 'undefined' && typeof DOMPurify?.sanitize === 'function') {
      workingHtml = DOMPurify.sanitize(rawHtml, {
        WHOLE_DOCUMENT: true,
        ADD_TAGS: ['style', 'link', 'meta', 'title', 'head', 'body', 'html'],
        ADD_ATTR: ['charset', 'name', 'content', 'http-equiv', 'property', 'media', 'rel', 'target'],
        FORBID_TAGS: ['script', 'object', 'embed', 'applet', 'base', 'iframe', 'frame', 'frameset'],
        FORBID_ATTR: ['srcdoc'],
      });
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(workingHtml, 'text/html');

    // Remove dangerous tags
    const forbiddenSelectors = allowScripts
      ? ['object', 'embed', 'applet', 'base', 'meta[http-equiv="refresh" i]', 'meta[http-equiv="Content-Security-Policy" i]']
      : ['script', 'object', 'embed', 'applet', 'base', 'iframe', 'frame', 'frameset', 'meta[http-equiv="refresh" i]', 'meta[http-equiv="Content-Security-Policy" i]'];

    scrubDomTree(doc, allowScripts, forbiddenSelectors);

    // Ensure <head> exists and prepend strict CSP meta tag
    let head = doc.head;
    if (!head) {
      head = doc.createElement('head');
      doc.documentElement.insertBefore(head, doc.body || null);
    }

    const cspMeta = doc.createElement('meta');
    cspMeta.setAttribute('http-equiv', 'Content-Security-Policy');
    cspMeta.setAttribute('content', cspContent);
    head.insertBefore(cspMeta, head.firstChild);

    // Ensure links open safely or don't navigate the parent frame
    doc.querySelectorAll('a[href]').forEach((a) => {
      const href = a.getAttribute('href') || '';
      if (isForbiddenUri(href)) {
        a.removeAttribute('href');
        return;
      }
      if (!href.startsWith('#')) {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      }
    });

    return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
  } catch {
    // Fail closed if DOMParser / sanitization throws
    return FAIL_CLOSED_HTML;
  }
}

export default function SafeHtmlViewer({
  content,
  title = 'HTML Preview',
  allowScripts = false,
  className = '',
}: SafeHtmlViewerProps) {
  const safeSrcDoc = useMemo(
    () => sanitizeHtmlDocument(content, allowScripts),
    [content, allowScripts]
  );

  // CRITICAL SECURITY:
  // Never combine `allow-scripts` with same-origin sandbox permissions!
  // With `sandbox="allow-popups"` (or `sandbox="allow-scripts allow-popups"` when explicitly toggled),
  // the iframe runs in an opaque `null` origin and has zero access to window.parent, localStorage,
  // cookies, or the ProductOS backend.
  const sandboxAttr = allowScripts ? 'allow-scripts allow-popups' : 'allow-popups';

  return (
    <div className={`w-full h-full flex flex-col bg-white dark:bg-zinc-950 overflow-hidden ${className}`}>
      <iframe
        data-testid="safe-html-iframe"
        title={title}
        srcDoc={safeSrcDoc}
        sandbox={sandboxAttr}
        referrerPolicy="no-referrer"
        className="w-full h-full flex-1 border-0 bg-white"
      />
    </div>
  );
}
