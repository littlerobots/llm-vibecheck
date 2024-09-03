import * as fs from "fs";
import * as crypto from "crypto";
import * as stream from "stream/promises";
import { batch } from "./util.js";

export interface ProcessedInput {
  file: string;
  hash: string;
  input: string;
  inputError?: Error;
}

export interface Preprocessor {
  process(file: string): Promise<Buffer | string>;
  canProcess?(file: string): boolean;
}

async function hashFile(path: string) {
  const input = fs.createReadStream(path);
  const hash = crypto.createHash("sha256");
  await stream.pipeline(input, hash);

  return hash.digest("hex");
}

async function hashInputs(inputDir: string): Promise<Array<ProcessedInput>> {
  const files = fs
    .readdirSync(inputDir, { recursive: false, withFileTypes: true })
    .filter((f) => f.isFile());
  const hashes = await Promise.all(
    files.map((f) => hashFile(`${f.parentPath}/${f.name}`))
  );
  return files.map((f, i) => {
    return {
      file: f.name,
      hash: hashes[i],
      input: `${f.parentPath}/${f.name}`,
    };
  });
}

async function preprocessInputs(
  inputDir: string,
  cacheDir: string,
  preprocessor: Preprocessor
): Promise<Array<ProcessedInput>> {
  const files = fs
    .readdirSync(inputDir, { recursive: false, withFileTypes: true })
    .filter(
      (f) =>
        f.isFile() &&
        preprocessor?.canProcess?.call(preprocessor, f.name) != false
    );
  const hashes = await Promise.all(
    files.map((f) => hashFile(`${f.parentPath}/${f.name}`))
  );

  return await batch(files, async (file, i) => {
    const cachePath = `${cacheDir}/${hashes[i]}`;
    if (!fs.existsSync(cachePath)) {
      try {
        const result = await preprocessor.process(
          `${file.parentPath}/${file.name}`
        );
        fs.writeFileSync(cachePath, result);
      } catch (e: unknown) {
        return {
          file: file.name,
          hash: hashes[i],
          input: `${file.parentPath}/${file.name}`,
          inputError: e as Error,
        };
      }
    }
    return {
      file: file.name,
      hash: hashes[i],
      input: `${cacheDir}/${hashes[i]}`,
    };
  });
}

export async function preprocess(
  inputDir: string,
  cacheDir: string,
  preprocessor: Preprocessor | undefined
) {
  if (!preprocessor) {
    return await hashInputs(inputDir);
  } else {
    return await preprocessInputs(inputDir, cacheDir, preprocessor);
  }
}
