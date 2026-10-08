// Run with Playwright available; optionally set PLAYWRIGHT_MODULE and CHROMIUM_PATH.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'searchcrutch-browser-'));
const extension = path.resolve(__dirname, '../src');
const output = process.env.SCREENSHOT_DIR || profile;
fs.mkdirSync(output, { recursive: true });
const failures = [];
let context;

async function launch() {
    context = await chromium.launchPersistentContext(profile, {
        headless: true,
        ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
        args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
        viewport: { width: 1280, height: 1100 }
    });
    let worker = context.serviceWorkers()[0];
    if (!worker) worker = await context.waitForEvent('serviceworker');
    return worker.url().split('/')[2];
}
async function options(id) {
    const page = await context.newPage();
    page.on('pageerror', error => failures.push(error.message));
    await page.goto(`chrome-extension://${id}/options.html`);
    await page.waitForFunction(() => !document.getElementById('saveSettings').disabled);
    return page;
}
async function names(page) { return page.locator('[data-field="name"]').evaluateAll(inputs => inputs.map(input => input.value)); }
async function saved(page) { return page.evaluate(() => chrome.storage.sync.get(['searchEngines', 'settings'])); }
async function save(page) {
    await page.locator('#saveSettings').click();
    await page.waitForFunction(() => document.getElementById('saveStatus').textContent.includes('搜索列表与右键菜单已更新'));
}

