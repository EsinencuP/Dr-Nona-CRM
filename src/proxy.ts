import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/api/applications" || request.nextUrl.pathname === "/api/telegram-webhook") {
    return NextResponse.next();
  }

  const user = process.env.CRM_BASIC_USER;
  const password = process.env.CRM_BASIC_PASSWORD;

  if (!user && !password && process.env.NODE_ENV !== "production") {
    return NextResponse.next();
  }

  if (!user || !password) {
    return new NextResponse("CRM access is not configured.", { status: 503 });
  }

  const expected = `Basic ${btoa(`${user}:${password}`)}`;
  if (request.headers.get("authorization") !== expected) {
    return new NextResponse("Authentication required.", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Dr. Nona CRM", charset="UTF-8"' },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|brand/|fonts/|favicon.ico).*)"],
};
