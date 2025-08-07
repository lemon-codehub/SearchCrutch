// Popup 页面逻辑
class PopupManager {
    constructor() {
        this.searchEngines = [];
        this.currentIndex = 0;
        this.init();
    }

    async init() {
        try {
            await this.loadData();
            this.renderSearchEngines();
            this.bindEvents();
        } catch (error) {
            this.showError('加载数据失败: ' + error.message);
        }
    }

    async loadData() {
        const result = await chrome.storage.sync.get(['searchEngines']);
        this.searchEngines = result.searchEngines || this.getDefaultSearchEngines();
        
        const localResult = await chrome.storage.local.get(['currentIndex']);
        this.currentIndex = localResult.currentIndex || 0;
    }

    getDefaultSearchEngines() {
        return [
            { name: 'Google', url: 'https://www.google.com/search?q=%s', enabled: true },
            { name: '百度', url: 'https://www.baidu.com/s?wd=%s', enabled: true },
            { name: '必应', url: 'https://cn.bing.com/search?q=%s', enabled: true },
            { name: '搜狗', url: 'https://www.sogou.com/web?query=%s', enabled: true }
        ];
    }

    renderSearchEngines() {
        const container = document.getElementById('searchEngines');
        const enabledEngines = this.searchEngines.filter(engine => engine.enabled);
        
        if (enabledEngines.length === 0) {
            container.innerHTML = '<div class="error">没有启用的搜索引擎，请在设置中启用</div>';
            return;
        }

        container.innerHTML = enabledEngines.map((engine, index) => {
            const isCurrent = index === this.currentIndex;
            return `
                <a href="#" class="engine-item ${isCurrent ? 'current' : ''}" 
                   data-index="${index}">
                    <span class="engine-name">${engine.name}</span>
                    <span class="engine-status">${isCurrent ? '当前' : '点击切换'}</span>
                </a>
            `;
        }).join('');
    }

    async switchEngine(index) {
        const enabledEngines = this.searchEngines.filter(engine => engine.enabled);
        if (index >= 0 && index < enabledEngines.length) {
            this.currentIndex = index;
            await chrome.storage.local.set({ currentIndex: index });
            this.renderSearchEngines();
            
            // 获取当前页面的搜索关键词并执行搜索
            await this.performSearch(index);
        }
    }

    async performSearch(engineIndex) {
        try {
            // 获取当前活动标签页
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) return;

            // 从当前页面URL中提取搜索关键词
            const searchQuery = this.extractSearchQuery(tab.url);
            if (!searchQuery) {
                console.log('无法从当前页面提取搜索关键词');
                return;
            }

            // 发送搜索请求到background script
            chrome.runtime.sendMessage({
                action: 'search',
                index: engineIndex,
                query: searchQuery
            });
        } catch (error) {
            console.error('执行搜索失败:', error);
        }
    }

    extractSearchQuery(url) {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.toLowerCase();
            
            // 根据不同搜索引擎提取搜索关键词
            if (hostname.includes('google')) {
                return urlObj.searchParams.get('q');
            } else if (hostname.includes('baidu')) {
                return urlObj.searchParams.get('wd');
            } else if (hostname.includes('bing')) {
                return urlObj.searchParams.get('q');
            } else if (hostname.includes('sogou')) {
                return urlObj.searchParams.get('query');
            } else if (hostname.includes('yahoo')) {
                return urlObj.searchParams.get('p');
            } else if (hostname.includes('duckduckgo')) {
                return urlObj.searchParams.get('q');
            } else if (hostname.includes('yandex')) {
                return urlObj.searchParams.get('text');
            } else {
                // 通用方法：尝试常见的搜索参数
                const commonParams = ['q', 'query', 'search', 'keyword', 'term'];
                for (const param of commonParams) {
                    const value = urlObj.searchParams.get(param);
                    if (value) return value;
                }
            }
            
            return null;
        } catch (error) {
            console.error('解析URL失败:', error);
            return null;
        }
    }

    bindEvents() {
        // 为搜索引擎项绑定点击事件
        document.addEventListener('click', (e) => {
            if (e.target.closest('.engine-item')) {
                e.preventDefault();
                const index = parseInt(e.target.closest('.engine-item').dataset.index);
                this.switchEngine(index);
            }
        });

        // 监听来自background的消息
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'updateCurrentIndex') {
                this.currentIndex = request.currentIndex;
                this.renderSearchEngines();
            }
        });
    }

    showError(message) {
        const container = document.getElementById('searchEngines');
        container.innerHTML = `<div class="error">${message}</div>`;
    }
}

// 初始化popup管理器
let popupManager;
document.addEventListener('DOMContentLoaded', () => {
    popupManager = new PopupManager();
});