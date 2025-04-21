import { randomUUID } from "crypto";
import * as fs from "fs";
import * as os from "os";
import { onTestFinished } from "vitest";

export function setupInputDirs() {
  const dir = `${os.tmpdir()}/${randomUUID()}`;
  const cacheDir = `${os.tmpdir()}/${randomUUID()}`;
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(cacheDir, { recursive: true });
  onTestFinished(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(cacheDir, { recursive: true, force: true });
  });

  return [dir, cacheDir];
}
