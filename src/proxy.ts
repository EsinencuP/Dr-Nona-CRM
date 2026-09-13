import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { evaluateCrmBasicAuth, isPublicCrmApiPath } from "./server/basic-auth";

const privateResponseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
};

export function proxy(request: NextRequest) {
  if (isPublicCrmApiPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const decision = evaluateCrmBasicAuth(request.headers.get("authorization"));
  if (decision === "allow") {
    return NextResponse.next();
  }
  if (decision === "unavailable") {
    return new NextResponse("CRM access is not configured.", {
      status: 503,
      headers: privateResponseHeaders,
    });
  }
  if (decision === "unauthorized") {
    return new NextResponse("Authentication required.", {
      status: 401,
      headers: {
        ...privateResponseHeaders,
        "WWW-Authenticate": 'Basic realm="Dr. Nona CRM", charset="UTF-8"',
      },
    });
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|brand/|fonts/|favicon.ico).*)"],
};
