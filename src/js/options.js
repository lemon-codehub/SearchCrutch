// 设置页面逻辑
class OptionsManager {
    constructor() {
        this.searchEngines = [];
        this.settings = {};
        this.init();
    }

    async init() {
        await this.loadData();
        this.renderBuiltinEngines();
        this.renderCustomSearchForms();
        this.bindEvents();
        this.loadSettings();
    }

    async loadData() {
        try {
            const result = await chrome.storage.sync.get(['searchEngines', 'settings']);
            this.searchEngines = result.searchEngines || this.getDefaultSearchEngines();
            this.settings = result.settings || this.getDefaultSettings();
        } catch (error) {
            console.error('加载数据失败:', error);
        }
    }

    getDefaultSearchEngines() {
        return [
            { name: 'Google', url: 'https://www.google.com/search?q=%s', enabled: true, builtin: true },
            { name: '百度', url: 'https://www.baidu.com/s?wd=%s', enabled: true, builtin: true },
            { name: '必应', url: 'https://cn.bing.com/search?q=%s', enabled: true, builtin: true },
            { name: '搜狗', url: 'https://www.sogou.com/web?query=%s', enabled: true, builtin: true }
        ];
    }

    getDefaultSettings() {
        return {
            openInNewTab: true,
            clickToSwitch: false,
            googleDirectAccess: true,
            autoSync: false
        };
    }

    renderBuiltinEngines() {
        const container = document.getElementById('builtinEngines');
        if (!container) return;
        
        container.innerHTML = '';

        this.searchEngines.filter(engine => engine.builtin).forEach((engine, index) => {
            const card = document.createElement('div');
            card.className = `engine-card ${engine.enabled ? 'enabled' : ''}`;
            card.innerHTML = `
                <label>
                    <input type="checkbox" ${engine.enabled ? 'checked' : ''} 
                           data-index="${index}">
                    <div class="engine-name">${engine.name}</div>
                    <div class="engine-url">${engine.url}</div>
                </label>
            `;
            
            // 绑定事件监听器
            const checkbox = card.querySelector('input[type="checkbox"]');
            checkbox.addEventListener('change', () => {
                this.toggleEngine(index);
            });
            
            container.appendChild(card);
        });
    }

    renderCustomSearchForms() {
        const container = document.getElementById('customSearchForms');
        if (!container) return;
        
        container.innerHTML = '';

        const customEngines = this.searchEngines.filter(engine => !engine.builtin);
        
        customEngines.forEach((engine, index) => {
            const formIndex = index + this.searchEngines.filter(e => e.builtin).length;
            this.addCustomSearchForm(formIndex, engine);
        });

        // 添加空表单
        for (let i = customEngines.length; i < 15; i++) {
            this.addCustomSearchForm(i + this.searchEngines.filter(e => e.builtin).length);
        }
    }

