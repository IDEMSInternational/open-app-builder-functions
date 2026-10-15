/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  setupFiles: ["<rootDir>/jest.env-setup.js"],
  // Run test files serially, as suites share (and clear) the same firestore emulator
  maxWorkers: 1,
};
