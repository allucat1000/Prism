const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ElectronAPI', {
    onAuthToken: (callback) => ipcRenderer.on('auth-token', (_, token) => callback(token))
});