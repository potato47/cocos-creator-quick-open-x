"use strict";

const { BrowserWindow, screen, ipcMain, shell } = require("electron");
const fs = require("fs");
const path = require("path");
const exec = require("child_process").exec;

const screenSize = screen.getPrimaryDisplay().workAreaSize;
const searchWindowWidth = 600;
const searchWindowHeight = 400;
const searchWindowX = Math.round(screenSize.width / 2 - searchWindowWidth / 2);
const searchWindowY = 150;
const searchWindowPostition = {
  x: searchWindowX,
  y: searchWindowY,
};

let searchWindow;
let webWindow;
let lastWindow;
let searchWindowVisible = false;

function load() {
  initSearchWindow();
}

function initSearchWindow() {
  createSearchWindow();
  searchWindow.on("ready-to-show", () => {
    if (process.platform !== "darwin") {
      searchWindow.showInactive();
    }
  });
  searchWindow.on("blur", () => {
    hideSearchWindow();
  });
  searchWindow.on("focus", () => {
    showSearchWindow();
  });
  // win.webContents.openDevTools();
  ipcMain.on("search-cancel", (event, value) => {
    close();
  });
  ipcMain.on("search-confirm", async (event, item) => {
    close();
    if (item.isCommand) {
      handleSearchCommand(item);
    } else {
      handleSearchAssets(item);
    }
  });
}

async function handleSearchAssets(item) {
  const filePath = path.join(Editor.Project.path, "/assets/", item.path);
  const uuid = await Editor.Message.request("asset-db", "query-uuid", filePath);
  const url = await Editor.Message.request("asset-db", "query-url", uuid);
  if (item.onlyLocate) {
    Editor.Message.send("assets", "twinkle", uuid);
  } else {
    Editor.Message.send("asset-db", "open-asset", url);
  }
}

async function handleSearchCommand(command) {
  switch (command.type) {
    case "open-preview":
      const port = await Editor.Message.request("server", "query-port");
      createWebWindow(`http://localhost:${port}/`);
      break;
    case "open-vscode":
      execCommond(`code ${Editor.Project.path}`, (err) => {
        if (err !== null) {
          console.error(err);
        }
      });
      break;
    default:
      createWebWindow(command.path + command.param);
      break;
  }
}

function unload() {
  ipcMain.removeAllListeners("search-command");
  ipcMain.removeAllListeners("search-cancel");
  ipcMain.removeAllListeners("search-confirm");
}

function open() {
  if (!searchWindowVisible) {
    lastWindow = BrowserWindow.getFocusedWindow();
    showSearchWindow();
    const files = getResItems(path.join(Editor.Project.path, "/assets"));
    const commands = getCommandItems();
    searchWindow.webContents.send("active-search", files, commands);
  }
}

function close() {
  if (searchWindowVisible) {
    if (lastWindow) {
      lastWindow.focus();
    }
    hideSearchWindow();
  }
  if (webWindow) {
    webWindow.close();
  }
}

function showSearchWindow() {
  if (!searchWindowVisible) {
    if (process.platform === "darwin") {
      searchWindow.show();
    } else {
      const { x, y } = searchWindowPostition;
      searchWindow.setPosition(x, y);
    }
    searchWindowVisible = true;
  }
}

function hideSearchWindow() {
  if (searchWindowVisible) {
    if (process.platform === "darwin") {
      searchWindow.hide();
    } else {
      searchWindow.setPosition(-100000, -100000);
    }
    searchWindowVisible = false;
  }
}

function createSearchWindow() {
  let { x, y } = searchWindowPostition;
  if (process.platform !== "darwin") {
    x = -100000;
    y = -100000;
  }
  searchWindow = createWindow(
    {
      show: false,
      hasShadow: true,
      transparent: true,
      frame: false,
      x,
      y,
      width: searchWindowWidth,
      height: searchWindowHeight,
      skipTaskbar: true,
      webPreferences: {
        nodeIntegration: true,
        webSecurity: false,
        backgroundThrottling: false,
      },
    },
    `file://${__dirname}/panel/index.html`
  );
}

function createWebWindow(url) {
  const width = 1600;
  const height = 1000;
  webWindow = createWindow(
    {
      alwaysOnTop: true,
      width,
      height,
      skipTaskbar: true,
      webPreferences: {
        nodeIntegration: false,
        webSecurity: false,
        backgroundThrottling: false,
      },
    },
    url
  );
  webWindow.on("closed", () => {
    webWindow = null;
  });
}

function createWindow(options, url) {
  const newWindow = new BrowserWindow(options);
  newWindow.webContents.loadURL(url);
  return newWindow;
}

function getResItems(searchPath) {
  const items = [];
  const walkDir = (currentPath) => {
    const files = fs.readdirSync(currentPath);
    files.forEach((fileName) => {
      const filePath = path.join(currentPath, fileName);
      const fileStat = fs.statSync(filePath);
      if (
        fileStat.isFile() &&
        !fileName.endsWith(".meta") &&
        fs.existsSync(filePath + ".meta")
      ) {
        items.push({
          name: fileName,
          path: filePath.substr(searchPath.length + 1),
        });
      } else if (fileStat.isDirectory()) {
        walkDir(filePath);
      }
    });
  };
  walkDir(searchPath);
  return items;
}

function getCommandItems() {
  return [
    {
      name: "打开预览窗口",
      path: "open preview",
      type: "open-preview",
    },
    {
      name: "打开VS Code",
      path: "open vscode",
      type: "open-vscode",
    },
    {
      name: "搜论坛: ",
      path: "https://forum.cocos.org/search?q=",
    },
    {
      name: "搜文档: ",
      path: "https://docs.cocos.com/creator/manual/zh/?q=",
    },
    {
      name: "搜API: ",
      path: "https://docs.cocos.com/creator/api/zh/?q=",
    },
    {
      name: "搜谷歌: ",
      path: "https://www.google.com/search?q=",
    },
    {
      name: "搜百度: ",
      path: "https://www.baidu.com/s?wd=",
    },
  ];
}

function execCommond(command, cb) {
  exec(command, function (err, stdout, stderr) {
    if (err !== null) {
      cb(new Error(err));
    } else if (typeof stderr != "string") {
      cb(new Error(stderr));
    } else {
      cb(null);
    }
  });
}

function source() {
  shell.openExternal('https://github.com/potato47/cocos-creator-quick-open-x');
}

function help() {
  console.log('----------万能搜索（quick-open-x）----------');
  console.log('alt(option) + s 打开搜索框');
  console.log('alt(option) + w 关闭搜索框');
  console.log('搜索框输入 > 进入命令模式');
  console.log('搜索框输入资源名称后加 : 只定位不打开文件');
  console.log('------------------------------------------');
}

module.exports = {
  load,
  unload,
  methods: {
    open,
    close,
    source,
    help,
  },
};
