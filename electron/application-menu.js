const labels = {
  ru: ["Файл", "Правка", "Вид", "Окно", "Справка", "Настройки", "Выход", "Отменить", "Повторить", "Вырезать", "Копировать", "Вставить", "Выделить всё", "Обновить окно", "Фактический размер", "Увеличить", "Уменьшить", "Полный экран", "Свернуть", "Закрыть окно", "О программе"],
  en: ["File", "Edit", "View", "Window", "Help", "Settings", "Quit", "Undo", "Redo", "Cut", "Copy", "Paste", "Select all", "Reload window", "Actual size", "Zoom in", "Zoom out", "Full screen", "Minimize", "Close window", "About"],
  zh: ["文件", "编辑", "视图", "窗口", "帮助", "设置", "退出", "撤销", "重做", "剪切", "复制", "粘贴", "全选", "重新加载窗口", "实际大小", "放大", "缩小", "全屏", "最小化", "关闭窗口", "关于"]
};

export function applicationMenu(locale, { showSettings, showAbout, platform = process.platform }) {
  const text = labels[locale] ?? labels.ru;
  const role = (index, name) => ({ label: text[index], role: name });
  const settings = { label: text[5], accelerator: "CmdOrCtrl+,", click: showSettings };
  const template = [
    { label: text[0], submenu: [settings, { type: "separator" }, role(6, "quit")] },
    { label: text[1], submenu: [role(7, "undo"), role(8, "redo"), { type: "separator" }, role(9, "cut"), role(10, "copy"), role(11, "paste"), role(12, "selectAll")] },
    { label: text[2], submenu: [role(14, "resetZoom"), role(15, "zoomIn"), role(16, "zoomOut"), { type: "separator" }, role(17, "togglefullscreen")] },
    { label: text[3], submenu: [role(18, "minimize"), role(19, "close")] },
    { label: text[4], submenu: [{ label: text[20], click: showAbout }] }
  ];
  if (platform === "darwin") template.unshift({ label: "TiM", submenu: [{ label: text[20], click: showAbout }, settings, { type: "separator" }, role(6, "quit")] });
  return template;
}
