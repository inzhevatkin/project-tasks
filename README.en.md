# TiM

[Русский](README.md) · [English](README.en.md) · [简体中文](README.zh-CN.md)

TiM is a desktop app for organizing personal projects and tasks. It is built with Electron and runs from the same codebase on Windows, macOS, and Linux. A Windows installer is currently available.

## Features

- Create and delete projects, group them by type, and switch between groups.
- Keep tasks and optional comments inside each project; rename groups, projects, and tasks by double-clicking.
- Track task completion and save changes automatically to a local JSON file.
- Use a classic Pomodoro timer: 25 minutes of focus, a 5-minute short break, and a 15-minute long break after four focus sessions.
- Start breaks automatically, hear distinct bell-like sounds at the end of focus and breaks, and see timer progress on the Windows taskbar icon or macOS Dock icon.
- Review today's focus time, a seven-day chart, and session history on the Statistics page.
- Add one-time or yearly calendar events, optionally with a time, and see a daily agenda when the app starts or the date changes.
- Switch between light and dark themes, and use the interface in Russian, English, or Simplified Chinese.

## Install and run

Download the latest Windows installer from [GitHub Releases](https://github.com/inzhevatkin/project-tasks/releases/latest). Choose Russian, English, or Simplified Chinese during installation; the app uses the selected language and keeps it through automatic updates. Project names, task names, comments, and event titles you enter are not translated.

The installed Windows app checks for updates at startup and every six hours. The Update button becomes available when a newer release is published. The installer is not yet signed with a trusted certificate, so Windows SmartScreen may display a warning.

To run from source, install Node.js 22 or newer and use:

```powershell
npm install
npm start
```

Updates are not available when running from source. To build a Windows installer locally, run `npm ci` and then `npm run dist:win`. The file will be placed at `dist/TiM-setup-<version>.exe`.

## Data and privacy

Projects, tasks, and calendar events are stored locally in `%APPDATA%\project-tasks\projects.json`. Pomodoro history and the daily-agenda display state are stored in Electron's local storage under the same data directory. Updates retain this directory. The daily agenda appears only while the app is running; the closed app does not send reminders.

## Development

Run `npm test` to execute the tests. Each commit to `main` triggers GitHub Actions to test the app, build the Windows installer, and publish a GitHub Release with the installer and `latest.yml`. The patch version increases by one for each commit after `0.1.0`. For local commits, the Git hook installed by `npm install` or `npm ci` also updates `package.json` and `package-lock.json`.

Key files: `electron/main.js` starts the app and handles IPC; `electron/workspace-store.js` manages local data; `src/renderer.js` initializes the interface; `src/workspace-controller.js`, `src/calendar-controller.js`, and `src/pomodoro-controller.js` implement the main features; `src/i18n.js` contains interface translations; `test/` contains tests.

## Planned improvements

Due dates, priorities, tags, search, filtering, sorting, project archiving, SQLite for larger datasets, and signed macOS and Linux packages.
