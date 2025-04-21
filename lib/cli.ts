import * as fs from "fs";
import yargs from "yargs/yargs";
import yoctoSpinner from "yocto-spinner";
import { Input, preprocess, type Preprocessor } from "./input.js";
import {
  Evaluator,
  getProcessorInput,
  processCached,
  Processor,
  ProcessorInput,
  ProcessResult,
  PromptConfig,
} from "./process.js";
import { batch } from "./util.js";
import { CsvOutputWriter, OutputWriter } from "./writer.js";

export interface CliResult {
  config: PromptConfig[];
  inputs: Input[];
  processorInputs: ProcessorInput[];
  results: ProcessResult[][];
}

export class Cli {
  private processsor: Processor;
  private preprocessor: Preprocessor | undefined;
  private evaluator: Evaluator | undefined;
  private writer: OutputWriter;

  constructor(
    processsor: Processor,
    preprocessor?: Preprocessor,
    evaluator?: Evaluator,
    writer: OutputWriter | undefined | null = new CsvOutputWriter()
  ) {
    this.processsor = processsor;
    this.preprocessor = preprocessor;
    this.evaluator = evaluator;
    this.writer = writer;
  }

  async run(args: string[]) {
    const argv = await yargs(args.slice(2))
      .options({
        input: {
          alias: "i",
          describe: "Directory with input files",
          demandOption: true,
          type: "string",
        },
        config: {
          alias: "c",
          describe: "Prompt config json file",
          demandOption: true,
          type: "string",
        },
        output: {
          alias: "o",
          describe: "Output file",
          demandOption: !!this.writer,
          hide: !this.writer,
          type: "string",
        },
        cache: {
          describe: "Directory used for caching inputs and outputs",
          default: `${process.cwd()}/.cache`,
          type: "string",
        },
      })
      .version(false)
      .help()
      .check((argv) => {
        if (!fs.existsSync(argv.input)) {
          throw Error(`${argv.input} does not exist`);
        }
        if (!fs.lstatSync(argv.input).isDirectory()) {
          throw Error(`${argv.input} is not a directory`);
        }
        if (!fs.existsSync(argv.config)) {
          throw Error(`${argv.config} does not exist`);
        }
        const promptConfig = JSON.parse(fs.readFileSync(argv.config, "utf-8"));
        if (!Array.isArray(promptConfig.prompts)) {
          throw Error("Prompt config is not valid");
        }
        return true;
      })
      .parse();

    this.createCacheDirs(argv.cache);
    const prompts = JSON.parse(fs.readFileSync(argv.config, "utf-8"))
      .prompts as Array<PromptConfig>;
    const spinner = yoctoSpinner({ text: "Processing inputs…" }).start();
    if (prompts.length == 0) {
      spinner.error("No prompts configured");
      process.exit(-1);
    }
    const inputs = await preprocess(
      argv.input,
      `${argv.cache}/input`,
      (name, cached, error) => {
        const spinnerText = spinner.text;
        let message = name;
        if (cached) {
          message += " (cached)";
        } else if (error) {
          message += `: ${(error as Error).message}`;
        }
        if (error) {
          spinner.error(message);
        } else {
          spinner.info(message);
        }
        spinner.start(spinnerText);
      },
      this.preprocessor
    );

    const processedInputs = inputs.filter(
      (input) => input.inputError == undefined
    );

    if (processedInputs.length == 0) {
      spinner.error("No input files to process");
      process.exit(-1);
    }

    spinner.text = "Running prompts…";
    const rows = await batch(processedInputs, (item) => {
      return batch(prompts, (prompt) =>
        processCached(
          `${argv.cache}/output`,
          item,
          prompt,
          this.processsor,
          this.evaluator
        )
      );
    });
    const cachedResults = rows
      .flatMap((v) =>
        v.reduce((acc, v) => {
          if (v.cached) {
            return acc + 1;
          } else {
            return acc;
          }
        }, 0)
      )
      .reduce((acc, v) => acc + v, 0);
    spinner.success(
      `All done! Ran ${
        rows.length * prompts.length
      } prompts, ${cachedResults} from cache.`
    );

    const cliResult: CliResult = {
      config: prompts,
      inputs: processedInputs.map((input) => ({
        file: input.file,
        name: input.name,
      })),
      processorInputs: processedInputs.map((input) => getProcessorInput(input)),
      results: rows,
    };

    if (this.writer) {
      this.writer.write(
        argv.output,
        cliResult.config,
        cliResult.inputs,
        cliResult.processorInputs,
        cliResult.results
      );
    }

    return cliResult;
  }

  private createCacheDirs(cacheDir: string) {
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir);
    }
    if (!fs.existsSync(`${cacheDir}/input`)) {
      fs.mkdirSync(`${cacheDir}/input`);
    }
    if (!fs.existsSync(`${cacheDir}/output`)) {
      fs.mkdirSync(`${cacheDir}/output`);
    }
  }
}
