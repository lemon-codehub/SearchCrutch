const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = name => fs.readFileSync(path.join(__dirname, '../src/js', name), 'utf8');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const copy = data => JSON.parse(JSON.stringify(data));
const event = () => ({ listeners: [], addListener(fn) { this.listeners.push(fn); } });
const engines = [
    { name: '小红书', url: 'https://www.xiaohongshu.com/search_result?keyword=%s&type=51', enabled: true },
    { name: '百度', url: 'https://www.baidu.com/s?wd=%s', enabled: false },
    { name: '自定义', url: 'https://example.com/search/%s?source=menu', enabled: true }
];

function worker(data = { searchEngines: engines }, menus = new Map(), options = {}) {
    const writes = [];
    const tabs = [];
    const errors = [];
    const chrome = {
        runtime: { onInstalled: event(), onStartup: event(), onMessage: event(), lastError: null },
        storage: {
            sync: {
                async get() { await sleep(15); if (options.readError) throw new Error('storage unavailable'); return copy(data); },
                async set(value) { writes.push(value); Object.assign(data, copy(value)); }
            },
            local: { async get() { return { currentIndex: 99 }; }, async set(value) { writes.push(value); } },
            onChanged: event()
        },
        contextMenus: {
            onClicked: event(),
            removeAll(cb) { setTimeout(() => { menus.clear(); cb(); }, 3); },
            create(properties, cb) {
                setTimeout(() => {
                    if (menus.has(properties.id)) errors.push('Duplicate menu ID');
                    menus.set(properties.id, properties);
                    cb();
                }, 3);
                return properties.id;
            }
        },
        commands: { onCommand: event() },
        tabs: { async create(tab) { tabs.push(tab); }, async query() { return [{ id: 7 }]; }, async update(id, tab) { tabs.push({ id, ...tab }); } }
    };
    const context = vm.createContext({ chrome, URL, console: { error: (...args) => errors.push(args) } });
    context.importScripts = name => vm.runInContext(source(name), context);
    vm.runInContext(source('background.js'), context);
    return {
        context, chrome, menus, writes, tabs, errors, data,
        idle: () => vm.runInContext('menuQueue', context),
        config: () => vm.runInContext('SearchConfig', context),
        message: request => new Promise(resolve => chrome.runtime.onMessage.listeners[0](request, {}, resolve))
    };
}

const titles = w => [...w.menus.values()].map(menu => menu.title);

test('startup waits for stored custom engines, builds in saved order and never writes defaults', async () => {
    const w = worker();
    for (const listener of w.chrome.runtime.onStartup.listeners) listener();
    assert.equal(w.menus.size, 0);
    await w.idle();
    assert.deepEqual(titles(w), ['便捷搜索', '小红书', '自定义']);
    assert.deepEqual([...w.menus.keys()], ['search-selection', 'search-0', 'search-2']);
    assert.equal(w.writes.length, 0);
    assert.equal(w.errors.length, 0);
});

test('a fresh worker after suspension restores custom menus without a startup event', async () => {
    const first = worker();
    await first.idle();
    const resumed = worker(first.data, first.menus);
    await resumed.idle();
    await resumed.chrome.contextMenus.onClicked.listeners[0]({ menuItemId: 'search-0', selectionText: '猫 & dog' });
    await sleep(30);
    assert.equal(resumed.tabs[0].url, 'https://www.xiaohongshu.com/search_result?keyword=%E7%8C%AB%20%26%20dog&type=51');
    assert.equal(resumed.writes.length, 0);
    assert.equal(resumed.errors.length, 0);
});

test('rapid save/reorder events serialize menu removal and creation using the latest storage', async () => {
    const w = worker();
    await w.idle();
    w.data.searchEngines = [engines[2], engines[0], engines[1]];
    for (let i = 0; i < 4; i++) {
        w.chrome.storage.onChanged.listeners[0]({ searchEngines: { newValue: w.data.searchEngines } }, 'sync');
    }
    const response = await w.message({ action: 'refreshContextMenus' });
    assert.equal(response.success, true);
    assert.deepEqual(titles(w), ['便捷搜索', '自定义', '小红书']);
    assert.equal(w.errors.length, 0);
});