    addCustomSearchForm(index, engine = null) {
        const container = document.getElementById('customSearchForms');
        if (!container) return;
        
        const form = document.createElement('div');
        form.className = 'custom-search-form';
        form.id = `custom-form-${index}`;
        
        form.innerHTML = `
            <div class="checkbox-group">
                <input type="checkbox" ${engine?.enabled ? 'checked' : ''} 
                       data-index="${index}">
            </div>
            <div class="form-group">
                <label>名称</label>
                <input type="text" placeholder="搜索引擎名称" value="${engine?.name || ''}" 
                       data-index="${index}" data-field="name">
            </div>
            <div class="form-group">
                <label>网址</label>
                <input type="text" placeholder="搜索引擎网址" 
                       value="${engine?.url || ''}" 
                       data-index="${index}" data-field="url">
            </div>
        `;
        
        // 绑定事件监听器
        const checkbox = form.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', () => {
            this.toggleCustomEngine(index);
        });
        
        const nameInput = form.querySelector('input[data-field="name"]');
        nameInput.addEventListener('change', (e) => {
            this.updateCustomEngine(index, 'name', e.target.value);
        });
        
        const urlInput = form.querySelector('input[data-field="url"]');
        urlInput.addEventListener('change', (e) => {
            this.updateCustomEngine(index, 'url', e.target.value);
        });
        
        container.appendChild(form);
    }

    toggleEngine(index) {
        if (this.searchEngines[index]) {
            this.searchEngines[index].enabled = !this.searchEngines[index].enabled;
            this.saveData();
            this.renderBuiltinEngines();
        }
    }

    toggleCustomEngine(index) {
        const builtinCount = this.searchEngines.filter(e => e.builtin).length;
        const customIndex = index - builtinCount;
        
        if (customIndex >= 0) {
            if (!this.searchEngines[builtinCount + customIndex]) {
                this.searchEngines[builtinCount + customIndex] = {
                    name: '',
                    url: '',
                    enabled: true,
                    builtin: false
                };
            } else {
                this.searchEngines[builtinCount + customIndex].enabled = 
                    !this.searchEngines[builtinCount + customIndex].enabled;
            }
            this.saveData();
        }
    }

    updateCustomEngine(index, field, value) {
        const builtinCount = this.searchEngines.filter(e => e.builtin).length;
        const customIndex = index - builtinCount;
        
        if (customIndex >= 0) {
            if (!this.searchEngines[builtinCount + customIndex]) {
                this.searchEngines[builtinCount + customIndex] = {
                    name: '',
                    url: '',
                    enabled: false,
                    builtin: false
                };
            }
            this.searchEngines[builtinCount + customIndex][field] = value;
            this.saveData();
        }
    }

    loadSettings() {
        const openInNewTab = document.getElementById('openInNewTab');
        const clickToSwitch = document.getElementById('clickToSwitch');
        const googleDirectAccess = document.getElementById('googleDirectAccess');
        const autoSync = document.getElementById('autoSync');
        
        if (openInNewTab) openInNewTab.checked = this.settings.openInNewTab;
        if (clickToSwitch) clickToSwitch.checked = this.settings.clickToSwitch;
        if (googleDirectAccess) googleDirectAccess.checked = this.settings.googleDirectAccess;
        if (autoSync) autoSync.checked = this.settings.autoSync;
    }

    bindEvents() {
        // 设置变更事件
        const openInNewTab = document.getElementById('openInNewTab');
        const clickToSwitch = document.getElementById('clickToSwitch');
        const autoSync = document.getElementById('autoSync');
        const addCustomSearch = document.getElementById('addCustomSearch');
        const backupData = document.getElementById('backupData');
        const restoreData = document.getElementById('restoreData');

        if (openInNewTab) {
            openInNewTab.addEventListener('change', (e) => {
                this.settings.openInNewTab = e.target.checked;
                this.saveData();
            });
        }

        if (clickToSwitch) {
            clickToSwitch.addEventListener('change', (e) => {
                this.settings.clickToSwitch = e.target.checked;
                this.saveData();
            });
        }

        if (autoSync) {
            autoSync.addEventListener('change', (e) => {
                this.settings.autoSync = e.target.checked;
                this.saveData();
            });
        }

        // 添加自定义搜索按钮
        if (addCustomSearch) {
            addCustomSearch.addEventListener('click', () => {
                const customCount = this.searchEngines.filter(e => !e.builtin).length;
                if (customCount < 15) {
                    this.addCustomSearchForm(this.searchEngines.filter(e => e.builtin).length + customCount);
                }
            });
        }

        // 数据备份恢复
        if (backupData) {
            backupData.addEventListener('click', () => {
                this.backupData();
            });
        }

        if (restoreData) {
            restoreData.addEventListener('click', () => {
                this.restoreData();
            });
        }
    }

    async saveData() {
        try {
            await chrome.storage.sync.set({
                searchEngines: this.searchEngines,
                settings: this.settings
            });
            console.log('设置已保存');
        } catch (error) {
            console.error('保存设置失败:', error);
        }
    }

    backupData() {
        const data = {
            searchEngines: this.searchEngines,
            settings: this.settings,
            timestamp: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `便捷搜索备份_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    async restoreData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const text = await file.text();
                    const data = JSON.parse(text);
                    
                    if (data.searchEngines && data.settings) {
                        this.searchEngines = data.searchEngines;
                        this.settings = data.settings;
                        await this.saveData();
                        this.renderBuiltinEngines();
                        this.renderCustomSearchForms();
                        this.loadSettings();
                        alert('数据恢复成功！');
                    } else {
                        alert('无效的备份文件');
                    }
                } catch (error) {
                    alert('恢复数据失败: ' + error.message);
                }
            }
        };
        input.click();
    }
}

// 初始化设置管理器
let optionsManager;
document.addEventListener('DOMContentLoaded', () => {
    optionsManager = new OptionsManager();
});