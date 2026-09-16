import { deflateRawSync } from "node:zlib";

export type SpreadsheetValue = string | number | null;

const ZIP_DATE = 0x21; // 1980-01-01; exports do not expose server filesystem timestamps.
const UTF8_FLAG = 0x800;

function crc32(data: Buffer) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(entries: ReadonlyArray<{ name: string; data: string }>) {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const plain = Buffer.from(entry.data, "utf8");
    const compressed = deflateRawSync(plain);
    const checksum = crc32(plain);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(UTF8_FLAG, 6);
    localHeader.writeUInt16LE(8, 8);
    localHeader.writeUInt16LE(ZIP_DATE, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(plain.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    local.push(localHeader, name, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(UTF8_FLAG, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(ZIP_DATE, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(plain.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt32LE(offset, 42);
    central.push(centralHeader, name);
    offset += localHeader.length + name.length + compressed.length;
  }
  const centralBytes = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBytes.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, centralBytes, end]);
}

function escapeXml(value: string) {
  return [...value]
    .filter((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code >= 32 || code === 9 || code === 10 || code === 13;
    })
    .join("")
    .replace(/\p{Cs}/gu, "�")
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&apos;");
}

function columnName(index: number) {
  let result = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26))
    result = String.fromCharCode(65 + ((n - 1) % 26)) + result;
  return result;
}

function cell(value: SpreadsheetValue, address: string) {
  if (value === null) return "";
  if (typeof value === "number" && Number.isFinite(value)) return `<c r="${address}"><v>${value}</v></c>`;
  // inlineStr is always text, including values beginning with =,+,-,@ or tabs.
  return `<c r="${address}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(String(value))}</t></is></c>`;
}

export function createXlsxWorkbook(
  sheetName: string,
  headers: readonly string[],
  rows: ReadonlyArray<readonly SpreadsheetValue[]>,
) {
  if (
    !sheetName ||
    sheetName.length > 31 ||
    ["\\", "/", "?", "*", "[", "]", ":"].some((character) => sheetName.includes(character))
  ) {
    throw new Error("Invalid worksheet name");
  }
  if (!headers.length || headers.length > 100 || rows.length > 10_000) throw new Error("Spreadsheet limits exceeded");
  if (rows.some((row) => row.length !== headers.length)) throw new Error("Spreadsheet row width mismatch");
  const allRows: ReadonlyArray<readonly SpreadsheetValue[]> = [headers, ...rows];
  const xmlRows = allRows
    .map((row, index) => {
      const cells = row.map((value, column) => cell(value, `${columnName(column)}${index + 1}`)).join("");
      return `<row r="${index + 1}">${cells}</row>`;
    })
    .join("");
  const lastColumn = columnName(headers.length - 1);
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetData>${xmlRows}</sheetData><autoFilter ref="A1:${lastColumn}${allRows.length}"/></worksheet>`;
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  return zip([
    {
      name: "[Content_Types].xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    },
    {
      name: "_rels/.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    { name: "xl/workbook.xml", data: workbook },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    },
    { name: "xl/worksheets/sheet1.xml", data: sheet },
  ]);
}
