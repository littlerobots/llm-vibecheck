import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { deserialize, serialize } from "v8";
import type { ProcessedInput } from "./input.js";

export type ResultProperties = Record<string, string | number | boolean>;
export interface ProcessResult {
  result: ResultProperties;
  eval: ResultProperties;
  cached?: boolean;
}
export interface ProcessorInput {
  input: string | Buffer;
  [x: string]: string | Buffer;
}

export interface Processor {
  /**
   *
   * @param input The input to process
   */
  process(
    config: PromptConfig,
    input: ProcessorInput
  ): Promise<ResultProperties>;
}

export interface Evaluator {
  evaluate(
    config: PromptConfig,
    input: ProcessorInput,
    output: ResultProperties
  ): Promise<ResultProperties>;
}

/**
 * Predefined properties that can be used in config passed
 * to the ProcessorFactory, all optional.
 * {@link name} is used to identify the prompt in the output, if set.
 */
export interface PromptConfig {
  name?: string;
  type?: string;
  systemPrompt?: string;
  prompt?: string;
  temperature?: number;
  [x: string]: unknown;
}

export function getProcessorInput(input: ProcessedInput): ProcessorInput {
  if (input.preprocessed) {
    return deserialize(fs.readFileSync(input.file));
  } else {
    const text = [".txt", ".md", ".html"];
    if (text.indexOf(path.extname(input.file)) > -1) {
      return { input: fs.readFileSync(input.file, "utf-8") };
    } else {
      return { input: fs.readFileSync(input.file) };
    }
  }
}

export async function processCached(
  cacheDir: string,
  input: ProcessedInput,
  promptConfig: PromptConfig,
  processor: Processor,
  evaluator?: Evaluator
): Promise<ProcessResult> {
  const promptConfigHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(promptConfig))
    .digest("hex");
  const cachedResponseDir = `${cacheDir}/${promptConfigHash}`;
  if (fs.existsSync(`${cachedResponseDir}/${input.hash}`)) {
    return {
      ...deserialize(fs.readFileSync(`${cachedResponseDir}/${input.hash}`)),
      cached: true,
    };
  } else {
    const processorInput = getProcessorInput(input);
    const result = await processor.process(promptConfig, processorInput);
    if (!fs.existsSync(cachedResponseDir)) {
      fs.mkdirSync(cachedResponseDir);
    }

    let evalResult: ResultProperties = {};
    if (evaluator) {
      evalResult = await evaluator.evaluate(
        promptConfig,
        processorInput,
        result
      );
    }
    const processResult = {
      result: result,
      eval: evalResult,
      cached: false,
    };
    fs.writeFileSync(
      `${cachedResponseDir}/${input.hash}`,
      serialize(processResult)
    );
    return processResult;
  }
}
