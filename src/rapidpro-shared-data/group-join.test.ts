import * as functions from "firebase-functions";
import functionsTest from "firebase-functions-test";
import httpMocks from "node-mocks-http";
import {
  clearFirestore,
  getFirestoreEmulator,
  seedFirestore,
} from "../../test/firestoreTestUtils";
import { IGroupJoinRequestParams, groupJoin } from "./group-join";

// Set the token for tests
const TEST_TOKEN = "test-secret-token";
process.env.SHARED_DATA_UPDATE_TOKEN = TEST_TOKEN;

// Initialize the test environment
const test = functionsTest();

// At the very top of your test file or test setup file:
process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";

const requestDefaults: httpMocks.RequestOptions = {
  method: "POST",
  body: {},
  headers: {
    authorization: `Bearer ${TEST_TOKEN}`,
  },
};

// Helper to create mock req/res
function createMockReqRes(requestOverrides: Partial<httpMocks.RequestOptions>) {
  const req = httpMocks.createRequest<functions.https.Request>({
    ...requestDefaults,
    ...requestOverrides,
  });
  const res = httpMocks.createResponse();
  return { req, res };
}

describe("sharedDataUpdate HTTP Validation", () => {
  afterEach(() => {
    test.cleanup();
    jest.clearAllMocks();
  });

  it("should return 401 if Authorization header is missing", async () => {
    const { req, res } = createMockReqRes({
      headers: { authorization: undefined },
    });
    await groupJoin(req, res);
    expect(res.statusCode).toEqual(401);
    expect(res._getData()).toEqual("Unauthorized");
  });

  it("should return 401 if Authorization header is incorrect", async () => {
    const { req, res } = createMockReqRes({
      headers: { authorization: "Bearer wrong-token" },
    });
    await groupJoin(req, res);
    expect(res.statusCode).toEqual(401);
    expect(res._getData()).toEqual("Unauthorized");
  });

  it("should return 405 if method is not POST", async () => {
    const { req, res } = createMockReqRes({ method: "GET" });
    await groupJoin(req, res);
    expect(res.statusCode).toEqual(405);
    expect(res._getData()).toEqual("Method Not Allowed");
  });

  it("should return 400 if params are invalid", async () => {
    const { req, res } = createMockReqRes({
      body: { foo: "bar" },
    });
    await groupJoin(req, res);
    expect(res.statusCode).toEqual(400);
    expect(res._getJSONData()).toEqual({
      _errors: [],
      parent_group_id: { _errors: ["Required"] },
      parent_name: { _errors: ["Required"] },
      parent_text_id: { _errors: ["Required"] },
    });
  });
});

const MOCK_FIRESTORE_STATE = {
  shared_data: {
    mock_group_id: {
      _created_at: new Date("2025-07-04"),
      _updated_at: new Date("2025-07-04"),
      admins: ["mock_user_id_1"],
      data: { label: "mock label" },
      id: "mock_group_id",
      members: ["mock_user_id_1", "mock_user_id_2"],
      access_code: "C4F2",
    },
  },
};

describe("groupJoin Firestore", () => {
  beforeEach(async () => {
    await clearFirestore();
    await seedFirestore(MOCK_FIRESTORE_STATE);
  });
  it("seeds data for testing", async () => {
    const firestore = getFirestoreEmulator();
    const snapshot = await firestore.doc(`shared_data/mock_group_id`).get();
    expect(snapshot.exists).toEqual(true);
  });

  it("should return 404 if parent group not found", async () => {
    // TODO
  });

  it("should return 200 if member added", async () => {
    const validBody: IGroupJoinRequestParams = {
      access_code: "C4F2",
      rapidpro_uuid: "abcd-123-efg",
      rapidpro_fields: { name: "Bob" },
    };
    // TODO - verify expected behaviour...

    const { req, res } = createMockReqRes({ body: validBody });
    await groupJoin(req, res);
    expect(res.statusCode).toEqual(200);
    expect(res._getJSONData()).toEqual({
      message: "Request received successfully!",
      receivedData: validBody,
    });
  });

  it("should return 201 if member updated", async () => {
    // TODO
  });
  //
});
