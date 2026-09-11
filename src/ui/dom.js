export function textSpan(text, className) {
  const span = document.createElement("span");
  span.className = className;
  span.textContent = text;
  return span;
}
