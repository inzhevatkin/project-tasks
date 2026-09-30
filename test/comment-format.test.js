import test from "node:test";
import assert from "node:assert/strict";
import { parseComment, parseCommentLines } from "../src/comment-format.js";

test("existing bold, italic, combined formatting and line breaks are understood", () => {
  assert.deepEqual(parseComment("first\n**bold** and *italic* ***both***"), [
    { text: "first\n", style: "plain" },
    { text: "bold", style: "bold" },
    { text: " and ", style: "plain" },
    { text: "italic", style: "italic" },
    { text: " ", style: "plain" },
    { text: "both", style: "boldItalic" }
  ]);
});

test("circle and square bullet lines have distinct markers", () => {
  assert.deepEqual(parseCommentLines("- first\n+ **second**\nordinary"), [
    { marker: "circle", runs: [{ text: "first", style: "plain" }] },
    { marker: "square", runs: [{ text: "second", style: "bold" }] },
    { marker: null, runs: [{ text: "ordinary", style: "plain" }] }
  ]);
});

test("HTML in a comment stays text, including across lines", () => {
  assert.deepEqual(parseCommentLines("<img src=x>\n<script>alert(1)</script>"), [
    { marker: null, runs: [{ text: "<img src=x>", style: "plain" }] },
    { marker: null, runs: [{ text: "<script>alert(1)</script>", style: "plain" }] }
  ]);
});
