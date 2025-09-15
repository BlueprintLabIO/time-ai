export interface TimeContext {
  now: Date;
  timezone: string;
  locale?: string;
}

export interface TimeAIConfig {
  timezone?: string;
  locale?: string;
  strategy?: 'preserve' | 'normalize' | 'hybrid';
  includeContext?: boolean;
}

export interface DateExtraction {
  originalText: string;
  resolvedDate: Date;
  confidence: number;
  type: 'absolute' | 'relative';
  start: number;
  end: number;
  grain?: 'day' | 'hour' | 'minute' | 'second';
}

export interface EnhancedPrompt {
  originalText: string;
  enhancedText: string;
  context: string;
  extractions: DateExtraction[];
  tokensAdded: number;
}

export type FormatStyle = 
  | 'context'      // "Today is Monday, September 15, 2025"
  | 'hybrid'       // "next Friday (Sep 19)" 
  | 'compact'      // "2025-09-15"
  | 'human'        // "Monday, September 15, 2025"
  | 'iso'          // "2025-09-15T00:00:00.000Z"
  | 'relative';    // "in 3 days"

export interface FormatOptions {
  includeWeekday?: boolean;
  includeTimezone?: boolean;
  includeTime?: boolean;
  relative?: boolean;
  compact?: boolean;
}

export interface ParsingOptions {
  timezone?: string;
  locale?: string;
  referenceDate?: Date;
  strict?: boolean;
}