export async function runUpdate({ getUpdateState, downloadUpdate, installUpdate, saveWorkspace }) {
  const state = await getUpdateState();
  if (!["available", "ready"].includes(state.status) && !(state.status === "error" && state.canRetry)) return false;
  await saveWorkspace();
  if (!state.downloaded) await downloadUpdate();
  // The user can keep editing during download. Save the latest workspace before
  // the installer starts, not just the snapshot from the original button click.
  await saveWorkspace();
  await installUpdate();
  return true;
}
