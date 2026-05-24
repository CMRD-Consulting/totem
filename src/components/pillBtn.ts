import type { CSSProperties } from 'vue';

/**
 * Standard pill button style.
 *   primary  — uses the bold ink/surface palette; non-primary uses chip bg
 *   disabled — drops opacity to 0.5 in addition to changing cursor, so the
 *              disabled state isn't communicated by color alone (helps
 *              colorblind users + screen readers see the disabled attr).
 */
export function pillBtn(primary: boolean, disabled = false): CSSProperties {
  return {
    all: 'unset',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
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
