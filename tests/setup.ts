// Test setup file
// This file runs before all tests

// Set up global test environment
process.env.NODE_ENV = 'test';

// Set up consistent timezone for testing
process.env.TZ = 'America/New_York';

// Mock console.warn to avoid noise during tests
const originalWarn = console.warn;
console.warn = (...args: any[]) => {
  // Only show warnings that are not from our testing
  if (!args.some(arg => typeof arg === 'string' && arg.includes('TimeAI'))) {
    originalWarn(...args);
  }
};

// Add custom matchers for better test assertions
expect.extend({
  toBeValidDate(received) {
    const pass = received instanceof Date && !isNaN(received.getTime());
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid Date`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid Date`,
        pass: false,
      };
    }
  },

  toBeWithinTimeRange(received, expected, tolerance = 1000) {
    const receivedTime = received instanceof Date ? received.getTime() : received;
    const expectedTime = expected instanceof Date ? expected.getTime() : expected;
    const diff = Math.abs(receivedTime - expectedTime);

    const pass = diff <= tolerance;
    if (pass) {
      return {
        message: () => `expected ${receivedTime} not to be within ${tolerance}ms of ${expectedTime}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${receivedTime} to be within ${tolerance}ms of ${expectedTime}, but was ${diff}ms away`,
        pass: false,
      };
    }
  }
});

// Export to make this file a module
export {};

// Global test utilities
(global as any).testUtils = {
  // Create a mock date for consistent testing
  createMockDate: (dateString: string) => {
    const mockDate = new Date(dateString);
    jest.spyOn(global, 'Date').mockImplementation(((...args: any[]) => {
      if (args.length === 0) {
        return mockDate;
      }
      return new (Date as any)(...args);
    }) as any);
    return mockDate;
  },

  // Restore real Date
  restoreDate: () => {
    jest.restoreAllMocks();
  },

  // Helper to run tests at specific times
  runAtTime: (dateString: string, testFn: () => void) => {
    const mockDate = (global as any).testUtils.createMockDate(dateString);
    try {
      testFn();
    } finally {
      (global as any).testUtils.restoreDate();
    }
  },

  // Helper to generate test dates
  generateTestDates: () => ({
    today: new Date(),
    tomorrow: (() => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return d;
    })(),
    nextWeek: (() => {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      return d;
    })(),
    lastWeek: (() => {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return d;
    })(),
    nextMonth: (() => {
      const d = new Date();
      d.setMonth(d.getMonth() + 1);
      return d;
    })(),
    endOfYear: new Date(new Date().getFullYear(), 11, 31),
    startOfYear: new Date(new Date().getFullYear(), 0, 1),
  })
};

// Global cleanup after each test
afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});