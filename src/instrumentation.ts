import type { Instrumentation } from "next";
import { operationalLog } from "@/lib/operations/logger";

export function register() {
  operationalLog("info", "application.instance.started", {
    runtime: process.env.NEXT_RUNTIME || "nodejs",
  });
}

export const onRequestError: Instrumentation.onRequestError = (
  error,
  request,
  context,
) => {
  const digest =
    typeof error === "object" && error !== null && "digest" in error
      ? String(error.digest)
      : undefined;
  operationalLog("error", "request.unhandled_error", {
    method: request.method,
    path: request.path.split("?")[0],
    routePath: context.routePath,
    routeType: context.routeType,
    digest,
  });
};
