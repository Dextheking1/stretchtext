// Builds dist/stretchtext.zip and copies it to docs/ so the GitHub Pages
// install page can serve the download directly.
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
mkdirSync(dist, { recursive: true });
const zipPath = join(dist, "stretchtext.zip");
rmSync(zipPath, { force: true });

execFileSync(
  "zip",
  ["-r", zipPath, "manifest.json", "src", "options", "popup", "icons", "LICENSE", "README.md"],
  { cwd: root, stdio: "inherit" }
);
copyFileSync(zipPath, join(root, "docs", "stretchtext.zip"));
console.log("built " + zipPath);
