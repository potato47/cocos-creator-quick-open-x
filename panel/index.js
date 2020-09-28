const fs = require('fs');
const path = require('path');
const { shell } = require('electron');

const MAX_RESULTS_COUNT = 100;

const createVue = function (elem) {
    const vm = new Vue({
        el: elem,
        data: {
            datas: [],
            search: "",
            results: [],
            isOpen: false,
            arrowCounter: 0,
            selected: '',
            isFullPath: false,
            isSimpleMode: false, // 简单模式只搜索 Scene 和 Prefab
            isRemoteSearch: false,
        },

        created: function () {
            this.updateSearchData();
        },

        watch: {
            search() {
                if (this.search !== "") {
                    this.filterResults();
                    this.isOpen = true;
                } else {
                    this.arrowCounter = 0;
                    this.isOpen = false;
                }
            }
        },
        methods: {
            updateSearchData() {
                this.datas = getSearchItems(path.join(Editor.Project.path, '/assets'));
            },
            filterResults() {
                this.isRemoteSearch = this.search.startsWith('@');
                if (this.isRemoteSearch) {
                    let q = this.search.substring(1);
                    this.results = getRemoteSearchResults(q);
                    return;
                }
                let count = 0;
                this.results = this.datas.filter(item => {
                    if (count > MAX_RESULTS_COUNT) {
                        return false;
                    }
                    if (this.isSimpleMode && !(item.name.endsWith('.fire') || item.name.endsWith('.prefab'))) {
                        return false;
                    }
                    const key = this.isFullPath ? 'path' : 'name';
                    const s1 = this.search.toLowerCase();
                    const s2 = item[key].toLowerCase();
                    const index = s2.indexOf(s1);
                    if (index > -1) {
                        item.sort = index;
                        count++;
                        return true;
                    }
                    if (new RegExp(s1.split('').join('.*')).test(s2)) {
                        item.sort = 9999;
                        count++;
                        return true;
                    }
                    return false;
                });
                this.results = this.results.sort((r1, r2) => {
                    if (r1.sort === r2.sort) {
                        const key = this.isFullPath ? 'path' : 'name';
                        return r1[key].length - r2[key].length;
                    } else {
                        return r1.sort - r2.sort;
                    }
                });
            },
            setResult(result) {
                if (this.results.length !== 0) {
                    this.search = this.isFullPath ? result.path : result.name;
                    this.arrowCounter = -1;
                    this.isOpen = false;
                }
            },
            onArrowDown(event) {
                event.stopPropagation();
                event.preventDefault();
                if (this.arrowCounter < this.results.length - 1) {
                    this.arrowCounter = this.arrowCounter + 1;
                } else {
                    this.arrowCounter = 0;
                    this.$els.fileslist.scrollTop = 0;
                }
                this.updateScroll();
            },
            onArrowUp(event) {
                event.stopPropagation();
                event.preventDefault();
                if (this.arrowCounter > 0) {
                    this.arrowCounter = this.arrowCounter - 1;
                    this.updateScroll();
                }
            },
            onEnter(event) {
                event.stopPropagation();
                event.preventDefault();
                if (this.isOpen && this.results[this.arrowCounter]) {
                    if (this.isRemoteSearch) {
                        const url = this.results[this.arrowCounter].url;
                        // window.open(url); // 编辑器窗口打开
                        shell.openExternal(url);
                    } else {
                        const filePath = path.join(Editor.Project.path, '/assets/', this.results[this.arrowCounter].path);
                        const uuid = Editor.remote.assetdb.fspathToUuid(filePath);
                        if (this.isSimpleMode) {
                            if (filePath.endsWith('.fire')) {
                                Editor.Panel.open('scene', {
                                    uuid,
                                });
                            } else if (filePath.endsWith('.prefab')) {
                                Editor.Ipc.sendToAll('scene:enter-prefab-edit-mode', uuid);
                            }
                        } else {
                            Editor.Ipc.sendToAll('assets:hint', uuid);
                            Editor.Selection.select('asset', uuid);
                        }
                    }
                    this.search = '';
                    this.arrowCounter = 0;
                    this.isOpen = false;
                    this.updateScroll();
                    Editor.Ipc.sendToPanel('quick-open-x', 'quick-open-x:search');
                }
            },
            onEsc(event) {
                event.stopPropagation();
                event.preventDefault();
                if (this.search === '') {
                    Editor.Ipc.sendToPanel('quick-open-x', 'quick-open-x:search');
                } else {
                    this.search = '';
                }
            },
            onTab(event) {
                event.stopPropagation();
                event.preventDefault();
                this.isFullPath = !this.isFullPath;
                if (this.search !== '') {
                    this.filterResults();
                    this.arrowCounter = 0;
                    this.updateScroll();
                }
            },
            updateScroll() {
                if (this.arrowCounter === 0) {
                    this.$els.fileslist.scrollTop = 0;
                    return;
                }
                if (this.arrowCounter >= 10) {
                    const offset = (this.arrowCounter - 9) * 30;
                    this.$els.fileslist.scrollTop = offset;
                }
            }
        }
    });
    return vm;
};

