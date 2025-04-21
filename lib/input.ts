import * as crypto from "crypto";
import * as fs from "fs";
import * as stream from "stream/promises";
import { serialize } from "v8";
import { ProcessorInput } from "./process.js";
import { batch } from "./util.js";

export interface Input {
  name: string;
  file: string;
}

export interface ProcessedInput extends Input {
  hash: string;
  inputError?: Error;
  preprocessed: boolean;
}

export interface Preprocessor {
  process(file: string): Promise<ProcessorInput | string>;
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
      name: f.name,
      hash: hashes[i],
      file: `${f.parentPath}/${f.name}`,
      preprocessed: false,
    };
  });
}

async function preprocessInputs(
  inputDir: string,
  cacheDir: string,
  preprocessor: Preprocessor,
  onProcessedFile: (name: string, cached: boolean, error?: unknown) => void
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
    let cached = true;
    if (!fs.existsSync(cachePath)) {
      cached = false;
      try {
        const result = await preprocessor.process(
          `${file.parentPath}/${file.name}`
        );
        let processorInput = result;
        if (typeof result == "string") {
          processorInput = {
            input: result,
          };
        }
        fs.writeFileSync(cachePath, serialize(processorInput));
      } catch (e: unknown) {
        onProcessedFile(file.name, false, e);
        return {
          name: file.name,
          hash: hashes[i],
          file: `${file.parentPath}/${file.name}`,
          inputError: e as Error,
          preprocessed: true,
        };
      }
    }
    onProcessedFile(file.name, cached);
    return {
      name: file.name,
      hash: hashes[i],
      file: `${cacheDir}/${hashes[i]}`,
      preprocessed: true,
    };
  });
}

export async function preprocess(
  inputDir: string,
  cacheDir: string,
  onProcessedFile: (
    name: string,
    cached: boolean,
    error?: unknown
  ) => void = () => {},
  preprocessor: Preprocessor | undefined
) {
  if (!preprocessor) {
    return await hashInputs(inputDir);
  } else {
    return await preprocessInputs(
      inputDir,
      cacheDir,
      preprocessor,
      onProcessedFile
    );
  }
}
