import type { Page } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { createNode, initialDocument } from '../blank/src/core/model';
import type { Placement, Document } from '../blank/src/core/types';
import { CONTAINER_SKINS } from '../blank/src/components/container/skins';
import { containerGeometry } from '../blank/src/core/container-geometry';
import { STORAGE_KEY } from '../blank/src/core/store';
import { LAYOUTS_KEY } from '../blank/src/core/layouts';
import { openLatestLayout } from './layout-test-helpers';

export async function checkContainerBackgrounds(base: Page) {
  const context = await base.context().browser()!.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage(), errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  const origin = new URL(base.url()).origin;
  const assert = (v: unknown, message: string) => { if (!v) throw new Error(message); };
  const node = (id: string) => page.locator(`#canvas .node[data-id="${id}"]`);
  const root = { ...createNode('layout.container'), id: 'svg-root', col: 2, row: 2, colSpan: 30, rowSpan: 20, design: { width: 360, height: 240 } };
  const child = { ...createNode('basic.button'), id: 'svg-child', parentId: root.id };
  async function seed(nodes: Placement[]) {
    await page.goto(origin); await page.reload();
    await page.evaluate(({ key, library, doc }) => { localStorage.removeItem(library); localStorage.setItem(key, JSON.stringify(doc)); }, { key: STORAGE_KEY, library: LAYOUTS_KEY, doc: { ...initialDocument(), nodes } });
    await page.reload(); await openLatestLayout(page);
  }
  async function saved(): Promise<Document> { await page.locator('#save').click(); return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY); }
  async function change(id: string, value: string) { await page.locator(id).fill(value); await page.locator(id).press('Tab'); }
  async function checkGeometry(source: Placement) {
    const expected = containerGeometry(source).content;
    const actual = await node(source.id).evaluate(el => {
      const surface = el.querySelector('.component-host')!.shadowRoot!.querySelector('.container-surface')!;
      const body = surface.querySelector('.container-children')!, rect = body.getBoundingClientRect(), outer = surface.getBoundingClientRect();
      const css = getComputedStyle(surface), sx = outer.width / parseFloat(css.width), sy = outer.height / parseFloat(css.height);
      return { x: (rect.left - outer.left) / sx, y: (rect.top - outer.top) / sy, width: rect.width / sx, height: rect.height / sy };
    });
    for (const key of ['x', 'y', 'width', 'height'] as const) assert(Math.abs(actual[key] - expected[key]) < 0.1, `内容区 DOM / 校验一致 ${key}: ${actual[key]} / ${expected[key]}`);
  }
  try {
    await seed([root, child]); await node(root.id).focus();
    for (const skin of CONTAINER_SKINS) {
      await page.locator(`[data-skin="${skin.id}"]`).click();
      const doc = await saved(), current = doc.nodes.find(n => n.id === root.id)!;
      assert(current.skin === skin.id && current.props.background === skin.palette.background, '选择皮肤应用独立浅色配色');
      await checkGeometry(current);
      assert(await node(root.id).locator('.container-safe-area').isVisible(), '选中显示内容安全区');
      assert(await node(root.id).locator('.container-surface').evaluate(el => getComputedStyle(el).backgroundColor) === 'rgba(0, 0, 0, 0)', 'SVG 外层不补矩形背景');
      assert(await node(root.id).locator('svg').getAttribute('aria-hidden') === 'true', '装饰 SVG 不参与可访问内容');
      const isTransparent = await node(root.id).locator('.skin-silhouette').evaluate((path: SVGGeometryElement, id) => !path.isPointInFill(new DOMPoint(id === 'ticket' ? 2 : 350, id === 'ticket' ? 120 : id === 'bubble' ? 235 : 3)), skin.id);
      assert(isTransparent, '可见轮廓保留真实缺角');
    }
    const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    assert(!audit.violations.length, `SVG 面板无障碍：${JSON.stringify(audit.violations.map(v => v.id))}`);
    await page.locator('#undo').click(); assert((await saved()).nodes[0].skin === 'ticket', '皮肤选择一次撤销');
    await page.locator('#redo').click(); await saved(); await page.reload(); await node(root.id).focus();
    assert((await saved()).nodes[0].skin === 'bubble', '皮肤保存刷新');
    await change('#prop-colSpan', '540'); await change('#prop-rowSpan', '360');
    await checkGeometry((await saved()).nodes[0]);
    await change('#layout-design-width', '480'); await change('#layout-design-height', '300');
    assert(await node(root.id).locator('svg').getAttribute('viewBox') === '0 0 480 300', '内部尺寸改变时重建路径');
    await checkGeometry((await saved()).nodes[0]);
    await change('#prop-hex-background', '#fef4d8');
    assert(await node(root.id).locator('.skin-silhouette').evaluate(p => getComputedStyle(p).fill) === 'rgb(254, 244, 216)', 'SVG 使用组件自定义配色');
    await change('#prop-borderWidth', '6');
    assert(await node(root.id).locator('.skin-silhouette').evaluate(p => getComputedStyle(p).strokeWidth) === '6px', 'SVG 轮廓使用边框粗细');
    await page.locator('#prop-borderStyle').selectOption('dashed');
    assert(await node(root.id).locator('.skin-silhouette').evaluate(p => getComputedStyle(p).strokeDasharray) === '6px, 4px', 'SVG 虚线生效');
    await page.locator('#layout-mode').selectOption('flex');
    await checkGeometry((await saved()).nodes[0]);
    await page.locator('#layout-mode').selectOption('grid');
    await checkGeometry((await saved()).nodes[0]);
    await page.locator('#layout-mode').selectOption('free');
    await page.locator('#preview').click();
    assert(await node(root.id).locator('.container-safe-area').isHidden(), '预览不显示辅助线');
    assert(await page.locator('[data-skin="paper"]').isDisabled(), '预览不能换背景');
    await page.locator('#preview').click();
    await saved(); await page.locator('#toggle-theme').click();
    assert((await saved()).nodes[0].props.background === '#fef4d8', '主题切换不覆盖 SVG 自身颜色');

    // A child that fits the old rectangle must not silently escape a smaller safe region.
    await seed([root, { ...child, col: 12, row: 12 }]); await node(root.id).focus();
    await page.locator('[data-skin="bubble"]').click();
    assert((await saved()).nodes[0].skin === undefined, '切换背景不能挤出已有子项');

    // At 50% nested display size, real content-origin geometry still controls drag-in.
    const nested = { ...root, skin: 'ticket' as const, props: { ...root.props, ...CONTAINER_SKINS[1].palette }, colSpan: 15, rowSpan: 10 };
    await seed([nested]);
    const contentBox = await node(root.id).locator('.container-children').boundingBox();
    await page.locator('#search').fill('basic.button');
    const tile = page.locator('[data-type="basic.button"] .tile-preview'); await tile.scrollIntoViewIfNeeded();
    const box = await tile.boundingBox();
    await page.mouse.move(box!.x + 20, box!.y + 20); await page.mouse.down();
    await page.mouse.move(contentBox!.x + 60, contentBox!.y + 30, { steps: 12 }); await page.mouse.up();
    let doc = await saved();
    assert(doc.nodes.length === 2 && doc.nodes[1].parentId === nested.id, '缩放 SVG 容器安全区可拖入组件');
    await checkGeometry(doc.nodes[0]);
    await node(root.id).focus(); await page.keyboard.press('Shift+F10'); await page.getByRole('menuitem', { name: '编辑组件', exact: true }).click();
    assert(await node(root.id).evaluate(el => getComputedStyle(el).backgroundColor) === 'rgba(0, 0, 0, 0)', '原位编辑不补满透明背景');
    await checkGeometry({ ...nested, colSpan: 30, rowSpan: 20 });
    await page.locator('#finish-edit').click();
    doc = await saved(); assert(doc.nodes[0].skin === 'ticket', '原位编辑完成保留皮肤');
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 }); await node(root.id).focus();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px 背景面板不导致页面溢出`);
    }
    assert(!errors.length, errors.join('; '));
    console.log('SVG 背景验证通过：三款皮肤、安全区几何、真实透明轮廓、保存/历史、自定义样式、Flex/Grid、嵌套拖放、原位编辑、主题隔离、无障碍和窄屏。');
  } finally { await context.close(); }
}
