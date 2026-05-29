package com.totp.authenticator.data.webdav

import com.sun.net.httpserver.HttpServer
import java.net.HttpURLConnection
import java.net.InetSocketAddress
import org.junit.Assert.assertEquals
import org.junit.After
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class WebDavClientTest {
    private var server: HttpServer? = null

    @After
    fun tearDown() {
        server?.stop(0)
    }

    @Test
    fun downloadReportsInvalidRemoteVaultFormatWithoutRawJsonParserError() {
        val settings = serveText("""{"mode":"encrypted","encryptedVault":{}}""")

        val error = runCatching { WebDavClient().download(settings) }.exceptionOrNull()

        assertTrue(error is WebDavException)
        assertTrue(error?.message.orEmpty().contains("WebDAV 远端保管库文件格式无效"))
        assertTrue(error?.message.orEmpty().contains("同步路径"))
        assertFalse(error?.message.orEmpty().contains("Unexpected JSON"))
    }

    @Test
    fun downloadFollowsTemporaryRedirectToRemoteVaultFile() {
        val previousFollowRedirects = HttpURLConnection.getFollowRedirects()
        HttpURLConnection.setFollowRedirects(false)
        val body = """
            {
              "schemaVersion": 1,
              "revision": "test-revision",
              "updatedAt": "2026-05-29T00:00:00Z",
              "encryptedVault": {
                "formatVersion": 2,
                "vaultId": "remote-vault",
                "kdf": { "name": "PBKDF2", "iterations": 310000, "hash": "SHA-256", "salt": "salt" },
                "keyEncryption": { "cipher": "AES-GCM", "iv": "key-iv", "ciphertext": "key-cipher" },
                "vaultEncryption": { "cipher": "AES-GCM", "iv": "vault-iv", "ciphertext": "vault-cipher" }
              }
            }
        """.trimIndent()
        try {
            val settings = serveRedirectedText(body)

            val snapshot = WebDavClient().download(settings)

            assertEquals("test-revision", snapshot?.revision)
            assertEquals("test-etag", snapshot?.etag)
        } finally {
            HttpURLConnection.setFollowRedirects(previousFollowRedirects)
        }
    }

    private fun serveText(body: String): WebDavSettings {
        val nextServer = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        nextServer.createContext("/vault.json") { exchange ->
            val bytes = body.toByteArray(Charsets.UTF_8)
            exchange.responseHeaders.add("ETag", "test-etag")
            exchange.sendResponseHeaders(200, bytes.size.toLong())
            exchange.responseBody.use { it.write(bytes) }
        }
        nextServer.start()
        server = nextServer
        return WebDavSettings(
            enabled = true,
            serverUrl = "http://127.0.0.1:${nextServer.address.port}",
            filePath = "/vault.json"
        )
    }

    private fun serveRedirectedText(body: String): WebDavSettings {
        val nextServer = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        nextServer.createContext("/vault.json") { exchange ->
            exchange.responseHeaders.add("Location", "/redirected-vault.json")
            exchange.sendResponseHeaders(301, -1)
            exchange.close()
        }
        nextServer.createContext("/redirected-vault.json") { exchange ->
            val bytes = body.toByteArray(Charsets.UTF_8)
            exchange.responseHeaders.add("ETag", "test-etag")
            exchange.sendResponseHeaders(200, bytes.size.toLong())
            exchange.responseBody.use { it.write(bytes) }
        }
        nextServer.start()
        server = nextServer
        return WebDavSettings(
            enabled = true,
            serverUrl = "http://127.0.0.1:${nextServer.address.port}",
            filePath = "/vault.json"
        )
    }
}
