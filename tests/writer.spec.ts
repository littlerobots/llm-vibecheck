import * as fs from "fs";
import { expect, it } from "vitest";
import { CsvOutputWriter } from "../lib/writer";
import { setupInputDirs } from "./input_dirs";

it("Writes result as csv", async () => {
  const [dir, cache] = setupInputDirs();
  const writer = new CsvOutputWriter();

  fs.writeFileSync(`${dir}/input.txt`, "input text");
  await writer.write(
    `${dir}/output.csv`,
    [{}],
    [{ file: `${dir}/input.txt`, name: "input.txt" }],
    [{ input: "processed input" }],
    [
      [
        {
          result: { text: "output", extra: "extra_output" },
          eval: { score: 8 },
          cached: false,
        },
      ],
    ]
  );

  const result = fs.readFileSync(`${dir}/output.csv`, "utf-8");
  expect(result).eq(
    "file,input,p0_text,p0_extra,p0_eval_score\ninput.txt,processed input,output,extra_output,8\n"
  );
});

it("Writes multiple output keys", async () => {
  const [dir, cache] = setupInputDirs();
  const writer = new CsvOutputWriter();

  fs.writeFileSync(`${dir}/input.txt`, "input text");
  await writer.write(
    `${dir}/output.csv`,
    [{}],
    [{ file: `${dir}/input.txt`, name: "input.txt" }],
    [{ input: "processed input", meta: "some meta" }],
    [
      [
        {
          result: { text: "output", extra: "extra_output" },
          eval: { score: 8 },
          cached: false,
        },
      ],
    ]
  );

  const result = fs.readFileSync(`${dir}/output.csv`, "utf-8");
  expect(result).eq(
    "file,input,meta,p0_text,p0_extra,p0_eval_score\ninput.txt,processed input,some meta,output,extra_output,8\n"
  );
});
