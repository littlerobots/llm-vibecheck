import * as fs from "fs";
import { preprocess, Preprocessor } from "../lib/input";

import { deserialize } from "v8";
import { expect, it } from "vitest";
import { ProcessorInput } from "../lib";
import { setupInputDirs } from "./input_dirs";

it("Returns processed inputs", async () => {
  const [dir, cacheDir] = setupInputDirs();
  fs.writeFileSync(`${dir}/input1.txt`, "Input 1");
  fs.writeFileSync(`${dir}/input2.txt`, "Input 2");

  const result = await preprocess(dir, cacheDir, undefined, undefined);
  expect(result.length).eq(2);
  expect(result[0].name).eq("input1.txt");
});

it("Runs preprocessor and returns processed inputs", async () => {
  const [dir, cacheDir] = setupInputDirs();
  const preprocessor: Preprocessor = {
    canProcess: () => true,
    process: async (file) => {
      const content = fs.readFileSync(file, "utf-8");
      return { input: `Processed: ${content}` };
    },
  };
  fs.writeFileSync(`${dir}/input1.txt`, "Input 1");

  const result = await preprocess(dir, cacheDir, undefined, preprocessor);
  expect(result.length).eq(1);
  expect(result[0].name).eq("input1.txt");
  // output should be in the cache dir
  expect(result[0].file.startsWith(cacheDir)).eq(true);
});

it("Runs preprocessor that returns string and returns inputs", async () => {
  const [dir, cacheDir] = setupInputDirs();
  const preprocessor: Preprocessor = {
    canProcess: () => true,
    process: async (file) => {
      const content = fs.readFileSync(file, "utf-8");
      return `Processed: ${content}`;
    },
  };
  fs.writeFileSync(`${dir}/input1.txt`, "Input 1");
  const result = await preprocess(dir, cacheDir, undefined, preprocessor);
  expect(result.length).eq(1);
  const cached = deserialize(
    fs.readFileSync(`${cacheDir}/${result[0].hash}`)
  ) as ProcessorInput;
  expect(result[0].name).eq("input1.txt");
  expect(cached.input).eq("Processed: Input 1");
});
