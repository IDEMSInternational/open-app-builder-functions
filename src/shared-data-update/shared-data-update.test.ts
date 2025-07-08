import * as functions from "firebase-functions";
import functionsTest from "firebase-functions-test";
import * as admin from "firebase-admin";
import httpMocks from "node-mocks-http";
import { sharedDataUpdate } from "./shared-data-update";

// Set the token for tests
const TEST_TOKEN = "test-secret-token";
process.env.SHARED_DATA_UPDATE_TOKEN = TEST_TOKEN;

// Initialize the test environment
const test = functionsTest();

// Mock the Firebase Admin SDK
jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  apps: [],
}));

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

describe("sharedDataUpdate", () => {
  afterEach(() => {
    test.cleanup();
    jest.clearAllMocks();
  });

  it("should return 401 if Authorization header is missing", () => {
    const { req, res } = createMockReqRes({
      headers: { authorization: undefined },
    });
    sharedDataUpdate(req, res);
    expect(res.statusCode).toEqual(401);
    expect(res._getData()).toEqual("Unauthorized");
  });

  it("should return 401 if Authorization header is incorrect", () => {
    const { req, res } = createMockReqRes({
      headers: { authorization: "Bearer wrong-token" },
    });
    sharedDataUpdate(req, res);
    expect(res.statusCode).toEqual(401);
    expect(res._getData()).toEqual("Unauthorized");
  });

  it("should return 405 if method is not POST", () => {
    const { req, res } = createMockReqRes({ method: "GET" });
    sharedDataUpdate(req, res);
    expect(res.statusCode).toEqual(405);
    expect(res._getData()).toEqual("Method Not Allowed");
  });

  it("should return 400 if params are invalid", () => {
    const { req, res } = createMockReqRes({
      body: { foo: "bar" },
    });
    sharedDataUpdate(req, res);
    expect(res.statusCode).toEqual(400);
    expect(res._getJSONData()).toEqual({
      _errors: [],
      parent_group_id: { _errors: ["Required"] },
      parent_name: { _errors: ["Required"] },
      parent_text_id: { _errors: ["Required"] },
    });
  });

  it("should return 200 and a success message for a valid POST request", () => {
    const validBody = {
      parent_group_id: "123e4567-e89b-12d3-a456-426614174000",
      parent_name: "Test Group",
      parent_text_id: "test_text_id",
    };
    const { req, res } = createMockReqRes({ body: validBody });
    sharedDataUpdate(req, res);
    expect(res.statusCode).toEqual(200);
    expect(res._getJSONData()).toEqual({
      message: "Request received successfully!",
      receivedData: validBody,
    });
  });
});
