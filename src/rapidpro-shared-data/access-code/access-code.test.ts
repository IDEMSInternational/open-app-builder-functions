import * as functions from "firebase-functions";
import * as crypto from "crypto";
import { HttpsError } from "firebase-functions/https";
import { clearFirestore, getFirestoreEmulator, seedFirestore } from "../../../test/firestoreTestUtils";
import { ACCESS_CODE_CHARACTERS, ACCESS_CODE_MAX_ATTEMPTS, generateAccessCode } from "./access-code";

process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";

// Wrap crypto.randomInt so it can be overridden in tests (module namespace properties cannot be spied on directly)
jest.mock("crypto", () => {
  const actual = jest.requireActual("crypto");
  return { ...actual, randomInt: jest.fn(actual.randomInt) };
});

// Mock logger
functions.logger.error = jest.fn();

const OWNER_ID = "owner_user_id";

// Helper to call the function
const invokeFn = async (data: Record<string, unknown>, uid: string | null = OWNER_ID) => {
  const auth = uid ? { uid, token: {} } : undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return generateAccessCode.run({ data, auth } as any);
};

/** Mock random index generation so that every generated character is `ACCESS_CODE_CHARACTERS[index]` */
const mockRandomIndex = (index: number) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (crypto.randomInt as jest.Mock).mockImplementation((() => index) as any);

const MOCK_FIRESTORE_STATE = {
  shared_data: {
    mock_group_id: {
      _created_by: OWNER_ID,
      _updated_at: "2020-01-01T00:00:00.000Z",
      admins: [OWNER_ID, "admin_user_id"],
      members: [OWNER_ID, "admin_user_id", "member_user_id"],
      data: { type: "parent_group", parentGroupData: { parents: [] } },
    },
    other_group_id: {
      _created_by: "other_user_id",
      admins: ["other_user_id"],
      members: ["other_user_id"],
      data: { type: "parent_group", parentGroupData: { parents: [] } },
      access_code: "AAAA",
    },
  },
};

/**
 * Run directly (execute jest tests within emulator)
 * ```bash
 * npm run emulators:exec "jest access-code"
 * ```
 */
describe("generateAccessCode callable function", () => {
  beforeEach(async () => {
    await clearFirestore();
    await seedFirestore(MOCK_FIRESTORE_STATE);
  });

  afterEach(() => {
    jest.clearAllMocks();
    (crypto.randomInt as jest.Mock).mockReset().mockImplementation(jest.requireActual("crypto").randomInt);
  });

  it("throws if user is not authenticated", async () => {
    await expect(invokeFn({ shared_id: "mock_group_id" }, null)).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("throws if params are invalid", async () => {
    await expect(invokeFn({ foo: "bar" })).rejects.toThrow(HttpsError);
    await expect(invokeFn({ foo: "bar" })).rejects.toMatchObject({ code: "invalid-argument" });
    expect(functions.logger.error).toHaveBeenCalledWith("Param validation error:", expect.any(Object));
  });

  it("throws if group does not exist", async () => {
    await expect(invokeFn({ shared_id: "missing_group_id" })).rejects.toMatchObject({ code: "not-found" });
  });

  it("throws if user is not the group owner", async () => {
    for (const uid of ["admin_user_id", "member_user_id", "other_user_id"]) {
      await expect(invokeFn({ shared_id: "mock_group_id" }, uid)).rejects.toMatchObject({
        code: "permission-denied",
      });
    }
    const snapshot = await getFirestoreEmulator().doc("shared_data/mock_group_id").get();
    expect(snapshot.get("access_code")).toBeUndefined();
  });

  it("generates and saves an access code", async () => {
    const { access_code } = await invokeFn({ shared_id: "mock_group_id" });
    expect(access_code).toMatch(new RegExp(`^[${ACCESS_CODE_CHARACTERS}]{4}$`));
    const snapshot = await getFirestoreEmulator().doc("shared_data/mock_group_id").get();
    expect(snapshot.get("access_code")).toEqual(access_code);
    expect(snapshot.get("_updated_at")).not.toEqual("2020-01-01T00:00:00.000Z");
  });

  it("retries if generated code is already in use", async () => {
    // First 4 characters generate "AAAA" (in use by other group), subsequent generate "BBBB"
    const spy = mockRandomIndex(1);
    for (let i = 0; i < 4; i++) {
      spy.mockImplementationOnce((() => 0) as never);
    }
    const { access_code } = await invokeFn({ shared_id: "mock_group_id" });
    expect(access_code).toEqual("BBBB");
    const snapshot = await getFirestoreEmulator().doc("shared_data/mock_group_id").get();
    expect(snapshot.get("access_code")).toEqual("BBBB");
  });

  it("throws if unique code cannot be generated", async () => {
    // Always generate "AAAA" (in use by other group)
    const spy = mockRandomIndex(0);
    await expect(invokeFn({ shared_id: "mock_group_id" })).rejects.toMatchObject({
      code: "resource-exhausted",
    });
    expect(spy).toHaveBeenCalledTimes(ACCESS_CODE_MAX_ATTEMPTS * 4);
    const snapshot = await getFirestoreEmulator().doc("shared_data/mock_group_id").get();
    expect(snapshot.get("access_code")).toBeUndefined();
  });
});
