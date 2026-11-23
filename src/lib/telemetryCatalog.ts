export const TELEMETRY_EVENTS: Record<string, readonly string[]> = Object.freeze({
  'app.launched': [],
  'app.exited': ['source'],
  'installation.status_checked': ['isFirstInstall'],
  'installation.started': ['source'],
  'installation.completed': ['success', 'durationMs'],
  'onboarding.step': ['step'],
  'onboarding.completed': ['provider', 'starterPack'],
  'settings.telemetry_changed': ['enabled'],
  'settings.saved': ['section'],
  'usage.viewed': ['scope'],
  'provider.detected': ['provider', 'success', 'durationMs'],
  'provider.selected': ['provider', 'source'],
  'agent.run.started': ['provider', 'source'],
  'agent.run.completed': ['provider', 'success', 'durationMs', 'tokensIn', 'tokensOut'],
  'agent.run.failed': ['provider', 'durationMs', 'errorCode'],
  'project.created': ['source'],
  'project.deleted': ['source'],
  'artifact.created': ['artifactType', 'source'],
  'artifact.saved': ['artifactType'],
  'artifact.imported': ['artifactType'],
  'artifact.exported': ['artifactType', 'exportFormat'],
  'file.imported': ['fileType'],
  'file.exported': ['exportFormat'],
  'secrets.exported': [],
  'skill.created': ['source'],
  'skill.updated': ['source'],
  'skill.imported': ['source'],
  'custom_cli.added': ['provider'],
  'integrations.enabled': ['channel'],
  'workflow.created': ['stepCount'],
  'workflow.started': ['stepCount', 'trigger'],
  'workflow.completed': ['status', 'durationMs', 'stepCount'],
  'error.unhandled': ['where', 'errorCode'],
  'view.changed': ['view'],
  'file.opened': [],
  'file.closed': [],
  'file.edited': [],
  'chat.message_sent': [],
  'chat.image_attached': ['count', 'source'],
  'chat.voice_dictated': ['mode', 'locale'],
  'chat.opened': [],
  'chat.closed': [],
  'ui.button_clicked': ['buttonId', 'location'],
  'socratic.grilling_started': ['artifactType', 'trigger'],
  'socratic.turn_completed': ['artifactType', 'step', 'totalSteps', 'answeredMode'],
  'socratic.grilling_bypassed': ['artifactType', 'reason'],
  'socratic.grilling_completed': ['artifactType', 'questionsAnswered', 'durationMs'],
  'critic.audit_triggered': ['artifactType', 'source', 'criticsCount'],
  'critic.audit_completed': ['artifactType', 'overallScore', 'findingsCount', 'criticalCount', 'durationMs'],
  'critic.fix_applied': ['critic', 'severity'],
  'critic.finding_dismissed': ['critic', 'severity'],
});

export const ALLOWED_EVENT_NAMES = new Set(Object.keys(TELEMETRY_EVENTS));

export function toGa4EventName(eventName: string): string {
  let normalized = String(eventName || '')
    .trim()
    .replace(/[^a-zA-Z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!normalized) return 'app_event';
  if (!/^[a-zA-Z]/.test(normalized)) {
    normalized = `e_${normalized}`;
  }
  return normalized.slice(0, 40);
}

export function sanitizeTelemetryEvent(
  eventName: string,
  rawProps?: Record<string, unknown> | null
): { allowed: boolean; props: Record<string, string | number | boolean> } {
  if (typeof eventName !== 'string' || !ALLOWED_EVENT_NAMES.has(eventName)) {
    return { allowed: false, props: {} };
  }

  const allowedKeys = new Set(TELEMETRY_EVENTS[eventName] || []);
  const props: Record<string, string | number | boolean> = {};

  if (!rawProps || typeof rawProps !== 'object' || Array.isArray(rawProps)) {
    return { allowed: true, props };
  }

  for (const [key, value] of Object.entries(rawProps)) {
    if (!allowedKeys.has(key)) continue;
    if (typeof value === 'boolean') {
      props[key] = value;
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      props[key] = value;
    } else if (typeof value === 'string') {
      props[key] = value.slice(0, 120);
    }
  }

  return { allowed: true, props };
}
