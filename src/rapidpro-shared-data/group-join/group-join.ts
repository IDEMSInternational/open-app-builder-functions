import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import type { Response } from "express";

import { timingSafeEqual } from "crypto";

import { z } from "zod";
import { errorResponse, successResponse } from "./responses";

// Ensure Firebase is initialized
if (admin.apps.length === 0) {
  admin.initializeApp();
}

/** Request param schema and validation */
const PARAMS_SCHEMA = z.object({
  access_code: z.string(),
  rapidpro_uuid: z.string().uuid().optional(),
  app_parent_id: z.string().optional(),
  app_auth_parent_id: z.string().optional(),
  rapidpro_fields: z.record(z.any()),
}).refine(
  (data) => !!(data.rapidpro_uuid || data.app_auth_parent_id || data.app_parent_id),
  {
    message: "At least one ID is required",
    path: [],
  },
);

// Generated type from schema validation above
export type IGroupJoinRequestParams = z.infer<typeof PARAMS_SCHEMA>;

export const groupJoin = functions.https.onRequest(async (request, response) => {
  response.set("Access-Control-Allow-Origin", process.env.ALLOW_ORIGIN || "");

  if (request.method === "OPTIONS") {
    response.set("Access-Control-Allow-Methods", "POST");
    response.set("Access-Control-Allow-Headers", "Authorization,Content-Type");
    response.set("Access-Control-Max-Age", "3600");
    response.status(204).send("");
    return;
  }

  if (request.method !== "POST") {
    return errorResponse(response, "METHOD_NOT_ALLOWED");
  }

  // Validate auth token
  const { SHARED_DATA_UPDATE_TOKEN } = process.env;
  if (!SHARED_DATA_UPDATE_TOKEN) {
    functions.logger.error("SHARED_DATA_UPDATE_TOKEN is not set");
    return errorResponse(response, "SERVER_MISCONFIGURATION", "No auth token on present");
  }
  const authHeader = request.get("Authorization") || "";
  const expectedHeader = `Bearer ${SHARED_DATA_UPDATE_TOKEN}`;
  if (!sensitiveStringIsEqual(authHeader, expectedHeader)) {
    return errorResponse(response, "UNAUTHORIZED");
  }
  // Validate params
  const { data, error } = PARAMS_SCHEMA.safeParse(request.body);
  if (error) {
    functions.logger.error("Param validation error:", error);
    return errorResponse(response, "INVALID_PARAMS", error.format());
  }
  // Process request
  return addParentToGroup(data, response);
});

export type IFirestoreParentGroup = {
  parentGroupData?: {
    parents?: Omit<IGroupJoinRequestParams, "access_code">[];
  };
};

/** Store reference to rapidpro parent within parentGroup data **/
async function addParentToGroup(params: IGroupJoinRequestParams, response: Response) {
  const {
    access_code,
    rapidpro_fields,
    rapidpro_uuid,
    app_auth_parent_id,
    app_parent_id,
  } = params;

  const ref = admin.firestore().collection("shared_data");
  const { size, docs } = await ref.where("access_code", "==", access_code).get();

  // Check group exists
  if (size === 0) {
    return errorResponse(response, "DATA_ERROR", "User group not found");
  }
  if (size > 1) {
    const msg = "Multiple groups with same access code, cannot proceed";
    return errorResponse(response, "DATA_ERROR", msg);
  }
  // Check group is parentGroup
  const [groupDoc] = docs;
  const data = groupDoc.data().data as IFirestoreParentGroup;
  if (!data.parentGroupData || !data.parentGroupData.parents) {
    const msg = "Group is not setup correctly, cannot proceed";
    return errorResponse(response, "DATA_ERROR", msg);
  }
  const parents = data.parentGroupData?.parents;
  const idInfo = getPriorityParentId({
    rapidpro_uuid,
    app_auth_parent_id,
    app_parent_id,
  });
  const userId = idInfo.value;

  // Return success if user already member
  const existingUser = parents.find((p) => p[idInfo.key] === userId);
  if (existingUser) {
    return successResponse(response, "USER_EXISTING", {
      userId,
      groupId: groupDoc.id,
      totalMembers: parents.length,
    });
  }
  // Add user to group and update
  parents.push({
    rapidpro_fields,
    ...(rapidpro_uuid ? { rapidpro_uuid } : {}),
    ...(app_auth_parent_id ? { app_auth_parent_id } : {}),
    ...(app_parent_id ? { app_parent_id } : {}),
  });
  data.parentGroupData.parents = parents;
  try {
    await groupDoc.ref.update({ data });
    return successResponse(response, "USER_ADDED", {
      userId,
      groupId: groupDoc.id,
      totalMembers: parents.length,
    });
  } catch (error) {
    functions.logger.error(error);
    return errorResponse(response, "INTERNAL_ERROR");
  }
}

/**
 * Compare strings within constant-time algorithm to avoid accidental timing information leak that could
 * be used to guess sensitive values.
 * Regular string comparison returns immediately on first character mismatch, allowing the time to resolve
 * to be used as part of brute-force attacks (faster resolve indicating fewer correct characters)
 */
function sensitiveStringIsEqual(a: string, b: string) {
  // Convert both to buffers
  const aBuffer = Buffer.from(a, "utf8");
  const bBuffer = Buffer.from(b, "utf8");
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}

/**
 * Determine the parent ID to use for the user based on the available options
 * Order of priority is:
 * 1. Rapidpro UUID (included in requests from RapidPro)
 * 2. App Auth Parent ID (included in requests from app, if user is authenticated)
 * 3. App Parent ID (included in all requests from app)
 */
function getPriorityParentId(params: {
  rapidpro_uuid?: string;
  app_auth_parent_id?: string;
  app_parent_id?: string;
}) {
  if (params.rapidpro_uuid) {
    return { key: "rapidpro_uuid" as const, value: params.rapidpro_uuid };
  }
  if (params.app_auth_parent_id) {
    return { key: "app_auth_parent_id" as const, value: params.app_auth_parent_id };
  }
  return { key: "app_parent_id" as const, value: params.app_parent_id as string };
}
