const baseConfig = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        target: 'ES2020',
        module: 'commonjs',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        strict: true,
        skipLibCheck: true,
        resolveJsonModule: true
      }
    }]
  },
  collectCoverageFrom: [
    'src/core/**/*.ts',
    '!src/core/**/*.d.ts',
    '!src/core/__tests__/**',
    '!src/core/examples/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html']
};

module.exports = {
  ...baseConfig,
  // 测试分类
  projects: [
    {
      ...baseConfig,
      displayName: 'unit',
      testMatch: ['<rootDir>/src/core/__tests__/**/!(integration|performance)/*.test.ts', '<rootDir>/src/core/__tests__/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/src/core/__tests__/setup.ts']
    },
    {
      ...baseConfig,
      displayName: 'integration',
      testMatch: ['<rootDir>/src/core/__tests__/integration/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/src/core/__tests__/integration/setup.ts'],
      testTimeout: 30000
    },
    {
      ...baseConfig,
      displayName: 'performance',
      testMatch: ['<rootDir>/src/core/__tests__/performance/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/src/core/__tests__/setup.ts'],
      testTimeout: 60000
    }
  ]
};
