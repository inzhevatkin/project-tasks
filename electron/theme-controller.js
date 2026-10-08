const backgrounds = { light: "#f3f5f9", dark: "#11131a" };

export function initializeNativeTheme({ ipcMain, nativeTheme, BrowserWindow }) {
  ipcMain.handle("app:theme", (event, theme) => {
    if (!Object.hasOwn(backgrounds, theme) || !BrowserWindow.fromWebContents(event.sender)) {
      throw new Error("Invalid application theme request");
    }
    nativeTheme.themeSource = theme;
    for (const window of BrowserWindow.getAllWindows()) window.setBackgroundColor(backgrounds[theme]);
    return theme;
  });
}
