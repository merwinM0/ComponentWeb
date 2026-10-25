import { expect, test } from 'bun:test';
import { THEME_KEY, ThemePreferences, parseTheme, themeDefaults } from './theme';
import { DEFAULT_APPEARANCE } from './types';
import { initialDocument } from './model';
import { Store } from './store';
import { StoreRouter } from './store-router';
function memory() {
  const values = new Map<string, string>(); let fail = false;
  return { values, fail(value: boolean) { fail = value; }, getItem(key: string) { return values.get(key) ?? null; }, setItem(key: string, value: string) { if (fail) throw new Error('quota'); values.set(key, value); } };
}
test('外观默认为原有暗色，不依赖系统亮暗偏好，也不自动覆盖记录', () => {
  const storage = memory(), prefs = new ThemePreferences(storage);
  expect(prefs.mode).toBe('dark'); expect(prefs.appearance).toEqual(DEFAULT_APPEARANCE); expect(storage.values.size).toBe(0);
});
test('首次兼容旧画布配色，已有主题偏好则优先使用新记录', () => {
  const storage = memory(), legacy = { background: '#123456', grid: '#ABCDEF' };
  const prefs = new ThemePreferences(storage, legacy); expect(prefs.appearance).toEqual({ background: '#123456', grid: '#abcdef' });
  prefs.toggle(); expect(new ThemePreferences(storage, legacy).appearance).toEqual(themeDefaults('light'));
});
test('亮色默认白底黑线，切换模式会覆盖而不是恢复各模式的旧自定义颜色', () => {
  const prefs = new ThemePreferences(memory()); prefs.setAppearance({ background: '#213141', grid: '#fedcba' }); prefs.toggle();
  expect(prefs.mode).toBe('light'); expect(prefs.appearance).toEqual({ background: '#ffffff', grid: '#000000' });
  prefs.setAppearance({ background: '#f1e8d9', grid: '#314159' }); prefs.toggle(); expect(prefs.appearance).toEqual(DEFAULT_APPEARANCE);
  prefs.toggle(); expect(prefs.appearance).toEqual(themeDefaults('light'));
});
test('自定义网格自动记录于浏览器，刷新恢复，但不触碰布局或组件数据', () => {
  const storage = memory(); storage.setItem('componentweb.layouts.v1', 'original-layouts'); storage.setItem('componentweb.combinations.v1', 'original-components');
  const prefs = new ThemePreferences(storage); prefs.setAppearance({ background: '#FAFAFA', grid: '#112233' });
  expect(new ThemePreferences(storage).appearance).toEqual({ background: '#fafafa', grid: '#112233' });
  expect(parseTheme(storage.getItem(THEME_KEY)!)).toMatchObject({ schemaVersion: 1, mode: 'dark' });
  expect(storage.getItem('componentweb.layouts.v1')).toBe('original-layouts'); expect(storage.getItem('componentweb.combinations.v1')).toBe('original-components');
});
test('验证偏好版本、模式和六位颜色，不接受执行内容或过大输入', () => {
  for (const raw of ['{', 'null', '[]', '{}', JSON.stringify({ schemaVersion: 2, mode: 'dark', appearance: DEFAULT_APPEARANCE }), JSON.stringify({ schemaVersion: 1, mode: 'auto', appearance: DEFAULT_APPEARANCE }), JSON.stringify({ schemaVersion: 1, mode: 'dark', appearance: { background: 'url(script)', grid: '#000000' } }), ' '.repeat(2049)]) expect(parseTheme(raw)).toBeNull();
  const prefs = new ThemePreferences(memory()); expect(() => prefs.setAppearance({ background: 'red', grid: '#000000' })).toThrow();
  expect(() => prefs.setMode('invalid' as 'dark')).toThrow(); expect(prefs.appearance).toEqual(DEFAULT_APPEARANCE);
});
test('损坏的记录不在读取时覆盖，后续手动切换可以修复', () => {
  const storage = memory(); storage.setItem(THEME_KEY, 'broken'); const prefs = new ThemePreferences(storage);
  expect(prefs.mode).toBe('dark'); expect(prefs.warning).toBeTruthy(); expect(storage.getItem(THEME_KEY)).toBe('broken');
  prefs.toggle(); expect(prefs.warning).toBe(''); expect(parseTheme(storage.getItem(THEME_KEY)!)?.mode).toBe('light');
});
test('存储写入失败仍允许本次切换，保留旧记录并支持恢复后重试', () => {
  const storage = memory(), prefs = new ThemePreferences(storage); prefs.toggle(); const old = storage.getItem(THEME_KEY); storage.fail(true); prefs.toggle();
  expect(prefs.mode).toBe('dark'); expect(prefs.appearance).toEqual(DEFAULT_APPEARANCE); expect(storage.getItem(THEME_KEY)).toBe(old); expect(prefs.warning).toContain('未能记录');
  storage.fail(false); prefs.setAppearance({ background: '#213141', grid: '#fedcba' }); expect(prefs.warning).toBe(''); expect(new ThemePreferences(storage).appearance).toEqual(prefs.appearance);
});
test('存储不可读或完全不可用时不会阻断外观切换', () => {
  const storage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  for (const prefs of [new ThemePreferences(storage), new ThemePreferences(null)]) { prefs.toggle(); expect(prefs.mode).toBe('light'); expect(prefs.warning).toBeTruthy(); }
});
test('切换主题后的第一次画布配色撤销回可见颜色，而非布局中的历史旧色', () => {
  const store = new StoreRouter(new Store(initialDocument())), nodes = structuredClone(store.doc.nodes);
  const custom = { background: '#f1e8d9', grid: '#000000' };
  store.commit({ ...store.doc, appearance: custom }, themeDefaults('light')); store.undo();
  expect(store.doc.appearance).toEqual(themeDefaults('light')); expect(store.doc.nodes).toEqual(nodes);
  store.redo(); expect(store.doc.appearance).toEqual(custom);
});
test('选择的配色恰好等于旧布局记录时，仍可撤销回切换主题后的可见配色', () => {
  const store = new Store(initialDocument()); store.commit(store.doc, themeDefaults('light'));
  expect(store.canUndo).toBe(true); store.undo(); expect(store.doc.appearance).toEqual(themeDefaults('light'));
  store.redo(); expect(store.doc.appearance).toEqual(DEFAULT_APPEARANCE);
});
test('颜色和默认值返回独立副本，相同状态不重复写入或通知', () => {
  const storage = memory(), prefs = new ThemePreferences(storage); let count = 0; const unsubscribe = prefs.subscribe(() => count++);
  prefs.appearance.grid = '#123456'; prefs.defaults.background = '#123456'; expect(prefs.appearance).toEqual(DEFAULT_APPEARANCE);
  prefs.setAppearance({ ...DEFAULT_APPEARANCE }); prefs.setMode('dark'); expect(count).toBe(0); prefs.toggle(); expect(count).toBe(1);
  unsubscribe(); prefs.toggle(); expect(count).toBe(1);
});
