import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createUpdateService } from "../electron/update-service.js";
import { runUpdate } from "../src/update-flow.js";

function fixture() {
  const calls = [];
  const updater = new EventEmitter();
  updater.checkForUpdates = async () => updater.emit("update-available", { version: "0.1.8" });
  updater.downloadUpdate = async () => {
    calls.push("download");
    updater.emit("download-progress", { percent: 50 });
    updater.emit("update-downloaded", { version: "0.1.8" });
  };
  updater.quitAndInstall = (...args) => calls.push(["install", ...args]);
  const service = createUpdateService({ updater, enabled: true, scheduleInstall: (callback) => callback() });
  const api = {
    getUpdateState: service.getState,
    downloadUpdate: service.download,
    installUpdate: service.install,
    saveWorkspace: async () => calls.push("save")
  };
  return { updater, service, calls, api };
}

test("one update action saves edits made during download and installs silently with restart", async () => {
  const { updater, service, calls, api } = fixture();
  let workspaceRevision = 1;
  api.saveWorkspace = async () => calls.push(["save", workspaceRevision]);
  updater.downloadUpdate = async () => {
    calls.push("download");
    workspaceRevision = 2;
    updater.emit("update-downloaded", { version: "0.1.8" });
  };
  await service.check();
  assert.equal(calls.length, 0, "Checking must not download or install without a user action");
  assert.equal(await runUpdate(api), true);
  assert.deepEqual(calls, [["save", 1], "download", ["save", 2], ["install", true, true]]);
  assert.equal(service.getState().status, "installing");
});

test("failure to save after download prevents installation and retry uses the cached file", async () => {
  const { service, calls, api } = fixture();
  await service.check();
  let saves = 0;
  api.saveWorkspace = async () => {
    saves++;
    if (saves === 2) throw new Error("Disk is full");
    calls.push("save");
  };
  await assert.rejects(runUpdate(api), /Disk is full/);
  assert.equal(service.getState().status, "ready");
  assert.deepEqual(calls, ["save", "download"]);
  await runUpdate(api);
  assert.equal(calls.filter((call) => call === "download").length, 1);
  assert.deepEqual(calls.at(-1), ["install", true, true]);
});

test("a failed download can be retried by the same update action", async () => {
  const { updater, service, calls, api } = fixture();
  const successfulDownload = updater.downloadUpdate;
  updater.downloadUpdate = async () => { throw new Error("Network unavailable"); };
  await service.check();
  await assert.rejects(runUpdate(api), /Network unavailable/);
  assert.equal(service.getState().canRetry, true);
  assert.equal(service.getState().downloaded, false);
  assert.equal(calls.some(Array.isArray), false);
  updater.downloadUpdate = successfulDownload;
  await runUpdate(api);
  assert.deepEqual(calls.at(-1), ["install", true, true]);
});

test("concurrent requests share one download and schedule only one installation", async () => {
  const { updater, service, calls } = fixture();
  let finish;
  updater.downloadUpdate = () => {
    calls.push("download");
    return new Promise((resolve) => { finish = () => {
      updater.emit("update-downloaded", { version: "0.1.8" });
      resolve();
    }; });
  };
  await service.check();
  const first = service.download();
  const second = service.download();
  await Promise.resolve();
  assert.deepEqual(calls, ["download"]);
  finish();
  await Promise.all([first, second]);
  service.install();
  service.install();
  assert.deepEqual(calls, ["download", ["install", true, true]]);
});

test("installation errors allow a retry without downloading again", async () => {
  const { updater, service, calls, api } = fixture();
  await service.check();
  const successfulInstall = updater.quitAndInstall;
  updater.quitAndInstall = () => { throw new Error("Installer could not start"); };
  await runUpdate(api);
  assert.equal(service.getState().status, "error");
  assert.equal(service.getState().canRetry, true);
  updater.quitAndInstall = successfulInstall;
  await runUpdate(api);
  assert.equal(calls.filter((call) => call === "download").length, 1);
  assert.deepEqual(calls.at(-1), ["install", true, true]);
});

test("an unavailable or unverified update cannot launch an installer", async () => {
  const { service, calls, api } = fixture();
  assert.equal(await runUpdate(api), false);
  assert.throws(() => service.install(), /Загрузка обновления не завершена/);
  const disabled = createUpdateService({ updater: new EventEmitter(), enabled: false });
  assert.equal(await runUpdate({ ...api, getUpdateState: disabled.getState }), false);
  await assert.rejects(disabled.download(), /Обновления доступны/);
  assert.deepEqual(calls, []);
});
