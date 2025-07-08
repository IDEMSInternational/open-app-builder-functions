import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

import { z } from "zod";

// Ensure Firebase is initialized
if (admin.apps.length === 0) {
  admin.initializeApp();
}

/**
 * A simple HTTP-triggered Firebase Function.
 *
 * @param {functions.https.Request} request - The HTTP request object.
 * @param {functions.Response} response - The HTTP response object.
 */
export const sharedDataUpdate = functions.https.onRequest(
  (request, response) => {
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
      const { data, error } = validateParams(request);

      if (error) {
        functions.logger.error("Param validation error:", error);
        response.status(400).json(error.format());
        return;
      }
      if (data) {
        const { parent_group_id, parent_name, parent_text_id } = data;

        // Send a response
        response.status(200).json({
          message: "Request received successfully!",
          receivedData: data,
        });
        return;
      }
    } catch (error) {
      functions.logger.error(error);
      response.status(500).send("Internal Server Error");
      return;
    }
  }
);

function validateParams(req: functions.https.Request) {
  // Define your schema
  const schema = z.object({
    parent_group_id: z.string().uuid(),
    parent_name: z.string(),
    parent_text_id: z.string(),
  });

  const result = schema.safeParse(req.body);
  return result;
}
