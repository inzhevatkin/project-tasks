import test from "node:test";
import assert from "node:assert/strict";
import { formatCommentSelection, parseComment } from "../src/comment-format.js";

test("bold and italic buttons wrap selected text without losing surrounding content", () => {
  assert.deepEqual(formatCommentSelection("hello world", 6, 11, "bold"), {
    value: "hello **world**", start: 8, end: 13
  });
  assert.deepEqual(formatCommentSelection("hello world", 0, 5, "italic"), {
    value: "*hello* world", start: 1, end: 6
  });
});

test("format button toggles markers and places the cursor inside empty markers", () => {
  assert.deepEqual(formatCommentSelection("hello **world**", 8, 13, "bold"), {
    value: "hello world", start: 6, end: 11
  });
  assert.deepEqual(formatCommentSelection("hello ", 6, 6, "bold"), {
    value: "hello ****", start: 8, end: 8
  });
});

test("new line preserves existing text", () => {
  assert.deepEqual(formatCommentSelection("firstsecond", 5, 5, "newline"), {
    value: "first\nsecond", start: 6, end: 6
  });
});

test("preview parses only bold and italic; HTML remains plain text", () => {
  assert.deepEqual(parseComment("first\n**bold** and *italic* <img src=x>"), [
    { text: "first\n", style: "plain" },
    { text: "bold", style: "bold" },
    { text: " and ", style: "plain" },
    { text: "italic", style: "italic" },
    { text: " <img src=x>", style: "plain" }
  ]);
  assert.deepEqual(parseComment("**first\nsecond**"), [{ text: "first\nsecond", style: "bold" }]);
});
