import { DateFormatter } from '../src/core/date-formatter';
import { TimeContextManager } from '../src/core/time-context';

describe('DateFormatter (additional)', () => {
  let formatter: DateFormatter;
  let contextManager: TimeContextManager;

  beforeEach(() => {
    contextManager = new TimeContextManager({ timezone: 'UTC', locale: 'en-US' });
    formatter = new DateFormatter(contextManager);
  });

  it('formatRelative should use weekday for exactly 7 days ahead (this/next)', () => {
    const date = new Date('2025-09-15T00:00:00Z');
    jest.spyOn(contextManager, 'isToday').mockReturnValue(false);
    jest.spyOn(contextManager, 'isTomorrow').mockReturnValue(false);
    jest.spyOn(contextManager, 'getDaysDifference').mockReturnValue(7);
    jest.spyOn(contextManager, 'formatDateInTimezone').mockReturnValue('Monday');

    const out = formatter.format(date, 'relative');
    expect(out.toLowerCase()).toContain('next');
    expect(out).toContain('Monday');
  });

  it('formatRelative should use weekday for exactly 14 days ahead (next)', () => {
    const date = new Date('2025-09-22T00:00:00Z');
    jest.spyOn(contextManager, 'isToday').mockReturnValue(false);
    jest.spyOn(contextManager, 'isTomorrow').mockReturnValue(false);
    jest.spyOn(contextManager, 'getDaysDifference').mockReturnValue(14);
    jest.spyOn(contextManager, 'formatDateInTimezone').mockReturnValue('Monday');

    const out = formatter.format(date, 'relative');
    expect(out).toBe('next Monday');
  });

  it('formatContext should not include timezone unless requested', () => {
    const date = new Date('2025-09-15T00:00:00Z');
    const resNoTz = formatter.format(date, 'context');
    expect(resNoTz).not.toContain('UTC');

    const resWithTz = formatter.format(date, 'context', { includeTimezone: true });
    expect(resWithTz).toContain('UTC');
  });
});

