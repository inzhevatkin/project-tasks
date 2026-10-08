export function createItemContextMenu(menu, deleteButton) {
  let action = null;
  let anchor = null;

  function close(restoreFocus = false) {
    menu.hidden = true;
    action = null;
    if (restoreFocus && anchor?.isConnected) anchor.focus();
    anchor = null;
  }

  function open(event, item, onDelete) {
    event.preventDefault();
    close();
    anchor = item;
    action = onDelete;
    menu.hidden = false;
    const rect = item.getBoundingClientRect();
    const x = event.clientX || rect.left;
    const y = event.clientY || rect.bottom;
    menu.style.left = `${Math.max(4, Math.min(x, window.innerWidth - menu.offsetWidth - 4))}px`;
    menu.style.top = `${Math.max(4, Math.min(y, window.innerHeight - menu.offsetHeight - 4))}px`;
    deleteButton.focus();
  }

  deleteButton.addEventListener("click", () => {
    const onDelete = action;
    close(true);
    if (onDelete) Promise.resolve(onDelete()).catch(console.error);
  });
  document.addEventListener("pointerdown", (event) => { if (!menu.contains(event.target)) close(); }, true);
  document.addEventListener("contextmenu", () => close(), true);
  document.addEventListener("focusin", (event) => { if (!menu.contains(event.target)) close(); });
  document.addEventListener("keydown", (event) => {
    if (menu.hidden) return;
    if (event.key === "Escape") { event.preventDefault(); close(true); }
    else if (event.key === "Tab") close();
    else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) { event.preventDefault(); deleteButton.focus(); }
  });
  document.addEventListener("scroll", () => close(), true);
  window.addEventListener("resize", () => close());
  return { open, close };
}
