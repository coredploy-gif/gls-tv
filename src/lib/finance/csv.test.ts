import { describe, expect, it } from "vitest";
import { csvRow, safeCsvCell } from "./csv";

describe("safeCsvCell", () => {
  it.each(["=cmd()", "+SUM(A1)", "-1+2", "@IMPORT", "\tformula"])(
    "neutralizes spreadsheet formula %s",
    (value) => {
      expect(safeCsvCell(value)).toBe(`"'${value}"`);
    },
  );

  it("quotes embedded quotes and commas", () => {
    expect(csvRow(['a,"b"', 12])).toBe('"a,""b""","12"');
  });
});
