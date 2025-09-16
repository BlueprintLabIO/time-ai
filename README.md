# time-ai

> Time-aware utilities for LLM applications - parse dates, add temporal context, and optimize prompts

[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)
![Coverage](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/BlueprintLabIO/time-ai/main/badges/coverage.json)

## Links

- Project site: https://time-ai.blueprintlab.io
- NPM package: https://www.npmjs.com/package/@blueprintlabio/time-ai

## Features

- **Natural Language Date Parsing** - Parse dates from text like "next Friday", "end of month", "tomorrow at 3pm"
- **LLM Context Enhancement** - Add temporal context to prompts for better AI understanding
- **Multiple Formatting Strategies** - Preserve, normalize, or hybrid date formatting
- **Timezone Aware** - Handle dates across different timezones
- **Locale Support** - Format dates according to different locales
- **TypeScript First** - Full type safety and IntelliSense support

## Installation

```bash
npm install @blueprintlabio/time-ai
```

## Quick Start

```typescript
import { TimeAI } from '@blueprintlabio/time-ai';

const timeAI = new TimeAI({
  timezone: 'America/New_York',
  locale: 'en-US'
});

// Enhance prompts with temporal context
const result = timeAI.enhancePrompt("Schedule a meeting next Friday at 2pm");
console.log(result.enhancedText);
// "Schedule a meeting next Friday (2025-09-19) at 2pm"

// Add current date context to any prompt
const prompt = timeAI.addContext("What's the weather like?");
console.log(prompt);
// Current date: 2025-09-15 (Sunday, 2025)
// Timezone: America/New_York
// 
// What's the weather like?

// Parse dates from natural language
const date = timeAI.parseDate("tomorrow at 3pm");
console.log(date?.resolvedDate);
// Date object for tomorrow at 3pm
```

## API Reference

### TimeAI Class

#### Constructor

```typescript
new TimeAI(config?: TimeAIConfig)
```

**Config Options:**
- `timezone?: string` - Target timezone (default: system timezone)
- `locale?: string` - Locale for formatting (default: system locale)
- `strategy?: 'preserve' | 'normalize' | 'hybrid'` - Date formatting strategy (default: 'hybrid')
- `includeContext?: boolean` - Whether to include temporal context (default: true)

#### Methods

##### `enhancePrompt(text: string, options?: { strategy?: 'preserve' | 'normalize' | 'hybrid' }): EnhancedPrompt`

Enhance text with temporal context and date disambiguation.

```typescript
const result = timeAI.enhancePrompt("Meet next Friday", { strategy: 'hybrid' });
// Returns: {
//   originalText: "Meet next Friday",
//   enhancedText: "Meet next Friday (2025-09-19)", 
//   context: "Current date: 2025-09-15...",
//   extractions: [...],
//   tokensAdded: 12
// }
```

**Strategies:**
- `preserve` - Keep original date text unchanged
- `normalize` - Replace with absolute dates (YYYY-MM-DD)
- `hybrid` - Combine relative and absolute: "next Friday (2025-09-19)"

##### `parseDate(text: string): DateExtraction | null`

Parse the first date found in text.

```typescript
const extraction = timeAI.parseDate("tomorrow at 3pm");
// Returns: {
//   originalText: "tomorrow at 3pm",
//   resolvedDate: Date,
//   confidence: 0.95,
//   type: 'relative',
//   start: 0,
//   end: 16,
//   grain: 'hour'
// }
```

##### `parseDates(text: string): DateExtraction[]`

Parse all dates found in text.

##### `formatDate(date: Date, style: FormatStyle): string`

Format dates for different use cases.

**Format Styles:**
- `context` - "Today is Monday, September 15, 2025"
- `hybrid` - "next Friday (Sep 19)"
- `compact` - "2025-09-15"
- `human` - "Monday, September 15, 2025"
- `iso` - "2025-09-15T00:00:00.000Z"
- `relative` - "in 3 days"

##### `addContext(prompt: string): string`

