import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as crypto from "crypto";

import { z } from "zod";
import { HttpsError } from "firebase-functions/https";

// Ensure Firebase is initialized
if (admin.apps.length === 0) {
  admin.initializeApp();
}

/** Characters used in access codes (excludes "O" and "0" to avoid confusion) */
export const ACCESS_CODE_CHARACTERS = "ABCDEFGHIJKLMNPQRSTUVWXYZ123456789";
export const ACCESS_CODE_LENGTH = 4;
/** Maximum number of candidate codes to try before giving up */
export const ACCESS_CODE_MAX_ATTEMPTS = 10;

/** Request param schema and validation */
const PARAMS_SCHEMA = z.object({
  shared_id: z.string().min(1),
});

// Generated type from schema validation above
export type IGenerateAccessCodeRequestParams = z.infer<typeof PARAMS_SCHEMA>;

/**
 * Generate a unique access code for a shared parent group and save it to `shared_data/{shared_id}.access_code`.
 * Codes are checked against all existing `shared_data` docs, which app users cannot query directly.
 */
export const generateAccessCode = functions.https.onCall({ enforceAppCheck: true }, async (request) => {
  // Validate request from app - handled by enforceAppCheck

  // Validate user
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "UNAUTHENTICATED");
  }

  // Validate params
  const { data: paramsData, error: paramsError } = PARAMS_SCHEMA.safeParse(request.data);
  if (paramsError) {
    functions.logger.error("Param validation error:", paramsError.format());
    throw new HttpsError("invalid-argument", "INVALID_PARAMS", paramsError.format());
  }

  // Process request
  return setUniqueAccessCode(paramsData, uid);
});

async function setUniqueAccessCode(params: IGenerateAccessCodeRequestParams, uid: string) {
  const { shared_id } = params;
  const ref = admin.firestore().collection("shared_data");

  // Check group exists and user is owner (matches firestore rules for metadata updates)
  const groupDoc = await ref.doc(shared_id).get();
  if (!groupDoc.exists) {
    throw new HttpsError("not-found", "GROUP_NOT_FOUND");
  }
  if (groupDoc.get("_created_by") !== uid) {
    throw new HttpsError("permission-denied", "PERMISSION_DENIED");
  }

  // Generate codes until one is found that is not used by any other group
  for (let attempt = 0; attempt < ACCESS_CODE_MAX_ATTEMPTS; attempt++) {
    const access_code = generateRandomCode();
    const { empty } = await ref.where("access_code", "==", access_code).limit(1).get();
    if (empty) {
      // Update `_updated_at` so that app clients syncing changes since last update receive the new code
      await groupDoc.ref.update({ access_code, _updated_at: new Date().toISOString() });
      return { access_code };
    }
  }
  functions.logger.error(`Failed to generate unique access code after ${ACCESS_CODE_MAX_ATTEMPTS} attempts`);
  throw new HttpsError("resource-exhausted", "ACCESS_CODE_GENERATION_FAILED");
}

function generateRandomCode() {
  let code = "";
  for (let i = 0; i < ACCESS_CODE_LENGTH; i++) {
    code += ACCESS_CODE_CHARACTERS.charAt(crypto.randomInt(ACCESS_CODE_CHARACTERS.length));
  }
  return code;
}
