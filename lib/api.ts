import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getDashboardSnapshot } from "@/lib/store";

export function ok(data: Record<string, unknown> = {}) {
  return NextResponse.json({
    ...data,
    snapshot: getDashboardSnapshot()
  });
}

export function fail(error: unknown, status = 400) {
  const message =
    error instanceof ZodError
      ? error.issues.map((issue) => issue.message).join("；")
      : error instanceof Error
        ? error.message
        : "请求处理失败。";

  return NextResponse.json({ error: message }, { status });
}
