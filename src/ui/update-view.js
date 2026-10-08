import { t } from "../i18n.js";

export function renderUpdateView(elements, state, inProgress = false) {
  const messages = {
    unavailable: t("Обновления доступны в установленной версии Windows"),
    checking: t("Проверка обновлений…"),
    current: t("Установлена последняя версия"),
    available: t("Доступна версия {version}", { version: state.version }),
    downloading: t("Загрузка: {progress} %", { progress: state.progress }),
    ready: t("Версия {version} готова к установке", { version: state.version }),
    installing: t("Установка обновления…"),
    error: t("Ошибка обновления: {error}", { error: state.error ?? state.message })
  };
  const actionable = state.status === "available" || state.status === "ready" || (state.status === "error" && state.canRetry);
  const visible = actionable || state.status === "downloading" || state.status === "installing";
  elements.updateStatus.textContent = messages[state.status] ?? state.message ?? "";
  elements.updateStatus.title = elements.updateStatus.textContent;
  elements.updateStatus.hidden = !visible && state.status !== "error";
  elements.updateButton.hidden = !visible;
  elements.updateButton.disabled = inProgress || !actionable;
  elements.updateButton.textContent = t("Обновить");
  elements.updateButton.title = elements.updateButton.disabled
    ? elements.updateStatus.textContent : t("Скачать, установить и перезапустить приложение");
}
