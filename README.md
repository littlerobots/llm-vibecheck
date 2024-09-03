# README

When working with LLM outputs, it's often valuable to compare results when modifying prompts.
While LLM benchmark frameworks exist, a simple "vibe check" can help a lot.
This package provides a mini framework to produce a comparison of outputs by producing a csv file.

## How to use
* Make sure you have a set of input files. The format will depend on your `Processor` and `Preprocessor` implementation.
* Create a `Processor`. The processor receives an arbitrary config object and outputs an object with the results. You'd typically call the code that invokes the LLM from this `Processor`, but you could also invoke webservice for example. The results end up as columns in the report. The output is also cached on disk for future runs.
* (Optional) create `Preprocessor` that takes an input file and processes it to a suitable input for your `Processor`. Preprocessing happens once per file and the outputs are cached on disk.
* (Optional) create an `Evaluator` that takes the input and output and runs whatever evaluation that you want. The result of the `Evaluator` is added as columns to the report.

### Create the cli

```typescript
import { runEvaluation, type Processor, type Preprocessor, type Evaluator } from '@littlerobots/llm-vibecheck';

// setup your processor, preprocessor and evaluator

await runEvaluation(processor, preprocessor, evaluator);
```

### Create prompt config
A basic config will look like this:

```json
{
    "prompts": { "name" : "Base prompt" }
}
```

The config object will be passed to the `Processor` and `Evaluator` as is. No properties are required, but if you add a `name` property it will be used in the report to name the prompt results.


### Run the cli
When you run the cli without any arguments the output will be similar to this:

```
Options:
  -i, --input   Directory with input files                   [string] [required]
  -c, --config  Prompt config json file                      [string] [required]
  -o, --output  CSV output file                              [string] [required]
      --cache   Directory used for caching inputs and outputs
            [string] [default: "/Users/you/myproject/.cache"]
      --help    Show help                                              [boolean]

Missing required arguments: input, config, output
```

Pass in the `--input`, `--config` and `--output` arguments to create the report.

## Caching
Preprocessed inputs and prompt outputs are cached by default. This speeds up processing and saves cost running the same LLM prompts over and over again. Prompt output is cached based on the prompt configuration, e.g. if you change the prompt configuration this will be considered a new config. Likewise if you change your `Processor` implementation, but not the config you'll want to remove the outputs from the cache directory to re-run the prompt.

## License

```
Copyright 2024 Hugo Visser

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
```