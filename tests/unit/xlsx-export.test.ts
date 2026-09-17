import { describe, expect, test } from "vitest";

import { createXlsxWorkbook } from "../../server/exports/xlsx";
import { inflateRawSync } from "node:zlib";

function sheetXml(archive: Buffer) {
  const name = Buffer.from("xl/worksheets/sheet1.xml");
  const index = archive.indexOf(name);
  if (index < 0) throw new Error("Missing worksheet");
  const header = index - 30;
  const size = archive.readUInt32LE(header + 18);
  return inflateRawSync(archive.subarray(index + name.length, index + name.length + size)).toString("utf8");
}

describe("minimal Excel export", () => {
  test("stores untrusted formula-like values as text and keeps numeric totals numeric", () => {
    const workbook = createXlsxWorkbook(
      "Заказы",
      ["Имя", "Сумма"],
      [
        ['=HYPERLINK("evil")', 120.5],
        ["Иван & Мария", null],
      ],
    );
    expect(workbook.subarray(0, 4).toString("hex")).toBe("504b0304");
    const xml = sheetXml(workbook);
    expect(xml).toContain('r="A2" t="inlineStr"');
    expect(xml).toContain("=HYPERLINK(&quot;evil&quot;)");
    expect(xml).toContain('<c r="B2"><v>120.5</v></c>');
    expect(xml).toContain("Иван &amp; Мария");
    expect(xml).not.toContain("<f>");
  });

  test("rejects rows that would truncate silently", () => {
    expect(() => createXlsxWorkbook("Отчёт", ["A", "B"], [["only one"]])).toThrow("row width");
    expect(() =>
      createXlsxWorkbook(
        "Отчёт",
        ["A"],
        Array.from({ length: 10_001 }, () => ["x"]),
      ),
    ).toThrow("limits");
  });
});
