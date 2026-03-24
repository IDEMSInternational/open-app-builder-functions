import * as functions from "firebase-functions";
import functionsTest from "firebase-functions-test";
import httpMocks from "node-mocks-http";
import { clearFirestore, getFirestoreEmulator, seedFirestore } from "../../../test/firestoreTestUtils";
import { IGroupJoinRequestParams, groupJoin } from "./group-join";
import { groupJoinProxy } from "./group-join-proxy";

// Set the token for tests
const TEST_TOKEN = "test-secret-token";
process.env.SHARED_DATA_UPDATE_TOKEN = TEST_TOKEN;
process.env.GROUP_JOIN_REMOTE_URL = "https://example.com/groupJoin";

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

/**
 * Run directly (execute jest tests within emulator)
 * ```bash
 * npm run emulators:exec "jest group-join"
 * ```
 */
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

describe("groupJoinProxy forwarding", () => {
  const TEST_PROXY_URL = "https://remote.example/functions/groupJoin";

  afterEach(() => {
    jest.restoreAllMocks();
    // Ensure other tests (or future additions) don't accidentally use the mocked fetch.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = undefined;
  });

  it("forwards the request and relays upstream JSON", async () => {
    const upstreamJson = {
      success: true,
      message: "User added to group",
      data: { groupId: "mock_group_id", userId: "1d3ea366-cfb9-4640-87e4-74e160ab7220", totalMembers: 2 },
    };

    const fetchMock = jest.fn().mockResolvedValue({
      status: 201,
      headers: {
        get: (name: string) => {
          if (name.toLowerCase() === "content-type") return "application/json; charset=utf-8";
          return null;
        },
      },
      json: async () => upstreamJson,
      text: async () => JSON.stringify(upstreamJson),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = fetchMock;
    process.env.GROUP_JOIN_REMOTE_URL = TEST_PROXY_URL;

    const body: IGroupJoinRequestParams = {
      access_code: "C4F2",
      rapidpro_uuid: "1d3ea366-cfb9-4640-87e4-74e160ab7220",
      rapidpro_fields: { name: "Cynthia" },
    };

    // Proxy authenticates to the upstream using its env token; callers do not need to provide Authorization.
    const { req, res } = createMockReqRes({ body, headers: { authorization: undefined } });
    await groupJoinProxy(req, res);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, calledOptions] = fetchMock.mock.calls[0];
    expect(calledUrl).toEqual(TEST_PROXY_URL);
    expect(calledOptions.method).toEqual("POST");
    expect(calledOptions.headers.Authorization).toEqual(`Bearer ${TEST_TOKEN}`);
    expect(calledOptions.headers["Content-Type"]).toEqual("application/json");
    expect(calledOptions.body).toEqual(JSON.stringify(body));

    expect(res.statusCode).toEqual(201);
    expect(res._getJSONData()).toEqual(upstreamJson);
  });

  it("unwraps Firebase callable envelope { data: ... }", async () => {
    const upstreamJson = {
      success: true,
      message: "User added to group",
      data: { groupId: "mock_group_id", userId: "1d3ea366-cfb9-4640-87e4-74e160ab7220", totalMembers: 2 },
    };

    const fetchMock = jest.fn().mockResolvedValue({
      status: 201,
      headers: {
        get: (name: string) => {
          if (name.toLowerCase() === "content-type") return "application/json; charset=utf-8";
          return null;
        },
      },
      json: async () => upstreamJson,
      text: async () => JSON.stringify(upstreamJson),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = fetchMock;
    process.env.GROUP_JOIN_REMOTE_URL = TEST_PROXY_URL;

    const body: IGroupJoinRequestParams = {
      access_code: "C4F2",
      rapidpro_uuid: "1d3ea366-cfb9-4640-87e4-74e160ab7220",
      rapidpro_fields: { name: "Cynthia" },
    };

    // Simulate `httpsCallable('groupJoinProxy')` sending { data: ... }
    const { req, res } = createMockReqRes({ body: { data: body }, headers: { authorization: undefined } });
    await groupJoinProxy(req, res);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, calledOptions] = fetchMock.mock.calls[0];
    expect(calledOptions.headers.Authorization).toEqual(`Bearer ${TEST_TOKEN}`);
    expect(calledOptions.body).toEqual(JSON.stringify(body));
    expect(res.statusCode).toEqual(201);
    expect(res._getJSONData()).toEqual(upstreamJson);
  });

  it("relays upstream 204 responses", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      status: 204,
      headers: { get: () => null },
      json: async () => {
        throw new Error("should not parse json for 204");
      },
      text: async () => "",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = fetchMock;
    process.env.GROUP_JOIN_REMOTE_URL = TEST_PROXY_URL;

    const { req, res } = createMockReqRes({ method: "POST", body: { example: "data" }, headers: { authorization: undefined } });
    await groupJoinProxy(req, res);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toEqual(204);
  });

  it("handles CORS preflight with x-firebase-appcheck allowed", async () => {
    const { req, res } = createMockReqRes({
      method: "OPTIONS",
      headers: { "x-firebase-appcheck": "appcheck-test" },
    });

    // The proxy should answer preflight without forwarding.
    await groupJoinProxy(req, res);

    expect(res.statusCode).toEqual(204);

    // node-mocks-http stores header names in lower-case
    expect(res.getHeader("access-control-allow-headers")).toContain("x-firebase-appcheck");
  });
});
