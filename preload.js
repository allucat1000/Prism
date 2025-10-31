const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('ElectronAPI', {
    // bleh
});