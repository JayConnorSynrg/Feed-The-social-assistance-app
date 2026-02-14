// Shared utilities, types, and constants
export * from './lib/constants';
export * from './lib/utils';

// 211 API integration
export * from './lib/211-client';
export * from './lib/211-transformer';

// Encryption utilities (zero dependencies - uses native Web Crypto API)
export * from './lib/crypto';

// Federation configuration
export * from './lib/federation-config';

// Federation protocol
export * from './lib/http-signatures';
export * from './lib/federation-client';

// Federation trust system
export * from './lib/trust-calculator';
export * from './lib/trust-levels';
export * from './lib/trust-event-logger';

// Federation health & quality
export * from './lib/uptime-calculator';
export * from './lib/data-quality-scorer';

// Federation resource sync
export * from './lib/resource-transformer';
export * from './lib/resource-deduplicator';
export * from './lib/conflict-detector';
export * from './lib/auto-resolver';
