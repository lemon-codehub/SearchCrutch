const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const bundled = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/search-engines.json'), 'utf8'));
const custom = { version: 1, engines: [{ id: 'remote', name: '服务器搜索', url: 'https://example.com/search/%s', category: '开发' }] };
const remoteUrl = 'https://lemontree.one/static/json/search-engines.json';
const localUrl = 'chrome-extension://test/data/search-engines.json';

function catalog({ remote = custom, status = 200, cached, cacheError = false, fastTimeout = false } = {}) {
    const calls = [];
    const writes = [];
    const context = vm.createContext({
        URL, AbortController,
        setTimeout: fastTimeout ? fn => setTimeout(fn, 0) : setTimeout,
        clearTimeout, console: { warn() {} },
        chrome: {
            runtime: { getManifest: () => ({ homepage_url: 'https://lemontree.one/docs/quicksearch/' }), getURL: () => localUrl },
            storage: { local: {
                async get() { return { engineCatalogCache: cached }; },
                async set(data) { if (cacheError) throw new Error('cache unavailable'); writes.push(data); }
            } }
        },
        fetch: async (url, options) => {
            calls.push({ url, options });
            if (url === localUrl) return { ok: true, json: async () => bundled };
            if (fastTimeout) return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted'))));
            return { ok: status === 200, status, json: async () => remote };
        }
    });
    for (const name of ['config.js', 'catalog.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/js', name), 'utf8'), context);
    return { api: vm.runInContext('SearchCatalog', context), calls, writes };
}

test('remote JSON supplies the selectable list and only writes a separate local cache', async () => {
    const c = catalog();
    const result = await c.api.load();
    assert.equal(result.source, 'online');
    assert.equal(result.engines[0].name, '服务器搜索');
    assert.equal(c.calls[0].url, remoteUrl);
    assert.equal(c.calls[0].options.credentials, 'omit');
    assert.deepEqual(Object.keys(c.writes[0]), ['engineCatalogCache']);
});

test('online result remains usable when cache storage fails', async () => {
    const c = catalog({ cacheError: true });
    assert.equal((await c.api.load()).source, 'online');
});

test('HTTP failure uses the last valid cache without falling back to defaults', async () => {
    const c = catalog({ status: 503, cached: custom });
    const result = await c.api.load();
    assert.equal(result.source, 'cache');
    assert.equal(result.engines[0].name, '服务器搜索');
    assert.equal(c.calls.length, 1);
});

test('offline with no valid cache uses the packaged JSON', async () => {
    const c = catalog({ status: 404, cached: { version: 1, engines: [{}] } });
    const result = await c.api.load();
    assert.equal(result.source, 'builtin');
    assert.equal(result.engines.length, bundled.engines.length);
    assert.equal(c.calls[1].url, localUrl);
});

test('malformed remote JSON uses a valid cache', async () => {
    const c = catalog({ remote: { invalid: true }, cached: custom });
    assert.equal((await c.api.load()).source, 'cache');
});

test('timeout aborts the remote request and uses the packaged list', async () => {
    const c = catalog({ fastTimeout: true });
    assert.equal((await c.api.load()).source, 'builtin');
    assert.equal(c.calls[0].options.signal.aborted, true);
});

test('catalog validates IDs, URLs, placeholders, duplicate URLs and schema version', () => {
    const { api } = catalog();
    for (const invalid of [
        { version: 2, engines: custom.engines },
        { version: 1, engines: [] },
        { version: 1, engines: [...custom.engines, ...custom.engines] },
        { version: 1, engines: [custom.engines[0], { ...custom.engines[0], id: 'another' }] },
        { version: 1, engines: [{ id: 'bad', name: '不安全', url: 'javascript:alert("%s")' }] },
        { version: 1, engines: [{ id: 'bad', name: '无关键词', url: 'https://example.com?q=hello' }] }
    ]) assert.throws(() => api.validate(invalid));
    assert.equal(api.validate({ version: 1, engines: [{ ...custom.engines[0], category: undefined }] })[0].category, '其他');
    assert.equal(api.validate(bundled).length, 15);
});

test('duplicate URL keys normalize hostnames while preserving distinct search templates', () => {
    const { api } = catalog();
    assert.equal(api.urlKey(' HTTPS://EXAMPLE.COM/search?q=%s '), api.urlKey('https://example.com/search?q=%s'));
    assert.notEqual(api.urlKey('https://example.com/search?q=%s'), api.urlKey('https://example.com/other?q=%s'));
});
