package com.totp.authenticator.data.webdav

import android.util.Log
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.util.Base64
import kotlinx.serialization.json.Json

data class WebDavRemoteSnapshot(
    val revision: String,
    val updatedAt: String,
    val etag: String,
    val vaultEnvelope: WebDavRemoteEnvelopeDto
)

data class WebDavUploadResult(
    val revision: String,
    val etag: String
)

class WebDavClient {
    fun download(settings: WebDavSettings): WebDavRemoteSnapshot? {
        val response = request(settings, method = "GET")
        if (response.code == HttpURLConnection.HTTP_NOT_FOUND || response.code == HttpURLConnection.HTTP_GONE) {
            return null
        }
        if (response.code !in 200..299) {
            throw WebDavException("WebDAV download failed with HTTP ${response.code}")
        }
        if (response.body.isBlank()) {
            return null
        }
        val envelope = runCatching {
            json.decodeFromString<WebDavRemoteEnvelopeDto>(response.body)
        }.getOrElse { error ->
            throw WebDavException(
                "WebDAV 远端保管库文件格式无效，请检查同步路径是否指向应用的 WebDAV 同步文件。",
                error
            )
        }
        return WebDavRemoteSnapshot(
            revision = envelope.revision,
            updatedAt = envelope.updatedAt,
            etag = response.etag,
            vaultEnvelope = envelope
        )
    }

    fun upload(
        settings: WebDavSettings,
        envelope: WebDavRemoteEnvelopeDto,
        previousEtag: String
    ): WebDavUploadResult {
        val response = request(
            settings = settings,
            method = "PUT",
            body = json.encodeToString(envelope),
            previousEtag = previousEtag
        )
        if (response.code !in 200..299) {
            val message = when (response.code) {
                HttpURLConnection.HTTP_UNAUTHORIZED, HttpURLConnection.HTTP_FORBIDDEN ->
                    "WebDAV upload failed: invalid username or password"
                HttpURLConnection.HTTP_CONFLICT ->
                    "WebDAV upload failed: remote directory does not exist or is not writable"
                HttpURLConnection.HTTP_PRECON_FAILED ->
                    "WebDAV upload failed: remote version changed"
                else -> "WebDAV upload failed with HTTP ${response.code}"
            }
            throw WebDavException(message)
        }
        return WebDavUploadResult(envelope.revision, response.etag)
    }

    fun testConnection(settings: WebDavSettings) {
        val response = request(settings, method = "GET")
        if (response.code == HttpURLConnection.HTTP_NOT_FOUND || response.code == HttpURLConnection.HTTP_GONE) {
            return
        }
        if (response.code !in 200..299) {
            throw WebDavException("WebDAV test failed with HTTP ${response.code}")
        }
    }

    private fun request(
        settings: WebDavSettings,
        method: String,
        body: String = "",
        previousEtag: String = ""
    ): WebDavResponse {
        return requestUrl(
            settings = settings,
            url = URL(buildVaultUrl(settings)),
            method = method,
            body = body,
            previousEtag = previousEtag,
            redirectCount = 0
        )
    }

    private fun requestUrl(
        settings: WebDavSettings,
        url: URL,
        method: String,
        body: String,
        previousEtag: String,
        redirectCount: Int
    ): WebDavResponse {
        val startedAt = System.currentTimeMillis()
        val connection = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 15_000
            readTimeout = 15_000
            useCaches = false
            instanceFollowRedirects = false
            setRequestProperty("Cache-Control", "no-cache")
            setRequestProperty("Pragma", "no-cache")
            if (settings.username.isNotBlank() || settings.password.isNotBlank()) {
                setRequestProperty("Authorization", "Basic ${basicAuth(settings.username, settings.password)}")
            }
            if (previousEtag.isNotBlank()) {
                setRequestProperty("If-Match", previousEtag)
            }
            if (body.isNotEmpty()) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
            }
        }

        return try {
            if (body.isNotEmpty()) {
                connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            }
            val bodyWrittenAt = System.currentTimeMillis()
            val code = connection.responseCode
            val responseCodeAt = System.currentTimeMillis()
            val redirectLocation = connection.getHeaderField("Location")
            if (isRedirect(code) && redirectLocation != null) {
                if (redirectCount >= MAX_REDIRECTS) {
                    throw WebDavException("WebDAV request failed: too many redirects")
                }
                logDebug("http $method redirect code=$code count=${redirectCount + 1}")
                return requestUrl(
                    settings = settings,
                    url = URL(url, redirectLocation),
                    method = redirectMethod(method, code),
                    body = redirectBody(method, code, body),
                    previousEtag = previousEtag,
                    redirectCount = redirectCount + 1
                )
            }
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            val responseBody = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            val finishedAt = System.currentTimeMillis()
            val etag = connection.getHeaderField("ETag").orEmpty()
            logDebug(
                "http $method total=${finishedAt - startedAt}ms write=${bodyWrittenAt - startedAt}ms response=${responseCodeAt - bodyWrittenAt}ms read=${finishedAt - responseCodeAt}ms code=$code requestBytes=${body.toByteArray(Charsets.UTF_8).size} responseBytes=${responseBody.toByteArray(Charsets.UTF_8).size} etag=${etag.isNotBlank()}"
            )
            WebDavResponse(code, responseBody, etag)
        } catch (error: IOException) {
            throw WebDavException("WebDAV request failed: ${error.message ?: "network error"}", error)
        } finally {
            connection.disconnect()
        }
    }

    private fun buildVaultUrl(settings: WebDavSettings): String {
        val server = settings.serverUrl.trim().trimEnd('/')
        val path = settings.filePath.trim().let { if (it.startsWith('/')) it else "/$it" }
        return server + path
    }

    private fun isRedirect(code: Int): Boolean {
        return code == HttpURLConnection.HTTP_MOVED_PERM ||
            code == HttpURLConnection.HTTP_MOVED_TEMP ||
            code == HttpURLConnection.HTTP_SEE_OTHER ||
            code == HTTP_TEMPORARY_REDIRECT ||
            code == HTTP_PERMANENT_REDIRECT
    }

    private fun redirectMethod(method: String, code: Int): String {
        return if (code == HttpURLConnection.HTTP_SEE_OTHER) "GET" else method
    }

    private fun redirectBody(method: String, code: Int, body: String): String {
        return if (method != redirectMethod(method, code)) "" else body
    }

    private fun basicAuth(username: String, password: String): String {
        return Base64.getEncoder().encodeToString("$username:$password".toByteArray(Charsets.UTF_8))
    }

    private fun logDebug(message: String) {
        runCatching { Log.d("TotpWebDavPerf", message) }
    }

    private companion object {
        const val MAX_REDIRECTS = 5
        const val HTTP_TEMPORARY_REDIRECT = 307
        const val HTTP_PERMANENT_REDIRECT = 308

        val json = Json {
            encodeDefaults = true
            ignoreUnknownKeys = true
        }
    }
}

class WebDavException(message: String, cause: Throwable? = null) : Exception(message, cause)

private data class WebDavResponse(
    val code: Int,
    val body: String,
    val etag: String
)
