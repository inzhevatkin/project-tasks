# TiM

[Русский](README.md) · [English](README.en.md) · [简体中文](README.zh-CN.md)

TiM 是一款用于管理个人项目和任务的桌面应用。它基于 Electron 开发，Windows、macOS 和 Linux 使用同一套代码。目前提供 Windows 安装程序。

## 功能

- 创建和删除项目，按类型对项目分组，并在不同分类之间切换。
- 在项目中管理任务和可选备注；双击即可重命名分类、项目和任务。
- 标记任务完成状态，并将更改自动保存到本地 JSON 文件。
- 使用经典番茄钟：专注 25 分钟、短休息 5 分钟，每完成四个专注时段后长休息 15 分钟。
- 自动开始休息；专注和休息结束时播放不同的钟声；在 Windows 任务栏或 macOS Dock 图标上显示计时进度。
- 在统计页面查看今日专注时间、最近七天图表和时段记录。
- 在日历中添加一次性或每年重复的事件，可选填写时间；启动应用或日期变化时显示当日计划。
- 切换浅色和深色主题，使用俄语、英语或简体中文界面。

## 安装与运行

请从 [GitHub Releases](https://github.com/inzhevatkin/project-tasks/releases/latest) 下载最新的 Windows 安装程序。安装时可选择俄语、英语或简体中文；应用会使用所选语言，并在自动更新后保留该设置。您输入的项目名、任务名、备注和事件标题不会自动翻译。

已安装的 Windows 版本会在启动时及此后每六小时检查一次更新。发布新版本后，“更新”按钮才会启用。安装程序尚未使用受信任的证书签名，因此 Windows SmartScreen 可能会显示警告。

从源代码运行需要 Node.js 22 或更高版本：

```powershell
npm install
npm start
```

从源代码运行时无法使用应用内更新。若要在本地构建 Windows 安装程序，请运行 `npm ci`，然后运行 `npm run dist:win`。生成的文件位于 `dist/TiM-setup-<version>.exe`。

## 数据与隐私

项目、任务和日历事件保存在本地 `%APPDATA%\project-tasks\projects.json`。番茄钟历史记录和每日计划的显示状态保存在同一数据目录下的 Electron 本地存储中。更新不会删除该目录。每日计划仅在应用运行时显示；关闭应用后不会发送提醒。

## 开发

运行 `npm test` 执行测试。每次向 `main` 提交代码时，GitHub Actions 都会运行测试、构建 Windows 安装程序，并发布包含安装程序和 `latest.yml` 的 GitHub Release。从 `0.1.0` 之后，每次提交都会使补丁版本号加一。在本地执行 `npm install` 或 `npm ci` 后，Git 钩子也会自动更新 `package.json` 和 `package-lock.json` 中的版本号。

主要文件：`electron/main.js` 启动应用并处理 IPC；`electron/workspace-store.js` 管理本地数据；`src/renderer.js` 初始化界面；`src/workspace-controller.js`、`src/calendar-controller.js` 和 `src/pomodoro-controller.js` 实现主要功能；`src/i18n.js` 包含界面翻译；`test/` 包含测试。

## 后续计划

到期日期、优先级、标签、搜索、筛选、排序、项目归档、用于大型数据集的 SQLite，以及已签名的 macOS 和 Linux 安装包。
