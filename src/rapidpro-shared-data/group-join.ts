import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import type { Response } from 'express'

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
  rapidpro_uuid: z.string().uuid(),
  rapidpro_fields: z.record(z.any()),
});

// Generated type from schema validation above
export type IGroupJoinRequestParams = z.infer<typeof PARAMS_SCHEMA>;

export const groupJoin = functions.https.onRequest(
  async (request, response) => {
    // Validate request method
    if (request.method !== "POST") {
      return errorResponse(response, 'METHOD_NOT_ALLOWED')

    }
    // Validate auth token
    const { SHARED_DATA_UPDATE_TOKEN } = process.env;
    if (!SHARED_DATA_UPDATE_TOKEN) {
      functions.logger.error("SHARED_DATA_UPDATE_TOKEN is not set");
      return errorResponse(response, 'SERVER_MISCONFIGURATION', 'No auth token on present');
    }
    const authHeader = request.get("Authorization") || "";
    const expectedHeader = `Bearer ${SHARED_DATA_UPDATE_TOKEN}`;
    if (!sensitiveStringIsEqual(authHeader, expectedHeader)) {
      return errorResponse(response, 'UNAUTHORIZED');
    }
    // Validate params
    const { data, error } = PARAMS_SCHEMA.safeParse(request.body);
    if (error) {
      functions.logger.error("Param validation error:", error);
      return errorResponse(response, 'INVALID_PARAMS', error.format());
    }
    // Process request
    return addParentToGroup(data, response);

  }
);

export type IFirestoreParentGroup = {
  parentGroupData?: {
    parents?: Omit<IGroupJoinRequestParams, "access_code">[];
  };
};

/** Store reference to rapidpro parent within parentGroup data **/
async function addParentToGroup(params: IGroupJoinRequestParams, response: Response) {
  const { access_code, rapidpro_fields, rapidpro_uuid } = params;

  const ref = admin.firestore().collection("shared_data");
  const { size, docs } = await ref
    .where("access_code", "==", access_code)
    .get();

  // Check group exists
  if (size === 0) {
    return errorResponse(response, 'DATA_ERROR', 'User group not found')

  }
  if (size > 1) {
    const msg = "Multiple groups with same access code, cannot proceed";
    return errorResponse(response, 'DATA_ERROR', msg)
  }
  // Check group is parentGroup
  const [groupDoc] = docs;
  const data = groupDoc.data().data as IFirestoreParentGroup;
  if (!data.parentGroupData || !data.parentGroupData.parents) {
    const msg = "Group is not setup correctly, cannot proceed";
    return errorResponse(response, 'DATA_ERROR', msg)
  }
  const parents = data.parentGroupData?.parents;

  // Return success if user already member
  const existingUser = parents.find((p) => p.rapidpro_uuid === rapidpro_uuid);
  if (existingUser) {
    return successResponse(response, 'USER_EXISTING', {
      userId: rapidpro_uuid,
      groupId: groupDoc.id,
      totalMembers: parents.length
    })
  }
  // Add user to group and update
  parents.push({ rapidpro_uuid, rapidpro_fields });
  data.parentGroupData.parents = parents;
  try {
    await groupDoc.ref.update({ data });
    return successResponse(response, 'USER_ADDED', {
      userId: rapidpro_uuid,
      groupId: groupDoc.id,
      totalMembers: parents.length
    })
  } catch (error) {
    functions.logger.error(error);
    return errorResponse(response, 'INTERNAL_ERROR',)
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