Add temporal context to any prompt.

```typescript
timeAI.addContext("What should I do today?");
// "Current date: 2025-09-15 (Sunday, 2025)\nTimezone: America/New_York\n\nWhat should I do today?"
```

### Convenience Functions

```typescript
import { enhancePrompt, parseDate, addContext } from '@blueprintlabio/time-ai';

// Use default instance
const result = enhancePrompt("Meet tomorrow");
const date = parseDate("next week");
const prompt = addContext("Hello world");

// Or with custom config
const result = enhancePrompt("Meet tomorrow", { timezone: 'UTC' });
```

### Legacy Compatibility

For easy migration from existing time utilities:

```typescript
import { getCurrentTimeContext, formatDateForOpenAI, addDateContextToPrompt } from '@blueprintlabio/time-ai';

// Drop-in replacements for your existing functions
const context = getCurrentTimeContext();
const formatted = formatDateForOpenAI(new Date());
const enhanced = addDateContextToPrompt("Your prompt here");
```

## Use Cases

### LLM Prompt Enhancement

```typescript
const timeAI = new TimeAI({ strategy: 'hybrid' });

// Before
const prompt = "Schedule a demo call next Tuesday and send reminder tomorrow";

// After
const enhanced = timeAI.enhancePrompt(prompt);
console.log(enhanced.enhancedText);
// "Schedule a demo call next Tuesday (2025-09-23) and send reminder tomorrow (2025-09-16)"
```

### Task Scheduling

```typescript
const timeAI = new TimeAI({ strategy: 'normalize' });

const userInput = "Remind me to call client next Friday";
const result = timeAI.enhancePrompt(userInput);

// Extract absolute date for scheduling
const dateExtraction = result.extractions[0];
const scheduleDate = dateExtraction.resolvedDate; // Exact Date object
```

### Multi-timezone Applications

```typescript
// User in New York
const nyTimeAI = new TimeAI({ timezone: 'America/New_York' });

// User in London  
const londonTimeAI = new TimeAI({ timezone: 'Europe/London' });

// Same relative date, different absolute times
const prompt = "Meet tomorrow at 9am";
const nyResult = nyTimeAI.enhancePrompt(prompt);
const londonResult = londonTimeAI.enhancePrompt(prompt);
```

### Chatbot Context

```typescript
const timeAI = new TimeAI();

function processMessage(userMessage: string) {
  // Add temporal awareness to every conversation
  const enhanced = timeAI.addContext(userMessage);
  
  // Send to LLM with temporal context
  return callLLM(enhanced);
}
```

## Advanced Usage

### Custom Date Patterns

The library uses [chrono-node](https://github.com/wanasit/chrono) internally and includes custom parsers for business contexts:

- "next business day" 
- "end of this week" (Friday)
- "end of quarter"
- "next workday"

### Timezone Handling

```typescript
const timeAI = new TimeAI({ timezone: 'UTC' });

// Change timezone dynamically
timeAI.setTimezone('Asia/Tokyo');
timeAI.setLocale('ja-JP');

// Check timezone-aware comparisons
const isTodayInTokyo = timeAI.isToday(someDate);
```

### Performance Considerations

The library provides token count estimation for LLM optimization:

```typescript
const result = timeAI.enhancePrompt("Long prompt with many dates...");
console.log(`Added ${result.tokensAdded} tokens`);

// Use compact context for token-sensitive applications
const timeAI = new TimeAI({ includeContext: false });
```

## Test Coverage

<!-- COVERAGE-START -->
Coverage from latest test run:

- Statements: 91.83%
- Branches: 82.53%
- Functions: 88.88%
- Lines: 92.50%
<!-- COVERAGE-END -->

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT © [Blueprint Lab](https://github.com/BlueprintLabIO)

## Related Projects

- [chrono-node](https://github.com/wanasit/chrono) - Natural language date parser
- [date-fns](https://date-fns.org/) - Modern JavaScript date utility library
- [dayjs](https://day.js.org/) - Lightweight date library
