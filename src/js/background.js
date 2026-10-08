// Chrome MV3 workers lose their globals when suspended. Always read persisted state.
importScripts('config.js');

let menuQueue = Promise.resolve();

function createMenu(properties) {
    return new Promise((resolve, reject) => {
        chrome.contextMenus.create(properties, () => {
            const error = chrome.runtime.lastError;
            if (error) reject(new Error(error.message));
            else resolve();
        });
    });
}

function removeMenus() {
    return new Promise((resolve, reject) => {
        chrome.contextMenus.removeAll(() => {
            const error = chrome.runtime.lastError;
            if (error) reject(new Error(error.message));
            else resolve();
        });
    });
}

function rebuildContextMenus() {
    // Serialize startup, save and sync changes to prevent overlapping remove/create calls.
    const next = menuQueue.then(async () => {
        const state = await SearchConfig.read();
        await removeMenus();
        const enabled = state.searchEngines.filter(engine => engine && engine.enabled && engine.name && engine.url);
        if (!enabled.length) return;
        await createMenu({ id: 'search-selection', title: '便捷搜索', contexts: ['selection'] });
        for (const [index, engine] of state.searchEngines.entries()) {
            if (!enabled.includes(engine)) continue;
            await createMenu({
                id: `search-${index}`, title: engine.name,
                contexts: ['selection'], parentId: 'search-selection'
            });
        }
    });
    menuQueue = next.catch(error => console.error('恢复右键菜单失败:', error));
    return next;
}

function restoreMenus() {
    // Errors are logged by the queue. Do not replace stored settings with defaults.
    void rebuildContextMenus().catch(() => {});
}

chrome.runtime.onInstalled.addListener(restoreMenus);
chrome.runtime.onStartup.addListener(restoreMenus);

chrome.contextMenus.onClicked.addListener((info) => {
    void (async () => {
        const match = /^search-(\d+)$/.exec(String(info.menuItemId));
        if (!match || !info.selectionText) return;
        const state = await SearchConfig.read();
        const engine = state.searchEngines[Number(match[1])];
        if (!engine || !engine.enabled) return;
        await chrome.tabs.create({ url: SearchConfig.searchUrl(engine, info.selectionText) });
    })().catch(error => console.error('右键搜索失败:', error));
});

async function switchEngine(direction) {
    const state = await SearchConfig.read();
    const count = state.searchEngines.filter(engine => engine.enabled && engine.name && engine.url).length;
    if (!count) return { success: false, error: '没有启用的搜索引擎' };
    const currentIndex = (state.currentIndex + direction + count) % count;
    await chrome.storage.local.set({ currentIndex });
    return { success: true, currentIndex };
}

chrome.commands.onCommand.addListener(command => {
    if (!['switch-pre', 'switch-next'].includes(command)) return;
    void switchEngine(command === 'switch-pre' ? -1 : 1)
        .catch(error => console.error('切换搜索引擎失败:', error));
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (!['getSearchEngines', 'switchEngine', 'search', 'refreshContextMenus'].includes(request.action)) return;
    (async () => {
        if (request.action === 'refreshContextMenus') {
            await rebuildContextMenus();
            return { success: true };
        }
        if (request.action === 'switchEngine') return switchEngine(1);
        const state = await SearchConfig.read();
        if (request.action === 'getSearchEngines') {
            return { searchEngines: state.searchEngines, currentIndex: state.currentIndex };
        }
        const engine = Number.isInteger(request.index) ? state.searchEngines[request.index] : null;
        if (!engine || !engine.enabled || typeof request.query !== 'string' || !request.query.trim()) {
            return { success: false, error: '请选择已启用的搜索引擎并输入关键词' };
        }
        const url = SearchConfig.searchUrl(engine, request.query);
        if (state.settings.openInNewTab) {
            await chrome.tabs.create({ url });
        } else {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) throw new Error('找不到当前标签页');
            await chrome.tabs.update(tab.id, { url });
        }
        return { success: true };
    })().then(sendResponse, error => sendResponse({ success: false, error: error.message }));
    return true;
});

chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && changes.searchEngines) restoreMenus();
});

// Also restore on an ordinary worker wakeup, not just browser startup/install.
restoreMenus();
