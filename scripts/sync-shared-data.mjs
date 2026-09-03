import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const crmRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteRoot = path.resolve(process.env.ECATALOG_ROOT || path.join(crmRoot, "..", "Dr Nona"));

const copies = [
  ["src/data/products.json", "src/data/products.json"],
  ["public/brand/dr-nona-logo.png", "public/brand/dr-nona-logo.png"],
  ["public/brand/favicon-64.png", "public/brand/favicon-64.png"],
];

for (const [source, destination] of copies) {
  const destinationPath = path.join(crmRoot, destination);
  await mkdir(path.dirname(destinationPath), { recursive: true });
  await copyFile(path.join(siteRoot, source), destinationPath);
  console.log(`Synced ${source}`);
}
