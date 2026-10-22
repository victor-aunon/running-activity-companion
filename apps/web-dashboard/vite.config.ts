import { defineConfig, type UserConfig } from 'vite';

interface VitePlusConfig extends UserConfig {
  lint?: {
    options?: {
      typeAware?: boolean;
      typeCheck?: boolean;
    };
    rules?: Record<string, unknown>;
  };
  fmt?: Record<string, unknown>;
}

export default defineConfig({
  // Vite+ (vp) Code Quality Configuration
  lint: {
    options: {
      typeAware: true,
      typeCheck: true, // Strict TypeScript type checking
    },
    rules: {
      // 1. Cyclomatic Complexity and Structure Rules
      complexity: ['error', 10],
      'max-lines-per-function': ['error', { max: 50, skipBlankLines: true, skipComments: true }],
      'max-depth': ['error', 3],
      'max-params': ['error', 4],

      // 2. Clean Architecture Layer Boundary Import Restrictions
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/src/infrastructure/**', '**/src/ui/**'],
              message:
                'Clean Architecture Violation: Domain cannot depend on Infrastructure or UI.',
            },
          ],
        },
      ],
    },
  },
  fmt: {
    // Airbnb / VoidZero style guide standard
    singleQuote: true,
    semi: true,
    trailingComma: 'all',
    tabWidth: 2,
    printWidth: 100,
  },
} as VitePlusConfig);
