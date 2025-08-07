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

// 加载设置
async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get(['searchEngines', 'settings']);
    searchEngines = result.searchEngines || getDefaultSearchEngines();
    settings = result.settings || getDefaultSettings();
    await saveSettings();
  } catch (error) {
    console.error('加载设置失败:', error);
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
      title: '搜索选中文本',
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
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId.startsWith('search-')) {
    const index = parseInt(info.menuItemId.replace('search-', ''));
    if (index >= 0 && index < searchEngines.length) {
      const engine = searchEngines[index];
      const searchUrl = engine.url.replace('%s', encodeURIComponent(info.selectionText));
      
      if (settings.openInNewTab) {
        chrome.tabs.create({ url: searchUrl });
      } else {
        chrome.tabs.update(tab.id, { url: searchUrl });
      }
    }
  }
});

// 处理快捷键
chrome.commands.onCommand.addListener((command) => {
  if (command === 'switch-pre') {
    switchToPreviousEngine();
  } else if (command === 'switch-next') {
    switchToNextEngine();
  }
});

// 切换到上一个搜索引擎
function switchToPreviousEngine() {
  const enabledEngines = searchEngines.filter(engine => engine.enabled);
  if (enabledEngines.length > 0) {
    currentIndex = (currentIndex - 1 + enabledEngines.length) % enabledEngines.length;
    chrome.storage.local.set({ currentIndex });
  }
}

// 切换到下一个搜索引擎
function switchToNextEngine() {
  const enabledEngines = searchEngines.filter(engine => engine.enabled);
  if (enabledEngines.length > 0) {
    currentIndex = (currentIndex + 1) % enabledEngines.length;
    chrome.storage.local.set({ currentIndex });
  }
}

// 处理来自popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSearchEngines') {
    sendResponse({ searchEngines, currentIndex });
  } else if (request.action === 'switchEngine') {
    const enabledEngines = searchEngines.filter(engine => engine.enabled);
    if (enabledEngines.length > 0) {
      currentIndex = (currentIndex + 1) % enabledEngines.length;
      chrome.storage.local.set({ currentIndex });
      sendResponse({ success: true, currentIndex });
    }
  } else if (request.action === 'search') {
    const enabledEngines = searchEngines.filter(engine => engine.enabled);
    const engine = enabledEngines[request.index];
    if (engine && request.query) {
      const searchUrl = engine.url.replace('%s', encodeURIComponent(request.query));
      
      if (settings.openInNewTab) {
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
      sendResponse({ success: false, error: '无效的搜索引擎或搜索关键词' });
    }
  }
  return true;
});

// 监听存储变化
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync') {
    if (changes.searchEngines) {
      searchEngines = changes.searchEngines.newValue;
      createContextMenus();
    }
    if (changes.settings) {
      settings = changes.settings.newValue;
    }
  }
});


