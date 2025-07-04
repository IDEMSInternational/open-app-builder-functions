import { logger } from "firebase-functions";
import { expect, jest, test } from "@jest/globals";
import firebaseFunctionsTest from "firebase-functions-test";
import { logstore } from "./shared-data-update";

const { wrap } = firebaseFunctionsTest();

test("logstore", () => {
  const mockLog = jest.spyOn(logger, "log");
  const wrappedLogStore = wrap(logstore);

  /**
   * Invoke the function once using default {@link CloudEvent}.
   */
  wrappedLogStore();
  expect(mockLog).toHaveBeenCalledTimes(1);

  /**
   * Invoke the function once using {@link Partial<CloudEvent>}.
   */
  const cloudEventPartial = { data: { bucket: "my-other-bucket" } };
  wrappedLogStore(cloudEventPartial);
  expect(mockLog).toHaveBeenCalledTimes(2);
});
