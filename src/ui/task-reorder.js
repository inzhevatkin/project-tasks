export function bindTaskReorder(list, { getProject, onMove }) {
  let dragged = null;
  let suppressClickUntil = 0;
  const items = () => [...list.querySelectorAll(".task-item")];
  const clearMarkers = () => items().forEach((item) => item.classList.remove("drop-before", "drop-after"));
  function clear() {
    dragged = null;
    clearMarkers();
    items().forEach((item) => item.classList.remove("dragging"));
  }
  function target(event) {
    if (!dragged || getProject()?.id !== dragged.projectId) return null;
    const rows = items();
    const item = event.target.closest(".task-item")
      ?? rows.find((row) => event.clientY < row.getBoundingClientRect().bottom) ?? rows.at(-1);
    if (!item || !list.contains(item) || item.dataset.id === dragged.taskId) return null;
    const rect = item.getBoundingClientRect();
    return { item, placement: event.clientY < rect.top + rect.height / 2 ? "before" : "after" };
  }
  list.addEventListener("dragstart", (event) => {
    const item = event.target.closest(".task-item");
    const project = getProject();
    if (!item || !list.contains(item) || !project?.tasks.some((task) => task.id === item.dataset.id)) return;
    dragged = { projectId: project.id, taskId: item.dataset.id };
    event.dataTransfer.setData("application/x-tim-task", JSON.stringify(dragged));
    event.dataTransfer.effectAllowed = "move";
    item.classList.add("dragging");
  });
  list.addEventListener("dragover", (event) => {
    clearMarkers();
    const drop = target(event);
    if (!drop) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    drop.item.classList.add(`drop-${drop.placement}`);
  });
  list.addEventListener("dragleave", (event) => {
    if (!list.contains(event.relatedTarget)) clearMarkers();
  });
  list.addEventListener("drop", (event) => {
    const drop = target(event);
    if (!drop) { clear(); return; }
    event.preventDefault();
    const taskId = dragged.taskId;
    clear();
    suppressClickUntil = Date.now() + 200;
    onMove(taskId, drop.item.dataset.id, drop.placement);
  });
  list.addEventListener("dragend", () => {
    suppressClickUntil = Date.now() + 200;
    clear();
  });
  // Also allow reordering without a mouse; do not intercept comment editing.
  list.addEventListener("keydown", (event) => {
    if (!event.altKey || event.ctrlKey || event.metaKey || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
    const item = event.target.closest(".task-item");
    const rows = items();
    const index = rows.indexOf(item);
    if (index < 0) return;
    event.preventDefault();
    const neighbor = rows[index + (event.key === "ArrowUp" ? -1 : 1)];
    if (!neighbor) return;
    onMove(item.dataset.id, neighbor.dataset.id, event.key === "ArrowUp" ? "before" : "after");
    items().find((row) => row.dataset.id === item.dataset.id)?.focus();
  });
  return { isDragging: () => Boolean(dragged), suppressClick: () => Date.now() < suppressClickUntil, clear };
}
