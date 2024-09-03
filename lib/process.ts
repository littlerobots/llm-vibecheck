import type { ProcessedInput } from "./input.js";
import * as crypto from "crypto";
import * as fs from "fs";

export type ProcessResult = Record<string, string | number | boolean>;

export interface Processor {
  /**
   *
   * @param input The input buffer to process
   */
  process(config: PromptConfig, input: Buffer): Promise<ProcessResult>;
}

export interface Evaluator {
  evaluate(
    config: PromptConfig,
    input: Buffer,
    output: ProcessResult
  ): Promise<ProcessResult>;
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
    return JSON.parse(
      fs.readFileSync(`${cachedResponseDir}/${input.hash}`, "utf-8")
    );
  } else {
    const result = await processor.process(
      promptConfig,
      fs.readFileSync(input.input)
    );
    if (!fs.existsSync(cachedResponseDir)) {
      fs.mkdirSync(cachedResponseDir);
    }

    let evalResult: ProcessResult = {};
    if (evaluator) {
      evalResult = await evaluator.evaluate(
        promptConfig,
        fs.readFileSync(input.input),
        result
      );
    }
    const resultWithEval = {
      ...result,
      ...Object.keys(evalResult).reduce(
        (a, c) => ((a[`eval_${c}`] = evalResult[c]), a),
        {}
      ),
    };
    fs.writeFileSync(
      `${cachedResponseDir}/${input.hash}`,
      JSON.stringify(resultWithEval)
    );
    return resultWithEval;
  }
}
