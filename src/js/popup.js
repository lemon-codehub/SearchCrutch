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
        try {
            const result = await chrome.storage.sync.get(['searchEngines']);
            this.searchEngines = result.searchEngines || this.getDefaultSearchEngines();
            
            const localResult = await chrome.storage.local.get(['currentIndex']);
            this.currentIndex = localResult.currentIndex || 0;
            
            console.log('加载数据:', {
                searchEngines: this.searchEngines,
                currentIndex: this.currentIndex,
                enabledEngines: this.searchEngines.filter(e => e.enabled)
            });
        } catch (error) {
            console.error('加载数据失败:', error);
            throw error;
        }
    }

    // 获取最新数据（每次操作时调用）
    async getLatestData() {
        try {
            const result = await chrome.storage.sync.get(['searchEngines']);
            const localResult = await chrome.storage.local.get(['currentIndex']);
            
            return {
                searchEngines: result.searchEngines || this.getDefaultSearchEngines(),
                currentIndex: localResult.currentIndex || 0
            };
        } catch (error) {
            console.error('获取最新数据失败:', error);
            return {
                searchEngines: this.getDefaultSearchEngines(),
                currentIndex: 0
            };
        }
    }

    getDefaultSearchEngines() {
        return [
            { name: 'Google', url: 'https://www.google.com/search?q=%s', enabled: true },
            { name: '百度', url: 'https://www.baidu.com/s?wd=%s', enabled: true },
            { name: '必应', url: 'https://cn.bing.com/search?q=%s', enabled: true },
            { name: '小红书', url: 'https://www.xiaohongshu.com/search_result?keyword=%s&type=51', enabled: true }
        ];
    }

    // 获取搜索引擎的favicon URL
    getFaviconUrl(engine) {
        try {
            const url = new URL(engine.url);
            if(engine.url.includes('search.bilibili.com')){
                return 'https://www.bilibili.com/favicon.ico';
            }else if(engine.url.includes('s.taobao.com')){
                return 'https://www.taobao.com/favicon.ico';
            }else{
                return `${url.protocol}//${url.hostname}/favicon.ico`;
            }
        } catch (error) {
            console.error('解析URL失败:', error);
            return null;
        }
    }

    // 获取备用图标（当favicon加载失败时使用）
    getFallbackIcon(engine) {
        const iconMap = {
            'Google': '🔍',
            '百度': '🔎',
            '必应': '🔍',
            '搜狗': '🔍',
            '知乎': '💡',
            '微博': '📱',
            '微信': '💬',
            '淘宝': '🛒',
            '京东': '🛒',
            '天猫': '🛍️',
            '亚马逊': '📦',
            'YouTube': '📺',
            'B站': '',
            'GitHub': '💻',
            'Stack Overflow': '💻',
            '维基百科': '📚',
            '豆瓣': '📖'
        };

        // 根据名称匹配图标
        for (const [name, icon] of Object.entries(iconMap)) {
            if (engine.name.includes(name)) {
                return icon;
            }
        }

        // 根据URL域名匹配图标
        try {
            const url = new URL(engine.url);
            const hostname = url.hostname.toLowerCase();
            
            if (hostname.includes('zhihu')) return '';
            if (hostname.includes('weibo')) return '';
            if (hostname.includes('wechat') || hostname.includes('wx')) return '';
            if (hostname.includes('taobao')) return '';
            if (hostname.includes('jd.com')) return '';
            if (hostname.includes('tmall')) return '🛍️';
            if (hostname.includes('amazon')) return '';
            if (hostname.includes('youtube')) return '';
            if (hostname.includes('bilibili')) return '';
            if (hostname.includes('github')) return '';
            if (hostname.includes('stackoverflow')) return '';
            if (hostname.includes('wikipedia')) return '';
            if (hostname.includes('douban')) return '📖';
        } catch (error) {
            console.error('解析URL失败:', error);
        }

        // 默认图标
        return '🔍';
    }

    renderSearchEngines() {
        const container = document.getElementById('searchEngines');
        const enabledEngines = this.searchEngines.filter(engine => engine.enabled);
        
        console.log('渲染搜索引擎:', {
            total: this.searchEngines.length,
            enabled: enabledEngines.length,
            currentIndex: this.currentIndex
        });
        
        if (enabledEngines.length === 0) {
            container.innerHTML = '<div class="error">没有启用的搜索引擎，请在设置中启用</div>';
            return;
        }

        // 确保currentIndex在有效范围内
        if (this.currentIndex >= enabledEngines.length) {
            this.currentIndex = 0;
            chrome.storage.local.set({ currentIndex: 0 });
        }

        container.innerHTML = enabledEngines.map((engine, index) => {
            const isCurrent = index === this.currentIndex;
            const faviconUrl = this.getFaviconUrl(engine);
            const fallbackIcon = this.getFallbackIcon(engine);
            
            return `
                <a href="#" class="engine-item ${isCurrent ? 'current' : ''}" 
                   data-index="${index}">
                    <div class="engine-icon">
                        <img src="${faviconUrl}" alt="${engine.name}" 
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';">
                        <span class="fallback-icon" style="display: none;">${fallbackIcon}</span>
                    </div>
                    <span class="engine-name">${engine.name}</span>
                    <span class="engine-status">${isCurrent ? '当前' : '点击切换'}</span>
                </a>
            `;
        }).join('');
    }

    async switchEngine(index) {
        try {
            // 获取最新数据
            const latestData = await this.getLatestData();
            const enabledEngines = latestData.searchEngines.filter(engine => engine.enabled);
            
            console.log('切换搜索引擎:', {
                requestedIndex: index,
                enabledEnginesCount: enabledEngines.length,
                currentIndex: latestData.currentIndex
            });
            
            if (index >= 0 && index < enabledEngines.length) {
                this.currentIndex = index;
                this.searchEngines = latestData.searchEngines;
                await chrome.storage.local.set({ currentIndex: index });
                this.renderSearchEngines();
                
                // 获取当前页面的搜索关键词并执行搜索
                await this.performSearch(index);
            } else {
                console.error('无效的搜索引擎索引:', index);
            }
        } catch (error) {
            console.error('切换搜索引擎失败:', error);
        }
    }

    async performSearch(engineIndex) {
        try {
            // 获取当前活动标签页
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) {
                console.log('无法获取当前标签页');
                return;
            }

            console.log('当前标签页:', tab.url);

            // 从当前页面URL中提取搜索关键词
            const searchQuery = this.extractSearchQuery(tab.url);
            if (!searchQuery) {
                console.log('无法从当前页面提取搜索关键词');
                return;
            }

            console.log('提取的搜索关键词:', searchQuery);

            // 获取最新数据
            const latestData = await this.getLatestData();
            const enabledEngines = latestData.searchEngines.filter(engine => engine.enabled);
            const selectedEngine = enabledEngines[engineIndex];
            
            // 在完整搜索引擎数组中找到对应的索引
            const fullIndex = latestData.searchEngines.findIndex(engine => 
                engine.name === selectedEngine.name && engine.url === selectedEngine.url
            );

            console.log('搜索参数:', {
                engineIndex: engineIndex,
                fullIndex: fullIndex,
                selectedEngine: selectedEngine,
                query: searchQuery
            });

            // 发送搜索请求到background script
            chrome.runtime.sendMessage({
                action: 'search',
                index: fullIndex,
                query: searchQuery
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('发送消息失败:', chrome.runtime.lastError);
                } else {
                    console.log('搜索响应:', response);
                }
            });
        } catch (error) {
            console.error('执行搜索失败:', error);
        }
    }

    extractSearchQuery(url) {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.toLowerCase();
            console.log('解析URL:', { hostname, url });

            // 针对抖音等路径型搜索引擎
            if (hostname.includes('douyin.com')) {
                // /search/关键词
                const match = urlObj.pathname.match(/\/search\/([^/?#]+)/);
                if (match && match[1]) {
                    return decodeURIComponent(match[1]);
                }
            }

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
        document.addEventListener('click', async (e) => {
            const engineItem = e.target.closest('.engine-item');
            if (engineItem) {
                e.preventDefault();
                const index = parseInt(engineItem.dataset.index);
                console.log('点击搜索引擎:', index);
                await this.switchEngine(index);
            }
        });

        // 监听来自background的消息
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            console.log('收到消息:', request);
            if (request.action === 'updateCurrentIndex') {
                this.currentIndex = request.currentIndex;
                this.renderSearchEngines();
            }
        });

        // 监听存储变化
        chrome.storage.onChanged.addListener(async (changes, namespace) => {
            console.log('存储变化:', { changes, namespace });
            if (namespace === 'sync' && changes.searchEngines) {
                this.searchEngines = changes.searchEngines.newValue;
                this.renderSearchEngines();
            }
            if (namespace === 'local' && changes.currentIndex) {
                this.currentIndex = changes.currentIndex.newValue;
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