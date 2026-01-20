/**
 * FEED Platform Typography Tokens
 * Design system typography definitions
 */

export const fontFamily = {
  sans: [
    'Inter',
    'system-ui',
    '-apple-system',
    'BlinkMacSystemFont',
    'Segoe UI',
    'Roboto',
    'Helvetica Neue',
    'Arial',
    'sans-serif',
  ],
  mono: [
    'JetBrains Mono',
    'Fira Code',
    'Monaco',
    'Consolas',
    'Liberation Mono',
    'Courier New',
    'monospace',
  ],
} as const

export const fontSize = {
  xs: ['0.75rem', { lineHeight: '1rem' }],
  sm: ['0.875rem', { lineHeight: '1.25rem' }],
  base: ['1rem', { lineHeight: '1.5rem' }],
  lg: ['1.125rem', { lineHeight: '1.75rem' }],
  xl: ['1.25rem', { lineHeight: '1.75rem' }],
  '2xl': ['1.5rem', { lineHeight: '2rem' }],
  '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
  '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
  '5xl': ['3rem', { lineHeight: '1' }],
  '6xl': ['3.75rem', { lineHeight: '1' }],
} as const

export const fontWeight = {
  thin: '100',
  extralight: '200',
  light: '300',
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900',
} as const

export const letterSpacing = {
  tighter: '-0.05em',
  tight: '-0.025em',
  normal: '0em',
  wide: '0.025em',
  wider: '0.05em',
  widest: '0.1em',
} as const

// Semantic typography styles
export const textStyles = {
  // Headings
  h1: {
    fontSize: '2.25rem',
    lineHeight: '2.5rem',
    fontWeight: '700',
    letterSpacing: '-0.025em',
  },
  h2: {
    fontSize: '1.875rem',
    lineHeight: '2.25rem',
    fontWeight: '600',
    letterSpacing: '-0.025em',
  },
  h3: {
    fontSize: '1.5rem',
    lineHeight: '2rem',
    fontWeight: '600',
  },
  h4: {
    fontSize: '1.25rem',
    lineHeight: '1.75rem',
    fontWeight: '600',
  },
  h5: {
    fontSize: '1.125rem',
    lineHeight: '1.75rem',
    fontWeight: '600',
  },
  h6: {
    fontSize: '1rem',
    lineHeight: '1.5rem',
    fontWeight: '600',
  },

  // Body text
  bodyLarge: {
    fontSize: '1.125rem',
    lineHeight: '1.75rem',
    fontWeight: '400',
  },
  body: {
    fontSize: '1rem',
    lineHeight: '1.5rem',
    fontWeight: '400',
  },
  bodySmall: {
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    fontWeight: '400',
  },

  // Labels and captions
  label: {
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    fontWeight: '500',
  },
  caption: {
    fontSize: '0.75rem',
    lineHeight: '1rem',
    fontWeight: '400',
  },

  // Special
  overline: {
    fontSize: '0.75rem',
    lineHeight: '1rem',
    fontWeight: '600',
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
  },
  button: {
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    fontWeight: '500',
  },
} as const

export type TextStyle = keyof typeof textStyles
export type FontSize = keyof typeof fontSize
export type FontWeight = keyof typeof fontWeight
