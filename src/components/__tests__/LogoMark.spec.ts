import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import LogoMark from '../LogoMark.vue';

describe('LogoMark', () => {
  it('renders a span with role="img" and aria-label "Totem"', () => {
    const wrapper = mount(LogoMark);
    const span = wrapper.find('span[role="img"]');
    expect(span.exists()).toBe(true);
    expect(span.attributes('aria-label')).toBe('Totem');
  });

  it('inlines the totem-mark SVG', () => {
    const wrapper = mount(LogoMark);
    expect(wrapper.html()).toContain('<svg');
    expect(wrapper.html()).toContain('viewBox="0 0 2099 2679"');
  });

  it('reflects the size prop in the rendered width style', () => {
    const wrapper = mount(LogoMark, { props: { size: 64 } });
    const span = wrapper.find('span[role="img"]');
    expect(span.attributes('style') ?? '').toMatch(/width:\s*64px/);
  });

  it('uses currentColor by default', () => {
    const wrapper = mount(LogoMark);
    const span = wrapper.find('span[role="img"]');
    expect(span.attributes('style') ?? '').toMatch(/color:\s*currentcolor/i);
  });

  it('accepts a custom color override', () => {
    const wrapper = mount(LogoMark, { props: { color: '#d62e2e' } });
    const span = wrapper.find('span[role="img"]');
    expect(span.attributes('style') ?? '').toMatch(/color:\s*(?:rgb\(214,\s*46,\s*46\)|#d62e2e)/i);
  });
});
