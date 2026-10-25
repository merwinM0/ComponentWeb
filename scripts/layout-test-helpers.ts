import type { Page } from 'playwright';

/** 旧工作台专项先经首页选择布局，不绕过新的页面入口。 */
export async function openLatestLayout(page: Page) {
  if (await page.locator('#layout-home').isVisible()) await page.locator('#layout-list .layout-item').first().click();
  await page.locator('#editor-page').waitFor({ state: 'visible' });
}
export async function gotoEditor(page: Page, url: string) {
  const target = new URL(url); target.hash = '';
  await page.goto(target.href); await openLatestLayout(page);
}
