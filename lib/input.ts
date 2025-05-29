import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
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

function sampleArrayFn<T>(size: number | undefined) {
  if (size === undefined || size == 0) {
    return (a: T[]) => a;
  } else {
    return (a: T[]) => {
      const shuffled = [...a];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled.slice(0, size);
    };
  }
}

async function hashInputs(
  inputDir: string,
  sampleFn: (entries: fs.Dirent[]) => fs.Dirent[]
): Promise<Array<ProcessedInput>> {
  const files = sampleFn(
    fs
      .readdirSync(inputDir, { recursive: true, withFileTypes: true })
      .filter((f) => f.isFile())
  );
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
  sampleFn: (entries: fs.Dirent[]) => fs.Dirent[],
  onProcessedFile: (name: string, cached: boolean, error?: unknown) => void
): Promise<Array<ProcessedInput>> {
  const files = sampleFn(
    fs
      .readdirSync(inputDir, { recursive: true, withFileTypes: true })
      .filter(
        (f) =>
          f.isFile() &&
          preprocessor?.canProcess?.call(preprocessor, f.name) != false
      )
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
        onProcessedFile(
          path.relative(inputDir, path.resolve(file.parentPath, file.name)),
          false,
          e
        );
        return {
          name: path.relative(
            inputDir,
            path.resolve(file.parentPath, file.name)
          ),
          hash: hashes[i],
          file: `${file.parentPath}/${file.name}`,
          inputError: e as Error,
          preprocessed: true,
        };
      }
    }
    onProcessedFile(
      path.relative(inputDir, path.resolve(file.parentPath, file.name)),
      cached
    );
    return {
      name: path.relative(inputDir, path.resolve(file.parentPath, file.name)),
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
  preprocessor: Preprocessor | undefined,
  sample?: number
) {
  if (!preprocessor) {
    return await hashInputs(inputDir, sampleArrayFn(sample));
  } else {
    return await preprocessInputs(
      inputDir,
      cacheDir,
      preprocessor,
      sampleArrayFn(sample),
      onProcessedFile
    );
  }
}
