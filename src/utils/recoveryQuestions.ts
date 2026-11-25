export const RECOVERY_QUESTIONS = [
  'What city were you born in?',
  'What was the name of your first school?',
  'What is the first name of your oldest sibling?',
  'What was the name of your childhood best friend?',
] as const;

export type RecoveryQuestion = (typeof RECOVERY_QUESTIONS)[number];
