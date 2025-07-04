import { logger } from "firebase-functions";
import { expect, jest, test } from "@jest/globals";
import firebaseFunctionsTest from "firebase-functions-test";
import { logstore } from "./shared-data-update";

const MOCK_FIRESTORE_STATE = {
  shared_data: {
    mock_group_id: {
      _created_at: new Date("2025-07-04"),
      _updated_at: new Date("2025-07-04"),
      admins: ["mock_user_id_1"],
      data: { label: "mock label" },
      id: "mock_group_id",
      members: ["mock_user_id_1", "mock_user_id_2"],
    },
  },
};

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
