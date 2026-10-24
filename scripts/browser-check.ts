import { chromium, type Page } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { components } from '../blank/src/components/registry';
import { initialDocument, type Document } from '../blank/src/core/model';
import { STORAGE_KEY } from '../blank/src/core/store';
import { checkLibraryScroll } from './library-scroll-check';
import { checkShapeSettings } from './shape-check';
import { checkFineGrid } from './grid-check';
import { checkWorkbench } from './workbench-check';
import { checkNestingDrag } from './nesting-drag-check';
import { checkInlineEditing } from './inline-edit-check';

const port = 3107;
const url = `http://127.0.0.1:${port}`;
const server = Bun.spawn(['bun', 'server.ts'], { env: { ...process.env, PORT: String(port) }, stdout: 'ignore', stderr: 'inherit' });
const browser = await chromium.launch({ headless: true }).catch(error => { server.kill(); throw error; });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors: string[] = [];
page.on('pageerror', error => errors.push(error.message));
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
async function seed(doc: Document) {
  // 先卸载有未保存历史的页面，避免 pagehide 覆盖下一份测试夹具。
  await page.reload();
  await page.locator('#library-count').filter({ hasText: String(components.length) }).waitFor();
  await page.evaluate(({ key, doc }) => localStorage.setItem(key, JSON.stringify(doc)), { key: STORAGE_KEY, doc });
  await page.reload();
  await page.locator('#library-count').filter({ hasText: String(components.length) }).waitFor();
}
async function audit(target: Page, label: string) {
  const result = await new AxeBuilder({ page: target }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  assert(!result.violations.length, `${label} 无障碍检查：${JSON.stringify(result.violations.map(item => ({ id: item.id, targets: item.nodes.map(node => node.target) })))}`);
}
try {
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(url)).ok) break; } catch { /* 等待开发服务器 */ }
    await Bun.sleep(100);
  }
  await page.goto(url);
  await page.locator('.node').first().waitFor();
  assert(await page.locator('.node').count() === 4, '初始布局');
  await checkLibraryScroll(page);
  await checkShapeSettings(page);
  await checkFineGrid(page);
  await checkNestingDrag(page);
  await checkWorkbench(page);
  await checkInlineEditing(page);
  await audit(page, '初始工作台');
  await page.getByRole('button', { name: 'HTML 标签', exact: true }).click();
  assert(await page.locator('.component-tile').count() === components.filter(item => item.type.startsWith('html.')).length, 'HTML 分类计数');
  await page.locator('#search').fill('h1');
  assert(await page.locator('[data-type="html.h1"]').count() === 1, '按标签名搜索');
  await page.locator('#search').clear();
  await page.getByRole('button', { name: '全部', exact: true }).click();

  await page.locator('.node').first().click();
  const originalColor = await page.locator('#prop-hex-background').inputValue();
  await page.locator('#prop-hex-background').fill('#253545');
  await page.locator('#prop-hex-background').press('Tab');
  assert(await page.locator('.node.selected .component-host').evaluate(element => element.style.getPropertyValue('--surface')) === '#253545', '背景色应用到 Shadow DOM');
  await page.locator('#undo').click();
  assert(await page.locator('#prop-hex-background').inputValue() === originalColor, '颜色撤销');
  await page.locator('#redo').click();
  assert(await page.locator('#prop-hex-background').inputValue() === '#253545', '颜色重做');
  await page.getByRole('button', { name: '应用浅色纸配色' }).click();
  assert(await page.locator('#prop-hex-text').inputValue() === '#172B42', '一键配色');
  await page.locator('#prop-hex-text').fill('invalid');
  await page.locator('#prop-hex-text').dispatchEvent('change');
  assert(await page.locator('#prop-hex-text').evaluate((input: HTMLInputElement) => !input.validity.valid), '拒绝非法 HEX');
  await page.locator('#prop-hex-text').fill('#172B42');
  await page.locator('#prop-hex-text').press('Tab');
  await page.locator('#prop-accent').evaluate((input: HTMLInputElement) => { input.value = '#ffcc88'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  assert(await page.locator('.node.selected .component-host').evaluate(element => element.style.getPropertyValue('--accent')) === '#ffcc88', '拾色实时预览');
  await page.locator('#prop-accent').dispatchEvent('change');
  await page.locator('#canvas-hex-background').fill('#182432');
  await page.locator('#canvas-hex-background').press('Tab');
  assert(await page.locator('#canvas').evaluate(element => element.style.getPropertyValue('--canvas-background')) === '#182432', '画布换色');
  await page.locator('#canvas-hex-grid').fill('#ffaa88');
  await page.locator('#canvas-hex-grid').press('Tab');
  await page.locator('#save').click();
  await page.reload();
  assert(await page.locator('#canvas-hex-grid').inputValue() === '#FFAA88', '画布颜色保存恢复');
  await page.locator('.node').first().click();
  assert(await page.locator('#prop-hex-text').inputValue() === '#172B42', '组件配色保存恢复');
  await page.screenshot({ path: '/tmp/componentweb-v2-desktop.png', fullPage: true });

  // 对每个注册项逐个加载和进入预览，验证真实标签、生命周期及颜色变量。
  let audited = 0;
  await seed({ ...initialDocument(), nodes: [] });
  for (const [index, definition] of components.entries()) {
    if (index % 20 === 0 || definition.type.startsWith('ui.')) console.log(`检查 ${index + 1}/${components.length}：${definition.type}`);
    await page.locator('#search').fill(definition.type);
    await page.getByRole('button', { name: `添加${definition.title}`, exact: true }).click();
    assert(await page.locator('.node .component-host').evaluate(element => !!element.shadowRoot?.childElementCount), `${definition.type} 已渲染`);
    if (definition.type.startsWith('html.')) {
      const tag = definition.tags![0];
      assert(await page.locator(`.component-host ${tag}`).count() > 0, `${definition.type} 包含真实 ${tag} 元素`);
    }
    await page.locator('.node').click();
    const surface = page.locator('.component-host').locator('.frame, .box, .container-surface, article, button, input').first();
    assert(await surface.evaluate(element => getComputedStyle(element).borderTopLeftRadius) === '0px', `${definition.type} 默认直角`);
    if (['ui.table', 'html.input'].includes(definition.type)) {
      await page.locator('#prop-radius').fill('8'); await page.locator('#prop-radius').press('Tab');
      await page.locator('#prop-borderWidth').fill('2'); await page.locator('#prop-borderWidth').press('Tab');
      await page.locator('#prop-borderStyle').selectOption('dotted');
      assert(await surface.evaluate(element => getComputedStyle(element).borderTopLeftRadius) === '8px', `${definition.type} 圆角生效`);
      assert(await surface.evaluate(element => getComputedStyle(element).borderTopStyle) === 'dotted', `${definition.type} 边框生效`);
      await page.locator('#reset-shape').click();
    }
    await page.locator('#preview').click();
    if (!definition.type.startsWith('html.') || ['html.form', 'html.input', 'html.img', 'html.video', 'html.svg', 'html.table', 'html.dialog'].includes(definition.type)) {
      await audit(page, definition.type); audited++;
    }
    const host = page.locator('.component-host');
    if (definition.type === 'ui.switch') {
      const control = host.getByRole('switch'); await control.uncheck(); assert(!(await control.isChecked()), '开关可交互');
    }
    if (definition.type === 'ui.tabs') {
      await host.getByRole('tab', { name: '设计规范' }).click();
      assert(await host.getByRole('tabpanel').textContent() === '一致的设计语言统一间距、色彩与交互，让每个组件自然协作。', '标签页切换');
      await page.keyboard.press('ArrowRight');
      assert(await host.getByRole('tab', { name: '更新记录' }).getAttribute('aria-selected') === 'true', '标签页键盘导航');
    }
    if (definition.type === 'ui.dialog') {
      await host.getByRole('button', { name: '打开对话框' }).click();
      assert(await host.locator('dialog').evaluate((dialog: HTMLDialogElement) => dialog.open), '对话框打开');
      await page.keyboard.press('Escape');
      assert(!(await host.locator('dialog').evaluate((dialog: HTMLDialogElement) => dialog.open)), '对话框 Escape 关闭');
    }
    if (definition.type === 'ui.pagination') {
      await host.getByRole('button', { name: '下一页' }).click();
      assert(await host.locator('[data-page="2"]').getAttribute('aria-current') === 'page', '分页交互');
    }
    if (definition.type === 'html.form') {
      await host.getByRole('textbox', { name: '姓名' }).fill('设计师');
      await host.getByRole('textbox', { name: '邮箱' }).fill('design@example.com');
      await host.getByRole('button', { name: '提交表单' }).click();
      assert((await page.locator('#toast').textContent())?.includes('表单演示'), '原生表单不执行页面跳转');
    }
    if (definition.type === 'html.a') {
      await page.locator('#preview').click();
      await page.locator('#prop-source').fill('javascript:alert(1)');
      await page.locator('#prop-source').press('Tab');
      assert(await host.locator('a').getAttribute('href') === null, '链接拒绝脚本协议');
    }
    if (await page.locator('#preview').getAttribute('aria-pressed') === 'true') await page.locator('#preview').click();
    await page.locator('.node').click();
    await page.locator('#delete').click();
    assert(await page.locator('.node').count() === 0, `${definition.type} 销毁`);
  }
  await seed(initialDocument());
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px 无页面横向溢出`);
  }
  await page.setViewportSize({ width: 320, height: 900 });
  await page.screenshot({ path: '/tmp/componentweb-v2-mobile.png', fullPage: true });
  assert(errors.length === 0, `无浏览器运行错误：${errors.join('; ')}`);
  console.log(`浏览器验证通过：${components.length} 项素材逐项渲染、${audited + 1} 个无障碍场景、配色保存/撤销、交互和四档响应式。`);
} finally {
  await browser.close();
  server.kill();
  await server.exited;
}
