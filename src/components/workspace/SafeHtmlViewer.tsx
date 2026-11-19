import { useMemo } from 'react';

interface SafeHtmlViewerProps {
  content: string;
  title?: string;
  allowScripts?: boolean;
  className?: string;
}

/**
 * Strips executable elements (<script>, <object>, <embed>, <applet>, <base>, <meta http-equiv="refresh">)
 * and inline event handlers (on*) using DOMParser as defense-in-depth when scripts are disabled.
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
    "style-src 'unsafe-inline' https:",
    "img-src data: blob: https: http:",
    "font-src data: https:",
    "media-src data: blob: https:",
    allowScripts ? "script-src 'unsafe-inline' https:" : "script-src 'none'",
    "connect-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, 'text/html');

    // Remove dangerous tags
    const forbiddenSelectors = allowScripts
      ? ['object', 'embed', 'applet', 'base', 'meta[http-equiv="refresh" i]', 'meta[http-equiv="Content-Security-Policy" i]']
      : ['script', 'object', 'embed', 'applet', 'base', 'iframe', 'frame', 'frameset', 'meta[http-equiv="refresh" i]', 'meta[http-equiv="Content-Security-Policy" i]'];

    doc.querySelectorAll(forbiddenSelectors.join(',')).forEach((el) => el.remove());

    if (!allowScripts) {
      // Strip inline event handler attributes (onclick, onerror, onload, etc.) and javascript: URLs
      const allElements = doc.querySelectorAll('*');
      allElements.forEach((el) => {
        for (const attr of Array.from(el.attributes)) {
          const name = attr.name.toLowerCase();
          const val = attr.value.trim().toLowerCase();
          if (name.startsWith('on')) {
            el.removeAttribute(attr.name);
          } else if (
            (name === 'href' || name === 'src' || name === 'xlink:href' || name === 'action' || name === 'formaction') &&
            (val.startsWith('javascript:') || val.startsWith('vbscript:') || val.startsWith('data:text/html'))
          ) {
            el.removeAttribute(attr.name);
          }
        }
      });
    }

    // Ensure <head> exists and prepend strict CSP meta tag + default typography fallback
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
      if (!href.startsWith('#')) {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      }
    });

    return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
  } catch {
    // Fallback if DOMParser is unavailable
    return rawHtml;
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
  // Never combine `allow-scripts` with same-origin permissions!
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
