// Shared configuration for the settings page, popup and service worker.
const SearchConfig = {
    defaultEngines() {
        return [
            { name: 'Google', url: 'https://www.google.com/search?q=%s', enabled: true, builtin: true },
            { name: '百度', url: 'https://www.baidu.com/s?wd=%s', enabled: true, builtin: true },
            { name: '必应', url: 'https://cn.bing.com/search?q=%s', enabled: true, builtin: true },
            { name: '小红书', url: 'https://www.xiaohongshu.com/search_result?keyword=%s&type=51', enabled: true, builtin: true }
        ];
    },

    defaultSettings() {
        return { openInNewTab: false, clickToSwitch: false, googleDirectAccess: true, autoSync: false };
    },

    async read() {
        const [data, local] = await Promise.all([
            chrome.storage.sync.get(['searchEngines', 'settings']),
            chrome.storage.local.get(['currentIndex'])
        ]);
        // Only a missing key means a fresh install; an empty list is intentional.
        const stored = data.searchEngines === undefined ? this.defaultEngines() : data.searchEngines;
        if (!Array.isArray(stored)) throw new Error('搜索引擎配置格式错误，请在设置中导入有效备份');
        // Older settings forms could save sparse arrays or completely blank slots.
        // Remove those placeholders in memory; never rewrite saved data on startup.
        const searchEngines = stored.filter(engine => engine != null).filter(engine => {
            if (typeof engine.name !== 'string' || typeof engine.url !== 'string') {
                throw new Error('搜索引擎配置格式错误，请在设置中导入有效备份');
            }
            return engine.name.trim() || engine.url.trim();
        });
        const count = searchEngines.filter(engine => engine.enabled && engine.name && engine.url).length;
        const index = Number.isInteger(local.currentIndex) ? local.currentIndex : 0;
        return {
            searchEngines,
            settings: { ...this.defaultSettings(), ...data.settings },
            currentIndex: count ? ((index % count) + count) % count : 0
        };
    },

    validate(engines) {
        if (!Array.isArray(engines)) throw new Error('搜索引擎列表格式不正确');
        return engines.flatMap((engine, index) => {
            const fail = message => {
                const error = new Error(`第 ${index + 1} 个搜索引擎：${message}`);
                error.engineIndex = index;
                throw error;
            };
            if (!engine || typeof engine.name !== 'string' || typeof engine.url !== 'string') {
                fail('名称和网址格式不正确');
            }
            const name = engine.name.trim();
            const url = engine.url.trim();
            if (!name && !url) return [];
            if (!name) fail('请填写名称');
            if (!url) fail('请填写搜索网址');
            if (!url.includes('%s')) fail('请用 %s 替换网址中的搜索关键词');
            let parsed;
            try { parsed = new URL(url); } catch { fail('请填写有效的搜索网址'); }
            if (!['http:', 'https:'].includes(parsed.protocol)) fail('网址须以 https:// 或 http:// 开头');
            if (parsed.username || parsed.password) fail('搜索网址不能包含账号或密码');
            return [{ ...engine, name, url, enabled: Boolean(engine.enabled) }];
        });
    },

    searchUrl(engine, query) {
        const url = engine.url.replace(/%s/g, encodeURIComponent(query));
        if (!['http:', 'https:'].includes(new URL(url).protocol)) throw new Error('搜索网址无效');
        return url;
    }
};
