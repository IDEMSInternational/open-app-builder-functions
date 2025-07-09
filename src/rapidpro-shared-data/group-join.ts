import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

import { z } from "zod";

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
      response.status(405).send("Method Not Allowed");
      return;
    }
    // Validate auth token
    const { SHARED_DATA_UPDATE_TOKEN } = process.env;
    const authHeader = request.get("Authorization") || "";
    const expectedHeader = `Bearer ${SHARED_DATA_UPDATE_TOKEN}`;
    if (authHeader !== expectedHeader) {
      response.status(401).send("Unauthorized");
      return;
    }
    // Validate params
    const { data, error } = PARAMS_SCHEMA.safeParse(request.body);
    if (error) {
      functions.logger.error("Param validation error:", error);
      response.status(400).json(error.format());
      return;
    }
    // Process request
    if (data) {
      const { status, msg } = await addParentToGroup(data);
      response.status(status).send(msg);
      return;
    }
  }
);

export type IFirestoreParentGroup = {
  parentGroupData?: {
    parents?: Omit<IGroupJoinRequestParams, "access_code">[];
  };
};

/** Store reference to rapidpro parent within parentGroup data **/
async function addParentToGroup(params: IGroupJoinRequestParams) {
  const { access_code, rapidpro_fields, rapidpro_uuid } = params;
  const collectionRef = admin.firestore().collection("shared_data");
  const { size, docs } = await collectionRef.where({ access_code }).get();
  // Check group exists
  if (size === 0) {
    return { status: 400, msg: "User group not found" };
  }
  if (size > 1) {
    const msg = "Multiple groups with same access code, cannot proceed";
    return { status: 400, msg };
  }
  // Check group is parentGroup
  const [groupDoc] = docs;
  const data = groupDoc.data() as IFirestoreParentGroup;
  if (!data.parentGroupData || !data.parentGroupData.parents) {
    const msg = "Group is not setup correctly, cannot proceed";
    return { status: 400, msg };
  }
  const parents = data.parentGroupData?.parents;

  // Return success if user already member
  const existingUser = parents.find((p) => p.rapidpro_uuid === rapidpro_uuid);
  if (existingUser) {
    return { status: 200, msg: "User already a member of group" };
  }
  // Add user to group and update
  parents.push({ rapidpro_uuid, rapidpro_fields });
  data.parentGroupData.parents = parents;
  try {
    await groupDoc.ref.update({ data });
    return { status: 201, msg: "User added to group" };
  } catch (error) {
    functions.logger.error(error);
    return { status: 500, msg: "Internal error occurred" };
  }
}
