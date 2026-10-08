// This file only reads catalog data. It never changes the user's saved engines.
const SearchCatalog = {
    endpoint() {
        return 'https://lemontree.one/static/json/search-engines.json';
    },

    validate(data) {
        if (!data || data.version !== 1 || !Array.isArray(data.engines) || !data.engines.length) {
            throw new Error('搜索引擎列表格式不正确');
        }
        const ids = new Set();
        const urls = new Set();
        return data.engines.map(engine => {
            if (!engine || typeof engine.id !== 'string' || !engine.id.trim() || ids.has(engine.id)) {
                throw new Error('搜索引擎标识缺失或重复');
            }
            const [validated] = SearchConfig.validate([engine]);
            if (!validated) throw new Error('搜索引擎名称与网址不能为空');
            const url = new URL(validated.url).href;
            if (urls.has(url)) throw new Error('搜索引擎网址重复');
            ids.add(engine.id);
            urls.add(url);
            return {
                id: engine.id,
                name: validated.name,
                url: validated.url,
                category: typeof engine.category === 'string' && engine.category.trim() ? engine.category.trim() : '其他'
            };
        });
    },

    async fetchList(url) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        try {
            const response = await fetch(url, { signal: controller.signal, cache: 'no-cache', credentials: 'omit' });
            if (!response.ok) throw new Error(`查询失败（HTTP ${response.status}）`);
            return this.validate(await response.json());
        } finally {
            clearTimeout(timeout);
        }
    },

    async load() {
        try {
            const engines = await this.fetchList(this.endpoint());
            // Caching is optional: a local storage error must not hide a valid remote list.
            try { await chrome.storage.local.set({ engineCatalogCache: { version: 1, engines } }); }
            catch (error) { console.warn('缓存搜索引擎列表失败:', error); }
            return { engines, source: 'online' };
        } catch (error) {
            console.warn('查询在线搜索引擎列表失败:', error);
            try {
                const cache = await chrome.storage.local.get(['engineCatalogCache']);
                if (cache.engineCatalogCache) return { engines: this.validate(cache.engineCatalogCache), source: 'cache' };
            } catch (cacheError) { console.warn('读取搜索引擎缓存失败:', cacheError); }
            const engines = await this.fetchList(chrome.runtime.getURL('data/search-engines.json'));
            return { engines, source: 'builtin' };
        }
    },

    urlKey(url) {
        try { return new URL(url.trim()).href; } catch { return url.trim(); }
    }
};
