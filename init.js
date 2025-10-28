// Main system imports
import JSZip from "https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm";
// End

const DB_NAME = "Prism";
const STORE_NAME = "FileSystem";

async function init() {
    let bootFunction = await rawGetFile("/system/main.js");
    if (bootFunction) bootFunction = bootFunction.content
    if (true /*!bootFunction*/) {
        // Attempt to get main function
        let res;
        try {
            res = await fetch("./desktop/main.js");
        } catch (e) {
            throw new Error("[SYS] Premature crash, unable to get main function!");
        }
        bootFunction = await res.text();
        await rawSetFile("/", { content: ["/system"], created: Date.now(), modified: Date.now(), permissions: ["user"], type: "dir"})
        await rawSetFile("/system/main.js", { content: bootFunction, created: Date.now(), modified: Date.now(), permissions: ["administrator"], type: "file"});
    };
    eval(bootFunction);
}

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function rawGetFile(path) {
    console.log(`[SYS] FileSystem read '${path}'`)
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(path);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
    });
}

async function rawSetFile(path, value) {
    console.log(`[SYS] FileSystem write '${path}'`)
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(value, path);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

async function rawDeleteFile(path) {
    console.log(`[SYS] FileSystem remove '${path}'`)
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(path);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

async function rawGetAllKeys() {
    console.log(`[SYS] FileSystem get all`)
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAllKeys();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

// Boot process

init()