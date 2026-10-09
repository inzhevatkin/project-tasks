// Acquire the lock after setting userData, before initializing stores or windows.
export function acquireSingleInstance({ app, activate }) {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return false;
  }
  app.on("second-instance", () => {
    // Let the normal startup finish if both launches happened together.
    app.whenReady().then(activate);
  });
  return true;
}

export function focusWindow(window) {
  if (!window || window.isDestroyed()) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}
