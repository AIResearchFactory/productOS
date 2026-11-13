export type ResolvedLinkType = 'anchor' | 'document' | 'peek' | 'external' | 'ignore';

export interface ResolvedLink {
  type: ResolvedLinkType;
  fileName?: string;
  hash?: string;
  url?: string;
}

export function normalizeRelativePath(baseDir: string, relativePath: string): string;

export function resolveProjectLink(
  href: string,
  currentFilePath?: string,
  knownFiles?: string[]
): ResolvedLink;

export function scrollToAnchor(hash: string): void;
