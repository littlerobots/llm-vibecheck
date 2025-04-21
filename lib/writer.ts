import * as csvWriter from "csv-writer";
import { Input, ProcessorInput, ProcessResult, PromptConfig } from "./index.js";

export interface OutputWriter {
  write(
    file: string,
    config: PromptConfig[],
    inputs: Input[],
    processorInput: ProcessorInput[],
    result: ProcessResult[][]
  ): Promise<void>;
}

export class CsvOutputWriter implements OutputWriter {
  private skipNonTextProperties: boolean;

  constructor(skipNonTextProperties: boolean = true) {
    this.skipNonTextProperties = skipNonTextProperties;
  }

  async write(
    file: string,
    config: PromptConfig[],
    inputs: Input[],
    processorInput: ProcessorInput[],
    rows: ProcessResult[][]
  ): Promise<void> {
    const inputKeys = Object.entries(processorInput[0])
      .map(([k, v]) => {
        if (Buffer.isBuffer(v) && this.skipNonTextProperties) {
          if (k == "input") {
            console.warn(`⚠️ skipping non-text input in report`);
          } else {
            console.warn(`⚠️ skipping non-text input "${k}" in report`);
          }
          return null;
        } else {
          return k;
        }
      })
      .filter((k) => !!k);

    const inputBufferKeys = inputKeys.map((k) =>
      Buffer.isBuffer(processorInput[0][k])
    );

    const promptKeys = config.map((p, index) => {
      const firstRow: ProcessResult = rows[0][index];
      return [
        ...Object.entries(firstRow.result)
          .map(([k, v]) => {
            if (Buffer.isBuffer(v) && this.skipNonTextProperties) {
              console.warn(`⚠️ skipping non-text output "${k}" in report`);
              return null;
            } else {
              return k;
            }
          })
          .filter((k) => !!k),
      ];
    });

    const evalKeys = config.map((p, index) => {
      const firstRow: ProcessResult = rows[0][index];
      return [
        ...Object.entries(firstRow.eval)
          .map(([k, v]) => {
            if (Buffer.isBuffer(v) && this.skipNonTextProperties) {
              console.warn(`⚠️ skipping non-text eval output "${k}" in report`);
              return null;
            } else {
              return k;
            }
          })
          .filter((k) => !!k),
      ];
    });

    const headers = [
      "file",
      ...inputKeys,
      ...promptKeys.flatMap((keys, index) =>
        keys.map((k) => {
          const promptName = config[index].name || `p${index}`;
          return `${promptName}_${k}`;
        })
      ),
      ...evalKeys.flatMap((keys, index) =>
        keys.map((k) => {
          const promptName = config[index].name || `p${index}`;
          return `${promptName}_eval_${k}`;
        })
      ),
    ];
    const writer = csvWriter.createArrayCsvWriter({
      header: headers,
      path: file,
    });
    await writer.writeRecords(
      rows.map((r, index) => {
        return [
          inputs[index].name,
          ...inputKeys.map((k, ki) => {
            const input = processorInput[index];
            if (!inputBufferKeys[ki]) {
              return input[k];
            } else {
              return input[k].toString("base64");
            }
          }),
          ...r.flatMap((sr, index) => {
            const keys = promptKeys[index];
            return [
              ...keys.map((k) => sr.result[k] || ""),
              ...evalKeys[index].map((k) => sr.eval[k] || ""),
            ];
          }),
        ];
      })
    );
  }
}
