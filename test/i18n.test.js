import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setLocale, t, intlLocale } from "../src/i18n.js";

test("all static Russian interface text has English and Chinese translations", () => {
  const html = readFileSync(new URL("../src/index.html", import.meta.url), "utf8");
  const text = [...html.matchAll(/>([^<>]+)</g)].map((match) => match[1].trim());
  const attributes = [...html.matchAll(/(?:aria-label|placeholder|title)="([^"]+)"/g)].map((match) => match[1]);
  const labels = [...new Set([...text, ...attributes].filter((value) => /[А-Яа-яЁё]/.test(value)))];
  for (const locale of ["en", "zh"]) {
    setLocale(locale);
    for (const label of labels) assert.notEqual(t(label), label, `Missing ${locale} translation: ${label}`);
  }
  setLocale("ru");
});

test("language-dependent messages and date formats follow the selected locale", () => {
  setLocale("en");
  assert.equal(t("Версия {version}", { version: "0.1.2" }), "Version 0.1.2");
  assert.equal(intlLocale(), "en-US");
  setLocale("zh");
  assert.equal(t("Версия {version}", { version: "0.1.2" }), "版本 0.1.2");
  assert.equal(intlLocale(), "zh-CN");
  setLocale("ru");
});

test("dynamic interface messages have translations", () => {
  const files = ["renderer.js", "workspace-controller.js", "calendar-controller.js", "pomodoro-controller.js", "ui/theme.js", "ui/statistics-view.js"];
  const labels = new Set(files.flatMap((file) => {
    const source = readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");
    return [...source.matchAll(/\bt\("([^"]+)"/g)].map((match) => match[1]);
  }));
  for (const locale of ["en", "zh"]) {
    setLocale(locale);
    for (const label of labels) assert.notEqual(t(label), label, `Missing ${locale} translation: ${label}`);
  }
  setLocale("ru");
});
