import * as functions from "firebase-functions";
import { z } from "zod";
import type { Response } from "express";

import { errorResponse } from "./responses";

const ENV_SCHEMA = z.object({
  /**
   * Shared data auth token used by the upstream `groupJoin` function.
   * Must be provided as `SHARED_DATA_UPDATE_TOKEN` in the proxy project as well.
   */
  SHARED_DATA_UPDATE_TOKEN: z.string(),
  /**
   * Full HTTPS URL to the remote `groupJoin` function endpoint, for example:
   * `https://us-central1-<project-id>.cloudfunctions.net/groupJoin`
   */
  GROUP_JOIN_REMOTE_URL: z.string().url(),
});

async function forwardResponse(response: Response, upstreamResponse: globalThis.Response): Promise<void> {
  // Mirror status first; body parsing happens next.
  response.status(upstreamResponse.status);

  // Relay common CORS headers so browsers can complete preflight/POST flows.
  const corsHeaderNames = [
    "access-control-allow-origin",
    "access-control-allow-methods",
    "access-control-allow-headers",
    "access-control-max-age",
  ];
  corsHeaderNames.forEach((h) => {
    const v = upstreamResponse.headers.get(h);
    if (v) response.set(h, v);
  });

  try {
    const text = await upstreamResponse.text();
    if (upstreamResponse.status === 204) {
      response.send("");
      return;
    }

    const contentType = upstreamResponse.headers.get("content-type") || "";
    const looksLikeJson = contentType.includes("application/json") || contentType.includes("+json");
    if (looksLikeJson) {
      // Forward as text instead of parsing/re-stringifying.
      // This preserves the upstream body exactly and avoids crashes on invalid JSON.
      if (contentType) response.set("Content-Type", contentType);
      response.send(text);
      return;
    }

    response.send(text);
  } catch (error) {
    // If body reading fails, still return the status code we got.
    functions.logger.error("Failed to process upstream response body:", { error });
    response.send("");
  }
}

/**
 * Proxy version for cross-project usage.
 *
 * This function is deployed to a different Firebase project and forwards the incoming
 * HTTP request to the remote `groupJoin` endpoint.
 */
export const groupJoinProxy = functions.https.onRequest(async (request, response) => {
  const { data: envData, error: envError } = ENV_SCHEMA.safeParse(process.env);
  if (envError) {
    functions.logger.error("Proxy env validation error:", envError.format());
    return errorResponse(response, "SERVER_MISCONFIGURATION", "Missing/invalid proxy env vars");
  }

  const upstreamUrl = envData.GROUP_JOIN_REMOTE_URL;

  // Only forward the most relevant headers to keep behavior predictable.
  const upstreamHeaders: Record<string, string> = {};
  // Use the proxy project's env token to authenticate to the upstream project.
  upstreamHeaders.Authorization = `Bearer ${envData.SHARED_DATA_UPDATE_TOKEN}`;

  upstreamHeaders["Content-Type"] = "application/json";

  let upstreamBody: string | undefined;
  if (request.body !== undefined) {
    upstreamBody = typeof request.body === "string" ? request.body : JSON.stringify(request.body);
  }

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      headers: upstreamHeaders,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : upstreamBody,
    });

    await forwardResponse(response, upstreamResponse);
    return;
  } catch (error) {
    functions.logger.error(error);
    return errorResponse(response, "INTERNAL_ERROR", "Failed to forward request to remote groupJoin");
  }
});

