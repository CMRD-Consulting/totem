import type { CSSProperties } from 'vue';

export function pillBtn(primary: boolean): CSSProperties {
  return {
    all: 'unset',
    cursor: 'pointer',
    boxSizing: 'border-box',
    flex: primary ? 1 : '0 0 auto',
    height: '38px',
    padding: primary ? '0 14px' : '0 12px',
    borderRadius: '999px',
    background: primary ? 'var(--ink)' : 'var(--chip-strong)',
    color: primary ? 'var(--surface)' : 'var(--ink)',
    fontFamily: 'Inter',
    fontWeight: 600,
    fontSize: '13px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    letterSpacing: '-0.1px',
  };
}
