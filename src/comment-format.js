const markers = { bold: "**", italic: "*" };

export function formatCommentSelection(value, start, end, format) {
  const before = value.slice(0, start);
  const selected = value.slice(start, end);
  const after = value.slice(end);
  if (format === "newline") {
    return { value: `${before}\n${after}`, start: start + 1, end: start + 1 };
  }
  const marker = markers[format];
  if (!marker) throw new TypeError(`Unknown comment format: ${format}`);
  const size = marker.length;
  if (selected.startsWith(marker) && selected.endsWith(marker) && selected.length > size * 2) {
    const unwrapped = selected.slice(size, -size);
    return { value: `${before}${unwrapped}${after}`, start, end: start + unwrapped.length };
  }
  if (before.endsWith(marker) && after.startsWith(marker)) {
    return {
      value: `${before.slice(0, -size)}${selected}${after.slice(size)}`,
      start: start - size, end: end - size
    };
  }
  return {
    value: `${before}${marker}${selected}${marker}${after}`,
    start: start + size, end: end + size
  };
}

export function parseComment(text) {
  const parts = [];
  const pattern = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let offset = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > offset) parts.push({ text: text.slice(offset, match.index), style: "plain" });
    parts.push({ text: match[1] ?? match[2], style: match[1] === undefined ? "italic" : "bold" });
    offset = match.index + match[0].length;
  }
  if (offset < text.length) parts.push({ text: text.slice(offset), style: "plain" });
  return parts;
}

export function renderCommentPreview(container, text) {
  container.replaceChildren(...parseComment(text).map(({ text: content, style }) => {
    const node = document.createElement(style === "bold" ? "strong" : style === "italic" ? "em" : "span");
    node.textContent = content;
    return node;
  }));
}
