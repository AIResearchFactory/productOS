export type CriticType = 'devils_pm' | 'telemetry_guardian' | 'tone_inspector';

export type CriticSeverity = 'critical' | 'suggestion' | 'compliant';

export interface CriticFinding {
  id: string;
  critic: CriticType;
  severity: CriticSeverity;
  title: string;
  description: string;
  quote?: string;
  suggestedFix: string;
  targetSection?: string;
}

export interface CriticAuditResult {
  summary: string;
  overallScore: number;
  findings: CriticFinding[];
  durationMs?: number;
}

export interface SocraticQuestion {
  id: string;
  question: string;
  quickOptions: string[];
  category?: 'edge_case' | 'telemetry' | 'scope' | 'dependency';
  defaultAssumption?: string;
}

export interface SocraticTurn {
  questionId: string;
  question: string;
  answer: string;
  mode: 'chip' | 'custom_text' | 'default';
  isDefault?: boolean;
}

export interface SocraticProposal {
  isHighStakesArtifact: boolean;
  artifactType: 'prd' | 'roadmap' | 'user_story' | 'presentation' | null;
  topic: string;
  triggerMode: 'slash_command' | 'intent_detected' | null;
  questions?: SocraticQuestion[];
}
