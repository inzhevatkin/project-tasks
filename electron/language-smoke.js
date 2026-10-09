import { Menu } from "electron";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export async function runLanguageSmoke(window, app) {
  const ready = () => window.webContents.executeJavaScript(`(async () => {
    const deadline = Date.now() + 5000;
    while (document.documentElement.dataset.ready !== "true" && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    if (document.documentElement.dataset.ready !== "true") throw new Error("Language reload timed out");
  })()`);
  await ready();
  await window.webContents.executeJavaScript(`
    document.querySelector("#daily-agenda-dialog").close();
    document.querySelector("#task-title").value = "Моя задача / My task / 我的任务";
    document.querySelector("#task-title").dispatchEvent(new Event("input", { bubbles: true }));
    document.querySelector("#task-comment").textContent = "Мой комментарий";
    document.querySelector("#task-comment").dispatchEvent(new Event("input", { bubbles: true }));
    document.querySelector("#task-list .selected").dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    document.querySelector('[data-task-status="in_progress"]').click();
    document.querySelector("#pomodoro-toggle").click();
  `);
  const timer = await window.webContents.executeJavaScript('JSON.parse(localStorage.getItem("projectTasks.pomodoro"))');
  const originalLocale = (await window.webContents.executeJavaScript('window.projectTasks.getAppInfo()')).locale;
  for (const locale of ["en", "zh", "ru"].filter((value) => value !== originalLocale).concat(originalLocale)) {
    const loaded = new Promise((resolve) => window.webContents.once("did-finish-load", resolve));
    await window.webContents.executeJavaScript(`
      document.querySelector("#show-settings").click();
      if (!document.querySelector("#settings-dialog").open) throw new Error("Settings dialog did not open");
      document.querySelector("#app-language").value = "${locale}";
      document.querySelector("#settings-form").requestSubmit();
    `);
    await loaded;
    await ready();
    const result = await window.webContents.executeJavaScript(`({
      language: document.documentElement.lang,
      settings: document.querySelector("#show-settings").textContent,
      task: document.querySelector("#task-title").value,
      comment: document.querySelector("#task-comment").textContent,
      status: document.querySelector("#task-list .selected").dataset.status,
      timer: JSON.parse(localStorage.getItem("projectTasks.pomodoro")),
      history: JSON.parse(localStorage.getItem("projectTasks.pomodoroHistory"))
    })`);
    assert.equal(result.language, locale === "zh" ? "zh-CN" : locale);
    assert.equal(result.settings, { ru: "Настройки", en: "Settings", zh: "设置" }[locale]);
    assert.equal(Menu.getApplicationMenu().items[0].label, { ru: "Файл", en: "File", zh: "文件" }[locale]);
    assert.equal(result.task, "Моя задача / My task / 我的任务");
    assert.equal(result.comment, "Мой комментарий");
    assert.equal(result.status, "in_progress");
    assert.equal(result.timer.running, true);
    assert.equal(result.timer.deadline, timer.deadline);
    assert.equal(result.timer.activeRunId, timer.activeRunId);
    assert.equal(result.history.length, 1);
    assert.equal(readFileSync(join(app.getPath("userData"), "installer-language.txt"), "utf8"), locale);
  }
  console.log("Language smoke passed: Russian/English/Chinese, native menus, saved edits, active timer and history across reloads");
}
