'use strict';

const obsidian = require('obsidian');
const { Plugin, TFile, TFolder, debounce, PluginSettingTab, Setting } = obsidian;

const DEFAULT_SETTINGS = {
    excludedFolders: 'Templates, Attachments, .trash',
    navigationFileName: 'Navigation'
}

module.exports = class AutoNavigationPlugin extends Plugin {

    async onload() {
        await this.loadSettings();

        this.addSettingTab(new AutoNavSettingTab(this.app, this));

        this.requestUpdate = debounce(this.initializeStructure.bind(this), 500, true);

        this.registerEvent(this.app.vault.on('create', () => this.requestUpdate()));
        this.registerEvent(this.app.vault.on('delete', () => this.requestUpdate()));
        this.registerEvent(this.app.vault.on('rename', () => this.requestUpdate()));

        await this.initializeStructure();
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
        this.requestUpdate();
    }

    getExcludedFolders() {
        return this.settings.excludedFolders.split(',').map(s => s.trim()).filter(s => s !== '');
    }

    async initializeStructure() {
        await this.updateOrCreateRootNavigation();
        const root = this.app.vault.getRoot();
        const excluded = this.getExcludedFolders();

        for (const child of root.children) {
            if (child instanceof TFolder && !excluded.includes(child.name)) {
                await this.updateOrCreateLevel2Navigation(child);
            }
        }
    }

    async updateOrCreateRootNavigation() {
        const navName = `${this.settings.navigationFileName}.md`;
        let file = this.app.vault.getAbstractFileByPath(navName);
        
        const excluded = this.getExcludedFolders();
        const folders = this.app.vault.getRoot().children
            .filter(c => c instanceof TFolder && !excluded.includes(c.name))
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

        let md = `#${this.settings.navigationFileName}\n\n`;
        folders.forEach(f => {
            md += `- [[${f.path}/${f.name}|${f.name}]]\n`;
        });

        if (!file) {
            try {
                await this.app.vault.create(navName, md);
            } catch (e) {
                file = this.app.vault.getAbstractFileByPath(navName);
                if (file) await this.app.vault.modify(file, md);
            }
        } else {
            const current = await this.app.vault.read(file);
            if (current.trim() !== md.trim()) {
                await this.app.vault.modify(file, md);
            }
        }
    }

    async updateOrCreateLevel2Navigation(folder) {
        const excluded = this.getExcludedFolders();
        if (!folder || !folder.parent || !folder.parent.isRoot() || excluded.includes(folder.name)) return;

        const navName = `${folder.name}.md`;
        const navPath = `${folder.path}/${navName}`;
        let file = this.app.vault.getAbstractFileByPath(navPath);

        const subFolders = folder.children
            .filter(c => c instanceof TFolder && !excluded.includes(c.name))
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

        const mdFiles = folder.children
            .filter(c => c instanceof TFile && c.extension === 'md' && c.name !== navName)
            .sort((a, b) => a.basename.localeCompare(b.basename, undefined, { numeric: true }));

        let md = `#Navigation for ${folder.name}\n\n`;

        subFolders.forEach(f => {
            md += `- [[${f.path}/${f.name}|${f.name}]]\n`;
            this.updateOrCreateLevel3Navigation(f);
        });

        mdFiles.forEach(f => {
            md += `- [[${f.basename}]]\n`;
        });

        if (!file) {
            try {
                await this.app.vault.create(navPath, md);
            } catch (e) {
                file = this.app.vault.getAbstractFileByPath(navPath);
                if (file) await this.app.vault.modify(file, md);
            }
        } else {
            const current = await this.app.vault.read(file);
            if (current.trim() !== md.trim()) {
                await this.app.vault.modify(file, md);
            }
        }
    }

    async updateOrCreateLevel3Navigation(folder) {
        const excluded = this.getExcludedFolders();
        if (!folder || excluded.includes(folder.name)) return;
        
        const navName = `${folder.name}.md`;
        const navPath = `${folder.path}/${navName}`;
        let file = this.app.vault.getAbstractFileByPath(navPath);

        const lines = this.buildRecursiveContent(folder, navName, 0);
        let newContent = `#Navigation for ${folder.name}\n\n` + lines.join('\n') + '\n';

        if (!file) {
            try {
                await this.app.vault.create(navPath, newContent);
            } catch (e) {
                file = this.app.vault.getAbstractFileByPath(navPath);
                if (file) await this.app.vault.modify(file, newContent);
            }
        } else {
            const current = await this.app.vault.read(file);
            if (current.trim() !== newContent.trim()) {
                await this.app.vault.modify(file, newContent);
            }
        }
    }

    buildRecursiveContent(folder, excludeName, level = 0) {
        const lines = [];
        const indent = '  '.repeat(level);
        const subfolders = [];
        const files = [];
        const excluded = this.getExcludedFolders();

        folder.children.forEach(child => {
            if (child instanceof TFolder && !excluded.includes(child.name)) {
                subfolders.push(child);
            } else if (child instanceof TFile && child.extension === 'md' && child.name !== excludeName) {
                files.push(child);
            }
        });

        subfolders.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        files.sort((a, b) => a.basename.localeCompare(b.basename, undefined, { numeric: true }));

        subfolders.forEach(sub => {
            lines.push(`${indent}- **${sub.name}**`);
            lines.push(...this.buildRecursiveContent(sub, excludeName, level + 1));
        });

        files.forEach(f => {
            lines.push(`${indent}- [[${f.basename}]]`);
        });

        return lines;
    }

    onunload() {}
};

class AutoNavSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h2', { text: 'Auto-Navigation Settings' });

        new Setting(containerEl)
            .setName('Excluded Folders')
            .setDesc('Folder names to ignore, separated by commas.')
            .addText(text => text
                .setPlaceholder('Templates, Archive...')
                .setValue(this.plugin.settings.excludedFolders)
                .onChange(async (value) => {
                    this.plugin.settings.excludedFolders = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Root Navigation Filename')
            .setDesc('The name of the main navigation file in the root.')
            .addText(text => text
                .setPlaceholder('Navigation')
                .setValue(this.plugin.settings.navigationFileName)
                .onChange(async (value) => {
                    this.plugin.settings.navigationFileName = value;
                    await this.plugin.saveSettings();
                }));
    }
}