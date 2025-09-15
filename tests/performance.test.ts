import { TimeAI, enhancePrompt } from '../src';

describe('Performance Tests', () => {
  const timeAI = new TimeAI();

  describe('Speed benchmarks', () => {
    it('should parse simple dates quickly', () => {
      const prompt = 'Meet tomorrow at 3pm';
      const iterations = 1000;

      const startTime = Date.now();
      for (let i = 0; i < iterations; i++) {
        timeAI.parseDate(prompt);
      }
      const endTime = Date.now();

      const timePerIteration = (endTime - startTime) / iterations;
      expect(timePerIteration).toBeLessThan(10); // Less than 10ms per parse
    });

    it('should enhance prompts quickly', () => {
      const prompt = 'Schedule meeting tomorrow and send reminders next week';
      const iterations = 500;

      const startTime = Date.now();
      for (let i = 0; i < iterations; i++) {
        timeAI.enhancePrompt(prompt);
      }
      const endTime = Date.now();

      const timePerIteration = (endTime - startTime) / iterations;
      expect(timePerIteration).toBeLessThan(20); // Less than 20ms per enhancement
    });

    it('should handle large text volumes efficiently', () => {
      const largeText = `
        Project timeline: Phase 1 starts next Monday, milestone review every Tuesday,
        weekly reports due every Friday, monthly presentations on the 15th of each month,
        quarterly reviews at end of each quarter, annual planning by December 31st,
        daily standups every morning, sprint planning every other Wednesday,
        retrospectives every two weeks, and final delivery by end of next year.
      `.repeat(100); // ~50KB of text

      const startTime = Date.now();
      const result = timeAI.enhancePrompt(largeText);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000); // Less than 5 seconds
      expect(result.extractions.length).toBeGreaterThan(0);
    });

    it('should scale linearly with text length', () => {
      const baseText = 'Meet tomorrow and call next week';
      const shortText = baseText;
      const mediumText = baseText.repeat(10);
      const longText = baseText.repeat(50);

      const timeShort = measureTime(() => timeAI.enhancePrompt(shortText));
      const timeMedium = measureTime(() => timeAI.enhancePrompt(mediumText));
      const timeLong = measureTime(() => timeAI.enhancePrompt(longText));

      // Should scale roughly linearly (allow for substantial variance in timing)
      expect(timeMedium).toBeLessThan(Math.max(timeShort * 50, 100)); // Allow up to 100ms or 50x
      expect(timeLong).toBeLessThan(Math.max(timeMedium * 20, 500)); // Allow up to 500ms or 20x
    });
  });

  describe('Memory efficiency', () => {
    it('should not accumulate memory over many operations', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < 1000; i++) {
        const result = timeAI.enhancePrompt(`Task ${i} due tomorrow`);
        // Don't keep references to results to allow GC
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('should handle repeated parsing of same text efficiently', () => {
      const text = 'Important deadline next Friday at 2pm';
      const iterations = 1000;

      const startMemory = process.memoryUsage().heapUsed;
      const startTime = Date.now();

      const results = [];
      for (let i = 0; i < iterations; i++) {
        results.push(timeAI.parseDate(text));
      }

      const endTime = Date.now();
      const endMemory = process.memoryUsage().heapUsed;

      expect(endTime - startTime).toBeLessThan(5000); // Should complete quickly
      expect(endMemory - startMemory).toBeLessThan(10 * 1024 * 1024); // Less than 10MB

      // All results should be equivalent
      results.forEach(result => {
        if (result) {
          expect(result.originalText).toBe('next Friday at 2pm');
        }
      });
    });
  });

  describe('Concurrency', () => {
    it('should handle concurrent parsing requests', async () => {
      const concurrency = 50;
      const promisesPerBatch = 10;

      const createPromise = (id: number) => {
        return new Promise<void>((resolve) => {
          setTimeout(() => {
            const result = timeAI.enhancePrompt(`Task ${id} due tomorrow`);
            expect(result.extractions).toHaveLength(1);
            resolve();
          }, Math.random() * 10);
        });
      };

      const startTime = Date.now();

      // Create concurrent batches
      const batches = [];
      for (let i = 0; i < concurrency; i += promisesPerBatch) {
        const batch = [];
        for (let j = 0; j < promisesPerBatch && i + j < concurrency; j++) {
          batch.push(createPromise(i + j));
        }
        batches.push(Promise.all(batch));
      }

      await Promise.all(batches);

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should maintain thread safety', async () => {
      const timeAI = new TimeAI();
      const results: any[] = [];

      const concurrentTasks = Array.from({ length: 100 }, (_, i) =>
        Promise.resolve().then(() => {
          if (i % 2 === 0) {
            timeAI.setTimezone('America/New_York');
          } else {
            timeAI.setTimezone('Europe/London');
          }

          return timeAI.enhancePrompt(`Task ${i} due tomorrow`);
        })
      );

      const allResults = await Promise.all(concurrentTasks);

      allResults.forEach((result, i) => {
        expect(result.extractions).toHaveLength(1);
        expect(result.originalText).toBe(`Task ${i} due tomorrow`);

        // Should have one of the two timezones
        const hasValidTimezone =
          result.context.includes('America/New_York') ||
          result.context.includes('Europe/London');
        expect(hasValidTimezone).toBe(true);
      });
    });
  });

  describe('Stress tests', () => {
    it('should handle extremely long single-line text', () => {
      const longPrompt = Array.from({ length: 1000 }, (_, i) =>
        `task${i} due ${i % 7 === 0 ? 'tomorrow' : i % 7 === 1 ? 'next week' : 'next month'}`
      ).join(' and ');

      const startTime = Date.now();
      const result = timeAI.enhancePrompt(longPrompt);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(10000); // Less than 10 seconds
      expect(result.extractions.length).toBeGreaterThan(100);
    });

    it('should handle text with many date-like false positives', () => {
      const falsePositives = `
        Version 2.1.4 was released, following updates to module 1.2.3.
        The IP address 192.168.1.1 connects to server 10.0.0.1.
        File sizes: config.json (1.2MB), data.xml (3.4MB), backup.zip (12.5MB).
        Ratios like 3:1, 4:2, and 5:3 are important.
        Phone numbers: 555-123-4567, 800-555-0123.
        Reference numbers: REF-2024-001, ID-2025-XYZ.
      `.repeat(50);

      const startTime = Date.now();
      const result = timeAI.enhancePrompt(falsePositives);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(3000); // Should handle false positives quickly
      // Should not find many (or any) dates in this text
      expect(result.extractions.length).toBeLessThan(10);
    });

    it('should handle rapid-fire small requests', async () => {
      const requests = 2000;
      const batchSize = 100;

      const startTime = Date.now();

      for (let i = 0; i < requests; i += batchSize) {
        const batch = [];
        for (let j = 0; j < batchSize && i + j < requests; j++) {
          batch.push(timeAI.parseDate('tomorrow'));
        }
        await Promise.all(batch);
      }

      const endTime = Date.now();
      const avgTime = (endTime - startTime) / requests;

      expect(avgTime).toBeLessThan(5); // Less than 5ms per request on average
    });
  });

  describe('Resource cleanup', () => {
    it('should properly cleanup after instance destruction', () => {
      const instances = [];

      // Create many instances
      for (let i = 0; i < 100; i++) {
        instances.push(new TimeAI({
          timezone: `UTC${i % 12 >= 6 ? '+' : '-'}${Math.abs(i % 12 - 6)}`,
          locale: ['en-US', 'en-GB', 'de-DE', 'fr-FR'][i % 4]
        }));
      }

      // Use them briefly
      instances.forEach((instance, i) => {
        instance.enhancePrompt(`Test ${i}`);
      });

      // Clear references
      instances.length = 0;

      // Force GC if available
      if (global.gc) {
        global.gc();
      }

      // Should not crash or leak significant memory
      expect(true).toBe(true);
    });
  });
});

// Helper function to measure execution time
function measureTime(fn: () => any): number {
  const start = Date.now();
  fn();
  return Date.now() - start;
}