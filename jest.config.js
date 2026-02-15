/**
 * Jest configuration for Micro Tower Defense
 * Configured for ES modules support
 */

export default {
  // Use jsdom environment for browser API simulation
  testEnvironment: 'jest-environment-jsdom',

  // Transform settings for ES modules
  transform: {},

  // Module file extensions
  moduleFileExtensions: ['js', 'mjs', 'json'],

  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],

  // Module name mapper for imports
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },

  // Setup files to run before each test file
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js'
  ],

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true
};
