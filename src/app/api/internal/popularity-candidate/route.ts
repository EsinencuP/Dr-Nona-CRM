import { getPopularityCandidate } from "../../../../../server/popularity/service";
import { timingSafeEqual } from "node:crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const privateHeaders = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" };

function validToken(actual: string, expected: string) {
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(request: Request) {
  const secret = process.env.POPULARITY_EXPORT_TOKEN;
  if (!secret || secret.length < 32) {
    return new Response("Popularity export is not configured.", { status: 503, headers: privateHeaders });
  }
  if (!validToken(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return new Response("Authentication required.", { status: 401, headers: privateHeaders });
  }

  try {
    const candidate = await getPopularityCandidate();
    return Response.json(candidate, { headers: privateHeaders });
  } catch (error) {
    console.error("Popularity candidate generation failed", error);
    return new Response("Popularity export unavailable.", { status: 503, headers: privateHeaders });
  }
}
