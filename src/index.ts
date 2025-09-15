// Main exports
export { TimeAI } from './core/time-ai';
export { TimeContextManager } from './core/time-context';
export { DateParser } from './core/date-parser';
export { DateFormatter } from './core/date-formatter';

// Type exports
export type {
  TimeContext,
  TimeAIConfig,
  DateExtraction,
  EnhancedPrompt,
  FormatStyle,
  FormatOptions,
  ParsingOptions
} from './types';

// Default export
export { TimeAI as default } from './core/time-ai';

// Convenience factory function
export function createTimeAI(config?: import('./types').TimeAIConfig) {
  const { TimeAI } = require('./core/time-ai');
  return new TimeAI(config);
}

// Legacy compatibility exports (for easy migration from your existing time.ts)
const { TimeAI: TimeAIClass } = require('./core/time-ai');
export const timeAI = new TimeAIClass();

export const getCurrentTimeContext = () => timeAI.getCurrentTimeContext();
export const formatDateForOpenAI = (date: Date) => timeAI.formatDateForOpenAI(date);
export const addDateContextToPrompt = (prompt: string) => timeAI.addDateContextToPrompt(prompt);

// Common use cases as convenience functions
export const enhancePrompt = (text: string, config?: import('./types').TimeAIConfig) => {
  const instance = config ? new TimeAIClass(config) : timeAI;
  return instance.enhancePrompt(text);
};

export const parseDate = (text: string, config?: import('./types').TimeAIConfig) => {
  const instance = config ? new TimeAIClass(config) : timeAI;
  return instance.parseDate(text);
};

export const addContext = (prompt: string, config?: import('./types').TimeAIConfig) => {
  const instance = config ? new TimeAIClass(config) : timeAI;
  return instance.addContext(prompt);
};