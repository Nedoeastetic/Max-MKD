// Лимиты и утилиты для полей ввода

export const LIMITS = {
  description: 1000,
  report: 300,
  reviewComment: 300,
  name: 100,
  address: 200
};

export function CharCounter({ value, max }: { value: string; max: number }) {
  const percent = (value.length / max) * 100;
  const color = percent > 90 ? 'var(--max-error)' : percent > 70 ? 'var(--max-warning)' : 'var(--max-text-tertiary)';
  return (
    <span style={{ color, fontSize: '11px' }}>
      {value.length}/{max}
    </span>
  );
}
