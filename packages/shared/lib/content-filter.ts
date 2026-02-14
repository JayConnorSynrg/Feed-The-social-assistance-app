/**
 * Content Filter Library for FEED Federation
 * Zero dependencies - runs in both Node.js and browser
 */

// ============================================================================
// Types
// ============================================================================

export type ContentFlagType =
  | 'profanity'
  | 'scam_phone'
  | 'malicious_url'
  | 'spam'
  | 'suspicious';

export interface ContentFlag {
  type: ContentFlagType;
  field: string;
  value: string;
  reason: string;
}

export interface ContentFilterResult {
  passed: boolean;
  flags: ContentFlag[];
  sanitizedText?: string;
  score: number; // 0-1, where 1 is clean
}

export interface ContentFilterConfig {
  profanity: {
    enabled: boolean;
    threshold: number; // Max profanity words before flagging (0 = strict)
  };
  scamPhones: {
    enabled: boolean;
  };
  maliciousUrls: {
    enabled: boolean;
  };
  spam: {
    enabled: boolean;
    capsThreshold: number; // % of caps before flagging (0.5 = 50%)
    repeatedCharThreshold: number; // Max repeated chars (3 = "!!!")
    spamPhraseThreshold: number; // Max spam phrases
  };
  minimumScore: number; // 0-1, minimum score to pass (0.7 = 70% clean)
}

// ============================================================================
// Configuration
// ============================================================================

export function createDefaultContentFilterConfig(): ContentFilterConfig {
  return {
    profanity: {
      enabled: true,
      threshold: 0, // Zero tolerance
    },
    scamPhones: {
      enabled: true,
    },
    maliciousUrls: {
      enabled: true,
    },
    spam: {
      enabled: true,
      capsThreshold: 0.6, // 60% caps triggers flag
      repeatedCharThreshold: 4, // "!!!!" triggers
      spamPhraseThreshold: 2, // 2+ spam phrases
    },
    minimumScore: 0.7, // 70% clean to pass
  };
}

// ============================================================================
// Profanity Filter
// ============================================================================

const PROFANITY_WORDS = new Set([
  // Common profanity (sanitized list)
  'fuck', 'shit', 'damn', 'bitch', 'bastard', 'ass', 'asshole',
  'cunt', 'dick', 'cock', 'pussy', 'whore', 'slut', 'piss',
  'bullshit', 'crap', 'hell', 'fag', 'faggot', 'nigger', 'nigga',
  'retard', 'retarded', 'rape', 'rapist', 'nazi', 'hitler',

  // L33t speak variations (common obfuscations)
  'fuk', 'f4ck', 'fvck', 'phuck', 'fuq', 'sh1t', 'shyt',
  'b1tch', 'biatch', 'a55', 'azz', 'd1ck', 'dik', 'c0ck',
  'cok', 'pusssy', 'wh0re', 'h0e', 'slutt', 'p1ss',
]);

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special chars
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

function detectL33tSpeak(word: string): string {
  // Convert common l33t substitutions
  return word
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/\$/g, 's')
    .replace(/@/g, 'a');
}

export function filterProfanity(text: string, config = createDefaultContentFilterConfig()): ContentFlag[] {
  if (!config.profanity.enabled) return [];

  const flags: ContentFlag[] = [];
  const normalized = normalizeText(text);
  const words = normalized.split(/\s+/);

  for (const word of words) {
    // Check direct match
    if (PROFANITY_WORDS.has(word)) {
      flags.push({
        type: 'profanity',
        field: 'text',
        value: word,
        reason: `Contains profanity: "${word}"`,
      });
      continue;
    }

    // Check l33t speak variation
    const decoded = detectL33tSpeak(word);
    if (decoded !== word && PROFANITY_WORDS.has(decoded)) {
      flags.push({
        type: 'profanity',
        field: 'text',
        value: word,
        reason: `Contains obfuscated profanity: "${word}" (detected as "${decoded}")`,
      });
    }

    // Check if profanity is embedded in word (e.g., "shitty", "fucked")
    for (const profanity of PROFANITY_WORDS) {
      if (word.includes(profanity) && word !== profanity) {
        flags.push({
          type: 'profanity',
          field: 'text',
          value: word,
          reason: `Contains embedded profanity: "${word}" (contains "${profanity}")`,
        });
        break;
      }
    }
  }

  return flags.length > config.profanity.threshold ? flags : [];
}

