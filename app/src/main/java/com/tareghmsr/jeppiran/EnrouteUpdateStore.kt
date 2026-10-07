package com.tareghmsr.jeppiran

import android.content.Context
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

object EnrouteUpdateStore {

    data class ManifestInfo(
        val cycle: String,
        val products: String,
        val effectiveFrom: String,
        val effectiveTo: String,
        val published: Boolean,
        val fileCount: Int
    )

    private const val PREFS =
        "jeppiran_enroute_data"

    private const val ACTIVE_CYCLE =
        "active_cycle"

    private const val ROOT_DIR =
        "enroute-data"

    private const val MANIFEST_FILE =
        "manifest.json"

    private const val TIMEOUT =
        30000

    fun activeCycle(
        context: Context
    ): String =
        context
            .getSharedPreferences(
                PREFS,
                Context.MODE_PRIVATE
            )
            .getString(
                ACTIVE_CYCLE,
                ""
            )
            .orEmpty()

    fun bundledManifest(
        context: Context
    ): ManifestInfo? =
        runCatching {
            context.assets
                .open(
                    "enroute-manifest.json"
                )
                .bufferedReader()
                .use {
                    parseInfo(
                        it.readText()
                    )
                }
        }
            .getOrNull()

    fun parseInfo(
        raw: String
    ): ManifestInfo {
        val root =
            JSONObject(raw)

        val cycle =
            root.optString(
                "cycle"
            )
                .trim()

        require(
            cycle.isNotBlank()
        ) {
            "Enroute cycle is missing"
        }

        val files =
            root.optJSONArray(
                "files"
            )

        return ManifestInfo(
            cycle = cycle,
            products =
                root.optString(
                    "products"
                )
                    .trim(),
            effectiveFrom =
                root.optString(
                    "effective_from"
                )
                    .trim(),
            effectiveTo =
                root.optString(
                    "effective_to"
                )
                    .trim(),
            published =
                root.optBoolean(
                    "published",
                    false
                ),
            fileCount =
                files?.length()
                    ?: 0
        )
    }

    @Synchronized
    fun activate(
        context: Context,
        manifestRaw: String,
        onProgress: (Int) -> Unit
    ) {
        val root =
            JSONObject(
                manifestRaw
            )

        val info =
            parseInfo(
                manifestRaw
            )

        require(
            info.published
        ) {
            "Enroute package is not published yet"
        }

        val files =
            root.optJSONArray(
                "files"
            )
                ?: error(
                    "Enroute file list is missing"
                )

        require(
            files.length() >
                0
        ) {
            "Enroute package contains no files"
        }

        val safeCycle =
            info.cycle
                .replace(
                    Regex(
                        "[^A-Za-z0-9._-]"
                    ),
                    "_"
                )

        val rootDir =
            File(
                context.filesDir,
                ROOT_DIR
            )

        rootDir.mkdirs()

        val stage =
            File(
                rootDir,
                ".stage-" +
                    safeCycle +
                    "-" +
                    System.currentTimeMillis()
            )

        require(
            stage.mkdirs()
        ) {
            "Unable to create Enroute staging directory"
        }

        try {
            var completed =
                0

            for (
                i in
                0 until
                    files.length()
            ) {
                val item =
                    files.optJSONObject(i)
                        ?: continue

                val name =
                    item.optString(
                        "name"
                    )
                        .trim()

                val address =
                    item.optString(
                        "url"
                    )
                        .trim()

                val expectedSha =
                    item.optString(
                        "sha256"
                    )
                        .trim()
                        .lowercase()

                require(
                    name.isNotBlank() &&
                        !name.contains("/") &&
                        !name.contains("\\")
                ) {
                    "Invalid Enroute filename"
                }

                require(
                    address.startsWith(
                        "https://"
                    )
                ) {
                    "Invalid Enroute download URL"
                }

                require(
                    expectedSha.matches(
                        Regex(
                            "[0-9a-f]{64}"
                        )
                    )
                ) {
                    "Invalid Enroute checksum"
                }

                val target =
                    File(
                        stage,
                        name
                    )

                downloadAndVerify(
                    address,
                    target,
                    expectedSha
                )

                completed +=
                    1

                onProgress(
                    (
                        completed *
                            100 /
                            files.length()
                        )
                        .coerceIn(
                            0,
                            100
                        )
                )
            }

            File(
                stage,
                MANIFEST_FILE
            )
                .writeText(
                    manifestRaw
                )

            val targetDir =
                File(
                    rootDir,
                    safeCycle
                )

            if (
                targetDir.exists()
            ) {
                targetDir.deleteRecursively()
            }

            if (
                !stage.renameTo(
                    targetDir
                )
            ) {
                targetDir.mkdirs()

                stage
                    .listFiles()
                    .orEmpty()
                    .forEach {
                        source ->

                        source.copyTo(
                            File(
                                targetDir,
                                source.name
                            ),
                            overwrite =
                                true
                        )
                    }

                stage.deleteRecursively()
            }

            require(
                File(
                    targetDir,
                    MANIFEST_FILE
                ).isFile
            ) {
                "Enroute package activation failed"
            }

            context
                .getSharedPreferences(
                    PREFS,
                    Context.MODE_PRIVATE
                )
                .edit()
                .putString(
                    ACTIVE_CYCLE,
                    info.cycle
                )
                .commit()

            onProgress(100)

        } catch (
            error: Throwable
        ) {
            stage.deleteRecursively()
            throw error
        }
    }

    private fun downloadAndVerify(
        address: String,
        target: File,
        expectedSha: String
    ) {
        var connection:
            HttpURLConnection? =
            null

        try {
            connection =
                URL(address)
                    .openConnection()
                    as HttpURLConnection

            connection.instanceFollowRedirects =
                true

            connection.connectTimeout =
                TIMEOUT

            connection.readTimeout =
                TIMEOUT

            connection.requestMethod =
                "GET"

            connection.setRequestProperty(
                "User-Agent",
                "JEPPIRAN Enroute updater"
            )

            val code =
                connection.responseCode

            require(
                code in
                    200..299
            ) {
                "Enroute download failed (HTTP " +
                    code +
                    ")"
            }

            val digest =
                MessageDigest.getInstance(
                    "SHA-256"
                )

            connection
                .inputStream
                .use {
                    input ->

                    target
                        .outputStream()
                        .use {
                            output ->

                            val buffer =
                                ByteArray(
                                    64 *
                                        1024
                                )

                            while (
                                true
                            ) {
                                val count =
                                    input.read(
                                        buffer
                                    )

                                if (
                                    count <=
                                    0
                                ) {
                                    break
                                }

                                output.write(
                                    buffer,
                                    0,
                                    count
                                )

                                digest.update(
                                    buffer,
                                    0,
                                    count
                                )
                            }
                        }
                }

            require(
                target.length() >
                    0L
            ) {
                "Downloaded Enroute file is empty"
            }

            val actual =
                digest
                    .digest()
                    .joinToString(
                        ""
                    ) {
                        byte ->
                        "%02x".format(
                            byte
                        )
                    }

            require(
                actual.equals(
                    expectedSha,
                    ignoreCase =
                        true
                )
            ) {
                "Enroute checksum verification failed"
            }

        } finally {
            connection?.disconnect()
        }
    }
}
