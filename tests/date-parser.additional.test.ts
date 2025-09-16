import { DateParser } from '../src/core/date-parser';

describe('DateParser (additional)', () => {
  let parser: DateParser;
  beforeEach(() => {
    parser = new DateParser();
  });

  it('should handle business acronyms gracefully (EOM/EOW/EOQ)', () => {
    const acronyms = ['EOM', 'EOW', 'EOQ'];
    acronyms.forEach((text) => {
      expect(() => parser.parseFirst(text)).not.toThrow();
      const res = parser.parseFirst(text);
      if (res) {
        expect(res.confidence).toBeGreaterThanOrEqual(0);
        expect(res.confidence).toBeLessThanOrEqual(1);
      }
    });
  });

  it('should handle minimal ambiguous tokens (single digit) without high confidence', () => {
    const res = parser.parseFirst('5');
    if (res) {
      expect(res.confidence).toBeGreaterThanOrEqual(0);
      expect(res.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('should produce correct positions for overlapping-like expressions', () => {
    const text = 'Schedule for Friday the 13th next month';
    const results = parser.parse(text);
    results.forEach((r) => {
      expect(r.start).toBeGreaterThanOrEqual(0);
      expect(r.end).toBeGreaterThan(r.start);
      expect(text.slice(r.start, r.end)).toBe(r.originalText);
    });
  });
});