// ============================================================================
// Scam Phone Filter
// ============================================================================

const SCAM_PHONE_PATTERNS = [
  /^1?900\d{7}$/, // 900 premium numbers
  /^1?976\d{7}$/, // 976 premium numbers
  /^\d{5}$/, // Short codes (can be legitimate, but flagged as suspicious)
  /^(\d)\1{9,}$/, // All same digit (e.g., 1111111111)
];

const KNOWN_SCAM_PREFIXES = new Set([
  '900', // Premium
  '976', // Premium
  '809', // International premium (Caribbean)
  '284', // British Virgin Islands (often scams)
  '649', // Turks and Caicos (often scams)
  '876', // Jamaica (high scam rate)
]);

function normalizePhone(phone: string): string {
  // Strip all non-numeric characters
  return phone.replace(/\D/g, '');
}

export function filterScamPhones(phone: string, config = createDefaultContentFilterConfig()): ContentFlag[] {
  if (!config.scamPhones.enabled) return [];
  if (!phone) return [];

  const flags: ContentFlag[] = [];
  const normalized = normalizePhone(phone);

  // Check against patterns
  for (const pattern of SCAM_PHONE_PATTERNS) {
    if (pattern.test(normalized)) {
      flags.push({
        type: 'scam_phone',
        field: 'phone',
        value: phone,
        reason: `Phone matches scam pattern: ${pattern.source}`,
      });
      break;
    }
  }

  // Check known scam prefixes
  for (const prefix of KNOWN_SCAM_PREFIXES) {
    if (normalized.startsWith(prefix) || normalized.startsWith('1' + prefix)) {
      flags.push({
        type: 'scam_phone',
        field: 'phone',
        value: phone,
        reason: `Phone uses known scam prefix: ${prefix}`,
      });
      break;
    }
  }

  // Check if phone is suspiciously short or long
  if (normalized.length < 10 && normalized.length !== 5) {
    flags.push({
      type: 'suspicious',
      field: 'phone',
      value: phone,
      reason: 'Phone number is unusually short',
    });
  } else if (normalized.length > 15) {
    flags.push({
      type: 'suspicious',
      field: 'phone',
      value: phone,
      reason: 'Phone number is unusually long',
    });
  }

  return flags;
}

// ============================================================================
// Malicious URL Filter
// ============================================================================

const SUSPICIOUS_TLD_PATTERNS = new Set([
  '.tk', '.ml', '.ga', '.cf', '.gq', // Free TLDs (high abuse)
  '.zip', '.mov', // New TLDs often used for phishing
  '.xyz', // High abuse rate
]);

const URL_BLACKLIST_PATTERNS = [
  /^javascript:/i,
  /^data:/i,
  /^file:/i,
  /^vbscript:/i,
];

