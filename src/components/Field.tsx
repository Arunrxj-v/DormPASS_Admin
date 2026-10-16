import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';

interface FieldShellProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  htmlFor: string;
  children: ReactNode;
}

function FieldShell({ label, required, error, hint, htmlFor, children }: FieldShellProps) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>
        {label}
        {required ? <span className="field-required"> *</span> : null}
      </label>
      {children}
      {error ? (
        <span className="field-error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="field-hint">{hint}</span>
      ) : null}
    </div>
  );
}

/** Label-above text input (design system form field: white, hairline, 8px). */
export function TextField({
  label,
  required,
  error,
  hint,
  ...inputProps
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <FieldShell
      label={label}
      required={required}
      error={error}
      hint={hint}
      htmlFor={id}
    >
      <input
        id={id}
        className="input"
        aria-invalid={error ? true : undefined}
        {...inputProps}
      />
    </FieldShell>
  );
}

/** Label-above select. */
export function SelectField({
  label,
  required,
  error,
  hint,
  children,
  ...selectProps
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
} & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <FieldShell
      label={label}
      required={required}
      error={error}
      hint={hint}
      htmlFor={id}
    >
      <select id={id} className="select" aria-invalid={error ? true : undefined} {...selectProps}>
        {children}
      </select>
    </FieldShell>
  );
}
