import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeWorkspace } from "../src/models.js";

export async function runContextMenuSmoke(window, app) {
  await window.webContents.executeJavaScript(`(async () => {
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    const tick = () => new Promise(resolve => setTimeout(resolve, 25));
    const deadline = Date.now() + 5000;
    while (document.documentElement.dataset.ready !== "true" && Date.now() < deadline) await tick();
    check(document.documentElement.dataset.ready === "true", "Renderer initialization timed out");
    document.querySelector("#daily-agenda-dialog").close();
    check(!document.querySelector("#delete-project, #delete-task"), "Permanent delete buttons remain");
    check(document.querySelector("#update-button").hidden && document.querySelector("#update-status").hidden, "Update controls visible without an update");
    const { renderUpdateView } = await import("./ui/update-view.js");
    const updateElements = { updateButton: document.querySelector("#update-button"), updateStatus: document.querySelector("#update-status") };
    for (const status of ["available", "downloading", "ready", "installing"]) {
      renderUpdateView(updateElements, { status, version: "0.1.14", progress: 20 });
      check(!updateElements.updateButton.hidden, "Update action disappeared during " + status);
    }
    for (const status of ["checking", "current", "unavailable"]) {
      renderUpdateView(updateElements, { status });
      check(updateElements.updateButton.hidden, "Update action remained visible during " + status);
    }
    const menu = document.querySelector("#item-context-menu");
    const dialog = document.querySelector("#confirm-dialog");
    const item = (list, text) => [...document.querySelector(list).children].find(button => button.textContent.includes(text));
    const context = (target, keyboard = false) => {
      target.dispatchEvent(keyboard ? new KeyboardEvent("keydown", { key: "F10", shiftKey: true, bubbles: true })
        : new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: innerWidth - 2, clientY: innerHeight - 2 }));
      check(!menu.hidden && document.activeElement === document.querySelector("#context-delete"), "Context menu did not open or receive focus");
      const rect = menu.getBoundingClientRect();
      check(rect.right <= innerWidth && rect.bottom <= innerHeight, "Context menu overflowed the window");
    };
    const remove = async (target, confirmed = true, keyboard = false) => {
      context(target, keyboard);
      document.querySelector("#context-delete").click();
      check(menu.hidden && dialog.open, "Delete did not open confirmation");
      dialog.querySelector('button[value="' + (confirmed ? "confirm" : "cancel") + '"]').click();
      await tick();
      check(!dialog.open, "Confirmation did not close");
    };
    const add = (input, form, name) => {
      document.querySelector(input).value = name;
      document.querySelector(form).requestSubmit();
    };
    const originalProject = document.querySelector("#project-title").textContent;
    context(item("#type-list", "Пустой раздел"));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    check(menu.hidden, "Escape did not dismiss the menu");
    context(item("#type-list", "Пустой раздел"));
    document.querySelector("#project-list").dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    check(menu.hidden && !dialog.open, "Empty area opened deletion menu");
    await remove(item("#type-list", "Пустой раздел"));
    check(document.querySelector("#project-title").textContent === originalProject, "Deleting another section changed current selection");
    add("#type-input", "#type-form", "Удаляемый раздел");
    add("#project-input", "#project-form", "Целевой проект");
    add("#task-input", "#task-form", "Первая удаляемая задача");
    add("#task-input", "#task-form", "Вторая удаляемая задача");
    await remove(item("#task-list", "Первая удаляемая задача"), false);
    check(document.querySelector("#task-list").children.length === 2, "Cancel deleted a task");
    await remove(item("#task-list", "Первая удаляемая задача"), true, true);
    check(document.querySelector("#task-list").children.length === 1
      && document.querySelector("#task-title").value === "Вторая удаляемая задача", "Deleting an unselected task removed or selected the wrong task");
    add("#project-input", "#project-form", "Сохраняемый проект");
    await remove(item("#project-list", "Целевой проект"), false);
    check(document.querySelector("#project-list").children.length === 2, "Cancel deleted a project");
    await remove(item("#project-list", "Целевой проект"));
    check(document.querySelector("#project-list").children.length === 1
      && document.querySelector("#project-title").textContent === "Сохраняемый проект", "Deleting an unselected project changed the wrong project");
    add("#task-input", "#task-form", "Каскадная задача");
    document.querySelector('#type-list [data-type-id="work"]').click();
    await remove(item("#type-list", "Удаляемый раздел"), false);
    check(document.querySelector("#type-list").children.length === 2, "Cancel deleted a section");
    await remove(item("#type-list", "Удаляемый раздел"));
    check(document.querySelector("#type-list").children.length === 1
      && document.querySelector("#project-title").textContent === originalProject, "Section deletion affected another section");
    await remove(document.querySelector('#type-list [data-type-id="work"]'));
    check(!document.querySelector("#type-list").children.length && !document.querySelector("#project-list").children.length
      && !document.querySelector("#task-list").children.length && document.querySelector("#details").hidden, "Last section deletion left orphaned items");
    document.querySelector("#show-journal").click();
    const rows = document.querySelectorAll("#journal-list .journal-entry");
    check(rows.length === 8 && document.querySelectorAll('#journal-list [data-action="deleted"]').length === 4, "Deletion history was lost or duplicated");
  })()`);
  app.once("will-quit", () => {
    try {
      const saved = JSON.parse(readFileSync(join(app.getPath("userData"), "projects.json"), "utf8"));
      assert.deepEqual(saved.projectTypes, []);
      assert.deepEqual(saved.projects, []);
      assert.equal(saved.taskJournal.length, 8);
      assert.equal(saved.calendarEvents.length, 1);
      assert.deepEqual(normalizeWorkspace(saved).projectTypes, []);
      console.log("Context menu smoke passed: cancel, exact targets, cascading deletion, empty workspace, and history persistence");
    } catch (error) {
      console.error(error);
      app.exit(1);
    }
  });
}