function isIPAddress(host: string): boolean {
  // IPv4 pattern
  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
  // IPv6 pattern (simplified)
  const ipv6 = /^([0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}$/i;

  return ipv4.test(host) || ipv6.test(host);
}

export function filterMaliciousUrls(url: string, config = createDefaultContentFilterConfig()): ContentFlag[] {
  if (!config.maliciousUrls.enabled) return [];
  if (!url) return [];

  const flags: ContentFlag[] = [];
  const urlLower = url.toLowerCase().trim();

  // Check for blacklisted protocols
  for (const pattern of URL_BLACKLIST_PATTERNS) {
    if (pattern.test(urlLower)) {
      flags.push({
        type: 'malicious_url',
        field: 'url',
        value: url,
        reason: `URL uses blacklisted protocol: ${pattern.source}`,
      });
      return flags;
    }
  }

  // Parse URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    flags.push({
      type: 'malicious_url',
      field: 'url',
      value: url,
      reason: 'Invalid URL format',
    });
    return flags;
  }

  // Check for IP address (suspicious for resources)
  if (isIPAddress(parsedUrl.hostname)) {
    flags.push({
      type: 'suspicious',
      field: 'url',
      value: url,
      reason: 'URL uses IP address instead of domain name',
    });
  }

  // Check for suspicious TLDs
  for (const tld of SUSPICIOUS_TLD_PATTERNS) {
    if (parsedUrl.hostname.endsWith(tld)) {
      flags.push({
        type: 'suspicious',
        field: 'url',
        value: url,
        reason: `URL uses suspicious TLD: ${tld}`,
      });
      break;
    }
  }

  // Check for extremely long URLs (often phishing)
  if (url.length > 500) {
    flags.push({
      type: 'suspicious',
      field: 'url',
      value: url,
      reason: `URL is suspiciously long (${url.length} chars)`,
    });
  }

  // Check for excessive subdomains (e.g., paypal.secure.login.verify.com)
  const subdomains = parsedUrl.hostname.split('.');
  if (subdomains.length > 4) {
    flags.push({
      type: 'suspicious',
      field: 'url',
      value: url,
      reason: `URL has excessive subdomains (${subdomains.length})`,
    });
  }

  // Check for @ symbol in URL (username in URL, often phishing)
  if (url.includes('@')) {
    flags.push({
      type: 'malicious_url',
      field: 'url',
      value: url,
      reason: 'URL contains @ symbol (potential phishing)',
    });
  }

  return flags;
}

// ============================================================================
// Spam Filter
// ============================================================================

const SPAM_PHRASES = new Set([
  'click here',
  'click now',
  'free money',
  'make money fast',
  'work from home',
  'lose weight fast',
  'buy now',
  'limited time',
  'act now',
  'order now',
  'special promotion',
  'winner',
  'congratulations',
  'you won',
  'claim prize',
  'earn cash',
  'easy money',
  'no credit check',
  'viagra',
  'cialis',
  'weight loss',
  'miracle cure',
]);

function calculateCapsRatio(text: string): number {
  const letters = text.replace(/[^a-zA-Z]/g, '');
  if (letters.length === 0) return 0;

  const caps = text.replace(/[^A-Z]/g, '');
  return caps.length / letters.length;
}

function findRepeatedChars(text: string): number {
  let maxRepeats = 0;
  let currentChar = '';
  let currentCount = 0;

  for (const char of text) {
    if (char === currentChar) {
      currentCount++;
      maxRepeats = Math.max(maxRepeats, currentCount);
    } else {
      currentChar = char;
      currentCount = 1;
    }
  }

  return maxRepeats;
}

export function filterSpam(text: string, config = createDefaultContentFilterConfig()): ContentFlag[] {
  if (!config.spam.enabled) return [];
  if (!text) return [];

  const flags: ContentFlag[] = [];
  const normalized = normalizeText(text);

  // Check caps ratio
  const capsRatio = calculateCapsRatio(text);
  if (capsRatio > config.spam.capsThreshold && text.length > 10) {
    flags.push({
      type: 'spam',
      field: 'text',
      value: text,
      reason: `Excessive caps (${Math.round(capsRatio * 100)}%)`,
    });
  }

  // Check repeated characters
  const maxRepeats = findRepeatedChars(text);
  if (maxRepeats > config.spam.repeatedCharThreshold) {
    flags.push({
      type: 'spam',
      field: 'text',
      value: text,
      reason: `Excessive repeated characters (${maxRepeats} in a row)`,
    });
  }

  // Check spam phrases
  let spamPhraseCount = 0;
  for (const phrase of SPAM_PHRASES) {
    if (normalized.includes(phrase)) {
      spamPhraseCount++;
    }
  }

  if (spamPhraseCount > config.spam.spamPhraseThreshold) {
    flags.push({
      type: 'spam',
      field: 'text',
      value: text,
      reason: `Contains ${spamPhraseCount} spam phrases`,
    });
  }

  // Check excessive punctuation
  const punctuationCount = (text.match(/[!?]{3,}/g) || []).length;
  if (punctuationCount > 2) {
    flags.push({
      type: 'spam',
      field: 'text',
      value: text,
      reason: `Excessive punctuation (${punctuationCount} instances)`,
    });
  }

  return flags;
}

