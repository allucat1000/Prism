const div = document.createElement("div");
setAttrs(div, {
    id: "dock",
    class: "dockAnim"
})
desktop.append(div);

const processList = document.createElement("div");
setAttrs(processList, {
    id: "processList"
});
const timeWidget = document.createElement("div");
setAttrs(timeWidget, {
    id: "timeWidget"
});
const timeEl = document.createElement("p");
timeEl.classList.add("timeWidgetText")
const dateEl = document.createElement("p");
dateEl.classList.add("timeWidgetText")
function pad(n) {
    return n.toString().padStart(2, "0");
}

timeWidget.append(timeEl);
timeWidget.append(dateEl);
div.append(processList)
div.append(timeWidget)
function timeUpdate() {
    const date = new Date()
    timeEl.textContent = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    dateEl.textContent = `${pad(day)}/${pad(month)}/${pad(year)}`
    setTimeout(timeUpdate, 1000);
}

timeUpdate();

setTimeout(dockAnim, 50);

function dockAnim() {
    div.classList.remove("dockAnim")
}