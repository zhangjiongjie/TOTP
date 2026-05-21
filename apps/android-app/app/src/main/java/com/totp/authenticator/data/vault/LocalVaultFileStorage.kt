package com.totp.authenticator.data.vault

import java.io.File

interface LocalVaultStorage {
    fun exists(): Boolean
    fun read(): String?
    fun write(value: String)
    fun delete()
}

class FileLocalVaultStorage(
    private val file: File
) : LocalVaultStorage {
    override fun exists(): Boolean {
        return file.isFile
    }

    override fun read(): String? {
        return if (exists()) file.readText(Charsets.UTF_8) else null
    }

    override fun write(value: String) {
        val parent = file.parentFile
        if (parent != null && !parent.isDirectory && !parent.mkdirs() && !parent.isDirectory) {
            throw LocalVaultStorageException("Unable to create local vault storage directory")
        }
        val tempFile = File(parent ?: file.absoluteFile.parentFile, "${file.name}.tmp")
        runCatching {
            tempFile.writeText(value, Charsets.UTF_8)
            if (file.exists() && !file.delete()) {
                throw LocalVaultStorageException("Unable to replace local vault storage file")
            }
            if (!tempFile.renameTo(file)) {
                throw LocalVaultStorageException("Unable to commit local vault storage file")
            }
        }.onFailure { error ->
            tempFile.delete()
            if (error is LocalVaultStorageException) {
                throw error
            }
            throw LocalVaultStorageException("Unable to write local vault storage file", error)
        }
    }

    override fun delete() {
        if (file.exists() && !file.delete()) {
            throw LocalVaultStorageException("Unable to delete local vault storage file")
        }
    }
}
