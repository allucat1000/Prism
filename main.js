const { ipcMain, app, BrowserWindow } = require('electron');
const path = require('path');

function parseToken(url) {
    const parsed = new URL(url);
    return parsed.searchParams.get("token");
}

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
        const allowedInternal = url.startsWith("https://rotur.dev/auth");
        if (allowedInternal) {
            const authWin = new BrowserWindow({
                width: 500,
                height: 700,
                parent: mainWin,
                modal: true,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    sandbox: true
                }
            });
            authWin.webContents.on('did-navigate', (event, url) => {
                if (url.startsWith('https://allucat1000.github.io/Prism/authSuccess')) {
                    const token = parseToken(url);
                    mainWin.webContents.send('auth-token', token);
                    authWin.close();
                }
            });
            authWin.loadURL(url);
            return { action: 'deny' };
        } else {
            require('electron').shell.openExternal(url);
            return { action: 'deny' };
        }
    });

    mainWin.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
        callback(false);
    });

    mainWin.loadFile(path.join(__dirname, 'index.html'));
});
