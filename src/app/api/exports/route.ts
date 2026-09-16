import { prisma } from "@/lib/prisma";
import { evaluateCrmBasicAuth } from "@/server/basic-auth";

import { getReportData } from "../../../../server/exports/report-data";
import { parseExportRequest } from "../../../../server/exports/request";
import { createXlsxWorkbook } from "../../../../server/exports/xlsx";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const privateHeaders = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" };

async function recordFailure(actor: string, errorCode: string, input?: ReturnType<typeof parseExportRequest>) {
  try {
    await prisma.reportExportAudit.create({
      data: {
        actor,
        report: input?.report ?? "invalid",
        columns: input?.columns ?? [],
        fromDate: input?.fromDate,
        toDate: input?.toDate,
        includeDemo: input?.includeDemo ?? false,
        outcome: "FAILED",
        errorCode,
      },
    });
  } catch (error) {
    console.error("Report export failure could not be audited", error instanceof Error ? error.name : "unknown");
  }
}

export async function POST(request: Request) {
  const access = evaluateCrmBasicAuth(request.headers.get("authorization"));
  if (access !== "allow") {
    return new Response(access === "unavailable" ? "CRM access unavailable." : "Authentication required.", {
      status: access === "unavailable" ? 503 : 401,
      headers: { ...privateHeaders, "WWW-Authenticate": 'Basic realm="Dr. Nona CRM", charset="UTF-8"' },
    });
  }
  const actor = process.env.CRM_BASIC_USER ?? "local-development";
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    await recordFailure(actor, "ORIGIN_MISMATCH");
    return new Response("Invalid request origin.", { status: 403, headers: privateHeaders });
  }

  let input: ReturnType<typeof parseExportRequest>;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 8_192) throw new Error("Request too large");
    input = parseExportRequest(JSON.parse(raw));
  } catch {
    await recordFailure(actor, "INVALID_REQUEST");
    return new Response("Invalid export selection.", { status: 400, headers: privateHeaders });
  }

  try {
    const report = await getReportData(input);
    const workbook = createXlsxWorkbook(report.sheetName, report.headers, report.rows);
    await prisma.reportExportAudit.create({
      data: {
        actor,
        report: input.report,
        columns: input.columns,
        fromDate: input.fromDate,
        toDate: input.toDate,
        includeDemo: input.includeDemo,
        outcome: "CREATED",
        rowCount: report.rowCount,
        fileBytes: workbook.length,
      },
    });
    const day = new Date().toISOString().slice(0, 10);
    return new Response(new Uint8Array(workbook), {
      status: 200,
      headers: {
        ...privateHeaders,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="dr-nona-${input.report}-${day}.xlsx"`,
        "Content-Length": String(workbook.length),
      },
    });
  } catch (error) {
    const limited = error instanceof Error && error.message.includes("10000 rows");
    await recordFailure(actor, limited ? "ROW_LIMIT" : "GENERATION_FAILED", input);
    return new Response(limited ? "Too many rows; narrow the date range." : "Export unavailable.", {
      status: limited ? 413 : 503,
      headers: privateHeaders,
    });
  }
}
