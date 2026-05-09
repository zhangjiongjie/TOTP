import githubSvg from './assets/github.svg?raw';
import googleSvg from './assets/google.svg?raw';
import microsoftSvg from './assets/microsoft.svg?raw';
import openaiSvg from './assets/openai.svg?raw';
import slackSvg from './assets/slack.svg?raw';

export const iconRegistry = {
  github: githubSvg,
  google: googleSvg,
  microsoft: microsoftSvg,
  slack: slackSvg,
  openai: openaiSvg
} as const;

export type IconKey = keyof typeof iconRegistry;
