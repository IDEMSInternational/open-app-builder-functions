import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

import { z } from "zod";
import { HttpsError } from "firebase-functions/https";

// Ensure Firebase is initialized
if (admin.apps.length === 0) {
  admin.initializeApp();
}

/** Request param schema and validation */
const PARAMS_SCHEMA = z.object({
  rapidpro_uuid: z.string().uuid(),
});

const ENV_SCHEMA = z.object({
  RAPIDPRO_URL: z.string().url(),
  RAPIDPRO_API_TOKEN: z.string(),
});

// Generated type from schema validation above
export type IUserDataRequestParams = z.infer<typeof PARAMS_SCHEMA>;

type IUserDataEnv = z.infer<typeof ENV_SCHEMA>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const rapidproUserData = functions.https.onCall(
  { enforceAppCheck: true, cors: process.env.ALLOW_ORIGIN || "*" },
  (request) => {
    // Validate request from app - handled by enforceAppCheck

    // Validate env
    const { data: envData, error: envError } = ENV_SCHEMA.safeParse(process.env);
    if (envError) {
      functions.logger.error("Env validation error:", envError.format());
      throw new HttpsError("internal", "SERVER_ENVIRONMENT_VARIABLES", envError.format());
    }

    // Validate params
    const { data: paramsData, error: paramsError } = PARAMS_SCHEMA.safeParse(request.data);
    if (paramsError) {
      functions.logger.error("Param validation error:", paramsError.format());
      throw new HttpsError("invalid-argument", "INVALID_PARAMS", paramsError.format());
    }

    // Process request
    return getUserData(paramsData, envData);
  },
);

async function getUserData(params: IUserDataRequestParams, env: IUserDataEnv) {
  const { RAPIDPRO_API_TOKEN, RAPIDPRO_URL } = env;
  const { rapidpro_uuid } = params;

  const endpoint = `${RAPIDPRO_URL}/api/v2/contacts.json?uuid=${rapidpro_uuid}`;
  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: { Authorization: `Token ${RAPIDPRO_API_TOKEN}`, "Content-Type": "application/json" },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} - ${response.statusText}`);
    }

    const data = (await response.json()) as IRapidProContactResponse;
    const [user] = data.results;
    if (!user) {
      // error will be caught and re-thrown as formatted error in next block
      throw new Error("User not found");
    }
    return user;
  } catch (error) {
    functions.logger.error(error);
    const message = error instanceof Error ? error.message : String(error);
    throw new HttpsError("internal", `Rapidpro Server Error - ${message}`);
  }
}

const EXAMPLE_RAPIDPRO_RESPONSE = {
  results: [
    {
      uuid: "700c4bd4-c7e5-4414-9ff2-2b1ff2571947",
      name: "Test Contact",
      language: null,
      urns: ["tel:0123456789"],
      groups: [],
      fields: {
        example_field: "example-text-value",
      },
      flow: null,
      blocked: false,
      stopped: false,
      created_on: "2025-08-14T16:24:33.644383Z",
      modified_on: "2025-08-14T16:24:33.644383Z",
      last_seen_on: null,
    },
  ],
};
type IRapidProContactResponse = typeof EXAMPLE_RAPIDPRO_RESPONSE;
