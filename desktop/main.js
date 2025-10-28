(async () => {
    const DEBUG = true;

    let index;

    // Logging system
    const logs = [];

    function log(...data) {
        console.log(...data);
        logs.push({ type: "log", content: data });
    }

    function warn(...data) {
        console.warn(...data);
        logs.push({ type: "warn", content: data });
    }

    function error(...data) {
        console.error(...data);
        logs.push({ type: "error", content: data });
    }

    log("[DESKTOP] Creating main UI");

    function setAttrs(element, attrs) {
        for (const [key, value] of Object.entries(attrs)) {
            if (key === "class") {
                element.classList.add(...value.split(" "));
            } else if (key in element) {
                element[key] = value;
            } else {
                element.setAttribute(key, value);
            }
        }
    }

    const body = document.getElementById("main");
    const desktop = document.createElement("div");
    desktop.id = "desktop";
    body.append(desktop);

    // Execute application

    let appZIndex = 1000;

    let processList = {};

    async function execApp(path) {
        log(`[DESKTOP] Request to execute application at path '${path}'`);
        const compressedApp = await getFile(path);
        if (!compressedApp) {
            log(`[DESKTOP] Unable to find application at path '${path}'`);
            return;
        }
        const appFiles = await JSZip.loadAsync(compressedApp);
        log(`[DESKTOP] Uncompressed application, attempting to create app window.`);
        const appWindow = createAppWindow(path, appFiles.files);
    }

    async function createAppWindow(path, files) {
        const window = document.createElement("div");
        const drag = document.createElement("div");
        drag.classList.add("internalWindowTopbar");
        window.classList.add("window");
        const app = document.createElement("iframe");
        app.classList.add("internalWindow");
        window.append(drag)
        window.append(app);
        let manifest;
        let globalID;
        if (Object.keys(files).includes("manifest.json")) {
            const i = Object.keys(files).indexOf("manifest.json");
            manifest = await (Object.values(files)[i]).async("text");
            log("[DESKTOP] Found manifest.json.");
            globalID = JSON.parse(manifest).id;
            
            if (!globalID) {
                error("[DESKTOP] Unable to find globalID in manifest.json. Application execution cancelled.");
                execApp("/home/applications/malformedapp.app");
                return;
            }
        } else {
            error("[DESKTOP] Unable to find manifest.json. Application execution cancelled.");
            execApp("/home/applications/malformedapp.app");
            return;
        }
        let indexHTML;
        if (Object.keys(files).includes("index.html")) {
            const i = Object.keys(files).indexOf("index.html");
            indexHTML = await (Object.values(files)[i]).async("text");
            log("[DESKTOP] Found index.html.");
        } else {
            warn("[DESKTOP] Unable to find index.html, fallback to empty.");
            indexHTML = `
`
        }
        let mainScript;
        if (Object.keys(files).includes("main.js")) {
            const i = Object.keys(files).indexOf("main.js");
            mainScript = await (Object.values(files)[i]).async("text");
            log("[DESKTOP] Found main.js.");
        } else {
            warn("[DESKTOP] Unable to find main.js, fallback to empty.");
            mainScript = "";
        }

        const appStyles = await getFile("/system/appstyles.css")

        const styleBlob = new Blob([appStyles], { type: "text/css" });

        const blob = new Blob([mainScript], { type: "text/javascript" });

        let safeIndex = indexHTML.replace("`","\\`");
        safeIndex = safeIndex.replace("${","\\$");
        app.srcdoc = `
<html
    <head>
        <title>${basename(path)}</title>
        <link rel="stylesheet" href=${JSON.stringify(URL.createObjectURL(styleBlob))}>
    </head>
    <body>
        ${safeIndex}
        <script>
        function setAttrs(element, attrs) {
            for (const [key, value] of Object.entries(attrs)) {
                if (key === "class") {
                    element.classList.add(...value.split(" "));
                } else if (key in element) {
                    element[key] = value;
                } else {
                    element.setAttribute(key, value);
                }
            }
        }
        </script>
        <script type="module" src=${JSON.stringify(URL.createObjectURL(blob))}></script>
    </body>
</html>
        `;
        log("[DESKTOP] Application srcdoc set");
        desktop.append(window);
        app.onload = () => {
            const win = app.contentWindow;

            app.contentWindow.eval("const top = null;");

            ["parent", "opener", "frameElement"].forEach(name => {
                try {
                    Object.defineProperty(win, name, {
                        configurable: false,
                        enumerable: false,
                        get() { return null; }
                    });
                } catch (e) {
                    warn(`[DESKTOP] Could not override ${name}:`, e);
                }
            });

            const FS = Object.freeze({
                writeFile: async (path, content, metadata = {}) => {
                    await writeFile(path, content, ["user"], metadata);
                },
                readFile: async (path) => {
                    return await getFile(path);
                },
                getFileData: async (path) => {
                    let data = await getFileData(path);
                    delete data?.content;
                    return data;
                },
                delFile: async (path) => {
                    await deleteFile(path);
                },
                mkDir: async (path, metadata = {}) => {
                    await makeDir(path, ["user"], metadata);
                },
                lsDir: async (path) => {
                    await listDir(path);
                }
            });

            win.FileSystem = FS;

            const loadModule = async (name) => {
                let m = await getFile(`/system/modules/${name}`);
                if (!m) {
                    try {
                        const res = await fetch(`desktop/modules/${name}`);
                        if (!res.ok) throw new Error("[DESKTOP] Module fetch failed");
                        m = await res.text();
                        await writeFile(`/system/modules/${name}`, m);
                    } catch (err) {
                        error(`[DESKTOP] Unable to find module under name '${name}': ${err.message}`);
                        return null;
                    }
                }
                return m;
            };

            Object.freeze(loadModule);

            win.module = loadModule

            const Rotur = Object.freeze({
                openLogin: async() => {
                    return new Promise( async(resolve, reject) => {
                        try {
                            await new Promise(r => setTimeout(r, 1000));
                            const result = await new Promise(async(resolve, reject) => {
                                const win = window.open(`https://rotur.dev/auth?styles=https://origin.mistium.com/Resources/auth.css&return_to=${window.location.origin}/Prism/authSuccess`, "_blank");
                                if (!win) {
                                    consoleerror("[ROTUR] Login window doesn't exist!");
                                    reject("Fail");
                                }
                                const interval = setInterval(() => {
                                    if (win.closed) {
                                        console.error("[ROTUR] Login window closed!");
                                        clearInterval(interval);
                                        reject("Fail");
                                    }
                                }, 200)
                                const listener = ev => {
                                    if (ev.origin !== "https://rotur.dev") return;

                                    if (ev.data.type === "rotur-auth-token") {
                                        document.removeEventListener("message", listener);
                                        clearInterval(interval);
                                        const token = ev.data.token;

                                        win.close();
                                        resolve(token);
                                    }
                                };
                                window.addEventListener("message", listener)
                                
                            });
                            if (result === "Fail") {
                                reject("Fail");
                                return;
                            }
                            resolve(result);
                            return;
                        } catch (error) {
                            console.error("[ROTUR] Login error:", error);
                            reject(error);
                        }

                })
                }
            });

            win.Rotur = Rotur
            log("[DESKTOP] System APIs injected");
        };

        
        log("[DESKTOP] Application appened to desktop");
        makeDraggableWindow(window, drag)
        log("[DESKTOP] Window dragging hooked to window");
        await new Promise((r) => setTimeout(r, 50));
        window.classList.add("windowLoaded");
        const id = crypto.randomUUID()
        processList[id] = { element: window, path, globalID }
        return { element: window, id: id, path, globalID };
    }

    async function killProc(id) {
        if (!processList[id]) {
            warn(`[DESKTOP] Unable to find process with id '${id}'`);
            return;
        }
        processList[id].element.remove();
        delete processList[id];
    }

    window.processList = processList;
    window.killProc = killProc;

    function makeDraggableWindow(el, drag) {
        const frame = el.querySelector(".internalWindow");

        let offsetX = 0;
        let offsetY = 0;
        let dragging = false;
        drag.addEventListener("mousedown", (e) => {
            frame.style.pointerEvents = "none";
            dragging = true;
            const rect = el.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;

            el.style.position = "absolute";
            appZIndex += 10;
            el.style.zIndex = appZIndex;
            requestAnimationFrame(() => {
                document.addEventListener("mousemove", onMouseMove);
                document.addEventListener("mouseup", onMouseUp);
            });
        })

        function onMouseMove(e) {
            if (!dragging) return;
            drag.style.cursor = "grabbing";
            
            const x = e.clientX - offsetX;
            const y = e.clientY - offsetY;
            el.style.left = x + "px";
            el.style.top = y + "px";
        }

        function onMouseUp() {
            frame.style.pointerEvents = "auto";
            
            dragging = false;
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
        }
    }

    function crash(reason) {
        const overlay = document.createElement("div");
        setAttrs(overlay, {
            class: "crashOverlay"
        });

        const message = document.createElement("h1");
        setAttrs(message, {
            class: "crashError",
            textContent: `System Crash: ${reason}`
        });

        overlay.append(message);
        document.body.innerHTML = "";
        document.body.append(overlay);

        error("[CRASH]", reason);
    }

    // FileSystem API

    async function makeDir(path, permissions = ["user"], extraMeta = {}) {
        if (await exists(path)) return;

        const parent = dirname(path);
        if (parent !== "/" && !(await exists(parent))) {
            await makeDir(parent, permissions);
        }

        const allowed = await checkperms(parent, permissions);
        if (!allowed) {
            log(`[DESKTOP] Permission denied: cannot create directory in '${parent}'`);
            return;
        }

        const now = Date.now();
        await rawSetFile(path, {
            type: "dir",
            content: [],
            created: now,
            modified: now,
            permissions,
            ...extraMeta,
        });

        const parentDir = await rawGetFile(parent);
        if (parentDir && parentDir.type === "dir" && !parentDir.content.includes(path)) {
            parentDir.content.push(path);
            parentDir.modified = now;
            await rawSetFile(parent, parentDir);
        }
    }

    async function writeFile(path, content, permissions = ["user"], extraMeta = {}) {
        const parent = dirname(path);
        if (!(await exists(parent))) {
            await makeDir(parent, permissions);
        }

        const allowed = await checkperms(path, permissions);
        if (!allowed) {
            log(`[DESKTOP] Permission denied: cannot write '${path}'`);
            return;
        }

        const now = Date.now();
        const existing = await rawGetFile(path);
        const created = existing ? existing.created : now;

        const file = {
            type: "file",
            content,
            mimetype: getFileMime(content),
            created,
            modified: now,
            permissions,
            ...extraMeta,
        };

        index[path] = { name: basename(path), path, mimetype: getFileMime(content), type: "file", permissions, modified: now, created, ...extraMeta, };

        await rawSetFile(path, file);

        const parentDir = await rawGetFile(parent);
        if (parentDir && parentDir.type === "dir" && !parentDir.content.includes(path)) {
            parentDir.content.push(path);
            parentDir.modified = now;
            await rawSetFile(parent, parentDir);
        }
    }

    async function getFile(path, permissions = ["user"]) {
        const file = await rawGetFile(path);
        if (!file || file.type !== "file") {
            log(`[DESKTOP] File not found '${path}'`);
            return;
        }

        const allowed = await checkperms(path, permissions);
        if (!allowed) {
            log(`[DESKTOP] Permission denied to read '${path}'`);
            return;
        }

        return file.content;
    }

    async function getFileData(path, permissions = ["user"]) {
        const file = await rawGetFile(path);
        if (!file || file.type !== "file") {
            log(`[DESKTOP] File not found '${path}'`);
            return;
        }

        const allowed = await checkperms(path, permissions);
        if (!allowed) {
            log(`[DESKTOP] Permission denied to read '${path}'`);
            return;
        }

        return file
    }

    async function listDir(path, permissions = ["user"]) {
        const dir = await rawGetFile(path);
        if (!dir || dir.type !== "dir") {
            log(`[DESKTOP] Directory not found '${path}'`);
            return;
        }

        const allowed = await checkperms(path, permissions);
        if (!allowed) {
            log(`[DESKTOP] Permission denied to list '${path}'`);
            return;
        }

        return dir.content;
    }

    async function deleteFile(path, permissions = ["user"]) {
        const file = await rawGetFile(path);
        if (!file) return;

        const allowed = await checkperms(path, permissions);
        if (!allowed) {
            log(`[DESKTOP] Permission denied to delete '${path}'`);
            return;
        }

        if (file.type === "dir") {
            for (const entry of file.content) {
                await deleteFile(entry, permissions);
            }
        }

        await rawDeleteFile(path);

        const parent = dirname(path);
        const parentDir = await rawGetFile(parent);
        if (parentDir && parentDir.type === "dir") {
            parentDir.content = parentDir.content.filter(p => p !== path);
            parentDir.modified = Date.now();
            await rawSetFile(parent, parentDir);
        }
    }

    // Helpers
    async function checkperms(path, permissions = ["user"]) {
        const file = await rawGetFile(path);
        if (!file || !file.permissions) return true;

        return permissions.some(perm => file.permissions.includes(perm));
    }

    function dirname(path) {
        const parts = path.split("/").filter(Boolean);
        parts.pop();
        return parts.length ? "/" + parts.join("/") : "/";
    }

    function getFileMime(content) {
        if (typeof content === "string") {
            const trimmed = content.trim();
            if (trimmed.startsWith("{") || trimmed.startsWith("[")) return "application/json";
            if (trimmed.startsWith("<!DOCTYPE html") || trimmed.startsWith("<html")) return "text/html";
            if (trimmed.startsWith("<svg")) return "image/svg+xml";
            return "text/plain";
        }

        if (typeof content === "object") {
            return "application/json";
        }

        if (content instanceof ArrayBuffer || ArrayBuffer.isView(content)) {
            const arr = new Uint8Array(content);

            if (arr[0] === 0x89 && arr[1] === 0x50 && arr[2] === 0x4E && arr[3] === 0x47) return "image/png";

            if (arr[0] === 0xFF && arr[1] === 0xD8 && arr[2] === 0xFF) return "image/jpeg";

            if (arr[0] === 0x47 && arr[1] === 0x49 && arr[2] === 0x46 && arr[3] === 0x38) return "image/gif";

            if (arr[0] === 0x52 && arr[1] === 0x49 && arr[2] === 0x46 && arr[3] === 0x46 &&
                arr[8] === 0x57 && arr[9] === 0x45 && arr[10] === 0x42 && arr[11] === 0x50) return "image/webp";

            return "application/octet-stream";
        }

        return "application/octet-stream";
    }

    function basename(path) {
        const parts = path.split("/").filter(Boolean);
        return parts.pop() || "/";
    }

    async function exists(path) {
        const file = await rawGetFile(path);
        return !!file;
    }

    // Indexing

    index = await getFile("/system/index.json") || {};

    function autoSaveIndex() {
        writeFile("/system/index.json", index);
        setTimeout(autoSaveIndex, 30000)
    }
    autoSaveIndex()

    // Desktop init

    let styles = await getFile("/system/desktop.css");
    if (styles) styles = styles.content;
    if (!styles || DEBUG) {
        log("[DESKTOP] No desktop styles found, might be init boot.");
        let res;
        try {
            res = await fetch("./desktop/css/desktop.css");
        } catch (e) {
            error("[DESKTOP] Failed to get desktop CSS, system halted.");
            crash(e);
            return;
        }
        styles = await res.text();
        await writeFile("/system/desktop.css", styles);
    }

    const styleEl = document.createElement("style");
    styleEl.textContent = styles;
    document.head.append(styleEl);

    let wallpapers = await listDir("/home/wallpapers");
    if (!wallpapers || wallpapers.length === 0) {
        await makeDir("/home/wallpapers");

        let res;
        try {
            res = await fetch("desktop/img/wallpapers/list.json");
        } catch {
            error("[DESKTOP] Failed to fetch wallpapers!");
            crash("Failed to fetch wallpapers list");
            return;
        }

        let list;
        try {
            list = JSON.parse(await res.text());
        } catch {
            error("[DESKTOP] Invalid wallpaper list!");
            crash("Invalid wallpaper list");
            return;
        }

        for (const wlp of list) {
            try {
                const imgRes = await fetch(`desktop/img/wallpapers/${wlp}`);
                const data = await imgRes.arrayBuffer();
                await writeFile(`/home/wallpapers/${wlp}`, data);
            } catch {
                error(`[DESKTOP] Failed to fetch wallpaper: ${wlp}`);
                crash(`Failed to fetch wallpaper '${wlp}'`);
                return;
            }
        }

        wallpapers = list;
    }

    const wallpaperEl = document.createElement("img");
    const wallpaper = await getFileData("/home/wallpapers/ChaoticCreek.png");
    const wallpaperBlob = new Blob([wallpaper.content], { type: wallpaper.mimetype });
    const wallpaperUrl = URL.createObjectURL(wallpaperBlob);
    setAttrs(wallpaperEl, {
        id: "wallpaper",
        src: wallpaperUrl,
    });
    desktop.append(wallpaperEl);
    log("[DESKTOP] Wallpaper initialized.");

    let dockScript = await getFile("/system/dock.js");
    let dockCss = await getFile("/system/dock.css");
    if (!dockScript || DEBUG) {
        let res;
        try {
            res = await fetch("desktop/js/dock.js");
        } catch {
            error("[DESKTOP] Failed to fetch dock, might not exist on this build?");
        }
        if (res) {
            dockScript = await res.text();
            await writeFile("/system/dock.js", dockScript);
        }
    }
    if ((!dockCss && dockScript) || DEBUG) {
        let res;
        try {
            res = await fetch("desktop/css/dock.css");
        } catch {
            error("[DESKTOP] Failed to fetch dock CSS.");
        }
        if (res) {
            dockCss = await res.text();
            await writeFile("/system/dock.css", dockCss);
        }
    }
    if (dockCss) {
        const styleEl = document.createElement("style");
        styleEl.textContent = dockCss
        document.head.append(styleEl);
    }
    if (dockScript) {
        eval(dockScript);
        log("[DESKTOP] Dock initialized.");
    }
    let searchScript = await getFile("/system/search.js");
    let searchCss = await getFile("/system/search.css");
    if (!searchScript || DEBUG) {
        let res;
        try {
            res = await fetch("desktop/js/search.js");
        } catch {
            error("[DESKTOP] Failed to fetch search, might not exist on this build?");
        }
        if (res) {
            searchScript = await res.text();
            await writeFile("/system/search.js", searchScript);
        }
    }
    if ((!searchCss && searchScript) || DEBUG) {
        let res;
        try {
            res = await fetch("desktop/css/search.css");
        } catch {
            error("[DESKTOP] Failed to fetch search CSS.");
        }
        if (res) {
            searchCss = await res.text();
            await writeFile("/system/search.css", searchCss);
        }
    }
    if (searchCss) {
        const styleEl = document.createElement("style");
        styleEl.textContent = searchCss
        document.head.append(styleEl);
    }
    if (searchScript) {
        eval(searchScript);
        log("[DESKTOP] Search initialized.");
    }

    let appCss = await getFile("/system/appstyles.css");
    if (!appCss || DEBUG) {
        let res;
        try {
            res = await fetch("desktop/css/defaultapp.css");
        } catch {
            error("[DESKTOP] Failed to fetch default app CSS.");
        }
        if (res) {
            appCss = await res.text();
            await writeFile("/system/appstyles.css", appCss);
            log("[DESKTOP] App styles created");
        }
    }

    let appList = await getFile("/system/applist.json");
    if (!appList || DEBUG) {
        let res;
        try {
            res = await fetch("desktop/app/list.json");
        } catch {
            error("[DESKTOP] Failed to fetch default app list!");
        }
        if (res) {
            appList = await res.text();
            await writeFile("/system/applist.json", appList);
            if (appList) {
                try {
                    appList = JSON.parse(appList)
                } catch {
                    log("[DESKTOP] Failed to parse default app list as JSON.");
                    appList = null;
                }
                if (appList) {
                    for (const app of appList) {
                        let res;
                        try {
                            res = await fetch(`desktop/app/${app}`);
                        } catch {
                            warn(`[DESKTOP] Failed to install app '${app}'.`);
                        }
                        if (res) {
                            const compressedApp = await res.arrayBuffer()
                            const appFiles = await JSZip.loadAsync(compressedApp);
                            const files = appFiles.files;
                            const i = Object.keys(files).indexOf("manifest.json");
                            if (i == -1) {
                                error("[DESKTOP] Malformed application, skipped.")
                                continue;
                            }
                            let manifest = await (Object.values(files)[i]).async("text");
                            try {
                                manifest = JSON.parse(manifest);
                            } catch {
                                error("[DESKTOP] Malformed application, skipped.");
                                continue;
                            }
                            let extraParams = {}
                            if (manifest.hidden) {
                                extraParams["hidden"] = true;
                            }
                            await writeFile(`/home/applications/${app}`, compressedApp, ["user"], extraParams);
                        }
                    }
                    log("[DESKTOP] Default apps installed.")
                }
            }
        }
    }
    
    log("[DESKTOP] Desktop initialized successfully.");
})();
