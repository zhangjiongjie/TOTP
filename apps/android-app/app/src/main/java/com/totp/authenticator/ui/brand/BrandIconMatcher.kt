package com.totp.authenticator.ui.brand

enum class BrandIcon {
    Amazon,
    Apple,
    Aws,
    Binance,
    Bitwarden,
    Canva,
    Cloudflare,
    Coinbase,
    Discord,
    Dropbox,
    Facebook,
    GitHub,
    GitLab,
    Google,
    Instagram,
    LinkedIn,
    Microsoft,
    Notion,
    OneDrive,
    OpenAI,
    PayPal,
    Reddit,
    Slack,
    Spotify,
    Steam,
    Stripe,
    Telegram,
    TikTok,
    Twitch,
    WhatsApp,
    X,
    Yahoo,
    Zoom,
    Default
}

object BrandIconMatcher {
    fun match(issuer: String): BrandIcon {
        val normalized = issuer.lowercase()
        return when {
            "amazon" in normalized -> BrandIcon.Amazon
            "apple" in normalized -> BrandIcon.Apple
            "aws" in normalized -> BrandIcon.Aws
            "binance" in normalized -> BrandIcon.Binance
            "bitwarden" in normalized -> BrandIcon.Bitwarden
            "canva" in normalized -> BrandIcon.Canva
            "cloudflare" in normalized -> BrandIcon.Cloudflare
            "coinbase" in normalized -> BrandIcon.Coinbase
            "discord" in normalized -> BrandIcon.Discord
            "dropbox" in normalized -> BrandIcon.Dropbox
            "facebook" in normalized || normalized == "meta" -> BrandIcon.Facebook
            "github" in normalized -> BrandIcon.GitHub
            "gitlab" in normalized || "git01.mobiwire.com" in normalized -> BrandIcon.GitLab
            "google" in normalized -> BrandIcon.Google
            "instagram" in normalized -> BrandIcon.Instagram
            "linkedin" in normalized -> BrandIcon.LinkedIn
            "microsoft" in normalized -> BrandIcon.Microsoft
            "notion" in normalized -> BrandIcon.Notion
            "onedrive" in normalized || "one drive" in normalized -> BrandIcon.OneDrive
            "openai" in normalized -> BrandIcon.OpenAI
            "paypal" in normalized -> BrandIcon.PayPal
            "reddit" in normalized -> BrandIcon.Reddit
            "slack" in normalized -> BrandIcon.Slack
            "spotify" in normalized -> BrandIcon.Spotify
            "steam" in normalized -> BrandIcon.Steam
            "stripe" in normalized -> BrandIcon.Stripe
            "telegram" in normalized -> BrandIcon.Telegram
            "tiktok" in normalized || "tik tok" in normalized -> BrandIcon.TikTok
            "twitch" in normalized -> BrandIcon.Twitch
            "whatsapp" in normalized || "whatapp" in normalized -> BrandIcon.WhatsApp
            normalized == "x" || "twitter" in normalized -> BrandIcon.X
            "yahoo" in normalized -> BrandIcon.Yahoo
            "zoom" in normalized -> BrandIcon.Zoom
            else -> BrandIcon.Default
        }
    }
}