// ============================================================================
// Text Sanitization
// ============================================================================

export function sanitizeText(text: string, flags: ContentFlag[]): string {
  let sanitized = text;

  for (const flag of flags) {
    if (flag.type === 'profanity') {
      // Replace profanity with asterisks
      const regex = new RegExp(flag.value, 'gi');
      sanitized = sanitized.replace(regex, (match) => '*'.repeat(match.length));
    }
  }

  return sanitized;
}

// ============================================================================
// Main Filter Function
// ============================================================================

export function filterResource(
  resource: {
    name: string;
    description?: string | null;
    phone?: string | null;
    website?: string | null;
  },
  config = createDefaultContentFilterConfig()
): ContentFilterResult {
  const allFlags: ContentFlag[] = [];

  // Filter name
  const nameFlags = [
    ...filterProfanity(resource.name, config),
    ...filterSpam(resource.name, config),
  ];
  nameFlags.forEach(flag => { flag.field = 'name'; });
  allFlags.push(...nameFlags);

  // Filter description
  if (resource.description) {
    const descFlags = [
      ...filterProfanity(resource.description, config),
      ...filterSpam(resource.description, config),
    ];
    descFlags.forEach(flag => { flag.field = 'description'; });
    allFlags.push(...descFlags);
  }

  // Filter phone
  if (resource.phone) {
    const phoneFlags = filterScamPhones(resource.phone, config);
    allFlags.push(...phoneFlags);
  }

  // Filter website
  if (resource.website) {
    const urlFlags = filterMaliciousUrls(resource.website, config);
    urlFlags.forEach(flag => { flag.field = 'website'; });
    allFlags.push(...urlFlags);
  }

  // Calculate score
  // Start with 1.0 (perfect), deduct for each flag
  const flagPenalty = 0.15; // Each flag reduces score by 15%
  const score = Math.max(0, 1 - (allFlags.length * flagPenalty));

  // Determine if passed
  const passed = score >= config.minimumScore && allFlags.length === 0;

  // Sanitize text if flags exist
  let sanitizedText: string | undefined;
  if (allFlags.length > 0) {
    const textToSanitize = [
      resource.name,
      resource.description || '',
    ].join(' ');

    sanitizedText = sanitizeText(textToSanitize, allFlags);
  }

  return {
    passed,
    flags: allFlags,
    sanitizedText,
    score,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get a human-readable summary of filter results
 */
export function summarizeFilterResult(result: ContentFilterResult): string {
  if (result.passed) {
    return 'Content passed all filters';
  }

  const flagsByType = new Map<ContentFlagType, number>();
  for (const flag of result.flags) {
    flagsByType.set(flag.type, (flagsByType.get(flag.type) || 0) + 1);
  }

  const summary: string[] = [];
  for (const [type, count] of flagsByType) {
    summary.push(`${count} ${type} flag${count > 1 ? 's' : ''}`);
  }

  return `Content failed filters: ${summary.join(', ')} (score: ${Math.round(result.score * 100)}%)`;
}

/**
 * Log filtered content (for admin review)
 */
export function logFilteredContent(
  resourceId: string,
  result: ContentFilterResult,
  logger: (message: string) => void = console.warn
): void {
  if (result.passed) return;

  logger(`[Content Filter] Resource ${resourceId} flagged: ${summarizeFilterResult(result)}`);

  for (const flag of result.flags) {
    logger(`  - ${flag.field}: ${flag.reason}`);
  }
}
