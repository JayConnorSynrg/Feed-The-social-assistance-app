/**
 * Test examples for content-filter.ts
 * Run with: npx tsx packages/shared/lib/content-filter.test.ts
 */

import {
  filterResource,
  filterProfanity,
  filterScamPhones,
  filterMaliciousUrls,
  filterSpam,
  summarizeFilterResult,
  createDefaultContentFilterConfig,
} from './content-filter';

console.log('=== Content Filter Tests ===\n');

// Test 1: Clean resource (should pass)
console.log('Test 1: Clean Resource');
const clean = filterResource({
  name: 'Community Food Bank',
  description: 'Free groceries every Tuesday and Thursday',
  phone: '555-123-4567',
  website: 'https://foodbank.org',
});
console.log('Result:', summarizeFilterResult(clean));
console.log('Passed:', clean.passed);
console.log('Score:', clean.score);
console.log();

// Test 2: Profanity detection
console.log('Test 2: Profanity Detection');
const profane = filterResource({
  name: 'This is some bullshit service',
  description: 'We dont give a damn about quality',
});
console.log('Result:', summarizeFilterResult(profane));
console.log('Flags:', profane.flags.map(f => f.reason));
console.log('Sanitized:', profane.sanitizedText);
console.log();

// Test 3: L33t speak profanity
console.log('Test 3: L33t Speak Obfuscation');
const leet = filterProfanity('This is fuk1ng bullsh1t');
console.log('Detected flags:', leet.map(f => f.reason));
console.log();

// Test 4: Scam phone numbers
console.log('Test 4: Scam Phone Detection');
const scamPhone1 = filterScamPhones('1-900-555-1234');
const scamPhone2 = filterScamPhones('876-555-1234'); // Jamaica scam prefix
console.log('900 number:', scamPhone1.map(f => f.reason));
console.log('Jamaica number:', scamPhone2.map(f => f.reason));
console.log();

// Test 5: Malicious URLs
console.log('Test 5: Malicious URL Detection');
const badUrl1 = filterMaliciousUrls('javascript:alert("xss")');
const badUrl2 = filterMaliciousUrls('http://192.168.1.1/phishing');
const badUrl3 = filterMaliciousUrls('https://paypal.secure.login.verify.com');
console.log('JavaScript URI:', badUrl1.map(f => f.reason));
console.log('IP address:', badUrl2.map(f => f.reason));
console.log('Excessive subdomains:', badUrl3.map(f => f.reason));
console.log();

// Test 6: Spam detection
console.log('Test 6: Spam Detection');
const spam = filterResource({
  name: 'CLICK HERE NOW!!!',
  description: 'WIN FREE MONEY!!!! Make money fast! Limited time offer! Act now!',
});
console.log('Result:', summarizeFilterResult(spam));
console.log('Flags:', spam.flags.map(f => f.reason));
console.log();

// Test 7: Combined filtering
console.log('Test 7: Combined Malicious Resource');
const malicious = filterResource({
  name: 'FREE MONEY CLICK NOW!!!',
  description: 'This shit is the best! You won! Claim your prize!',
  phone: '1-900-555-SCAM',
  website: 'javascript:void(0)',
});
console.log('Result:', summarizeFilterResult(malicious));
console.log('Passed:', malicious.passed);
console.log('Score:', malicious.score);
console.log('Total flags:', malicious.flags.length);
console.log('Flag types:', [...new Set(malicious.flags.map(f => f.type))].join(', '));
console.log();

// Test 8: Custom config
console.log('Test 8: Custom Config (More Lenient)');
const lenientConfig = createDefaultContentFilterConfig();
lenientConfig.minimumScore = 0.5; // Accept 50% clean
lenientConfig.profanity.threshold = 2; // Allow up to 2 profanity words

const borderline = filterResource(
  {
    name: 'Decent Service',
    description: 'This is some bullshit but we try our best',
  },
  lenientConfig
);
console.log('Result:', summarizeFilterResult(borderline));
console.log('Passed with lenient config:', borderline.passed);
console.log('Score:', borderline.score);
console.log();

console.log('=== All Tests Complete ===');
