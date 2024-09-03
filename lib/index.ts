import { Cli } from "./cli.js";
import { Preprocessor } from "./input.js";
import { Processor, Evaluator } from "./process.js";
export { Preprocessor } from "./input.js";
export {
  Processor,
  PromptConfig,
  Evaluator,
  ProcessResult,
} from "./process.js";

export async function runEvaluation(
  processor: Processor,
  preprocessor?: Preprocessor,
  evaluator?: Evaluator
) {
  await new Cli(processor, preprocessor, evaluator).run(process.argv);
}
