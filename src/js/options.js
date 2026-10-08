class OptionsManager {
    constructor() {
        this.searchEngines = [];
        this.settings = {};
        this.savedSnapshot = '';
        this.dirty = false;
        this.saving = false;
        this.dragIndex = null;
        this.catalogEngines = [];
        this.catalogSelection = new Set();
        this.catalogCategory = '全部';
        this.catalogLoading = false;
        this.init();
    }

    async init() {
        this.bindEvents();
        document.getElementById('version').textContent = `便捷搜索 · v${chrome.runtime.getManifest().version}`;
        try {
            const state = await SearchConfig.read();
            this.searchEngines = state.searchEngines;
            this.settings = state.settings;
            this.savedSnapshot = this.snapshot();
            this.render();
            this.setBusy(false);
            this.setStatus('设置已加载，修改后记得保存');
        } catch (error) {
            this.setStatus(`读取失败：${error.message}。请重新打开设置页重试。`, 'error');
        }
    }

    snapshot() {
        return JSON.stringify({ searchEngines: this.searchEngines, settings: this.settings });
    }

    setStatus(message, type = '') {
        document.getElementById('saveStatus').textContent = message;
        document.getElementById('statusDot').className = `status-dot ${type}`;
    }

    markDirty() {
        this.dirty = this.snapshot() !== this.savedSnapshot;
        this.setStatus(this.dirty ? '有未保存的更改' : '所有更改已保存', this.dirty ? 'dirty' : 'success');
        this.updateCount();
    }

    setBusy(busy) {
        this.saving = busy;
        document.getElementById('settingsEditor').disabled = busy;
        document.getElementById('saveSettings').disabled = busy;
        document.getElementById('saveSettings').textContent = busy ? '正在保存…' : '保存设置';
    }

    updateCount() {
        const count = this.searchEngines.filter(engine => engine.name.trim() && engine.url.trim() && engine.enabled).length;
        document.getElementById('engineCount').textContent = `${count} 个已启用`;
    }

    render() {
        const container = document.getElementById('engineList');
        container.replaceChildren();
        this.searchEngines.forEach((engine, index) => {
            const row = document.createElement('div');
            row.className = `engine-row${engine.enabled ? '' : ' is-disabled'}`;
            row.dataset.index = index;

            const handle = document.createElement('button');
            handle.type = 'button';
            handle.className = 'icon-button drag-handle';
            handle.draggable = true;
            handle.title = '拖拽排序，或按 Alt + ↑ / ↓ 调整';
            handle.setAttribute('aria-label', `调整第 ${index + 1} 个搜索引擎的顺序`);
            const dots = document.createElement('span');
            dots.className = 'handle-dots';
            dots.setAttribute('aria-hidden', 'true');
            handle.appendChild(dots);
            row.appendChild(handle);

            for (const field of ['name', 'url']) {
                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'engine-input';
                input.dataset.field = field;
                input.value = engine[field];
                input.placeholder = field === 'name' ? '搜索引擎名称' : 'https://example.com/search?q=%s';
                input.setAttribute('aria-label', `第 ${index + 1} 个搜索引擎的${field === 'name' ? '名称' : '网址'}`);
                input.spellcheck = false;
                row.appendChild(input);
            }

            const toggle = document.createElement('label');
            toggle.className = 'toggle';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = engine.enabled;
            checkbox.setAttribute('aria-label', `启用第 ${index + 1} 个搜索引擎`);
            const track = document.createElement('span');
            track.className = 'toggle-track';
            toggle.append(checkbox, track);
            row.appendChild(toggle);

            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'icon-button remove-engine';
            remove.textContent = '×';
            remove.title = '移除搜索引擎';
            remove.setAttribute('aria-label', `移除第 ${index + 1} 个搜索引擎`);
            row.appendChild(remove);
            container.appendChild(row);
        });
        if (!this.searchEngines.length) {
            const empty = document.createElement('p');
            empty.className = 'empty-state';
            empty.textContent = '还没有搜索引擎，点击上方按钮添加。';
            container.appendChild(empty);
        }
        document.getElementById('openInNewTab').checked = this.settings.openInNewTab;
        this.updateCount();
    }

    moveEngine(from, to) {
        if (from === to || from < 0 || to < 0 || from >= this.searchEngines.length || to >= this.searchEngines.length) return;
        const [engine] = this.searchEngines.splice(from, 1);
        this.searchEngines.splice(to, 0, engine);
        this.render();
        this.markDirty();
        document.querySelectorAll('.drag-handle')[to].focus();
    }

    clearDrag() {
        document.querySelectorAll('.engine-row').forEach(row => row.classList.remove('dragging', 'drop-before', 'drop-after'));
    }

    bindEvents() {
        const list = document.getElementById('engineList');
        list.addEventListener('input', event => {
            const field = event.target.dataset.field;
            const row = event.target.closest('.engine-row');
            if (!field || !row || this.saving) return;
            this.searchEngines[Number(row.dataset.index)][field] = event.target.value;
            event.target.removeAttribute('aria-invalid');
            this.markDirty();
        });
        list.addEventListener('change', event => {
            if (event.target.type !== 'checkbox' || this.saving) return;
            const row = event.target.closest('.engine-row');
            this.searchEngines[Number(row.dataset.index)].enabled = event.target.checked;
            row.classList.toggle('is-disabled', !event.target.checked);
            this.markDirty();
        });
        list.addEventListener('click', event => {
            const remove = event.target.closest('.remove-engine');
            if (!remove || this.saving) return;
            const index = Number(remove.closest('.engine-row').dataset.index);
            this.searchEngines.splice(index, 1);
            this.render();
            this.markDirty();
        });
        list.addEventListener('keydown', event => {
            if (!event.target.closest('.drag-handle') || !event.altKey || this.saving) return;
            if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
            event.preventDefault();
            const from = Number(event.target.closest('.engine-row').dataset.index);
            this.moveEngine(from, from + (event.key === 'ArrowUp' ? -1 : 1));
        });
        list.addEventListener('dragstart', event => {
            const handle = event.target.closest('.drag-handle');
            if (!handle || this.saving) { event.preventDefault(); return; }
            const row = handle.closest('.engine-row');
            this.dragIndex = Number(row.dataset.index);
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', String(this.dragIndex));
            event.dataTransfer.setDragImage(row, 20, row.offsetHeight / 2);
            row.classList.add('dragging');
        });
        list.addEventListener('dragover', event => {
            const row = event.target.closest('.engine-row');
            if (!row || this.dragIndex === null) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            this.clearDrag();
            document.querySelectorAll('.engine-row')[this.dragIndex].classList.add('dragging');
            if (Number(row.dataset.index) === this.dragIndex) return;
            const bounds = row.getBoundingClientRect();
            row.classList.add(event.clientY < bounds.top + bounds.height / 2 ? 'drop-before' : 'drop-after');
        });
        list.addEventListener('drop', event => {
            const row = event.target.closest('.engine-row');
            if (!row || this.dragIndex === null || this.saving) return;
            event.preventDefault();
            const from = this.dragIndex;
            const target = Number(row.dataset.index);
            const bounds = row.getBoundingClientRect();
            const after = event.clientY >= bounds.top + bounds.height / 2;
            const insertion = target + (after ? 1 : 0);
            this.dragIndex = null;
            this.clearDrag();
            this.moveEngine(from, insertion - (from < insertion ? 1 : 0));
        });
        list.addEventListener('dragend', () => { this.dragIndex = null; this.clearDrag(); });

        document.getElementById('openInNewTab').addEventListener('change', event => {
            this.settings.openInNewTab = event.target.checked;
            this.markDirty();
        });
        document.getElementById('addCustomSearch').addEventListener('click', () => this.openCatalog());
        document.getElementById('closeCatalog').addEventListener('click', () => document.getElementById('catalogDialog').close());
        document.getElementById('refreshCatalog').addEventListener('click', () => this.loadCatalog());
        document.getElementById('catalogQuery').addEventListener('input', () => this.renderCatalog(true));
        document.getElementById('catalogCategories').addEventListener('click', event => {
            const button = event.target.closest('[data-category]');
            if (!button) return;
            this.catalogCategory = button.dataset.category;
            this.renderCatalog(true);
        });
        document.getElementById('catalogList').addEventListener('change', event => {
            if (event.target.type !== 'checkbox') return;
            const id = event.target.dataset.id;
            if (event.target.checked) this.catalogSelection.add(id);
            else this.catalogSelection.delete(id);
            this.renderCatalog();
        });
        document.getElementById('addSelectedEngines').addEventListener('click', () => this.addSelectedEngines());
        document.getElementById('addManualSearch').addEventListener('click', () => this.addManualSearch());
        document.getElementById('saveSettings').addEventListener('click', () => this.saveData());
        document.getElementById('backupData').addEventListener('click', () => this.backupData());
        document.getElementById('restoreData').addEventListener('click', () => {
            const input = document.getElementById('importFile');
            input.value = '';
            input.click();
        });
        document.getElementById('importFile').addEventListener('change', event => this.restoreData(event.target.files[0]));
        window.addEventListener('beforeunload', event => {
            if (!this.dirty) return;
            event.preventDefault();
            event.returnValue = '';
        });
    }

    async openCatalog() {
        if (this.saving) return;
        this.catalogSelection.clear();
        this.catalogCategory = '全部';
        document.getElementById('catalogQuery').value = '';
        document.getElementById('catalogDialog').showModal();
        document.getElementById('catalogQuery').focus();
        await this.loadCatalog();
    }

    async loadCatalog() {
        if (this.catalogLoading) return;
        this.catalogLoading = true;
        document.getElementById('refreshCatalog').disabled = true;
        document.getElementById('catalogStatus').textContent = '正在查询搜索引擎列表…';
        this.renderCatalog();
        try {
            const result = await SearchCatalog.load();
            this.catalogEngines = result.engines;
            const validIds = new Set(result.engines.map(engine => engine.id));
            this.catalogSelection = new Set([...this.catalogSelection].filter(id => validIds.has(id)));
            if (!['全部', ...result.engines.map(engine => engine.category)].includes(this.catalogCategory)) this.catalogCategory = '全部';
            const status = {
                online: '在线列表已更新，添加后记得保存设置。',
                cache: '暂时无法连接在线列表，正在使用上次加载的列表。',
                builtin: '暂时无法连接在线列表，正在使用内置列表。'
            };
            document.getElementById('catalogStatus').textContent = status[result.source];
        } catch (error) {
            document.getElementById('catalogStatus').textContent = `列表加载失败：${error.message}。可以重试或手动添加。`;
        } finally {
            this.catalogLoading = false;
            document.getElementById('refreshCatalog').disabled = false;
            this.renderCatalog();
        }
    }

    renderCatalog(resetScroll = false) {
        const focusedId = document.activeElement?.dataset.id;
        const focusedCategory = document.activeElement?.dataset.category;
        const previousScroll = document.getElementById('catalogList').scrollTop;
        const categories = document.getElementById('catalogCategories');
        categories.replaceChildren();
        for (const category of ['全部', ...new Set(this.catalogEngines.map(engine => engine.category))]) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `category-chip${category === this.catalogCategory ? ' selected' : ''}`;
            button.dataset.category = category;
            button.textContent = category;
            button.setAttribute('aria-pressed', String(category === this.catalogCategory));
            categories.appendChild(button);
        }
        const existing = new Set(this.searchEngines.map(engine => SearchCatalog.urlKey(engine.url)));
        const query = document.getElementById('catalogQuery').value.trim().toLocaleLowerCase();
        const matches = this.catalogEngines.filter(engine => {
            const inCategory = this.catalogCategory === '全部' || engine.category === this.catalogCategory;
            return inCategory && `${engine.name} ${engine.category} ${new URL(engine.url).hostname}`.toLocaleLowerCase().includes(query);
        });
        const list = document.getElementById('catalogList');
        list.replaceChildren();
        for (const engine of matches) {
            const added = existing.has(SearchCatalog.urlKey(engine.url));
            if (added) this.catalogSelection.delete(engine.id);
            const card = document.createElement('label');
            card.className = `catalog-card${added ? ' already-added' : ''}${this.catalogSelection.has(engine.id) ? ' selected' : ''}`;
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.dataset.id = engine.id;
            checkbox.checked = this.catalogSelection.has(engine.id);
            checkbox.disabled = added || this.catalogLoading;
            checkbox.setAttribute('aria-label', `选择${engine.name}`);
            const info = document.createElement('span');
            info.className = 'catalog-card-info';
            const name = document.createElement('strong');
            name.textContent = engine.name;
            const domain = document.createElement('span');
            domain.className = 'catalog-domain';
            domain.textContent = new URL(engine.url).hostname;
            const badge = document.createElement('span');
            badge.className = 'catalog-badge';
            badge.textContent = added ? '已添加' : engine.category;
            info.append(name, domain);
            card.append(checkbox, info, badge);
            list.appendChild(card);
        }
        if (!matches.length) {
            const empty = document.createElement('p');
            empty.className = 'empty-state';
            empty.textContent = this.catalogLoading ? '正在加载…' : '没有匹配的搜索引擎，试试其他关键词或手动添加。';
            list.appendChild(empty);
        }
        const add = document.getElementById('addSelectedEngines');
        add.disabled = !this.catalogSelection.size || this.catalogLoading;
        add.textContent = this.catalogSelection.size ? `添加所选（${this.catalogSelection.size}）` : '添加所选';
        list.scrollTop = resetScroll ? 0 : previousScroll;
        const focusTarget = focusedId ? [...list.querySelectorAll('input')].find(input => input.dataset.id === focusedId)
            : focusedCategory ? [...categories.children].find(button => button.dataset.category === focusedCategory) : null;
        focusTarget?.focus({ preventScroll: true });
    }

    addSelectedEngines() {
        if (this.catalogLoading || this.saving) return;
        const existing = new Set(this.searchEngines.map(engine => SearchCatalog.urlKey(engine.url)));
        const selected = this.catalogEngines.filter(engine => this.catalogSelection.has(engine.id) && !existing.has(SearchCatalog.urlKey(engine.url)));
        if (!selected.length) return;
        this.searchEngines.push(...selected.map(engine => ({ name: engine.name, url: engine.url, enabled: true, builtin: false })));
        document.getElementById('catalogDialog').close();
        this.render();
        this.markDirty();
        this.setStatus(`已添加 ${selected.length} 个搜索引擎，点击保存设置后生效`, 'dirty');
        document.querySelectorAll('.engine-row')[this.searchEngines.length - selected.length].querySelector('.engine-input').focus();
    }

    addManualSearch() {
        if (this.saving) return;
        this.searchEngines.push({ name: '', url: '', enabled: true, builtin: false });
        document.getElementById('catalogDialog').close();
        this.render();
        this.markDirty();
        const input = document.querySelector('#engineList .engine-row:last-child [data-field="name"]');
        input.focus();
        input.scrollIntoView({ block: 'nearest' });
    }

    showValidationError(error) {
        this.setStatus(error.message, 'error');
        if (Number.isInteger(error.engineIndex)) {
            const row = document.querySelectorAll('.engine-row')[error.engineIndex];
            row?.querySelectorAll('.engine-input').forEach(input => input.setAttribute('aria-invalid', 'true'));
            row?.querySelector('.engine-input').focus();
        }
    }

    async saveData() {
        if (this.saving) return;
        let engines;
        try { engines = SearchConfig.validate(this.searchEngines); }
        catch (error) { this.showValidationError(error); return; }
        this.setBusy(true);
        this.setStatus('正在保存设置…');
        try {
            await chrome.storage.sync.set({ searchEngines: engines, settings: this.settings });
            this.searchEngines = engines;
            this.savedSnapshot = this.snapshot();
            this.dirty = false;
            this.render();
            try {
                const response = await chrome.runtime.sendMessage({ action: 'refreshContextMenus' });
                if (!response?.success) throw new Error(response?.error || '后台未响应');
                this.setStatus('设置已保存，搜索列表与右键菜单已更新', 'success');
            } catch (error) {
                this.setStatus(`设置已保存，右键菜单更新失败：${error.message}。请重新加载扩展。`, 'error');
            }
        } catch (error) {
            this.setStatus(`保存失败：${error.message}。更改仍保留在此页，请重试。`, 'error');
        } finally {
            this.setBusy(false);
        }
    }

    backupData() {
        try {
            const data = { searchEngines: SearchConfig.validate(this.searchEngines), settings: this.settings, timestamp: new Date().toISOString() };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `便捷搜索备份_${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (error) { this.showValidationError(error); }
    }

    async restoreData(file) {
        if (!file || this.saving) return;
        try {
            const data = JSON.parse(await file.text());
            if (!data.settings || typeof data.settings !== 'object' || Array.isArray(data.settings)) throw new Error('配置文件缺少有效的搜索偏好');
            const engines = SearchConfig.validate(data.searchEngines);
            const settings = SearchConfig.defaultSettings();
            for (const key of Object.keys(settings)) {
                if (data.settings[key] === undefined) continue;
                if (typeof data.settings[key] !== 'boolean') throw new Error('配置文件中的搜索偏好格式不正确');
                settings[key] = data.settings[key];
            }
            this.searchEngines = engines;
            this.settings = settings;
            this.render();
            this.markDirty();
            this.setStatus('配置已导入，点击保存设置后生效', 'dirty');
        } catch (error) {
            this.setStatus(`导入失败：${error.message}`, 'error');
        }
    }
}

let optionsManager;
document.addEventListener('DOMContentLoaded', () => { optionsManager = new OptionsManager(); });
