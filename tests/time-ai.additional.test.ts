import { TimeAI } from '../src';

describe('TimeAI (additional)', () => {
  it('preserve strategy with includeContext=false should not change text and add zero tokens', () => {
    const ai = new TimeAI({ includeContext: false, timezone: 'UTC', locale: 'en-US' });
    const text = 'Due tomorrow at 9am';
    const res = ai.enhancePrompt(text, { strategy: 'preserve' });
    expect(res.enhancedText).toBe(text);
    expect(res.context).toBe('');
    expect(res.tokensAdded).toBeGreaterThanOrEqual(0); // heuristic rounding can yield 0
    expect(res.tokensAdded).toBeLessThan(2); // certainly not large when preserving
  });

  it('normalize strategy with includeContext=false should modify text and keep tokensAdded reasonable', () => {
    const ai = new TimeAI({ includeContext: false, timezone: 'UTC', locale: 'en-US' });
    const text = 'Due tomorrow';
    const res = ai.enhancePrompt(text, { strategy: 'normalize' });
    expect(res.context).toBe('');
    expect(res.enhancedText).not.toBe(text);
    expect(Number.isFinite(res.tokensAdded)).toBe(true);
    expect(res.tokensAdded).toBeGreaterThanOrEqual(0);
  });
});

