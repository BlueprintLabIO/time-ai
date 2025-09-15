import { TimeAI, enhancePrompt, parseDate, addContext } from '../src';

// Basic usage examples
console.log('=== Basic TimeAI Usage ===\n');

// 1. Create a TimeAI instance
const timeAI = new TimeAI({
  timezone: 'America/New_York',
  locale: 'en-US',
  strategy: 'hybrid'
});

// 2. Enhance prompts with temporal context
console.log('1. Enhance prompts:');
const prompt = "Schedule a meeting next Friday and send reminder tomorrow";
const result = timeAI.enhancePrompt(prompt);

console.log('Original:', result.originalText);
console.log('Enhanced:', result.enhancedText);
console.log('Context:', result.context);
console.log('Extractions:', result.extractions.length);
console.log('Tokens added:', result.tokensAdded);
console.log();

// 3. Parse individual dates
console.log('2. Parse dates:');
const dateText = "Let's meet the day after tomorrow at 3pm";
const dateResult = timeAI.parseDate(dateText);

if (dateResult) {
  console.log('Original text:', dateResult.originalText);
  console.log('Resolved date:', dateResult.resolvedDate);
  console.log('Type:', dateResult.type);
  console.log('Confidence:', dateResult.confidence);
  console.log('Grain:', dateResult.grain);
}
console.log();

// 4. Different formatting strategies
console.log('3. Different strategies:');
const testPrompt = "Meet next Monday and call client end of week";

const preserved = timeAI.enhancePrompt(testPrompt, { strategy: 'preserve' });
console.log('Preserved:', preserved.enhancedText);

const normalized = timeAI.enhancePrompt(testPrompt, { strategy: 'normalize' });
console.log('Normalized:', normalized.enhancedText);

const hybrid = timeAI.enhancePrompt(testPrompt, { strategy: 'hybrid' });
console.log('Hybrid:', hybrid.enhancedText);
console.log();

// 5. Add context to any prompt
console.log('4. Add context:');
const contextPrompt = timeAI.addContext("What's the weather like today?");
console.log(contextPrompt);
console.log();

// 6. Date formatting examples
console.log('5. Date formatting:');
const testDate = new Date('2025-12-25T15:30:00Z');

console.log('Compact:', timeAI.formatDate(testDate, 'compact'));
console.log('Human:', timeAI.formatDate(testDate, 'human'));
console.log('Relative:', timeAI.formatDate(testDate, 'relative'));
console.log('ISO:', timeAI.formatDate(testDate, 'iso'));
console.log();

// 7. Convenience functions
console.log('6. Convenience functions:');
const quickEnhance = enhancePrompt("Deadline is next week");
console.log('Quick enhance:', quickEnhance.enhancedText);

const quickParse = parseDate("in 3 days");
console.log('Quick parse:', quickParse?.resolvedDate);

const quickContext = addContext("Hello world");
console.log('Quick context preview:', quickContext.split('\n')[0]);
console.log();

// 8. Utility methods
console.log('7. Utility methods:');
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);

console.log('Is today?', timeAI.isToday(new Date()));
console.log('Is tomorrow?', timeAI.isTomorrow(tomorrow));
console.log('Days until Christmas:', timeAI.getDaysDifference(new Date('2025-12-25')));

// Run this example:
// npx ts-node examples/basic-usage.ts