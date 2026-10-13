/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  collectCoverageFrom: ['src/**/*.ts', '!src/index.ts'],
  coverageReporters: ['text-summary', 'text', 'html'],
  // Seuils anti-régression (niveau atteint au 12/10/2026)
  coverageThreshold: { global: { lines: 94, statements: 91, functions: 96, branches: 73 } },
};
