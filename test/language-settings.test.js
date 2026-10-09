import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLanguageSettings } from "../electron/language-settings.js";
import { applicationMenu } from "../electron/application-menu.js";

test("chosen language persists across launches and serializes writes without altering other data", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "tim-language-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "installer-language.txt");
  const settings = createLanguageSettings(path, "en");
  assert.equal(settings.get(), "en");
  for (const language of ["zh", "ru", "en"]) {
    await settings.set(language);
    assert.equal(createLanguageSettings(path, "ru").get(), language);
  }
  await assert.rejects(settings.set("invalid"));
  assert.equal(await readFile(path, "utf8"), "en");
  await Promise.all([settings.set("ru"), settings.set("en"), settings.set("zh")]);
  assert.equal(settings.get(), "zh");
  assert.equal(createLanguageSettings(path).get(), "zh");
});

test("native menus use localized labels and keep editing roles and settings shortcut", () => {
  for (const [locale, labels] of [["ru", ["Файл", "Правка", "Вид", "Окно", "Справка"]], ["en", ["File", "Edit", "View", "Window", "Help"]], ["zh", ["文件", "编辑", "视图", "窗口", "帮助"]]]) {
    let opened = false;
    const menu = applicationMenu(locale, { showSettings: () => { opened = true; }, showAbout: () => {}, platform: "win32" });
    assert.deepEqual(menu.map((item) => item.label), labels);
    assert.equal(menu[0].submenu[0].accelerator, "CmdOrCtrl+,");
    menu[0].submenu[0].click();
    assert.equal(opened, true);
    assert.equal(menu[1].submenu.find((item) => item.role === "copy").role, "copy");
    for (const item of menu.flatMap((entry) => entry.submenu)) if (!item.type) assert.ok(item.label);
  }
});
