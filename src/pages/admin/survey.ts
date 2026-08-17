// Shared labels/metadata for the onboarding survey, used across the CRM.

export const GOAL_LABELS: Record<string, string> = {
  basics: 'Aprender lo básico',
  strategies: 'Practicar estrategias',
  crypto: 'Explorar el mundo cripto',
  'ready-to-invest': 'Prepararse para invertir de verdad',
  other: 'Otro',
};

export const GOAL_ORDER = ['basics', 'strategies', 'crypto', 'ready-to-invest', 'other'] as const;

export const GOAL_COLORS: Record<string, string> = {
  basics: '#3B82F6',
  strategies: '#16C784',
  crypto: '#A78BFA',
  'ready-to-invest': '#E8B339',
  other: '#5B6472',
};

export const EXPERIENCE_LEVELS: { key: 'beginner' | 'intermediate' | 'advanced'; label: string; color: string }[] = [
  { key: 'beginner', label: 'Principiante (1–3)', color: '#3B82F6' },
  { key: 'intermediate', label: 'Intermedio (4–7)', color: '#16C784' },
  { key: 'advanced', label: 'Avanzado (8–10)', color: '#A78BFA' },
];
