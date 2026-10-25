import { expect, test } from 'bun:test';
import { layoutHash, layoutIdFromHash } from './layout-route';

test('首页没有布局路由，不自动进入默认候选布局', () => {
  expect(layoutIdFromHash('')).toBeNull(); expect(layoutIdFromHash('#')).toBeNull(); expect(layoutIdFromHash('#other')).toBeNull();
});
test('布局地址可无损编解码 ID，支持静态部署', () => {
  for (const id of ['layout-123', '中文布局', 'a / b?#&=+%']) expect(layoutIdFromHash(layoutHash(id))).toBe(id);
  expect(layoutHash('a b')).toBe('#layout=a%20b');
});
test('拒绝损坏、空及超长布局地址', () => {
  expect(layoutIdFromHash('#layout=')).toBeNull(); expect(layoutIdFromHash('#layout=%')).toBeNull();
  expect(layoutIdFromHash('#layout=%E0%A4%A')).toBeNull(); expect(layoutIdFromHash(layoutHash('x'.repeat(101)))).toBeNull();
});
