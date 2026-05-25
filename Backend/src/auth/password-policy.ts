export const MIN_PASSWORD_LENGTH = 8;
export const MIN_PASSWORD_CATEGORIES = 3;

export type PasswordStrengthLevel = 0 | 1 | 2 | 3 | 4;

export interface PasswordRuleChecks {
  minLength: boolean;
  lowercase: boolean;
  uppercase: boolean;
  numbers: boolean;
  special: boolean;
  categoriesMet: number;
  categoriesOk: boolean;
  noTripleRepeat: boolean;
}

export interface PasswordValidationResult {
  valid: boolean;
  checks: PasswordRuleChecks;
  errors: string[];
  strength: PasswordStrengthLevel;
  strengthLabel: 'Weak' | 'Fair' | 'Good' | 'Strong';
}

const LOWERCASE = /[a-z]/;
const UPPERCASE = /[A-Z]/;
const NUMBERS = /[0-9]/;
const SPECIAL = /[^a-zA-Z0-9]/;

export function hasTripleRepeat(password: string): boolean {
  for (let i = 0; i < password.length - 2; i += 1) {
    if (password[i] === password[i + 1] && password[i + 1] === password[i + 2]) {
      return true;
    }
  }
  return false;
}

export function evaluatePassword(password: string): PasswordValidationResult {
  const checks: PasswordRuleChecks = {
    minLength: password.length >= MIN_PASSWORD_LENGTH,
    lowercase: LOWERCASE.test(password),
    uppercase: UPPERCASE.test(password),
    numbers: NUMBERS.test(password),
    special: SPECIAL.test(password),
    categoriesMet: 0,
    categoriesOk: false,
    noTripleRepeat: password.length === 0 || !hasTripleRepeat(password),
  };

  checks.categoriesMet = [
    checks.lowercase,
    checks.uppercase,
    checks.numbers,
    checks.special,
  ].filter(Boolean).length;
  checks.categoriesOk = checks.categoriesMet >= MIN_PASSWORD_CATEGORIES;

  const errors: string[] = [];
  if (!checks.minLength) {
    errors.push(`At least ${MIN_PASSWORD_LENGTH} characters`);
  }
  if (!checks.categoriesOk) {
    errors.push(
      'At least 3 of: lowercase (a-z), uppercase (A-Z), numbers (0-9), special characters',
    );
  }
  if (!checks.noTripleRepeat) {
    errors.push('No more than 2 identical characters in a row');
  }

  const valid = checks.minLength && checks.categoriesOk && checks.noTripleRepeat;

  let strength: PasswordStrengthLevel = 0;
  if (checks.minLength) strength = 1;
  if (checks.minLength && checks.categoriesMet >= 2) strength = 2;
  if (checks.minLength && checks.categoriesOk && checks.noTripleRepeat) strength = 3;
  if (valid && (password.length >= 12 || checks.categoriesMet === 4)) strength = 4;

  const strengthLabel =
    strength >= 4 ? 'Strong' : strength === 3 ? 'Good' : strength === 2 ? 'Fair' : 'Weak';

  return { valid, checks, errors, strength, strengthLabel };
}

export function assertPasswordPolicy(password: string): void {
  const result = evaluatePassword(password);
  if (!result.valid) {
    throw new Error(result.errors.join('. '));
  }
}

/** Message suitable for BadRequestException in Nest controllers/services. */
export function passwordPolicyErrorMessage(password: string): string {
  const result = evaluatePassword(password);
  if (result.valid) return '';
  return `Password does not meet requirements: ${result.errors.join('; ')}`;
}
