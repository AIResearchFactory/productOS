export const BUILTIN_PROVIDER_LABELS: Record<string, string>;

export function resolveProviderDisplayName(
  providerId: string | null | undefined,
  settings?: {
    customClis?: Array<{ id?: string; name?: string }>;
    custom_clis?: Array<{ id?: string; name?: string }>;
  },
  record?: { provider_name?: string; providerName?: string } | null
): string;
