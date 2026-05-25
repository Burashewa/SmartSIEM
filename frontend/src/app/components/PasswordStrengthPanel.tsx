import { evaluatePassword } from '../passwordPolicy';

interface PasswordStrengthPanelProps {
  password: string;
  showRequirements?: boolean;
}

export function PasswordStrengthPanel({
  password,
  showRequirements = true,
}: PasswordStrengthPanelProps) {
  const result = evaluatePassword(password);
  const { checks, strength, strengthLabel } = result;
  const barPercent = password.length === 0 ? 0 : Math.max(8, (strength / 4) * 100);

  const categoryRules = [
    { key: 'lowercase', label: 'Lowercase letters (a-z)', met: checks.lowercase },
    { key: 'uppercase', label: 'Uppercase letters (A-Z)', met: checks.uppercase },
    { key: 'numbers', label: 'Numbers (0-9)', met: checks.numbers },
    { key: 'special', label: 'Special characters (e.g. !@#$%^&*)', met: checks.special },
  ] as const;

  return (
    <div className="auth-pw-strength" aria-live="polite">
      <div className="auth-pw-strength__header">
        <span className="auth-pw-strength__label">Password strength</span>
        <span
          className={`auth-pw-strength__badge auth-pw-strength__badge--s${strength}`}
          data-strength={strengthLabel}
        >
          {password.length === 0 ? '—' : strengthLabel}
        </span>
      </div>
      <div
        className="auth-pw-strength__track"
        role="progressbar"
        aria-valuenow={strength}
        aria-valuemin={0}
        aria-valuemax={4}
        aria-label={`Password strength: ${password.length === 0 ? 'not entered' : strengthLabel}`}
      >
        <div
          className={`auth-pw-strength__bar auth-pw-strength__bar--s${strength}`}
          style={{ width: `${barPercent}%` }}
        />
      </div>

      {showRequirements ? (
        <div className="auth-pw-requirements">
          <p className="auth-pw-requirements__title">Password requirements</p>
          <p className="auth-pw-requirements__lead">Your password must contain:</p>
          <ul className="auth-pw-requirements__list">
            <li className={checks.minLength ? 'auth-pw-req--met' : 'auth-pw-req--unmet'}>
              At least 8 characters
            </li>
            <li className={checks.categoriesOk ? 'auth-pw-req--met' : 'auth-pw-req--unmet'}>
              At least 3 of the following:
              <ul className="auth-pw-requirements__sublist">
                {categoryRules.map((rule) => (
                  <li
                    key={rule.key}
                    className={rule.met ? 'auth-pw-req--met' : 'auth-pw-req--unmet'}
                  >
                    {rule.label}
                  </li>
                ))}
              </ul>
            </li>
            <li className={checks.noTripleRepeat ? 'auth-pw-req--met' : 'auth-pw-req--unmet'}>
              No more than 2 identical characters in a row
            </li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}
