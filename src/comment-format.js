// Comments remain plain text in projects.json. Only a small Markdown-like
// subset is interpreted, so older comments keep their original content.
export function parseComment(text) {
  const parts = [];
  const pattern = /\*\*\*([^*]+)\*\*\*|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let offset = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > offset) parts.push({ text: text.slice(offset, match.index), style: "plain" });
    parts.push({
      text: match[1] ?? match[2] ?? match[3],
      style: match[1] !== undefined ? "boldItalic" : match[2] !== undefined ? "bold" : "italic"
    });
    offset = match.index + match[0].length;
  }
  if (offset < text.length) parts.push({ text: text.slice(offset), style: "plain" });
  return parts;
}

export function parseCommentLines(text) {
  const lines = [[]];
  for (const part of parseComment(text.replace(/\r\n?/g, "\n"))) {
    const pieces = part.text.split("\n");
    for (let index = 0; index < pieces.length; index++) {
      if (index > 0) lines.push([]);
      if (pieces[index]) lines.at(-1).push({ text: pieces[index], style: part.style });
    }
  }
  return lines.map((runs) => {
    const first = runs[0];
    const match = first?.style === "plain" ? /^([-+]) /.exec(first.text) : null;
    if (!match) return { marker: null, runs };
    const remaining = first.text.slice(2);
    return {
      marker: match[1] === "+" ? "square" : "circle",
      runs: [...(remaining ? [{ text: remaining, style: "plain" }] : []), ...runs.slice(1)]
    };
  });
}

function inlineNodes(runs) {
  return runs.map(({ text, style }) => {
    if (style === "plain") return document.createTextNode(text);
    const node = document.createElement(style === "italic" ? "em" : "strong");
    if (style === "boldItalic") {
      const italic = document.createElement("em");
      italic.textContent = text;
      node.append(italic);
    } else node.textContent = text;
    return node;
  });
}

export function renderCommentEditor(editor, text) {
  if (!text) {
    editor.replaceChildren();
    return;
  }
  const nodes = [];
  let list = null;
  for (const line of parseCommentLines(text)) {
    if (line.marker) {
      if (!list || list.dataset.marker !== line.marker) {
        list = document.createElement("ul");
        list.dataset.marker = line.marker;
        nodes.push(list);
      }
      const item = document.createElement("li");
      item.append(...inlineNodes(line.runs));
      if (!item.hasChildNodes()) item.append(document.createElement("br"));
      list.append(item);
    } else {
      list = null;
      const paragraph = document.createElement("div");
      paragraph.append(...inlineNodes(line.runs));
      if (!paragraph.hasChildNodes()) paragraph.append(document.createElement("br"));
      nodes.push(paragraph);
    }
  }
  editor.replaceChildren(...nodes);
}

function serializeInline(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue;
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  if (node.tagName === "BR") return "\n";
  const content = [...node.childNodes].map(serializeInline).join("");
  if (!content) return "";
  if (node.matches("b, strong")) return `**${content}**`;
  if (node.matches("i, em")) return `*${content}*`;
  return content;
}

function serializeBlock(node) {
  if (node.nodeType === Node.ELEMENT_NODE && node.matches("ul, ol")) {
    const prefix = node.dataset.marker === "square" ? "+ " : "- ";
    return [...node.children].filter((child) => child.matches("li"))
      .map((item) => `${prefix}${serializeInline(item).replace(/\n$/, "")}`).join("\n");
  }
  if (node.nodeType === Node.ELEMENT_NODE && node.matches("div, p") && !node.textContent) return "";
  return serializeInline(node).replace(/\n$/, "");
}

export function serializeCommentEditor(editor) {
  const blocks = [];
  let loose = "";
  for (const node of editor.childNodes) {
    if (node.nodeType === Node.ELEMENT_NODE && node.matches("div, p, ul, ol")) {
      if (loose) { blocks.push(loose); loose = ""; }
      blocks.push(serializeBlock(node));
    } else loose += serializeInline(node);
  }
  if (loose) blocks.push(loose);
  return blocks.join("\n");
}

export function applyCommentCommand(editor, format) {
  editor.focus();
  const selectedList = () => {
    const anchor = window.getSelection()?.anchorNode;
    const element = anchor?.nodeType === Node.ELEMENT_NODE ? anchor : anchor?.parentElement;
    const list = element?.closest("ul");
    return list && editor.contains(list) ? list : null;
  };
  if (format === "bold" || format === "italic") {
    document.execCommand(format);
  } else if (format === "circle-list" || format === "square-list") {
    const marker = format === "square-list" ? "square" : "circle";
    const current = selectedList();
    if (current && current.dataset.marker !== marker) {
      current.dataset.marker = marker;
    } else {
      document.execCommand("insertUnorderedList");
      const list = selectedList();
      if (list) list.dataset.marker = marker;
    }
  }
}
