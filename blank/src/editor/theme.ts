import { ThemePreferences, themeDefaults } from '../core/theme';
import type { Document } from '../core/types';
import { $, toast } from './dom';

/** 只更新外观变量；组件自身的颜色、几何和编辑草稿保持不变。 */
export function applyGridAppearance(preferences: ThemePreferences, appearance: Document['appearance']) {
  const root = document.documentElement;
  root.style.setProperty('--canvas-background', appearance.background); root.style.setProperty('--canvas-grid', appearance.grid);
  // 首页是操作界面，沿用主题默认网格，避免自定义画布背景破坏文字对比度。
  const defaults = themeDefaults(preferences.mode);
  root.style.setProperty('--home-grid-background', preferences.mode === 'dark' ? '#0b1118' : defaults.background);
  root.style.setProperty('--home-grid-color', defaults.grid);
}
export function setupTheme(preferences: ThemePreferences) {
  const button = $<HTMLButtonElement>('toggle-theme');
  function render() {
    const light = preferences.mode === 'light'; document.documentElement.dataset.theme = preferences.mode;
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')!.content = light ? '#ffffff' : '#0b1118';
    button.title = light ? '当前为亮色，切换为暗色主题' : '当前为暗色，切换为亮色主题';
    button.setAttribute('aria-pressed', String(light));
    button.querySelector('[data-theme-icon]')!.textContent = light ? '☾' : '☀';
    applyGridAppearance(preferences, preferences.appearance);
  }
  button.addEventListener('click', () => { preferences.toggle(); if (preferences.warning) toast(preferences.warning); });
  preferences.subscribe(render); render();
}
