import test from "node:test";
import assert from "node:assert/strict";
import { renderUpdateView } from "../src/ui/update-view.js";

test("update controls stay hidden without an update, but show progress and allow retries", () => {
  const elements = { updateStatus: {}, updateButton: {} };
  for (const status of ["unavailable", "checking", "current"]) {
    renderUpdateView(elements, { status });
    assert.equal(elements.updateButton.hidden, true);
    assert.equal(elements.updateStatus.hidden, true);
    assert.equal(elements.updateButton.disabled, true);
  }
  for (const status of ["available", "ready"]) {
    renderUpdateView(elements, { status, version: "0.1.14" });
    assert.equal(elements.updateButton.hidden, false);
    assert.equal(elements.updateButton.disabled, false);
    assert.equal(elements.updateStatus.hidden, false);
  }
  renderUpdateView(elements, { status: "available", version: "0.1.14" }, true);
  assert.equal(elements.updateButton.disabled, true);
  for (const status of ["downloading", "installing"]) {
    renderUpdateView(elements, { status, progress: 35 });
    assert.equal(elements.updateButton.hidden, false);
    assert.equal(elements.updateButton.disabled, true);
    assert.equal(elements.updateStatus.hidden, false);
  }
  renderUpdateView(elements, { status: "error", error: "Network", canRetry: false });
  assert.equal(elements.updateButton.hidden, true);
  assert.equal(elements.updateStatus.hidden, false);
  renderUpdateView(elements, { status: "error", error: "Network", version: "0.1.14", canRetry: true });
  assert.equal(elements.updateButton.hidden, false);
  assert.equal(elements.updateButton.disabled, false);
  renderUpdateView(elements, { status: "current" });
  assert.equal(elements.updateButton.hidden, true);
});
