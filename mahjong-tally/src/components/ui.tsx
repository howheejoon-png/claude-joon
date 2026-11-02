import { useId, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Minus, Plus } from 'lucide-react';
import type { Cents } from '../models/types';
import { centsToInput, parseMoney } from '../utils/money';

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold';
type ButtonSize = 'lg' | 'md' | 'sm';

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'bg-emerald text-emerald-ink hover:bg-emerald-strong active:bg-emerald-strong disabled:opacity-40 elev-1',
  secondary:
    'bg-surface-2 text-ink border border-line hover:border-line-strong hover:bg-surface-3 active:bg-surface-3 disabled:opacity-40',
  ghost: 'bg-transparent text-ink-2 hover:text-ink hover:bg-surface-2 active:bg-surface-3 disabled:opacity-40',
  danger:
    'bg-negative-soft text-negative border border-transparent hover:border-negative/40 active:bg-negative/20 disabled:opacity-40',
  gold: 'bg-gold-soft text-gold border border-gold/25 hover:border-gold/50 active:bg-gold/20 disabled:opacity-40',
};

const SIZE: Record<ButtonSize, string> = {
  lg: 'min-h-14 px-6 text-[17px] font-semibold rounded-2xl gap-2.5',
  md: 'min-h-12 px-5 text-[15px] font-semibold rounded-xl gap-2',
  sm: 'min-h-9 px-3.5 text-[13px] font-semibold rounded-lg gap-1.5',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  icon?: ReactNode;
}

export function Button({ variant = 'secondary', size = 'md', block, icon, className, children, type, ...rest }: ButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      className={cx(
        'pressable inline-flex select-none items-center justify-center whitespace-nowrap',
        VARIANT[variant],
        SIZE[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'pressable inline-flex h-11 w-11 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2 hover:text-ink active:bg-surface-3 disabled:opacity-40',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Card({
  children,
  className,
  as: Tag = 'section',
  ...rest
}: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article' | 'li' } & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={cx('rounded-3xl border border-line bg-surface elev-1', className)} {...rest}>
      {children}
    </Tag>
  );
}

export function SectionTitle({ children, action, id }: { children: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div className="mb-2.5 mt-7 flex items-center justify-between px-1 first:mt-0">
      <h2 id={id} className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-3">
        {children}
      </h2>
      {action}
    </div>
  );
}

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'emerald' | 'gold' | 'negative'; className?: string }) {
  const tones = {
    neutral: 'bg-surface-3 text-ink-2',
    emerald: 'bg-emerald-soft text-positive',
    gold: 'bg-gold-soft text-gold',
    negative: 'bg-negative-soft text-negative',
  } as const;
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide', tones[tone], className)}>
      {children}
    </span>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | undefined;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="px-1 text-[13px] font-medium text-ink-2">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="px-1 text-[12px] font-medium text-negative">
          {error}
        </p>
      ) : hint ? (
        <p className="px-1 text-[12px] text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

export const inputClass =
  'w-full min-h-12 rounded-xl border border-line bg-surface-2 px-4 text-[16px] text-ink placeholder:text-ink-3 outline-none transition-[border-color] focus:border-emerald focus-visible:outline-none aria-[invalid=true]:border-negative';

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputClass, props.className)} />;
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div className="min-w-0">
        <div id={`${id}-l`} className="text-[15px] font-medium text-ink">
          {label}
        </div>
        {description ? <div className="text-[13px] leading-snug text-ink-3">{description}</div> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-l`}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          'pressable relative h-8 w-[52px] shrink-0 rounded-full border transition-colors disabled:opacity-40',
          checked ? 'border-emerald bg-emerald' : 'border-line-strong bg-surface-3',
        )}
      >
        <span
          className={cx(
            'absolute left-0 top-[3px] h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ease-[var(--ease-spring)]',
            checked ? 'translate-x-[23px]' : 'translate-x-[3px]',
          )}
        />
      </button>
    </div>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  description?: ReactNode;
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  size = 'md',
}: {
  value: T;
  options: SegmentOption<T>[];
  onChange: (v: T) => void;
  label: string;
  size?: 'md' | 'sm';
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-2xl border border-line bg-surface-2 p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cx(
              'pressable flex-1 rounded-xl px-2 font-semibold',
              size === 'md' ? 'min-h-11 text-[14px]' : 'min-h-9 text-[13px]',
              active ? 'bg-surface text-ink elev-1' : 'text-ink-3 hover:text-ink-2',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Stepper({
  value,
  onChange,
  min,
  max,
  label,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  label: string;
  suffix?: string;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-line bg-surface-2 p-1" role="group" aria-label={label}>
      <IconButton label={`Decrease ${label}`} className="h-9 w-9" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>
        <Minus size={16} />
      </IconButton>
      <output aria-live="polite" className="num min-w-10 text-center text-[15px] font-semibold">
        {value}
        {suffix ? <span className="ml-0.5 text-ink-3">{suffix}</span> : null}
      </output>
      <IconButton label={`Increase ${label}`} className="h-9 w-9" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>
        <Plus size={16} />
      </IconButton>
    </div>
  );
}

/**
 * Money entry. Text is parsed with string arithmetic into integer cents
 * (never floats). Invalid text is flagged and not committed.
 */
export function MoneyInput({
  valueCents,
  onChange,
  id,
  label,
  allowZero = true,
  className,
  compact,
}: {
  valueCents: Cents;
  onChange: (cents: Cents) => void;
  id?: string;
  label: string;
  allowZero?: boolean;
  className?: string;
  compact?: boolean;
}) {
  const [text, setText] = useState(centsToInput(valueCents));
  const [invalid, setInvalid] = useState(false);
  const [syncedValue, setSyncedValue] = useState(valueCents);
  if (syncedValue !== valueCents) {
    // External value changed (e.g. table regenerated): show it.
    setSyncedValue(valueCents);
    setText(centsToInput(valueCents));
    setInvalid(false);
  }
  const commit = (raw: string) => {
    const cents = parseMoney(raw);
    if (cents === null || cents < 0 || (!allowZero && cents === 0)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    if (cents !== valueCents) onChange(cents);
    else setText(centsToInput(cents));
  };
  return (
    <div className={cx('relative', className)}>
      <span className={cx('pointer-events-none absolute top-1/2 -translate-y-1/2 text-ink-3', compact ? 'left-2.5 text-[14px]' : 'left-4')}>$</span>
      <input
        id={id}
        aria-label={label}
        aria-invalid={invalid}
        inputMode="decimal"
        autoComplete="off"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const cents = parseMoney(e.target.value);
          setInvalid(cents === null || cents < 0);
        }}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        className={cx(
          inputClass,
          'num',
          compact ? 'min-h-10 rounded-lg pl-6 pr-2 text-right text-[15px]' : 'pl-8',
        )}
      />
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center animate-fade-in">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-line bg-surface-2 text-gold">{icon}</div>
      <h2 className="text-[19px] font-semibold text-ink">{title}</h2>
      <p className="mt-1.5 max-w-xs text-[15px] leading-relaxed text-ink-2">{body}</p>
      {action ? <div className="mt-6 w-full max-w-xs">{action}</div> : null}
    </div>
  );
}

export function ErrorList({ errors }: { errors: { message: string; code?: string }[] }) {
  if (!errors.length) return null;
  return (
    <div role="alert" className="rounded-2xl border border-negative/30 bg-negative-soft p-4">
      <ul className="space-y-1 text-[14px] text-negative">
        {errors.map((e, i) => (
          <li key={`${e.code ?? ''}-${i}`}>• {e.message}</li>
        ))}
      </ul>
    </div>
  );
}
