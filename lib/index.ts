import { Cli, CliResult } from "./cli.js";
import { CsvOutputWriter } from "./index.js";
import { Preprocessor } from "./input.js";
import { Evaluator, Processor } from "./process.js";
import { OutputWriter } from "./writer.js";
export { CliResult } from "./cli.js";
export { Input, Preprocessor } from "./input.js";
export {
  Evaluator,
  Processor,
  ProcessorInput,
  ProcessResult,
  PromptConfig,
} from "./process.js";
export { CsvOutputWriter, OutputWriter } from "./writer.js";

export async function runEvaluation(
  processor: Processor,
  preprocessor?: Preprocessor,
  evaluator: Evaluator | undefined = undefined,
  outputWriter: OutputWriter | null = new CsvOutputWriter()
): Promise<CliResult> {
  return await new Cli(processor, preprocessor, evaluator, outputWriter).run(
    process.argv
  );
}
