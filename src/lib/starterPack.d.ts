export interface PersonalProfileInput {
  companyName: string;
  productName: string;
  primaryPersona: string;
  topCompetitors: string;
}

export const PERSONAL_STARTER_WORKFLOWS: Array<{ name: string; description: string }>;

export function buildPersonalContextDoc(input: PersonalProfileInput): string;
export function seedPersonalContext(projectId: string, input: PersonalProfileInput): Promise<void>;
export function installPersonalStarterPack(projectId: string): Promise<void>;
