import { watchEffect } from 'vue';
import { state } from '@/store/state';

function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function useTheme() {
  watchEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = state.theme;
    root.style.setProperty('--accent', state.accent);
    const rgb = hexToRgb(state.accent);
    if (rgb) {
      const [r, g, b] = rgb;
      root.style.setProperty('--accent-soft', `rgba(${r},${g},${b},0.12)`);
    }
  });
}
