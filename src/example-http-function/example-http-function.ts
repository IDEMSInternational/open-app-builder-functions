
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

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
export const exampleHttpFunction = functions.https.onRequest((request, response) => {
  if (request.method !== "POST") {
    response.status(405).send("Method Not Allowed");
    return;
  }

  try {
    // You can access the POST body data using request.body
    const data = request.body;

    // For example, if you expect a JSON payload with a "message" property:
    const message = data.message || "No message provided.";

    functions.logger.info(`Received message: ${message}`, {structuredData: true});

    // Send a response
    response.status(200).json({
      message: "Request received successfully!",
      receivedData: data,
    });
  } catch (error) {
    functions.logger.error("Error in exampleHttpFunction:", error);
    response.status(500).send("Internal Server Error");
  }
});
