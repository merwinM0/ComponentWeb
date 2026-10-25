import type { Page } from 'playwright';
import { gotoEditor } from './layout-test-helpers';

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

export async function checkLibraryScroll(page: Page) {
  const list = page.locator('#component-list');
  for (const [width, height] of [[1440, 900], [1440, 700], [1024, 900], [768, 900], [320, 900]]) {
    await page.setViewportSize({ width, height });
    await list.evaluate(element => { element.scrollTop = 0; });
    const size = await list.evaluate(element => ({ visible: element.clientHeight, total: element.scrollHeight }));
    assert(size.visible > 0 && size.total > size.visible, `${width}×${height} 组件列表拥有受限高度与滚动内容`);
    assert((await list.locator('.component-tile').first().boundingBox())!.height >= 90, `${width}px 素材卡片不能被网格行高压缩成细线`);
    await list.scrollIntoViewIfNeeded();
    const box = (await list.boundingBox())!;
    const searchTop = (await page.locator('#search').boundingBox())!.y;
    await page.mouse.move(box.x + box.width / 2, box.y + Math.min(40, box.height / 2));
    await page.mouse.wheel(0, 500);
    await page.waitForFunction(() => document.getElementById('component-list')!.scrollTop > 0);
    assert(Math.abs((await page.locator('#search').boundingBox())!.y - searchTop) < 1, `${width}px 滚动列表不移动搜索栏`);
    await list.focus();
    await page.keyboard.press('End');
    await page.waitForFunction(() => {
      const element = document.getElementById('component-list')!;
      return element.scrollTop + element.clientHeight >= element.scrollHeight - 2;
    });
    assert(await list.locator('.component-tile').last().isVisible(), `${width}px 键盘可滚动到底部`);
    await page.keyboard.press('Home');
    await page.waitForFunction(() => document.getElementById('component-list')!.scrollTop === 0);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  const last = list.locator('[data-type="html.meter"]');
  await last.scrollIntoViewIfNeeded();
  const tile = (await last.boundingBox())!;
  const canvas = (await page.locator('#canvas').boundingBox())!;
  await page.mouse.move(tile.x + 20, tile.y + 20);
  await page.mouse.down();
  await page.mouse.move(canvas.x + 600, canvas.y + 450, { steps: 12 });
  await page.mouse.up();
  assert(await page.locator('.node').count() === 5, '滚动到底后仍可将组件拖入画布');
  await page.locator('#undo').click();
  assert(await page.locator('.node').count() === 4, '撤销测试拖入，恢复初始布局');
  await list.evaluate(element => { element.scrollTop = 0; });

  // 用真实 touch 事件验证：手指从素材卡片上向上划时应滚动，而不是被拖拽吞掉。
  const touchContext = await page.context().browser()!.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const touchPage = await touchContext.newPage();
    await gotoEditor(touchPage, page.url());
    const touchList = touchPage.locator('#component-list');
    await touchList.scrollIntoViewIfNeeded();
    const box = (await touchList.boundingBox())!;
    const client = await touchContext.newCDPSession(touchPage);
    const x = box.x + 30;
    const start = box.y + Math.min(150, box.height - 20);
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: start }] });
    for (let i = 1; i <= 8; i++) {
      await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: start - i * 12 }] });
      await touchPage.waitForTimeout(20);
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await touchPage.waitForFunction(() => document.getElementById('component-list')!.scrollTop > 0);
    assert(await touchPage.locator('#ghost').isHidden(), '触屏滚动取消拖放预览');
    assert(await touchPage.locator('.node').count() === 4, '触屏滚动不会误添加组件');
  } finally {
    await touchContext.close();
  }
  console.log('组件库滚动验证通过：五档视口、滚轮、键盘到底/回顶、搜索栏固定、底部组件拖入和触屏滑动。');
}
