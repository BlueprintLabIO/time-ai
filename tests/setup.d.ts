// TypeScript declarations for test setup

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidDate(): R;
      toBeWithinTimeRange(expected: Date | number, tolerance?: number): R;
    }
  }

  namespace NodeJS {
    interface Global {
      testUtils: {
        createMockDate: (dateString: string) => Date;
        restoreDate: () => void;
        runAtTime: (dateString: string, testFn: () => void) => void;
        generateTestDates: () => {
          today: Date;
          tomorrow: Date;
          nextWeek: Date;
          lastWeek: Date;
          nextMonth: Date;
          endOfYear: Date;
          startOfYear: Date;
        };
      };
    }
  }
}

export {};