(async () => {
    const params = new URLSearchParams(window.location.search);
    const DEBUG = params.get("debug") == "true" ? true : false;

    let index;

    const isElectron = !!window.ElectronAPI?.electron;

    // Logging system
    const logs = [];

    function log(...data) {
        console.log(`[DESKTOP] ${data}`);
        logs.push({ type: "log", content: data });
    }

    function warn(...data) {
        console.warn(`[DESKTOP] ${data}`);
        logs.push({ type: "warn", content: data });
    }

    function error(...data) {
        console.error(`[DESKTOP] ${data}`);
        logs.push({ type: "error", content: data });
        return null;
    }

    log("Creating main UI");

    const bootTime = Date.now();

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
        log(`Request to execute application at path '${path}'`);
        const compressedApp = await getFile(path);
        if (!compressedApp) {
            log(`Unable to find application at path '${path}'`);
            return;
        }
        const appFiles = await JSZip.loadAsync(compressedApp);
        log(`Uncompressed application, attempting to create app window.`);
        const appWindow = createAppWindow(path, appFiles.files);
    }

    async function createAppWindow(path, files) {
        const appWindow = document.createElement("div");
        const drag = document.createElement("div");
        drag.classList.add("internalWindowTopbar");
        appWindow.classList.add("window");
        const app = document.createElement("iframe");
        app.classList.add("internalWindow");
        appWindow.append(drag)
        appWindow.append(app);
        window.addEventListener("keydown", (e) => {
            if (e.code == "AltLeft") {
                drag.style.height = "100%";
                drag.style.backgroundColor = "rgba(0, 0, 0, 0)";
            }
        })
        window.addEventListener("keyup", (e) => {
            if (e.code == "AltLeft") {
                drag.style.height = "";
                drag.style.backgroundColor = "";
            }
        })
        let manifest;
        let globalID;
        if (Object.keys(files).includes("manifest.json")) {
            const i = Object.keys(files).indexOf("manifest.json");
            manifest = await (Object.values(files)[i]).async("text");
            log("Found manifest.json.");
            globalID = JSON.parse(manifest).id;
            
            if (!globalID) {
                error("Unable to find globalID in manifest.json. Application execution cancelled.");
                execApp("/home/applications/malformedapp.app");
                return;
            }
        } else {
            error("Unable to find manifest.json. Application execution cancelled.");
            execApp("/home/applications/malformedapp.app");
            return;
        }
        let indexHTML;
        if (Object.keys(files).includes("index.html")) {
            const i = Object.keys(files).indexOf("index.html");
            indexHTML = await (Object.values(files)[i]).async("text");
            log("Found index.html.");
        } else {
            warn("Unable to find index.html, fallback to empty.");
            indexHTML = `
`
        }
        let mainScript;
        if (Object.keys(files).includes("main.js")) {
            const i = Object.keys(files).indexOf("main.js");
            mainScript = await (Object.values(files)[i]).async("text");
            log("Found main.js.");
        } else {
            warn("Unable to find main.js, fallback to empty.");
            mainScript = "";
        }

        const appStyles = await getFile("/system/appstyles.css")

        const styleBlob = new Blob([appStyles], { type: "text/css" });

        const blob = new Blob([mainScript], { type: "text/javascript" });

        let safeIndex = indexHTML.replace("\\","\\\\")
        safeIndex = safeIndex.replace("`","\`");
        safeIndex = safeIndex.replace("${","\${");
        console.log(safeIndex);
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
                } else if (key === "src") {
                    const color = "white";
                    const updated = value.replace("currentColor", color);
                    element[key] = updated;
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
        log("Application srcdoc set");
        appWindow.style.zIndex = appZIndex += 10;
        desktop.append(appWindow);
        const id = crypto.randomUUID()
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
                warn(`Could not override ${name}:`, e);
            }
        });

        const Rotur = Object.freeze({
            login: async () => {
                await new Promise(r => setTimeout(r, 1000));

                return new Promise((resolve, reject) => {
                    let url = `https://rotur.dev/auth?styles=https://origin.mistium.com/Resources/auth.css&return_to=${window.location.origin}/Prism/authSuccess`
                    if (window.ElectronAPI) {
                        url = `https://rotur.dev/auth?styles=https://origin.mistium.com/Resources/auth.css&return_to=https://allucat1000.github.io/Prism/authSuccess`;
                    }
                const win = window.open(
                    url,
                    "_blank"
                );

                if (window.ElectronAPI) {
                    window.ElectronAPI.onAuthToken((token) => {
                        resolve(token);
                    });
                    setTimeout(() => reject("Fail"), 90000)
                } else {

                    if (!win) {
                        console.error("[ROTUR] Login window doesn't exist!");
                        return reject("Fail");
                    }

                    const interval = setInterval(() => {
                        if (win.closed) {
                        console.error("[ROTUR] Login window closed!");
                        clearInterval(interval);
                        window.removeEventListener("message", listener);
                        reject("Fail");
                        }
                    }, 200);

                    const listener = ev => {
                        if (ev.origin !== "https://rotur.dev") return;

                        if (ev.data.type === "rotur-auth-token") {
                        window.removeEventListener("message", listener);
                        clearInterval(interval);
                        const token = ev.data.token;
                        win.close();
                        resolve(token);
                        }
                    };

                    window.addEventListener("message", listener);
                }
                });
            }
        })

        win.Rotur = Rotur;

        async function getStorageUsage() {
            if (!navigator.storage?.estimate) {
                throw new Error("StorageManager API not supported");
            }

            const estimate = await navigator.storage.estimate();

            return {
                used: estimate.usage,
                total: estimate.quota,
                free: estimate.quota - estimate.usage
            };
        }

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
                return await listDir(path);
            },
            getStats: async() => {
                return await getStorageUsage()
            }
        });

        win.FileSystem = FS;

        const System = Object.freeze({
            bootTime: bootTime,

            electron: isElectron
        });

        win.System = System;

        const App = Object.freeze({
            execApp: async(path) => {
                await execApp(path);
            },
            
            close: async() => {
                await killProc(id);
            },

            storage: {
                read: async (path) => {
                    const safePath = path.startsWith("/") ? path : "/" + path;
                    const fullPath = `/system/applicationstorage/${globalID}${safePath}`;
                    
                    const existsFile = await exists(fullPath);
                    if (!existsFile) {
                        console.warn(`ApplicationStorage: File not found: ${fullPath}`);
                        return null;
                    }

                    const data = await getFile(fullPath);
                    return data;
                },

                write: async (path, content) => {
                    const safePath = path.startsWith("/") ? path : "/" + path;
                    const fullPath = `/system/applicationstorage/${globalID}${safePath}`;

                    await writeFile(fullPath, content, ["user"]);
                }
            },

            electron: {

            }
        });

        win.Application = App;

        const loadModule = async (name) => {
            let m = await getFile(`/system/modules/${name}.js`);
            if (!m || DEBUG) {
                try {
                    const res = await fetch(`desktop/modules/${name}.js`);
                    if (!res.ok) throw new Error("Module fetch failed");
                    m = await res.text();
                    await writeFile(`/system/modules/${name}.js`, m);
                } catch {
                    error(`Unable to find module under name '${name}'`);
                    return null;
                }
            }
            return eval("(async() => { " + m + " })()");
        };

        Object.freeze(loadModule);

        win.module = loadModule

        const loadFile = async (name) => {
            if (!Object.keys(files).includes(name)) {
                warn(`Unable to find file under name '${name}'`)
            }
            const i = Object.keys(files).indexOf(name);
            file = await (Object.values(files)[i]).async("text");
            return file;
        }

        Object.freeze(loadFile);

        win.load = loadFile;

        function parsePos(pos) {
            if (typeof pos === "number") {
                return pos + "px";
            } else {
                return pos;
            }
        }
        const Topbar = Object.freeze({
            add: (name, pos, data) => {
                switch (name) {
                    case "Topbar":{
                        app.style.marginTop = "3em";
                        app.style.height = "calc(100% - 3em)";
                        break;
                    }
                    case "Close":{
                        const closeButton = appWindow.querySelector("closeButton") || document.createElement("button");
                        closeButton.classList.add("closeButton");
                        closeButton.style = "position: absolute; background-color: transparent; width: 32px; height: 32px; border-style: none; color: white; font-size: large; z-index: 99; margin: 0.5em; cursor: pointer;";
                        closeButton.onclick = () => killProc(id);
                        closeButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x-icon lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
                        closeButton.style.left = parsePos(pos[0]);
                        closeButton.style.top = parsePos(pos[1]);
                        appWindow.append(closeButton)
                        break;
                    }
                    case "Title":{
                        const title = appWindow.querySelector(".windowTitle") || document.createElement("p");
                        title.textContent = data;
                        title.classList.add("windowTitle");
                        title.style = "margin: 0.9em 1em; color: white; position: absolute;";
                        title.style.left = parsePos(pos[0])
                        drag.append(title);
                        break;
                    }
                    case "TextButton":{
                        const text = document.createElement("p");
                        const id = parseFloat(data.id);
                        const callback = data.callback;
                        const textcontent = data.text;
                        if (!id) {
                            return error("Topbar: Element ID required!");
                        }
                        if (!textcontent) {
                            return error("Topbar: Text content required!");;
                        }
                        if (!callback) {
                            return error("Topbar: Callback required!");
                        }
                        text.classList.add(`topbar${id}`);
                        text.textContent = textcontent;
                        text.addEventListener("click", callback);
                        text.style = "margin: 0.9em 1em; color: white; position: absolute; z-index: 999; cursor: pointer;";
                        text.style.left = parsePos(pos[0]);
                        drag.append(text);
                        break;
                    }
                    case "Text":{
                        const text = document.createElement("p");
                        const id = parseFloat(data.id);
                        const textcontent = data.text;
                        if (!id) {
                            return error("Topbar: Element ID required!");
                        }
                        if (!textcontent) {
                            return error("Topbar: Text content required!");;
                        }
                        const old = appWindow.querySelector(`.topbar${id}`);
                        if (old) {
                            return error("Topbar: You cannot have multiple elements with the same ID in one window!");
                        }
                        text.classList.add(`topbar${id}`);
                        text.textContent = textcontent;
                        text.style = "margin: 0.9em 1em; color: white; position: absolute; z-index: 999; cursor: pointer;";
                        text.style.left = parsePos(pos[0]);
                        drag.append(text);
                        break;
                    }
                    default:
                        warn(`Topbar: Unknown element to add '${name}'`);
                        break;
                }
            },

            set: (name, params) => {
                switch (name) {
                    case "Topbar":
                        if (typeof params !== "object") {
                            warn(`Topbar: Invalid Topbar set param data`);
                            return;
                        }
                        if (params.x)
                        drag.style.left = parsePos(params.x);
                        if (params.w)
                        drag.style.width = parsePos(params.w);
                        break;
                
                    default:
                        warn(`Topbar: Unknown element to set '${name}'`);
                        break;
                }
            },

            del: (id) => {
                if (id == "Topbar") {
                    app.style.marginTop = "0";
                    app.style.height = "100%";
                    return;
                }
                const el = appWindow.querySelector(`.topbar${id}`);
                if (el) el.remove(); else warn(`Topbar: Element not found '${id}'`);
            }
        })

        win.Topbar = Topbar;

        log("System APIs injected");
        
        log("Application appened to desktop");
        makeDraggableWindow(appWindow, drag)
        log("Window dragging hooked to window");
        await new Promise((r) => setTimeout(r, 50));
        appWindow.classList.add("windowLoaded");
        processList[id] = { element: appWindow, path, globalID }
        return { element: appWindow, id: id, path, globalID };
    }

    async function killProc(id) {
        if (!processList[id]) {
            warn(`Unable to find process with id '${id}'`);
            return;
        }
        log(`Killed process with id '${id}'`)
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
            textContent: `System Crash: ${reason}`,
            style: `
                color: white;
                margin: 0.5em;
                font-weight: 100;
                font-family: sans-serif;
                font-size: 1.5em;
            `
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
            log(`Permission denied: cannot create directory in '${parent}'`);
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
            log(`Permission denied: cannot write '${path}'`);
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
            log(`File not found '${path}'`);
            return;
        }

        const allowed = await checkperms(path, permissions);
        if (!allowed) {
            log(`Permission denied to read '${path}'`);
            return;
        }

        return file.content;
    }

    async function getFileData(path, permissions = ["user"]) {
        const file = await rawGetFile(path);
        if (!file) {
            log(`File not found '${path}'`);
            return;
        }

        const allowed = await checkperms(path, permissions);
        if (!allowed) {
            log(`Permission denied to read '${path}'`);
            return;
        }

        return file
    }

    async function listDir(path, permissions = ["user"]) {
        const dir = await rawGetFile(path);
        if (!dir || dir.type !== "dir") {
            log(`Directory not found '${path}'`);
            return;
        }

        const allowed = await checkperms(path, permissions);
        if (!allowed) {
            log(`Permission denied to list '${path}'`);
            return;
        }

        return dir.content;
    }

    async function deleteFile(path, permissions = ["user"]) {
        const file = await rawGetFile(path);
        if (!file) return;

        const allowed = await checkperms(path, permissions);
        if (!allowed) {
            log(`Permission denied to delete '${path}'`);
            return;
        }

        if (file.type === "dir") {
            for (const entry of file.content) {
                await deleteFile(entry, permissions);
            }
        }

        delete index[path]

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

    const installStep = document.createElement("p");
    installStep.textContent = "Loading system..."
    installStep.style = "text-align: center; position: absolute; bottom: 15em; left: 50%; transform: translateX(-50%); color: white; font-size: 1.75em; font-family: 'Poppins', sans-serif; font-weight: 100; opacity: 1; transition: opacity 0.5s;";
    const loadingSpinner = document.createElement("img");
    loadingSpinner.src = "./desktop/img/loadingSpinner.svg";
    loadingSpinner.style = `
    left: 50%;
    width: 6em;
    position: absolute;
    transform: translateX(-50%);
    bottom: 10em;
    opacity: 1;
    transition: opacity 0.5s;`
    desktop.append(loadingSpinner);

    let styles = await getFile("/system/desktop.css");
    if (!styles || DEBUG) {
        installStep.textContent = "Installing styles...";
        desktop.prepend(installStep);
        log("No desktop styles found, might be init boot.");
        let res;
        try {
            res = await fetch("./desktop/css/desktop.css");
        } catch (e) {
            error("Failed to get desktop CSS, system halted.");
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
    if (!wallpapers || wallpapers.length === 0 || DEBUG) {
        await makeDir("/home/wallpapers");
        installStep.textContent = "Installing wallpapers...";

        let res;
        try {
            res = await fetch("desktop/img/wallpapers/list.json");
        } catch {
            error("Failed to fetch wallpapers!");
            crash("Failed to fetch wallpapers list");
            return;
        }

        let list;
        try {
            list = JSON.parse(await res.text());
        } catch {
            error("Invalid wallpaper list!");
            crash("Invalid wallpaper list");
            return;
        }

        for (const wlp of list) {
            try {
                installStep.textContent = `Installing wallpaper: ${wlp}...`;
                const imgRes = await fetch(`desktop/img/wallpapers/${wlp}`);
                const data = await imgRes.arrayBuffer();
                await writeFile(`/home/wallpapers/${wlp}`, data);
            } catch {
                error(`Failed to fetch wallpaper: ${wlp}`);
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
        style: `opacity: 0; transition: opacity 0.5s`,
        src: wallpaperUrl,
    });
    log("Wallpaper initialized.");

    let dockScript = await getFile("/system/dock.js");
    let dockCss = await getFile("/system/dock.css");
    if (!dockScript || DEBUG) {
        installStep.textContent = `Installing dock...`;
        let res;
        try {
            res = await fetch("desktop/js/dock.js");
        } catch {
            error("Failed to fetch dock, might not exist on this build?");
        }
        if (res) {
            dockScript = await res.text();
            await writeFile("/system/dock.js", dockScript);
        }
    }
    if ((!dockCss && dockScript) || DEBUG) {
        let res;
        installStep.textContent = `Installing dock CSS...`;
        try {
            res = await fetch("desktop/css/dock.css");
        } catch {
            error("Failed to fetch dock CSS.");
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
    let searchScript = await getFile("/system/search.js");
    let searchCss = await getFile("/system/search.css");
    if (!searchScript || DEBUG) {
        installStep.textContent = `Installing search...`;
        let res;
        try {
            res = await fetch("desktop/js/search.js");
        } catch {
            error("Failed to fetch search, might not exist on this build?");
        }
        if (res) {
            searchScript = await res.text();
            await writeFile("/system/search.js", searchScript);
        }
    }
    if ((!searchCss && searchScript) || DEBUG) {
        let res;
        installStep.textContent = `Installing search CSS...`;
        try {
            res = await fetch("desktop/css/search.css");
        } catch {
            error("Failed to fetch search CSS.");
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

    let appCss = await getFile("/system/appstyles.css");
    if (!appCss || DEBUG) {
        installStep.textContent = `Installing app CSS...`;
        let res;
        try {
            res = await fetch("desktop/css/defaultapp.css");
        } catch {
            error("Failed to fetch default app CSS.");
        }
        if (res) {
            appCss = await res.text();
            await writeFile("/system/appstyles.css", appCss);
            log("App styles created");
        }
    }

    let fileProcs = await getFile("/system/fileProcesses.json");
    if (!appCss || DEBUG) {
        installStep.textContent = `Installing default file processes...`;
        let res;
        try {
            res = await fetch("desktop/misc/fileProcesses.json");
        } catch {
            error("Failed to fetch file processes file.");
        }
        if (res) {
            fileProcs = await res.text();
            await writeFile("/system/fileProcesses.json", fileProcs);
            log("FileProcesses list created");
        }
    }

    let hostname = await getFile("/system/hostname.conf");
    if (!hostname) {
        await writeFile("/system/hostname.conf", "prism");
    }

    let appList = await getFile("/system/applist.json");
    if (!appList || DEBUG) {
        installStep.textContent = `Installing default apps...`;
        let res;
        try {
            res = await fetch("desktop/app/list.json");
        } catch {
            error("Failed to fetch default app list!");
        }
        if (res) {
            appList = await res.text();
            await writeFile("/system/applist.json", appList);
            if (appList) {
                try {
                    appList = JSON.parse(appList)
                } catch {
                    log("Failed to parse default app list as JSON.");
                    appList = null;
                }
                if (appList) {
                    for (const app of appList) {
                        let res;
                        installStep.textContent = `Installing app: ${app}...`;
                        try {
                            res = await fetch(`desktop/app/${app}`);
                        } catch {
                            warn(`Failed to install app '${app}'.`);
                        }
                        if (res) {
                            const compressedApp = await res.arrayBuffer()
                            const appFiles = await JSZip.loadAsync(compressedApp);
                            const files = appFiles.files;
                            const i = Object.keys(files).indexOf("manifest.json");
                            if (i == -1) {
                                error("Malformed application, skipped.")
                                continue;
                            }
                            let manifest = await (Object.values(files)[i]).async("text");
                            try {
                                manifest = JSON.parse(manifest);
                            } catch {
                                error("Malformed application, skipped.");
                                continue;
                            }
                            let extraParams = {}
                            if (manifest.hidden) {
                                extraParams["hidden"] = true;
                            }
                            await writeFile(`/home/applications/${app}`, compressedApp, ["user"], extraParams);
                        }
                    }
                    log("Default apps installed.")
                }
            }
        }
    }

    desktop.append(wallpaperEl);

    if (searchScript) {
        eval(searchScript);
        log("Search initialized.");
    }

    if (dockScript) {
        eval(dockScript);
        log("Dock initialized.");
    }
    
    log("Desktop initialized successfully.");
    await new Promise((r) => setTimeout(r, 50));
    loadingSpinner.style.opacity = "0";
    installStep.style.opacity = "0";
    wallpaperEl.style.opacity = "1";
    await new Promise((r) => setTimeout(r, 500));
    loadingSpinner.remove();
    installStep.remove();
})();
