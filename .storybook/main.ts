import type { StorybookConfig } from '@storybook/nextjs';

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: ['@storybook/addon-a11y', '@storybook/addon-docs'],
  // @storybook/nextjs (webpack5), not nextjs-vite: next.config.ts has a
  // custom webpack config injected by withSentryConfig, which nextjs-vite
  // doesn't support.
  framework: '@storybook/nextjs',
  staticDirs: ['../public'],
};
export default config;
