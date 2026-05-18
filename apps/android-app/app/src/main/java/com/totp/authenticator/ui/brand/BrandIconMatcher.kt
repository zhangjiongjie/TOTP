package com.totp.authenticator.ui.brand

enum class BrandIcon {
    Amazon,
    Apple,
    Canva,
    GitHub,
    Google,
    Instagram,
    Microsoft,
    OpenAI,
    Default
}

object BrandIconMatcher {
    fun match(issuer: String): BrandIcon {
        val normalized = issuer.lowercase()
        return when {
            "amazon" in normalized -> BrandIcon.Amazon
            "apple" in normalized -> BrandIcon.Apple
            "canva" in normalized -> BrandIcon.Canva
            "github" in normalized -> BrandIcon.GitHub
            "google" in normalized -> BrandIcon.Google
            "instagram" in normalized -> BrandIcon.Instagram
            "microsoft" in normalized -> BrandIcon.Microsoft
            "openai" in normalized -> BrandIcon.OpenAI
            else -> BrandIcon.Default
        }
    }
}
