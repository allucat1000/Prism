let searchState = false;
const div = document.createElement("div");
const input = document.createElement("input");
const results = document.createElement("div");
results.classList.add("searchResults")
input.placeholder = "Search for files"
input.classList.add("searchInput")
div.classList.add("searchHidden");
div.id = "searchPopup";
div.append(input)
div.append(results)
desktop.append(div);

window.addEventListener("keydown", (e) => {
    if (e.altKey && e.key == "Enter") {
        e.preventDefault();
        toggleSearch();
    } else if (searchState === true && e.key == "Escape") {
        toggleSearch()
        input.value = "";
    }
})

input.addEventListener("input", async() => {
    const query = input.value.toLowerCase();
    results.innerHTML = "";
    if (query.length < 2) return;
    const matches = Object.values(index)
        .filter(file => file.name.toLowerCase().includes(query))
        .sort((a, b) => a.name.localeCompare(b.name));

    for (const file of matches) {
        const resEl = document.createElement("div");
        resEl.classList.add("searchResult")
        resEl.textContent = file.name;
        resEl.onclick = () => {
            input.value = "";
            results.innerHTML = "";
            if (file.name.endsWith(".app")) {
                execApp(file.path);
            }
            toggleSearch();
        }
        if (!file.hidden) results.append(resEl);
    }
})

async function toggleSearch() {
    if (searchState === true) {
        log("[SEARCH] Search window closed")
        searchState = false;
        input.disabled = true;
        div.classList.add("searchHidden");
    } else {
        log("[SEARCH] Search window opened")
        searchState = true;
        input.disabled = false;
        input.focus()
        div.classList.remove("searchHidden")
    }
}