export interface QualityIssue {
  key: string;
  message: string;
  reason?: string;
  suggestion?: string;
}

export function detectArtifactKind(fileNameOrPath: string): 'prd' | 'roadmap' | 'one_pager' | 'datasheet' | 'positioning' | 'presentation' | null;
export function validateArtifactQuality(content: string, kind: 'prd' | 'roadmap' | 'one_pager' | 'datasheet' | 'positioning' | 'presentation' | null): QualityIssue[];
