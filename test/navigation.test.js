import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setLocale, t } from "../src/i18n.js";

test("Journal precedes Statistics and uses the new name throughout the interface", () => {
  const html = readFileSync(new URL("../src/index.html", import.meta.url), "utf8");
  const tabs = [...html.matchAll(/<button id="(show-[^"]+)" class="view-tab[^\"]*"[^>]*>([^<]+)<\/button>/g)];
  assert.deepEqual(tabs.map((match) => match[1]), ["show-tasks", "show-calendar", "show-journal", "show-statistics"]);
  assert.equal(tabs[2][2], "Журнал");
  assert.match(html, /<h2>Журнал<\/h2>/);
  assert.match(html, /aria-label="Поиск в журнале"/);
  assert.doesNotMatch(html, /[Дд]невник/);
  for (const [locale, name, search] of [["ru", "Журнал", "Поиск в журнале"], ["en", "Journal", "Search the journal"], ["zh", "工作日志", "搜索工作日志"]]) {
    setLocale(locale);
    assert.equal(t("Журнал"), name);
    assert.equal(t("Поиск в журнале"), search);
  }
  setLocale("ru");
});

test("task status controls are only in the task context menu", () => {
  const html = readFileSync(new URL("../src/index.html", import.meta.url), "utf8");
  assert.doesNotMatch(html, /id="task-status"|for="task-status"/);
  const group = html.match(/<div id="context-task-statuses"[^>]*>([\s\S]*?)<\/div>/)?.[1];
  assert.ok(group);
  assert.deepEqual([...group.matchAll(/data-task-status="([^"]+)"/g)].map((match) => match[1]), ["pending", "in_progress", "completed"]);
  assert.equal([...group.matchAll(/role="menuitemradio"/g)].length, 3);
});