Editor.Panel.extend({

    style: fs.readFileSync(Editor.url('packages://quick-open-x/panel/index.css')) + '',

    template: fs.readFileSync(Editor.url('packages://quick-open-x/panel/index.html')) + '',

    $: {
        btn: '#btn',
    },

    ready() {
        this.$btn.addEventListener('confirm', () => {
            this.messages['quick-open-x:search'].apply(this);
        });
        const markDiv = document.createElement('div');
        markDiv.id = 'overlay';
        document.body.appendChild(markDiv);
        markDiv.style.cssText = `
            width: 100%;
            height: 0;
            position: absolute;
            left: 0;
            top: 0;
            z-index: 1;
            visibility: hidden;
        `;
        markDiv.innerHTML = fs.readFileSync(Editor.url('packages://quick-open-x/panel/search.html')) + '';
        this._vm = createVue(markDiv);
        this._markDiv = markDiv;
        Editor.Ipc.sendToMain('quick-open-x:panel-ready');
    },

    close() {
        if (this._vm) {
            this._vm.$destroy();
            this._vm = null;
        }
        if (this._markDiv) {
            this._markDiv.parentNode.removeChild(this._markDiv);
            this._markDiv = null;
        }
        Editor.Ipc.sendToMain('quick-open-x:panel-close');
    },

    messages: {
        'quick-open-x:search'(event, isSimpleMode) {
            if (this._markDiv.style.visibility === 'hidden') {
                this._markDiv.style.visibility = 'visible';
                this._vm.$els.search.focus();
                this._vm.$data.search = '';
                this._vm.$data.isSimpleMode = isSimpleMode;
            } else {
                this._markDiv.style.visibility = 'hidden';
            }
        },
        'asset-db:assets-created'(event, list) {
            this._vm.updateSearchData();
        },
        'asset-db:assets-moved'(event, list) {
            this._vm.updateSearchData();
        },
        'asset-db:assets-deleted'(event, list) {
            this._vm.updateSearchData();
        },

    },

});

function getSearchItems(searchPath) {
    const items = [];
    const walkDir = (currentPath) => {
        const files = fs.readdirSync(currentPath);
        files.forEach(fileName => {
            const filePath = path.join(currentPath, fileName);
            const fileStat = fs.statSync(filePath);
            if (fileStat.isFile() && !fileName.endsWith('.meta') && fs.existsSync(filePath + '.meta')) {
                items.push({ name: fileName, path: filePath.substr(searchPath.length + 1) });
            } else if (fileStat.isDirectory()) {
                walkDir(filePath);
            }
        });
    };
    walkDir(searchPath);
    return items;
}

function getRemoteSearchResults(q) {
    return [
        { name: '搜论坛：' + q, path: '搜论坛：' + q, url: `https://forum.cocos.org/search?q=${q}%20category%3A27` },
        { name: '搜文档：' + q, path: '搜文档：' + q, url: `https://docs.cocos.com/creator/manual/zh/?q=${q}`  },
        { name: '搜API：' + q, path: '搜API：' + q, url: `https://docs.cocos.com/creator/api/zh/?q=${q}`  },
        { name: '搜谷歌：' + q, path: '搜谷歌：' + q, url: `https://www.google.com/search?q=${q}`  },
        { name: '搜百度：' + q, path: '搜百度：' + q, url: `https://www.baidu.com/s?wd=${q}`  },
    ];
}
