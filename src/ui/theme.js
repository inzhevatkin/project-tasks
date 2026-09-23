export function initializeTheme(elements) {
  function applyTheme(theme) {
    const isDark = theme === "dark";
    document.documentElement.dataset.theme = theme;
    elements.themeToggle.querySelector("span").textContent = isDark ? "☀️" : "🌙";
    const label = t(isDark ? "Включить светлую тему" : "Включить тёмную тему");
    elements.themeToggle.setAttribute("aria-label", label);
    elements.themeToggle.title = label;
  }

  function initialTheme() {
    const saved = localStorage.getItem("projectTasks.theme");
    if (saved === "dark" || saved === "light") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }


  elements.themeToggle.addEventListener("click", () => {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    localStorage.setItem("projectTasks.theme", nextTheme);
    applyTheme(nextTheme);
  });


  applyTheme(initialTheme());
}
import { t } from "../i18n.js";
