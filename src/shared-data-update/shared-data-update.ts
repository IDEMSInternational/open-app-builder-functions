import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

import { z } from "zod";

// Ensure Firebase is initialized
if (admin.apps.length === 0) {
  admin.initializeApp();
}

/** Request param schema and validation */
const PARAMS_SCHEMA = z.object({
  parent_group_id: z.string().uuid(),
  parent_name: z.string(),
  parent_text_id: z.string(),
});

// Generated type from schema validation above
export type ISharedDataRequestParams = z.infer<typeof PARAMS_SCHEMA>;

export const sharedDataUpdate = functions.https.onRequest(
  async (request, response) => {
    // Bearer token check
    const { SHARED_DATA_UPDATE_TOKEN } = process.env;
    const authHeader = request.get("Authorization") || "";
    const expectedHeader = `Bearer ${SHARED_DATA_UPDATE_TOKEN}`;
    if (authHeader !== expectedHeader) {
      response.status(401).send("Unauthorized");
      return;
    }

    if (request.method !== "POST") {
      response.status(405).send("Method Not Allowed");
      return;
    }

    try {
      const { data, error } = PARAMS_SCHEMA.safeParse(request.body);

      if (error) {
        functions.logger.error("Param validation error:", error);
        response.status(400).json(error.format());
        return;
      }
      if (data) {
        const { status, msg } = await addParentToGroup(data);

        // Send a response
        response.status(status).send(msg);
        return;
      }
    } catch (error) {
      functions.logger.error(error);
      response.status(500).send("Internal Server Error");
      return;
    }
  }
);

async function addParentToGroup(params: ISharedDataRequestParams) {
  const { parent_group_id, parent_name, parent_text_id } = params;
  const docRef = admin.firestore().doc(`shared_data/${parent_group_id}`);
  const { exists, data } = await docRef.get();
  console.log("exists", exists);
  if (exists) {
    return { status: 200, msg: "User updated successfully" };
  }
  return { status: 400, msg: "User group not found" };
}
