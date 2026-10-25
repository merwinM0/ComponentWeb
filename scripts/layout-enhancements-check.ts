import type { Page } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { createNode, initialDocument } from '../blank/src/core/model';
import type { Document, Placement } from '../blank/src/core/types';
import { STORAGE_KEY } from '../blank/src/core/store';
import { LAYOUTS_KEY } from '../blank/src/core/layouts';
import { openLatestLayout } from './layout-test-helpers';

export async function checkLayoutEnhancements(base: Page) {
  const context = await base.context().browser()!.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const origin = new URL(base.url()).origin;
  const assert = (value: unknown, label: string) => { if (!value) throw new Error(label); };
  const node = (id: string) => page.locator(`#canvas .node[data-id="${id}"]`);
  async function seed(nodes: Placement[]) {
    await page.goto(origin); await page.reload();
    await page.evaluate(({ key, layouts, doc }) => { localStorage.removeItem(layouts); localStorage.setItem(key, JSON.stringify(doc)); }, { key: STORAGE_KEY, layouts: LAYOUTS_KEY, doc: { ...initialDocument(), nodes } });
    await page.reload(); await openLatestLayout(page);
  }
  async function stored(): Promise<Document> { await page.locator('#save').click(); return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY); }
  async function change(id: string, value: string) { await page.locator(id).fill(value); await page.locator(id).press('Tab'); }
  try {
    const a = { ...createNode('html.p'), id: 'text-a', col: 2, row: 2 }, b = { ...createNode('html.p'), id: 'text-b', col: 30, row: 2 };
    await seed([a, b]); await node(a.id).focus(); await node(b.id).click({ modifiers: ['Shift'] });
    await change('#type-fontSize', '20'); await page.locator('#type-fontWeight').selectOption('700'); await change('#type-lineHeight', '1.8'); await page.locator('#type-textAlign').selectOption('center');
    for (const n of [a, b]) {
      const css = await node(n.id).locator('p').evaluate(e => { const c = getComputedStyle(e); return [c.fontSize, c.fontWeight, c.lineHeight, c.textAlign]; });
      assert(css.join('/') === '20px/700/36px/center', '多选排版应用到真实标签');
    }
    await page.locator('#undo').click(); assert((await stored()).nodes.every(n => n.props.typography?.textAlign === undefined), '多选统一修改一次撤销');
    await page.locator('#redo').click(); await stored(); await page.reload();
    assert(await node(a.id).locator('p').evaluate(e => getComputedStyle(e).fontSize) === '20px', '排版保存刷新');
    await node(a.id).focus();
    const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    assert(!audit.violations.length, `新面板无障碍 ${JSON.stringify(audit.violations.map(v => v.id))}`);

    const parent = { ...createNode('layout.container'), id: 'parent', col: 2, row: 2, colSpan: 60, rowSpan: 40, design: { width: 720, height: 480 } };
    parent.layout!.mode = 'flex'; parent.layout!.wrap = false;
    const x = { ...createNode('basic.button'), id: 'child-x', parentId: parent.id }, y = { ...createNode('basic.button'), id: 'child-y', parentId: parent.id };
    await seed([parent, x, y]); await node(x.id).focus(); await change('#item-flexGrow', '1');
    let widths = await Promise.all([node(x.id).evaluate(e => parseFloat(getComputedStyle(e).width)), node(y.id).evaluate(e => parseFloat(getComputedStyle(e).width))]);
    assert(widths[0] > widths[1] * 2, 'Flex grow 分配可用空间');
    await change('#item-flexGrow', '0'); await change('#item-flexShrink', '1');
    await node(y.id).focus(); await change('#item-flexShrink', '1');
    await node(parent.id).focus(); await change('#layout-design-width', '300');
    widths = await Promise.all([node(x.id).evaluate(e => parseFloat(getComputedStyle(e).width)), node(y.id).evaluate(e => parseFloat(getComputedStyle(e).width))]);
    assert(widths.every(w => w >= 96 && w < 168), 'Flex shrink 在最小尺寸以上收缩');
    await change('#layout-design-width', '720'); await page.locator('#layout-mode').selectOption('grid'); await change('#layout-columns', '3'); await page.locator('#layout-align').selectOption('stretch');
    await node(x.id).focus(); await change('#item-columnSpan', '2'); await change('#item-rowSpan', '3');
    widths = await Promise.all([node(x.id).evaluate(e => parseFloat(getComputedStyle(e).width)), node(y.id).evaluate(e => parseFloat(getComputedStyle(e).width))]);
    assert(widths[0] > widths[1] * 1.9, 'Grid 跨两列占用实际列宽');
    assert(await node(x.id).evaluate(e => getComputedStyle(e).gridRowStart) === 'span 3', 'Grid 跨三行');
    await stored(); await page.reload();
    assert((await stored()).nodes.find(n => n.id === x.id)?.constraints?.columnSpan === 2, '约束刷新保留');

    const text = { ...createNode('html.p'), id: 'auto-text', col: 2, row: 2 };
    text.props.title = '内容排版和自动高度测试。'.repeat(5);
    const blocker = { ...createNode('basic.button'), id: 'blocker', col: 2, row: 35 };
    await seed([text, blocker]); await node(text.id).focus();
    await page.locator('#item-heightMode').selectOption('content');
    const h1 = (await stored()).nodes[0].rowSpan;
    await change('#type-fontSize', '24'); const h2 = (await stored()).nodes[0].rowSpan;
    assert(h2 > h1, `内容高度随字号增长并写入占位：${h1} → ${h2}，${await page.locator('#toast').textContent()}`);
    await page.locator('#undo').click(); assert((await stored()).nodes[0].rowSpan === h1, '排版和高度一起撤销');
    const before = await stored(); await node(text.id).focus(); await change('#type-fontSize', '100');
    assert(JSON.stringify(await stored()) === JSON.stringify(before), '自适应越界或碰撞拒绝整次修改');
    await page.locator('#zoom').selectOption('0.5'); const same = await stored();
    assert(JSON.stringify(same) === JSON.stringify(before), '画布缩放不重写设计高度');
    await page.reload(); assert((await stored()).nodes[0].constraints?.heightMode === 'content', '自适应模式刷新保留');

    await seed([a, { ...b, col: a.col, row: 30 }]); await page.locator('#zoom').selectOption('1');
    const box = await node(a.id).boundingBox();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2); await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2 + 120, { steps: 8 });
    assert(await page.locator('.alignment-guide').count() > 0, '拖动显示同级对齐参考线');
    await page.keyboard.press('Escape'); await page.mouse.up();
    assert(await page.locator('.alignment-guide').count() === 0, '取消拖动清理参考线');
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 }); await node(a.id).focus();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px 面板不导致横向溢出`);
    }
    assert(!errors.length, `浏览器运行错误：${errors.join(';')}`);
    console.log('排版与布局约束验证通过：多选、历史、保存、Flex/Grid、内容高度、碰撞回滚、缩放隔离、参考线、无障碍与窄屏。');
  } finally { await context.close(); }
}
