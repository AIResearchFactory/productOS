/**
 * prompts.mjs
 * Socratic question templates and clarification prompt builders.
 */

export const SOCRATIC_ARTIFACT_TYPES = ['prd', 'roadmap', 'user_story', 'presentation'];

export const DEFAULT_SOCRATIC_QUESTIONS = {
  prd: [
    {
      id: 'q_rate_limits',
      question: 'What scale and rate limits should we design for at launch?',
      quickOptions: ['100 req/min (Standard)', '1,000 req/min (High scale)', 'Internal only (< 10 req/min)', 'Decide for me'],
      category: 'edge_case',
      defaultAssumption: 'Standard cloud API rate limit of 100 requests/minute per tenant with exponential backoff on HTTP 429.',
    },
    {
      id: 'q_primary_kpi',
      question: 'What is the primary success metric / North Star for this feature?',
      quickOptions: ['30% feature adoption in 30d', '50% reduction in workflow time', 'Zero unhandled errors (99.9% SLA)', 'Decide for me'],
      category: 'telemetry',
      defaultAssumption: '30% monthly active adoption among eligible users within 30 days of general availability.',
    },
    {
      id: 'q_failure_mode',
      question: 'How should the system behave if downstream services or webhooks fail?',
      quickOptions: ['Async retry 3x + Dead Letter Queue', 'Fail fast with immediate user toast', 'Silent degradation with local cache', 'Decide for me'],
      category: 'edge_case',
      defaultAssumption: 'Retry failed dispatches up to 3 times with exponential backoff; route permanently failed payloads to dead-letter queue.',
    },
    {
      id: 'q_scope_boundaries',
      question: 'What is explicitly OUT of scope for this initial version (V1)?',
      quickOptions: ['Multi-tenant org billing', 'Mobile native support', 'Custom webhooks / third-party plugins', 'Decide for me'],
      category: 'scope',
      defaultAssumption: 'Custom third-party integrations and native mobile push notifications are deferred to V2.',
    },
  ],
  roadmap: [
    {
      id: 'q_time_horizon',
      question: 'What time horizon and release cadence should this roadmap reflect?',
      quickOptions: ['Quarterly (Q1-Q4)', '6-Month Phase 1 / Phase 2', 'Monthly agile sprints', 'Decide for me'],
      category: 'scope',
      defaultAssumption: 'Quarterly roadmap structure across 4 sequential quarters with milestone gates.',
    },
    {
      id: 'q_target_audience',
      question: 'Who is the primary audience for this roadmap deck/document?',
      quickOptions: ['Executive / Board alignment', 'Engineering team sprint planning', 'External customer-facing summary', 'Decide for me'],
      category: 'scope',
      defaultAssumption: 'Cross-functional leadership (Product, Engineering, Design) prioritizing strategic outcomes.',
    },
    {
      id: 'q_dependency_model',
      question: 'Are there hard external platform or compliance milestones to lock in?',
      quickOptions: ['SOC2 / GDPR compliance in Q2', 'Payment gateway migration in Q3', 'No hard external blockers', 'Decide for me'],
      category: 'dependency',
      defaultAssumption: 'Standard security reviews required prior to each major milestone without third-party vendor blockers.',
    },
  ],
  user_story: [
    {
      id: 'q_actor_persona',
      question: 'Which specific user persona is the primary actor in this story slice?',
      quickOptions: ['Admin / Team Lead', 'Non-technical Contributor', 'API Developer', 'Decide for me'],
      category: 'scope',
      defaultAssumption: 'Authenticated Workspace Administrator managing team settings.',
    },
    {
      id: 'q_acceptance_strictness',
      question: 'What acceptance format fits your team best?',
      quickOptions: ['Given / When / Then (Gherkin)', 'Checklist of functional invariants', 'User test script steps', 'Decide for me'],
      category: 'telemetry',
      defaultAssumption: 'Given/When/Then scenario blocks with positive flow, negative boundary, and telemetry trigger.',
    },
    {
      id: 'q_error_experience',
      question: 'What feedback should the user see upon invalid input or server timeout?',
      quickOptions: ['Inline red field validation', 'Sticky error banner with retry action', 'Modal error dialog', 'Decide for me'],
      category: 'edge_case',
      defaultAssumption: 'Inline form field validation errors with contextual hint copy and accessible ARIA alerts.',
    },
  ],
  presentation: [
    {
      id: 'q_slide_count',
      question: 'What is the target deck length and presentation format?',
      quickOptions: ['5-Slide Executive Pitch', '10-Slide Product Deep Dive', '3-Slide Standup Update', 'Decide for me'],
      category: 'scope',
      defaultAssumption: '5 to 7 high-impact slides optimized for 16:9 widescreen layout.',
    },
    {
      id: 'q_visual_style',
      question: 'What visual mood and color tone should the slides follow?',
      quickOptions: ['Modern Dark Slate', 'Clean Minimalist White', 'Vibrant Gradient Brand', 'Decide for me'],
      category: 'scope',
      defaultAssumption: 'Modern Dark Slate theme with high-contrast accent highlights.',
    },
  ],
};

/**
 * Synthesizes the ## Assumptions & Defaults markdown block for generated documents.
 * @param {Array<{ questionId: string, question: string, answer: string, isDefault?: boolean }>} answeredTurns
 * @param {string} [artifactType]
 * @returns {string}
 */
export function formatAssumptionsSection(answeredTurns = [], artifactType = 'prd') {
  if (!answeredTurns || answeredTurns.length === 0) {
    return '';
  }

  let markdown = '\n\n## Assumptions & Technical Defaults\n\n';
  markdown += '> *This specification was calibrated through Socratic PM clarification. Explicit user decisions and industry-standard defaults are codified below:*\n\n';

  for (const item of answeredTurns) {
    const isDecideForMe = !item.answer || item.answer.toLowerCase().includes('decide for me') || item.isDefault;
    if (isDecideForMe) {
      markdown += `- **${item.question}**: Applied recommended default — *${item.defaultAssumption || item.answer || 'Standard PM best practice'}* (Defaulted).\n`;
    } else {
      markdown += `- **${item.question}**: **${item.answer}** (User Confirmed).\n`;
    }
  }

  return markdown;
}
