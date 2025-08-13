import * as functions from "firebase-functions";
import functionsTest from "firebase-functions-test";
import httpMocks from "node-mocks-http";
import { clearFirestore, getFirestoreEmulator, seedFirestore } from "../../test/firestoreTestUtils";
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

describe("groupJoin HTTP Validation", () => {
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
    expect(res._getJSONData()).toEqual({
      success: false,
      message: "Unauthorized",
      error: { status: 401 },
    });
  });

  it("should return 401 if Authorization header is incorrect", async () => {
    const { req, res } = createMockReqRes({
      headers: { authorization: "Bearer wrong-token" },
    });
    await groupJoin(req, res);
    expect(res.statusCode).toEqual(401);
    expect(res._getJSONData()).toEqual({
      success: false,
      message: "Unauthorized",
      error: { status: 401 },
    });
  });

  it("should return 405 if method is not POST", async () => {
    const { req, res } = createMockReqRes({ method: "GET" });
    await groupJoin(req, res);
    expect(res.statusCode).toEqual(405);
    expect(res._getJSONData()).toEqual({
      success: false,
      message: "Method Not Allowed",
      error: { status: 405 },
    });
  });

  it("should return 422 if params are invalid", async () => {
    const { req, res } = createMockReqRes({
      body: { foo: "bar" },
    });
    await groupJoin(req, res);
    expect(res.statusCode).toEqual(422);
    expect(res._getJSONData()).toEqual({
      success: false,
      message: "Invalid Params",
      error: {
        status: 422,
        details: {
          _errors: [],
          access_code: { _errors: ["Required"] },
          rapidpro_uuid: { _errors: ["Required"] },
          rapidpro_fields: { _errors: ["Required"] },
        },
      },
    });
  });
});

const MOCK_FIRESTORE_STATE = {
  shared_data: {
    mock_group_id: {
      data: {
        parentGroupData: {
          parents: [
            {
              rapidpro_uuid: "1660b262-95a0-480a-99ef-9abf67773bc8",
              rapidpro_fields: { name: "Bob" },
            },
          ],
        },
      },
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

  it("should return 201 if member added", async () => {
    const body: IGroupJoinRequestParams = {
      access_code: "C4F2",
      rapidpro_uuid: "1d3ea366-cfb9-4640-87e4-74e160ab7220",
      rapidpro_fields: { name: "Cynthia" },
    };
    const { req, res } = createMockReqRes({ body });
    await groupJoin(req, res);
    expect(res.statusCode).toEqual(201);
    expect(res._getJSONData()).toEqual({
      success: true,
      message: "User added to group",
      data: {
        groupId: "mock_group_id",
        userId: "1d3ea366-cfb9-4640-87e4-74e160ab7220",
        totalMembers: 2,
      },
    });
  });

  it("should return 200 if member already exists", async () => {
    const body: IGroupJoinRequestParams = {
      access_code: "C4F2",
      rapidpro_uuid: "1660b262-95a0-480a-99ef-9abf67773bc8",
      rapidpro_fields: { name: "Bob Updated" },
    };
    const { req, res } = createMockReqRes({ body });
    await groupJoin(req, res);
    expect(res.statusCode).toEqual(200);
    expect(res._getJSONData()).toEqual({
      success: true,
      message: "User already in group",
      data: {
        groupId: "mock_group_id",
        userId: "1660b262-95a0-480a-99ef-9abf67773bc8",
        totalMembers: 1,
      },
    });
  });

  it("should return 422 if parent group not found", async () => {
    const body: IGroupJoinRequestParams = {
      access_code: "BAD1",
      rapidpro_uuid: "1d3ea366-cfb9-4640-87e4-74e160ab7220",
      rapidpro_fields: { name: "Cynthia" },
    };
    const { req, res } = createMockReqRes({ body });
    await groupJoin(req, res);
    expect(res.statusCode).toEqual(422);
    expect(res._getJSONData()).toEqual({
      success: false,
      message: "Data Error",
      error: {
        status: 422,
        details: "User group not found",
      },
    });
  });
});
