export function createItemContextMenu(menu, deleteButton, statusGroup) {
  let actions = null;
  let anchor = null;

  function close(restoreFocus = false) {
    menu.hidden = true;
    actions = null;
    if (restoreFocus && anchor?.isConnected) anchor.focus();
    anchor = null;
  }

  function open(event, item, itemActions) {
    event.preventDefault();
    close();
    anchor = item;
    actions = itemActions;
    statusGroup.hidden = !actions.onStatus;
    for (const button of statusGroup.querySelectorAll("[data-task-status]")) {
      button.setAttribute("aria-checked", String(button.dataset.taskStatus === actions.status));
    }
    menu.hidden = false;
    const rect = item.getBoundingClientRect();
    const x = event.clientX || rect.left;
    const y = event.clientY || rect.bottom;
    menu.style.left = `${Math.max(4, Math.min(x, window.innerWidth - menu.offsetWidth - 4))}px`;
    menu.style.top = `${Math.max(4, Math.min(y, window.innerHeight - menu.offsetHeight - 4))}px`;
    const current = statusGroup.hidden ? null : statusGroup.querySelector('[aria-checked="true"]');
    (current ?? deleteButton).focus();
  }

  menu.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button || !actions) return;
    const action = button === deleteButton ? actions.onDelete : actions.onStatus;
    const status = button.dataset.taskStatus;
    close(true);
    if (action) Promise.resolve(action(status)).catch(console.error);
  });
  document.addEventListener("pointerdown", (event) => { if (!menu.contains(event.target)) close(); }, true);
  document.addEventListener("contextmenu", () => close(), true);
  document.addEventListener("focusin", (event) => { if (!menu.contains(event.target)) close(); });
  document.addEventListener("keydown", (event) => {
    if (menu.hidden) return;
    if (event.key === "Escape") { event.preventDefault(); close(true); }
    else if (event.key === "Tab") close();
    else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const buttons = [...menu.querySelectorAll("button")].filter((button) => !button.closest("[hidden]"));
      const index = buttons.indexOf(document.activeElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1
        : (index + (event.key === "ArrowUp" ? -1 : 1) + buttons.length) % buttons.length;
      buttons[next]?.focus();
    }
  });
  document.addEventListener("scroll", () => close(), true);
  window.addEventListener("resize", () => close());
  return { open, close };
}
