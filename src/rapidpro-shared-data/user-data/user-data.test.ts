import { rapidproUserData } from "./user-data";
import { HttpsError } from "firebase-functions/https";
import * as functions from "firebase-functions";

// Mock fetch globally
global.fetch = jest.fn();

// Mock logger
functions.logger.error = jest.fn();

// Helper to call the function
const invokeFn = async (data: Record<string, string>) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return rapidproUserData.run({ data } as any);
};

/**
 * Run directly (firebase emulators not required)
 * ```bash
 * npm exec jest user-data
 * ```
 */
describe("userData callable function", () => {
  const VALID_ENV = {
    RAPIDPRO_URL: "https://rapidpro.example.com",
    RAPIDPRO_API_TOKEN: "test-token",
  };

  const VALID_PARAMS = {
    rapidpro_uuid: "700c4bd4-c7e5-4414-9ff2-2b1ff2571947",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...VALID_ENV };
  });

  it("throws if env vars are invalid", async () => {
    process.env.RAPIDPRO_URL = "not-a-url";

    await expect(invokeFn(VALID_PARAMS)).rejects.toThrow(HttpsError);
    expect(functions.logger.error).toHaveBeenCalledWith("Env validation error:", expect.any(Object));
  });

  it("throws if params are invalid", async () => {
    await expect(invokeFn({ rapidpro_uuid: "not-a-uuid" })).rejects.toThrow(HttpsError);
    expect(functions.logger.error).toHaveBeenCalledWith("Param validation error:", expect.any(Object));
  });

  it("returns user data on success", async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          {
            uuid: VALID_PARAMS.rapidpro_uuid,
            name: "Test Contact",
          },
        ],
      }),
    });

    const result = await invokeFn(VALID_PARAMS);

    expect(fetch).toHaveBeenCalledWith(
      `${VALID_ENV.RAPIDPRO_URL}/api/v2/contacts.json?uuid=${VALID_PARAMS.rapidpro_uuid}`,
      {
        method: "GET",
        headers: {
          Authorization: `Token ${VALID_ENV.RAPIDPRO_API_TOKEN}`,
          "Content-Type": "application/json",
        },
      },
    );
    expect(result).toEqual({
      uuid: VALID_PARAMS.rapidpro_uuid,
      name: "Test Contact",
    });
  });

  it("throws if API returns no user", async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [] }),
    });

    await expect(invokeFn(VALID_PARAMS)).rejects.toThrow(HttpsError);
    expect(functions.logger.error).toHaveBeenCalled();
  });

  it("throws if API returns non-OK status", async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Server Error",
    });

    await expect(invokeFn(VALID_PARAMS)).rejects.toThrow(HttpsError);
    expect(functions.logger.error).toHaveBeenCalled();
  });
});