(async () => {
    const id = await launch();
    await context.route('**/static/json/search-engines.json', route => route.fulfill({
        status: 200, contentType: 'application/json',
        body: fs.readFileSync(path.join(extension, 'data/search-engines.json'), 'utf8')
    }));
    let page = await options(id);
    assert.deepEqual(await names(page), ['Google', '百度', '必应', '小红书']);
    await page.screenshot({ path: path.join(output, 'settings-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(output, 'settings-mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 1100 });

    // Online chooser: duplicate prevention, search, categories and batch selection.
    await page.locator('#addCustomSearch').click();
    await page.waitForFunction(() => document.getElementById('catalogStatus').textContent.startsWith('在线列表已更新'));
    assert.equal(await page.locator('.catalog-card').count(), 15);
    assert.equal(await page.locator('.catalog-card input:disabled').count(), 4);
    await page.locator('#catalogQuery').fill('zhihu');
    assert.equal(await page.locator('.catalog-card').count(), 1);
    await page.locator('.catalog-card input').focus();
    await page.keyboard.press('Space');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.id), 'zhihu');
    assert.equal(await page.locator('.catalog-card input').isChecked(), true);
    await page.locator('#catalogQuery').fill('');
    await page.locator('[data-category="视频"]').click();
    assert.equal(await page.locator('.catalog-card').count(), 3);
    await page.locator('.catalog-card input[data-id="bilibili"]').check();
    await page.locator('[data-category="全部"]').click();
    await page.screenshot({ path: path.join(output, 'settings-catalog.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.getElementById('catalogDialog').scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(output, 'catalog-mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 1100 });
    await page.locator('#addSelectedEngines').click();
    assert.deepEqual((await names(page)).slice(4), ['知乎', 'B站']);
    assert.equal((await saved(page)).searchEngines, undefined);
    await page.locator('.remove-engine').last().click();
    await page.locator('.remove-engine').last().click();

    // Network failures keep the chooser usable with cache or the packaged JSON.
    await context.route('**/static/json/search-engines.json', route => route.fulfill({ status: 503, body: 'offline' }));
    await page.locator('#addCustomSearch').click();
    await page.waitForFunction(() => document.getElementById('catalogStatus').textContent.includes('上次加载的列表'));
    assert.equal(await page.locator('.catalog-card').count(), 15);
    await page.keyboard.press('Escape');
    await page.evaluate(() => chrome.storage.local.remove('engineCatalogCache'));
    await page.locator('#addCustomSearch').click();
    await page.waitForFunction(() => document.getElementById('catalogStatus').textContent.includes('内置列表'));
    assert.equal(await page.locator('.catalog-card').count(), 15);
    await page.locator('#closeCatalog').click();

    await page.locator('[data-field="name"]').nth(1).fill('小红书·自定义');
    await page.locator('[data-field="url"]').nth(1).fill('https://www.xiaohongshu.com/search_result?keyword=%s&type=51');
    await page.locator('.engine-row input[type="checkbox"]').nth(2).uncheck();
    await page.locator('#openInNewTab').check();
    // Native HTML drag gesture, including before/after insertion logic.
    const lastRow = page.locator('.engine-row').nth(3);
    const bounds = await lastRow.boundingBox();
    await page.locator('.drag-handle').first().dragTo(lastRow, { targetPosition: { x: 20, y: bounds.height - 4 } });
    assert.deepEqual(await names(page), ['小红书·自定义', '必应', '小红书', 'Google']);
    assert.equal((await saved(page)).searchEngines, undefined, 'draft edits should not be written before save');
    await save(page);
    assert.deepEqual((await saved(page)).searchEngines.map(engine => engine.name), await names(page));
    assert.equal((await saved(page)).settings.openInNewTab, true);

    // Keyboard sorting and reload preserve editable order across mixed builtin/custom rows.
    await page.locator('.drag-handle').last().focus();
    await page.keyboard.press('Alt+ArrowUp');
    assert.deepEqual(await names(page), ['小红书·自定义', '必应', 'Google', '小红书']);
    await save(page);
    await page.reload();
    await page.waitForFunction(() => !document.getElementById('saveSettings').disabled);
    assert.deepEqual(await names(page), ['小红书·自定义', '必应', 'Google', '小红书']);

    await page.locator('#addCustomSearch').click();
    await page.locator('#addManualSearch').click();
    assert.equal(await page.locator('.engine-row').count(), 5);
    await page.locator('[data-field="name"]').last().fill('不完整的配置');
    await page.locator('#saveSettings').click();
    assert.match(await page.locator('#saveStatus').textContent(), /请填写搜索网址/);
    assert.equal((await saved(page)).searchEngines.length, 4);
    await page.locator('[data-field="url"]').last().fill('javascript:alert("%s")');
    await page.locator('#saveSettings').click();
    assert.match(await page.locator('#saveStatus').textContent(), /https/);
    await page.locator('.remove-engine').last().click();

    // Storage failures keep the draft and show an explicit error.
    await page.locator('[data-field="name"]').first().fill('保存失败的草稿');
    await page.evaluate(() => {
        window.originalSet = chrome.storage.sync.set;
        chrome.storage.sync.set = async () => { throw new Error('QUOTA_BYTES exceeded'); };
    });
    await page.locator('#saveSettings').click();
    await page.waitForFunction(() => document.getElementById('saveStatus').textContent.includes('QUOTA_BYTES'));
    assert.equal((await saved(page)).searchEngines[0].name, '小红书·自定义');
    await page.evaluate(() => { chrome.storage.sync.set = window.originalSet; });
    await page.locator('[data-field="name"]').first().fill('小红书·自定义');
    await save(page);

    const invalid = { searchEngines: [{ name: 'bad', url: 'https://example.com?q=test' }], settings: {} };
    await page.locator('#importFile').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(invalid)) });
    await page.waitForFunction(() => document.getElementById('saveStatus').textContent.startsWith('导入失败'));
    assert.equal((await names(page))[0], '小红书·自定义');
    const original = await saved(page);
    const imported = { searchEngines: [{ name: '引擎 "<b>"', url: 'https://example.com/search/%s', enabled: true }], settings: {} };
    await page.locator('#importFile').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(imported)) });
    await page.waitForFunction(() => document.getElementById('saveStatus').textContent.startsWith('配置已导入'));
    assert.deepEqual(await names(page), ['引擎 "<b>"']);
    assert.equal((await saved(page)).searchEngines.length, 4, 'import should remain a draft');
    await save(page);
    const popup = await context.newPage();
    popup.on('pageerror', error => failures.push(error.message));
    await popup.goto(`chrome-extension://${id}/popup.html`);
    await popup.locator('.engine-name').waitFor();
    assert.equal(await popup.locator('.engine-name').textContent(), '引擎 "<b>"');
    assert.equal(await popup.locator('.engine-name b').count(), 0);
    await popup.close();

    // Restore custom list and fully restart the browser with the same profile.
    await page.locator('#importFile').setInputFiles({ name: 'original.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(original)) });
    await page.waitForFunction(() => document.getElementById('saveStatus').textContent.startsWith('配置已导入'));
    await save(page);
    await context.close();
    await launch();
    page = await options(id);
    assert.deepEqual(await names(page), ['小红书·自定义', '必应', 'Google', '小红书']);
    assert.equal((await saved(page)).settings.openInNewTab, true);
    // Existing menu IDs must be restored after browser restart. Disabled index 1 stays absent.
    await page.waitForFunction(async () => {
        try { await chrome.contextMenus.update('search-0', { enabled: true }); return true; }
        catch { return false; }
    });
    const menuState = await page.evaluate(async () => {
        const result = [];
        for (const index of [0, 1, 2, 3]) {
            try { await chrome.contextMenus.update(`search-${index}`, { enabled: true }); result.push(true); }
            catch { result.push(false); }
        }
        return result;
    });
    assert.deepEqual(menuState, [true, false, true, true]);
    const finalPopup = await context.newPage();
    await finalPopup.goto(`chrome-extension://${id}/popup.html`);
    await finalPopup.locator('.engine-name').first().waitFor();
    assert.deepEqual(await finalPopup.locator('.engine-name').allTextContents(), ['小红书·自定义', 'Google', '小红书']);
    assert.equal(failures.length, 0, failures.join('\n'));
    console.log('PASS: online catalog, search/category/batch add, deduplication, cache/offline fallback, manual add, drag/keyboard order, explicit save, validation, import, save failure, popup, responsive layout, browser restart and menu restoration');
    console.log(`Screenshots: ${output}`);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
    await context?.close();
    if (process.env.SCREENSHOT_DIR) fs.rmSync(profile, { recursive: true, force: true });
});
