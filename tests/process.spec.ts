import * as fs from "fs";
import { serialize } from "v8";
import { expect, it } from "vitest";
import {
  Evaluator,
  processCached,
  Processor,
  ProcessorInput,
  PromptConfig,
  ResultProperties,
} from "../lib/process";
import { setupInputDirs } from "./input_dirs";

it("Processes the result", async () => {
  const [dir, cacheDir] = setupInputDirs();

  const processor: Processor = {
    process: async function (
      config: PromptConfig,
      input: ProcessorInput
    ): Promise<ResultProperties> {
      return {
        text: `processed: ${input.input}`,
        config: JSON.stringify(config),
      };
    },
  };

  fs.writeFileSync(`${dir}/input.txt`, "input");

  const result = await processCached(
    cacheDir,
    {
      file: `${dir}/input.txt`,
      name: "input.txt",
      hash: "fakehash",
      preprocessed: false,
    },
    { prompt: "test prompt" },
    processor,
    undefined
  );

  expect(result.result.text).eq("processed: input");
  expect(result.result.config).eq(JSON.stringify({ prompt: "test prompt" }));
});

it("Caches the result", async () => {
  const [dir, cacheDir] = setupInputDirs();
  let processorInvoked = 0;

  const processor: Processor = {
    process: async function (
      config: PromptConfig,
      input: ProcessorInput
    ): Promise<ResultProperties> {
      processorInvoked++;
      return {
        text: `processed: ${input.input}`,
        config: JSON.stringify(config),
      };
    },
  };

  fs.writeFileSync(`${dir}/input.txt`, "input");

  await processCached(
    cacheDir,
    {
      file: `${dir}/input.txt`,
      name: "input.txt",
      hash: "fakehash",
      preprocessed: false,
    },
    { prompt: "test prompt" },
    processor,
    undefined
  );

  const result = await processCached(
    cacheDir,
    {
      file: `${dir}/input.txt`,
      name: "input.txt",
      hash: "fakehash",
      preprocessed: false,
    },
    { prompt: "test prompt" },
    processor,
    undefined
  );

  expect(processorInvoked).eq(1);
  expect(result.result.text).eq("processed: input");
  expect(result.result.config).eq(JSON.stringify({ prompt: "test prompt" }));
});

it("Runs the evaluator", async () => {
  const [dir, cacheDir] = setupInputDirs();
  let processorInvoked = 0;

  const processor: Processor = {
    process: async function (
      config: PromptConfig,
      input: ProcessorInput
    ): Promise<ResultProperties> {
      processorInvoked++;
      return {
        text: `processed: ${input.input}`,
        config: JSON.stringify(config),
      };
    },
  };

  const evaluator: Evaluator = {
    evaluate: async function (
      config: PromptConfig,
      input: ProcessorInput,
      output: ResultProperties
    ): Promise<ResultProperties> {
      return {
        test: `eval value: ${input.input}, output: ${output.text}`,
      };
    },
  };

  const processorInput: ProcessorInput = {
    input: "input",
  };
  fs.writeFileSync(`${dir}/input.txt`, serialize(processorInput));

  const result = await processCached(
    cacheDir,
    {
      file: `${dir}/input.txt`,
      name: "input.txt",
      hash: "fakehash",
      preprocessed: true,
    },
    { prompt: "test prompt" },
    processor,
    evaluator
  );

  expect(processorInvoked).eq(1);
  expect(result.result.text).eq("processed: input");
  expect(result.eval.test).eq("eval value: input, output: processed: input");
  expect(result.result.config).eq(JSON.stringify({ prompt: "test prompt" }));
});
