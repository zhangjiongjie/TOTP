import appleSvg from './assets/apple.svg?raw';
import discordSvg from './assets/discord.svg?raw';
import dropboxSvg from './assets/dropbox.svg?raw';
import githubSvg from './assets/github.svg?raw';
import googleSvg from './assets/google.svg?raw';
import linkedinSvg from './assets/linkedin.svg?raw';
import microsoftSvg from './assets/microsoft.svg?raw';
import notionSvg from './assets/notion.svg?raw';
import onedriveSvg from './assets/onedrive.svg?raw';
import openaiSvg from './assets/openai.svg?raw';
import slackSvg from './assets/slack.svg?raw';
import spotifySvg from './assets/spotify.svg?raw';
import telegramSvg from './assets/telegram.svg?raw';
import xSvg from './assets/x.svg?raw';

export const iconRegistry = {
  apple: appleSvg,
  discord: discordSvg,
  dropbox: dropboxSvg,
  github: githubSvg,
  google: googleSvg,
  linkedin: linkedinSvg,
  microsoft: microsoftSvg,
  notion: notionSvg,
  onedrive: onedriveSvg,
  openai: openaiSvg,
  slack: slackSvg,
  spotify: spotifySvg,
  telegram: telegramSvg,
  x: xSvg
} as const;

export type IconKey = keyof typeof iconRegistry;