test('an intentionally empty or disabled list never falls back to default engines', async () => {
    for (const list of [[], engines.map(engine => ({ ...engine, enabled: false }))]) {
        const w = worker({ searchEngines: list });
        await w.idle();
        assert.equal(w.menus.size, 0);
        assert.equal((await w.message({ action: 'getSearchEngines' })).searchEngines.length, list.length);
        assert.equal((await w.message({ action: 'switchEngine' })).success, false);
    }
});

test('storage failure preserves existing menus and surfaces an error rather than loading defaults', async () => {
    const menus = new Map([['existing', { title: '自定义' }]]);
    const w = worker({}, menus, { readError: true });
    await w.idle();
    assert.deepEqual(titles(w), ['自定义']);
    assert.equal(w.writes.length, 0);
    const response = await w.message({ action: 'getSearchEngines' });
    assert.equal(response.success, false);
    assert.match(response.error, /storage unavailable/);
});

test('fresh install gets common defaults without overwriting storage during initialization', async () => {
    const w = worker({});
    await w.idle();
    assert.deepEqual(titles(w), ['便捷搜索', 'Google', '百度', '必应', '小红书']);
    assert.equal(w.writes.length, 0);
});

test('right-click respects disabled engines and only accepts exact child menu IDs', async () => {
    const w = worker();
    await w.idle();
    for (const id of ['search-selection', 'search-1', 'search-2junk']) {
        w.chrome.contextMenus.onClicked.listeners[0]({ menuItemId: id, selectionText: 'test' });
    }
    await sleep(30);
    assert.equal(w.tabs.length, 0);
});

test('popup search uses complete ordered list and preserves open-in-new-tab preference', async () => {
    const w = worker({ searchEngines: engines, settings: { openInNewTab: true } });
    await w.idle();
    assert.equal((await w.message({ action: 'search', index: 2, query: 'a+b 中文' })).success, true);
    assert.equal(w.tabs[0].url, 'https://example.com/search/a%2Bb%20%E4%B8%AD%E6%96%87?source=menu');
    assert.equal((await w.message({ action: 'search', index: 1, query: 'test' })).success, false);
    w.data.settings.openInNewTab = false;
    await w.message({ action: 'search', index: 0, query: 'test' });
    assert.equal(w.tabs[1].id, 7);
});

test('validation rejects invalid and partial rows without changing data, preserves order, and removes blank drafts', async () => {
    const w = worker();
    await w.idle();
    const config = w.config();
    for (const row of [
        { name: 'partial', url: '' },
        { name: '', url: 'https://example.com?q=%s' },
        { name: 'missing placeholder', url: 'https://example.com?q=test' },
        { name: 'invalid', url: 'javascript:alert("%s")' }
    ]) {
        assert.throws(() => config.validate([row]), /第 1 个搜索引擎/);
    }
    const input = [engines[2], { name: '', url: '', enabled: true }, engines[0]];
    const before = JSON.stringify(input);
    assert.deepEqual(Array.from(config.validate(input), engine => engine.name), ['自定义', '小红书']);
    assert.equal(JSON.stringify(input), before);
    assert.equal(config.searchUrl({ url: 'https://example.com/%s?q=%s' }, 'a b'), 'https://example.com/a%20b?q=a%20b');
});


test('legacy sparse arrays and blank form slots restore valid custom engines without rewriting storage', async () => {
    const stored = [engines[0], null, { name: '', url: '', enabled: false }, engines[2]];
    const w = worker({ searchEngines: stored });
    await w.idle();
    assert.deepEqual(titles(w), ['便捷搜索', '小红书', '自定义']);
    assert.deepEqual(Array.from((await w.message({ action: 'getSearchEngines' })).searchEngines, engine => engine.name), ['小红书', '自定义']);
    assert.equal(w.data.searchEngines.length, 4);
    assert.equal(w.writes.length, 0);
});
