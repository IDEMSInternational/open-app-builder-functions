
import functionsTest from "firebase-functions-test";
import * as admin from "firebase-admin";
import { exampleHttpFunction } from "./example-http-function";

// Initialize the test environment
const test = functionsTest();

// Mock the Firebase Admin SDK
jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  apps: [],
}));

describe("exampleHttpFunction", () => {
  afterEach(() => {
    test.cleanup();
  });

  it("should return 405 if method is not POST", () => {
    const req = { method: "GET" };
    const res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    exampleHttpFunction(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.send).toHaveBeenCalledWith("Method Not Allowed");
  });

  it("should return 200 and a success message for a valid POST request", () => {
    const req = {
      method: "POST",
      body: { message: "Hello from test!" },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    exampleHttpFunction(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Request received successfully!",
      receivedData: { message: "Hello from test!" },
    });
  });

  it('should handle POST request with no message', () => {
    const req = { method: 'POST', body: {} };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    exampleHttpFunction(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Request received successfully!',
      receivedData: {},
    });
  });
});
