import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));

test("manifest is Manifest V3 with the required fields", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.ok(manifest.name && manifest.version && manifest.description);
  assert.equal(manifest.background.service_worker, "src/background.js");
  assert.equal(manifest.options_page, "options/options.html");
  assert.equal(manifest.action.default_popup, "popup/popup.html");
});

test("every file the manifest references exists", () => {
  const refs = [
    manifest.background.service_worker,
    manifest.options_page,
    manifest.action.default_popup,
    ...manifest.content_scripts.flatMap((cs) => [...cs.js, ...cs.css]),
    ...Object.values(manifest.icons),
  ];
  for (const ref of refs) {
    assert.ok(existsSync(join(root, ref)), "missing: " + ref);
  }
});

test("permissions are minimal and hosts are scoped to Pollinations", () => {
  assert.deepEqual(manifest.permissions, ["storage"]);
  for (const host of manifest.host_permissions) {
    assert.match(host, /^https:\/\/(gen|enter)\.pollinations\.ai\//);
  }
});
