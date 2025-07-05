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
export const exampleHttpFunction = functions.https.onRequest(
  (request, response) => {
    if (request.method !== "POST") {
      response.status(405).send("Method Not Allowed");
      return;
    }

    try {
      const { success, data, error } = validateParams(request);

      if (error) {
        response.status(400).json({
          error: error.format(),
        });
        return;
      }

      // functions.logger.info(`Received message: ${message}`, {
      //   structuredData: true,
      // });

      // Send a response
      response.status(200).json({
        message: "Request received successfully!",
        receivedData: data,
      });
    } catch (error) {
      functions.logger.error("Error in exampleHttpFunction:", error);
      response.status(500).send("Internal Server Error");
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
