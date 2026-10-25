import { isColor } from '../components/colors';
import { DEFAULT_APPEARANCE, type Document } from './types';

export const THEME_KEY = 'componentweb.theme.v1';
export type ThemeMode = 'dark' | 'light';
export interface ThemeState { schemaVersion: 1; mode: ThemeMode; appearance: Document['appearance'] }
type ThemeStorage = Pick<Storage, 'getItem' | 'setItem'>;
export function themeDefaults(mode: ThemeMode): Document['appearance'] { return mode === 'light' ? { background: '#ffffff', grid: '#000000' } : { ...DEFAULT_APPEARANCE }; }
function appearanceOf(value: unknown): Document['appearance'] | null {
  const item = value as Document['appearance'] | null;
  return item && isColor(item.background) && isColor(item.grid) ? { background: item.background.toLowerCase(), grid: item.grid.toLowerCase() } : null;
}
export function parseTheme(raw: string): ThemeState | null {
  try {
    if (raw.length > 2048) return null;
    const item = JSON.parse(raw), appearance = appearanceOf(item?.appearance);
    return item?.schemaVersion === 1 && (item.mode === 'dark' || item.mode === 'light') && appearance ? { schemaVersion: 1, mode: item.mode, appearance } : null;
  } catch { return null; }
}
/** 浏览器级外观，不因切换布局恢复旧颜色；切换模式会覆盖自定义网格配色。 */
export class ThemePreferences {
  private current: ThemeState;
  private storage: ThemeStorage | null = null;
  private listeners = new Set<() => void>();
  warning = '';
  constructor(storage?: ThemeStorage | null, legacy: Document['appearance'] = DEFAULT_APPEARANCE) {
    this.current = { schemaVersion: 1, mode: 'dark', appearance: appearanceOf(legacy) ?? themeDefaults('dark') };
    try {
      this.storage = storage === undefined ? globalThis.localStorage ?? null : storage;
      const raw = this.storage?.getItem(THEME_KEY);
      if (raw) { const parsed = parseTheme(raw); if (parsed) this.current = parsed; else this.warning = '外观偏好无效，已使用默认暗色与原有画布配色'; }
    } catch { this.warning = '无法读取外观偏好，本次仍可切换主题'; }
  }
  get mode() { return this.current.mode; }
  get appearance() { return { ...this.current.appearance }; }
  get defaults() { return themeDefaults(this.mode); }
  subscribe(listener: () => void) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private update(mode: ThemeMode, appearance: Document['appearance']) {
    const next: ThemeState = { schemaVersion: 1, mode, appearance };
    if (JSON.stringify(next) === JSON.stringify(this.current)) return;
    this.current = next; this.warning = '';
    try { if (!this.storage) throw new Error('unavailable'); this.storage.setItem(THEME_KEY, JSON.stringify(next)); }
    catch { this.warning = '当前外观已生效，但未能记录到浏览器；请检查存储权限或剩余空间'; }
    this.listeners.forEach(listener => listener());
  }
  setMode(mode: ThemeMode) { if (mode !== 'dark' && mode !== 'light') throw new Error('主题无效'); if (mode !== this.mode) this.update(mode, themeDefaults(mode)); }
  toggle() { this.setMode(this.mode === 'dark' ? 'light' : 'dark'); }
  setAppearance(value: Document['appearance']) { const appearance = appearanceOf(value); if (!appearance) throw new Error('网格配色无效'); this.update(this.mode, appearance); }
}
