import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export async function runTaskManagementSmoke(window, app) {
  const ready = () => window.webContents.executeJavaScript(`(async () => {
    const deadline = Date.now() + 5000;
    while (document.documentElement.dataset.ready !== "true" && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    if (document.documentElement.dataset.ready !== "true") throw new Error("Task management initialization timed out");
  })()`);
  await ready();
  const expected = await window.webContents.executeJavaScript(`(async () => {
    const check = (value, message) => { if (!value) throw new Error(message); };
    document.querySelector("#daily-agenda-dialog").close();
    const list = document.querySelector("#task-list");
    const rows = () => [...list.querySelectorAll(".task-item")];
    const find = id => rows().find(row => row.dataset.id === id);
    const order = () => rows().map(row => row.dataset.id);
    const add = (input, form, value) => { document.querySelector(input).value = value; document.querySelector(form).requestSubmit(); };
    const setStatus = (id, status) => {
      find(id).dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
      document.querySelector('[data-task-status="' + status + '"]').click();
    };
    setStatus("smoke-task", "in_progress");
    for (const name of ["R2", "R3", "R4"]) add("#task-input", "#task-form", name);
    const ids = order();
    setStatus(ids[1], "in_progress");
    setStatus(ids[2], "in_progress");
    check(rows().filter(row => row.dataset.status === "in_progress").length === 3, "Existing work was stopped");
    setStatus(ids[3], "in_progress");
    check(document.querySelector("#task-limit-dialog").open && find(ids[3]).dataset.status === "pending", "Fourth start was not rejected");
    check(document.querySelector("#task-limit-message").textContent.includes("3"), "Limit explanation is missing");
    document.querySelector("#task-limit-dialog").close();
    setStatus(ids[0], "pending");
    setStatus(ids[3], "in_progress");
    check(rows().filter(row => row.dataset.status === "in_progress").length === 3, "Freed work slot could not be reused");
    add("#project-input", "#project-form", "Other project");
    add("#task-input", "#task-form", "Cross-project task");
    const crossId = order()[0];
    setStatus(crossId, "in_progress");
    check(document.querySelector("#task-limit-dialog").open && find(crossId).dataset.status === "pending", "Limit was not global");
    document.querySelector("#task-limit-dialog").close();
    document.querySelector('#project-list [data-id="smoke-project"]').click();
    find(ids[3]).click();
    const drag = (sourceId, targetId, placement, cancel = false) => {
      const source = find(sourceId), target = find(targetId);
      check(source.draggable, "Task is not draggable");
      const dataTransfer = new DataTransfer();
      source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer }));
      const rect = target.getBoundingClientRect();
      const options = { bubbles: true, cancelable: true, dataTransfer, clientX: rect.left + 30,
        clientY: placement === "before" ? rect.top + 2 : rect.bottom - 2 };
      target.querySelector(".item-title").dispatchEvent(new DragEvent("dragover", options));
      check(target.classList.contains("drop-" + placement), "Drop position indicator missing");
      if (!cancel) target.dispatchEvent(new DragEvent("drop", options));
      list.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer }));
      check(!list.querySelector(".dragging, .drop-before, .drop-after"), "Drag markers remained");
      check(!document.querySelector("#rename-dialog").open, "Drag opened renaming dialog");
      check(document.querySelector("#task-title").value === "R4", "Reordering changed selected task");
    };
    drag(ids[0], ids[3], "after");
    check(order().join() === [ids[1], ids[2], ids[3], ids[0]].join(), "Move to last failed");
    drag(ids[0], ids[1], "before");
    check(order().join() === ids.join(), "Move to first failed");
    drag(ids[1], ids[2], "after");
    find(ids[3]).focus();
    find(ids[3]).dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", altKey: true, bubbles: true, cancelable: true }));
    const expectedOrder = [ids[0], ids[2], ids[3], ids[1]];
    check(order().join() === expectedOrder.join() && document.activeElement.dataset.id === ids[3], "Keyboard move or focus failed");
    drag(ids[2], ids[0], "before", true);
    list.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() }));
    check(order().join() === expectedOrder.join(), "Canceled or external drag changed order");
    const deadline = Date.now() + 5000;
    let saved;
    do {
      await new Promise(resolve => setTimeout(resolve, 50));
      saved = await window.projectTasks.load();
    } while (saved.projects[0].tasks.map(task => task.id).join() !== expectedOrder.join() && Date.now() < deadline);
    check(saved.projects[0].tasks.map(task => task.id).join() === expectedOrder.join(), "Order was not saved");
    check(saved.taskJournal.length === 10 && saved.taskJournal.filter(entry => entry.action === "paused").length === 1, "Blocked starts or moves modified journal");
    return { ids: expectedOrder, saved };
  })()`);
  const reloaded = new Promise((resolve) => window.webContents.once("did-finish-load", resolve));
  window.webContents.reload();
  await reloaded;
  await ready();
  const result = await window.webContents.executeJavaScript(`({
    ids: [...document.querySelectorAll("#task-list .task-item")].map(row => row.dataset.id),
    working: document.querySelectorAll("#task-list .in-progress").length
  })`);
  assert.deepEqual(result.ids, expected.ids);
  assert.equal(result.working, 3);
  assert.deepEqual(JSON.parse(readFileSync(join(app.getPath("userData"), "projects.json"), "utf8")), expected.saved);
  console.log("Task management smoke passed: three active tasks, global limit, drag/drop, cancel, keyboard order, and reload persistence");
}
