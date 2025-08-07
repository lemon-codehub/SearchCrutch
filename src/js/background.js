// Chrome v3 Service Worker
let currentIndex = 0;
let searchEngines = [];
let settings = {};

// 初始化
chrome.runtime.onInstalled.addListener(() => {
  console.log('便捷搜索插件已安装');
  loadSettings();
  createContextMenus();
});

// 每次Service Worker启动时也加载设置
chrome.runtime.onStartup.addListener(() => {
  console.log('Service Worker启动');
  loadSettings();
  createContextMenus();
});

// 加载设置
async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get(['searchEngines', 'settings']);
    searchEngines = result.searchEngines || getDefaultSearchEngines();
    settings = result.settings || getDefaultSettings();
    await saveSettings();
    
    // 加载当前索引
    const localResult = await chrome.storage.local.get(['currentIndex']);
    currentIndex = localResult.currentIndex || 0;
    
    console.log('Background加载设置:', {
      searchEngines: searchEngines,
      currentIndex: currentIndex,
      settings: settings
    });
  } catch (error) {
    console.error('加载设置失败:', error);
  }
}

// 获取最新状态（每次处理消息时调用）
async function getLatestState() {
  try {
    const result = await chrome.storage.sync.get(['searchEngines', 'settings']);
    const localResult = await chrome.storage.local.get(['currentIndex']);
    
    return {
      searchEngines: result.searchEngines || getDefaultSearchEngines(),
      settings: result.settings || getDefaultSettings(),
      currentIndex: localResult.currentIndex || 0
    };
  } catch (error) {
    console.error('获取最新状态失败:', error);
    return {
      searchEngines: getDefaultSearchEngines(),
      settings: getDefaultSettings(),
      currentIndex: 0
    };
  }
}

// 获取默认搜索引擎
function getDefaultSearchEngines() {
  return [
    { name: 'Google', url: 'https://www.google.com/search?q=%s', enabled: true },
    { name: '百度', url: 'https://www.baidu.com/s?wd=%s', enabled: true },
    { name: '必应', url: 'https://cn.bing.com/search?q=%s', enabled: true },
    { name: '搜狗', url: 'https://www.sogou.com/web?query=%s', enabled: true }
  ];
}

// 获取默认设置
function getDefaultSettings() {
  return {
    openInNewTab: true,
    clickToSwitch: false,
    autoSync: false
  };
}

// 保存设置
async function saveSettings() {
  try {
    await chrome.storage.sync.set({
      searchEngines: searchEngines,
      settings: settings
    });
  } catch (error) {
    console.error('保存设置失败:', error);
  }
}

// 创建右键菜单
function createContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'search-selection',
      title: '便捷搜索',
      contexts: ['selection']
    });
    
    // 为每个启用的搜索引擎创建菜单
    searchEngines.forEach((engine, index) => {
      if (engine.enabled) {
        chrome.contextMenus.create({
          id: `search-${index}`,
          title: `用${engine.name}搜索`,
          contexts: ['selection'],
          parentId: 'search-selection'
        });
      }
    });
  });
}

// 处理右键菜单点击
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const state = await getLatestState();
  
  if (info.menuItemId.startsWith('search-')) {
    const index = parseInt(info.menuItemId.replace('search-', ''));
    if (index >= 0 && index < state.searchEngines.length) {
      const engine = state.searchEngines[index];
      const searchUrl = engine.url.replace('%s', encodeURIComponent(info.selectionText));
      
      if (state.settings.openInNewTab) {
        chrome.tabs.create({ url: searchUrl });
      } else {
        chrome.tabs.update(tab.id, { url: searchUrl });
      }
    }
  }
});

// 处理快捷键
chrome.commands.onCommand.addListener(async (command) => {
  const state = await getLatestState();
  
  if (command === 'switch-pre') {
    await switchToPreviousEngine(state);
  } else if (command === 'switch-next') {
    await switchToNextEngine(state);
  }
});

// 切换到上一个搜索引擎
async function switchToPreviousEngine(state) {
  const enabledEngines = state.searchEngines.filter(engine => engine.enabled);
  if (enabledEngines.length > 0) {
    const newIndex = (state.currentIndex - 1 + enabledEngines.length) % enabledEngines.length;
    await chrome.storage.local.set({ currentIndex: newIndex });
    console.log('切换到上一个搜索引擎:', newIndex);
  }
}

// 切换到下一个搜索引擎
async function switchToNextEngine(state) {
  const enabledEngines = state.searchEngines.filter(engine => engine.enabled);
  if (enabledEngines.length > 0) {
    const newIndex = (state.currentIndex + 1) % enabledEngines.length;
    await chrome.storage.local.set({ currentIndex: newIndex });
    console.log('切换到下一个搜索引擎:', newIndex);
  }
}

// 处理来自popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background收到消息:', request);
  
  // 使用Promise处理异步操作
  (async () => {
    try {
      // 每次处理消息时都获取最新状态
      const state = await getLatestState();
      
      if (request.action === 'getSearchEngines') {
        sendResponse({ 
          searchEngines: state.searchEngines, 
          currentIndex: state.currentIndex 
        });
      } else if (request.action === 'switchEngine') {
        const enabledEngines = state.searchEngines.filter(engine => engine.enabled);
        if (enabledEngines.length > 0) {
          const newIndex = (state.currentIndex + 1) % enabledEngines.length;
          await chrome.storage.local.set({ currentIndex: newIndex });
          sendResponse({ success: true, currentIndex: newIndex });
        }
      } else if (request.action === 'search') {
        // 修复：直接使用request.index作为在完整搜索引擎数组中的索引
        const engine = state.searchEngines[request.index];
        
        console.log('执行搜索:', {
          requestedIndex: request.index,
          totalEnginesCount: state.searchEngines.length,
          engine: engine,
          query: request.query,
          allEngines: state.searchEngines.map((e, i) => ({ index: i, name: e.name, enabled: e.enabled }))
        });
        
        if (engine && engine.enabled && request.query) {
          const searchUrl = engine.url.replace('%s', encodeURIComponent(request.query));
          
          if (state.settings.openInNewTab) {
            chrome.tabs.create({ url: searchUrl });
          } else {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
              if (tabs[0]) {
                chrome.tabs.update(tabs[0].id, { url: searchUrl });
              }
            });
          }
          sendResponse({ success: true });
        } else {
          console.error('搜索失败:', {
            engine: engine,
            engineEnabled: engine?.enabled,
            query: request.query,
            index: request.index
          });
          sendResponse({ 
            success: false, 
            error: engine ? (engine.enabled ? '无效的搜索关键词' : '搜索引擎已禁用') : '无效的搜索引擎索引' 
          });
        }
      }
    } catch (error) {
      console.error('处理消息失败:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();
  
  return true; // 保持消息通道开放
});

// 监听存储变化
chrome.storage.onChanged.addListener((changes, namespace) => {
  console.log('Background存储变化:', { changes, namespace });
  
  if (namespace === 'sync') {
    if (changes.searchEngines) {
      searchEngines = changes.searchEngines.newValue;
      createContextMenus();
    }
    if (changes.settings) {
      settings = changes.settings.newValue;
    }
  }
  
  if (namespace === 'local' && changes.currentIndex) {
    currentIndex = changes.currentIndex.newValue;
    console.log('当前索引更新:', currentIndex);
  }
});


