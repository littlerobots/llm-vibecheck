import { runEvaluation } from "@littlerobots/llm-vibecheck";
import * as fs from "fs";

await runEvaluation(
  {
    async process(config, input) {
      // call the llm here
      return {
        output: `dummy-output for ${config.name} ${input.toString("utf-8")}`,
      };
    },
  },
  {
    canProcess(file) {
      // only process .txt files
      return file.endsWith(".txt");
    },
    async process(file) {
      // do any processing here
      return fs.readFileSync(file);
    },
  },
  {
    async evaluate(config, input, output) {
      // implement real evals here
      return {
        score: 1.0,
        length: "medium",
      };
    },
  }
);
