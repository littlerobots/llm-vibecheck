import yargs from "yargs/yargs";
import * as fs from "fs";
import { preprocess, type Preprocessor } from "./input.js";
import { batch } from "./util.js";
import {
  processCached,
  PromptConfig,
  Processor,
  Evaluator,
} from "./process.js";
import * as csvWriter from "csv-writer";
import yoctoSpinner from "yocto-spinner";

export class Cli {
  processsor: Processor;
  preprocessor: Preprocessor | undefined;
  evaluator: Evaluator | undefined;

  constructor(
    processsor: Processor,
    preprocessor?: Preprocessor,
    evaluator?: Evaluator
  ) {
    this.processsor = processsor;
    this.preprocessor = preprocessor;
    this.evaluator = evaluator;
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
          describe: "CSV output file",
          demandOption: true,
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
      this.preprocessor
    );
    const errors = inputs.filter((input) => !!input.inputError);
    const processedInputs = inputs.filter(
      (input) => input.inputError == undefined
    );
    if (errors.length > 0) {
      spinner.warning("Error processing some inputs:");
      errors.map((input) =>
        console.warn(`   ${input.file}: ${input.inputError?.message}`)
      );
      spinner.start();
    }

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

    spinner.success("All done!");

    // assume / require that every prompt returns the same keys for every row
    const promptKeys = prompts.map((p, index) => {
      const firstRow =
        rows.length > 0 && rows[0].length > 0 ? rows[0][index] : [];
      return [
        ...Object.keys(firstRow)
          .filter((k) => !k.startsWith("eval_"))
          .sort((a, b) => a.localeCompare(b)),
        ...Object.keys(firstRow)
          .filter((k) => k.startsWith("eval_"))
          .sort((a, b) => a.localeCompare(b)),
      ];
    });

    const headers = [
      "file",
      "input",
      ...promptKeys.flatMap((keys, index) =>
        keys.map((k) => {
          const promptName = prompts[index].name || `p${index}`;
          return `${promptName}_${k}`;
        })
      ),
    ];
    const writer = csvWriter.createArrayCsvWriter({
      header: headers,
      path: argv.output,
    });
    await writer.writeRecords(
      rows.map((r, index) => {
        return [
          processedInputs[index].file,
          fs.readFileSync(processedInputs[index].input, "utf-8"),
          ...r.flatMap((sr, index) => {
            const keys = promptKeys[index];
            return keys.map((k) => sr[k] || "");
          }),
        ];
      })
    );
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
