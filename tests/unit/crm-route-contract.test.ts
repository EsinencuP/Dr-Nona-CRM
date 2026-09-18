import { describe, expect, test } from "vitest";

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const appRoot = join(process.cwd(), "src", "app");
const approvedRoutes = ["/catalog", "/clients", "/dashboard", "/orders", "/results"];

function pageFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return pageFiles(path);
    return entry.name === "page.tsx" ? [path] : [];
  });
}

function routeFor(file: string) {
  const segments = relative(appRoot, file)
    .split(sep)
    .slice(0, -1)
    .filter((segment) => !(segment.startsWith("(") && segment.endsWith(")")));
  return segments.length ? `/${segments.join("/")}` : "/";
}

describe("CRM page-route contract", () => {
  test("exposes only the root redirect and five approved CRM pages", () => {
    const routes = pageFiles(appRoot).map(routeFor).sort();
    expect(routes).toEqual(["/", ...approvedRoutes]);
    expect(readFileSync(join(appRoot, "page.tsx"), "utf8")).toContain('redirect("/dashboard")');
  });

  test("keeps the sidebar destinations equal to the approved route set", () => {
    const shell = readFileSync(join(appRoot, "(crm)", "_components", "crm-shell.tsx"), "utf8");
    const hrefs = [...shell.matchAll(/href:\s*"([^"?]+)"/g)].map((match) => match[1]).sort();
    expect(hrefs).toEqual(approvedRoutes);
    expect(shell).not.toMatch(/href:\s*"\/(?:status|debug|results\/)/);
  });
});
