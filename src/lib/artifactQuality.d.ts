export interface QualityIssue {
  key: string;
  message: string;
}

export function detectArtifactKind(fileNameOrPath: string): 'prd' | 'roadmap' | 'one_pager' | null;
export function validateArtifactQuality(content: string, kind: 'prd' | 'roadmap' | 'one_pager' | null): QualityIssue[];
