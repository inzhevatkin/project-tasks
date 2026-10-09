import { getLocale, t } from "../i18n.js";

export function initializeSettings(elements, { saveWorkspace, reload = () => window.location.reload(), canChange = () => true }) {
  const open = () => {
    if (elements.settingsDialog.open) return;
    elements.appLanguage.value = getLocale();
    elements.settingsError.hidden = true;
    elements.settingsDialog.showModal();
  };
  elements.showSettings.addEventListener("click", open);
  elements.settingsCancel.addEventListener("click", () => elements.settingsDialog.close());
  elements.settingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (elements.settingsSave.disabled) return;
    if (elements.appLanguage.value === getLocale()) { elements.settingsDialog.close(); return; }
    elements.settingsSave.disabled = true;
    elements.settingsCancel.disabled = true;
    elements.settingsError.hidden = true;
    try {
      if (!canChange()) throw new Error(t("Дождитесь завершения обновления."));
      await saveWorkspace();
      await window.projectTasks.setLanguage(elements.appLanguage.value);
      reload();
    } catch (error) {
      elements.settingsError.textContent = t("Не удалось изменить язык: {error}", { error: error.message });
      elements.settingsError.hidden = false;
    } finally {
      elements.settingsSave.disabled = false;
      elements.settingsCancel.disabled = false;
    }
  });
  return { open };
}
