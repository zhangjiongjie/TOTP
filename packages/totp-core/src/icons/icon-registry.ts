import amazonSvg from './assets/amazon.svg?raw';
import appleSvg from './assets/apple.svg?raw';
import awsSvg from './assets/aws.svg?raw';
import binanceSvg from './assets/binance.svg?raw';
import bitwardenSvg from './assets/bitwarden.svg?raw';
import canvaSvg from './assets/canva.svg?raw';
import cloudflareSvg from './assets/cloudflare.svg?raw';
import coinbaseSvg from './assets/coinbase.svg?raw';
import defaultSvg from './assets/default.svg?raw';
import discordSvg from './assets/discord.svg?raw';
import dropboxSvg from './assets/dropbox.svg?raw';
import facebookSvg from './assets/facebook.svg?raw';
import githubSvg from './assets/github.svg?raw';
import gitlabSvg from './assets/gitlab.svg?raw';
import googleSvg from './assets/google.svg?raw';
import instagramSvg from './assets/instagram.svg?raw';
import linkedinSvg from './assets/linkedin.svg?raw';
import microsoftSvg from './assets/microsoft.svg?raw';
import notionSvg from './assets/notion.svg?raw';
import onedriveSvg from './assets/onedrive.svg?raw';
import openaiSvg from './assets/openai.svg?raw';
import paypalSvg from './assets/paypal.svg?raw';
import redditSvg from './assets/reddit.svg?raw';
import slackSvg from './assets/slack.svg?raw';
import spotifySvg from './assets/spotify.svg?raw';
import steamSvg from './assets/steam.svg?raw';
import stripeSvg from './assets/stripe.svg?raw';
import telegramSvg from './assets/telegram.svg?raw';
import tiktokSvg from './assets/tiktok.svg?raw';
import twitchSvg from './assets/twitch.svg?raw';
import whatsappSvg from './assets/whatsapp.svg?raw';
import xSvg from './assets/x.svg?raw';
import yahooSvg from './assets/yahoo.svg?raw';
import zoomSvg from './assets/zoom.svg?raw';

export const iconRegistry = {
  "amazon": amazonSvg,
  "apple": appleSvg,
  "aws": awsSvg,
  "binance": binanceSvg,
  "bitwarden": bitwardenSvg,
  "canva": canvaSvg,
  "cloudflare": cloudflareSvg,
  "coinbase": coinbaseSvg,
  "default": defaultSvg,
  "discord": discordSvg,
  "dropbox": dropboxSvg,
  "facebook": facebookSvg,
  "github": githubSvg,
  "gitlab": gitlabSvg,
  "google": googleSvg,
  "instagram": instagramSvg,
  "linkedin": linkedinSvg,
  "microsoft": microsoftSvg,
  "notion": notionSvg,
  "onedrive": onedriveSvg,
  "openai": openaiSvg,
  "paypal": paypalSvg,
  "reddit": redditSvg,
  "slack": slackSvg,
  "spotify": spotifySvg,
  "steam": steamSvg,
  "stripe": stripeSvg,
  "telegram": telegramSvg,
  "tiktok": tiktokSvg,
  "twitch": twitchSvg,
  "whatsapp": whatsappSvg,
  "x": xSvg,
  "yahoo": yahooSvg,
  "zoom": zoomSvg
} as const;

export type IconKey = keyof typeof iconRegistry;
