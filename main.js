const { app, BrowserWindow } = require('electron');
const path = require('path');

app.whenReady().then(() => {
  const mainWin = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true,
      sandbox: true
    }
  });

  mainWin.webContents.once('did-finish-load', () => {
    mainWin.webContents.openDevTools();
  });

  mainWin.webContents.on('will-attach-webview', (event, webPreferences, params) => {
    webPreferences.nodeIntegration = false;
    webPreferences.nodeIntegrationInWorker = false;
    webPreferences.enableRemoteModule = false;
    webPreferences.contextIsolation = true;
    webPreferences.preload = null;
    webPreferences.sandbox = true;
  });

  mainWin.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWin.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(false);
  });

  mainWin.loadFile(path.join(__dirname, 'index.html'));
});
