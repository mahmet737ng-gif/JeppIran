package com.tareghmsr.jeppiran

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

object AppUpdateManager {

    data class PatchInfo(
        val fromVersionCode: Long,
        val toVersionCode: Long,
        val fromSha256: String,
        val toSha256: String,
        val patchUrl: String,
        val patchSha256: String,
        val patchSizeBytes: Long
    )

    data class UpdateInfo(
        val versionCode: Long,
        val versionName: String,
        val apkUrl: String,
        val sha256: String,
        val publishedAt: String,
        val patches: List<PatchInfo>
    )

    data class CheckResult(
        val currentVersionCode: Long,
        val currentVersionName: String,
        val remote: UpdateInfo?,
        val updateAvailable: Boolean,
        val deltaAvailable: Boolean
    )

    private const val UPDATE_INFO_URL =
        "https://github.com/mahmet737ng-gif/JeppIran/releases/download/jeppiran-test/app-update.json"

    private const val TIMEOUT_MS =
        30000

    fun check(
        context: Context
    ): CheckResult {

        val local =
            localVersion(
                context
            )

        val metadataUrl =
            UPDATE_INFO_URL +
                "?t=" +
                System.currentTimeMillis()

        val remote =
            parseUpdateInfo(
                fetchText(
                    metadataUrl
                )
            )

        val chain =
            buildPatchChain(
                local.first,
                remote.versionCode,
                remote.patches
            )

        return CheckResult(
            currentVersionCode =
                local.first,
            currentVersionName =
                local.second,
            remote =
                remote,
            updateAvailable =
                remote.versionCode >
                    local.first,
            deltaAvailable =
                chain !=
                    null &&
                    chain.isNotEmpty()
        )
    }

    fun canInstallPackages(
        context: Context
    ): Boolean {

        return Build.VERSION.SDK_INT <
            Build.VERSION_CODES.O ||
            context.packageManager
                .canRequestPackageInstalls()
    }

    fun openInstallPermission(
        context: Context
    ) {

        if (
            Build.VERSION.SDK_INT >=
            Build.VERSION_CODES.O
        ) {

            val intent =
                Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse(
                        "package:" +
                            context.packageName
                    )
                )

            context.startActivity(
                intent
            )
        }
    }

    fun downloadAndVerify(
        context: Context,
        info: UpdateInfo,
        onProgress: (Int) -> Unit
    ): File {

        val dir =
            File(
                context.cacheDir,
                "updates"
            )

        if (
            !dir.exists()
        ) {
            dir.mkdirs()
        }

        dir.listFiles()
            .orEmpty()
            .forEach {
                file ->

                if (
                    file.name.startsWith(
                        "delta-"
                    ) ||
                    file.name.startsWith(
                        "rebuild-"
                    ) ||
                    file.name ==
                        "jeppiran-update.part"
                ) {
                    file.delete()
                }
            }

        val local =
            localVersion(
                context
            )

        val chain =
            buildPatchChain(
                local.first,
                info.versionCode,
                info.patches
            )

        require(
            chain !=
                null &&
                chain.isNotEmpty()
        ) {
            "Delta update package is unavailable for this installed version. Full APK download was not started."
        }

        val installedApk =
            File(
                context.applicationInfo
                    .sourceDir
            )

        val installedSha =
            sha256(
                installedApk
            )

        require(
            installedSha.equals(
                chain.first()
                    .fromSha256,
                ignoreCase =
                    true
            )
        ) {
            "Installed APK does not match the delta base. Full APK download was not started."
        }

        return applyPatchChain(
            context =
                context,
            info =
                info,
            installedApk =
                installedApk,
            chain =
                chain,
            directory =
                dir,
            onProgress =
                onProgress
        )
    }

    fun launchInstaller(
        context: Context,
        apk: File
    ) {

        require(
            apk.isFile &&
                apk.length() >
                0L
        ) {
            "APK file is missing"
        }

        val uri =
            FileProvider.getUriForFile(
                context,
                context.packageName +
                    ".fileprovider",
                apk
            )

        val intent =
            Intent(
                Intent.ACTION_VIEW
            ).apply {

                setDataAndType(
                    uri,
                    "application/vnd.android.package-archive"
                )

                addFlags(
                    Intent.FLAG_GRANT_READ_URI_PERMISSION
                )

                addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK
                )
            }

        context.startActivity(
            intent
        )
    }

    private fun parseUpdateInfo(
        raw: String
    ): UpdateInfo {

        val root =
            JSONObject(
                raw
            )

        val patches =
            mutableListOf<
                PatchInfo
            >()

        val array =
            root.optJSONArray(
                "patches"
            )

        if (
            array !=
            null
        ) {

            for (
                index in
                0 until
                    array.length()
            ) {

                val item =
                    array.optJSONObject(
                        index
                    )
                        ?: continue

                val patch =
                    PatchInfo(
                        fromVersionCode =
                            item.optLong(
                                "fromVersionCode",
                                -1L
                            ),
                        toVersionCode =
                            item.optLong(
                                "toVersionCode",
                                -1L
                            ),
                        fromSha256 =
                            item.optString(
                                "fromSha256"
                            )
                                .trim()
                                .lowercase(),
                        toSha256 =
                            item.optString(
                                "toSha256"
                            )
                                .trim()
                                .lowercase(),
                        patchUrl =
                            item.optString(
                                "patchUrl"
                            )
                                .trim(),
                        patchSha256 =
                            item.optString(
                                "patchSha256"
                            )
                                .trim()
                                .lowercase(),
                        patchSizeBytes =
                            item.optLong(
                                "patchSizeBytes",
                                0L
                            )
                    )

                if (
                    patch.fromVersionCode >
                        0L &&
                    patch.toVersionCode >
                        patch.fromVersionCode &&
                    patch.fromSha256
                        .matches(
                            Regex(
                                "[0-9a-f]{64}"
                            )
                        ) &&
                    patch.toSha256
                        .matches(
                            Regex(
                                "[0-9a-f]{64}"
                            )
                        ) &&
                    patch.patchSha256
                        .matches(
                            Regex(
                                "[0-9a-f]{64}"
                            )
                        ) &&
                    patch.patchUrl
                        .startsWith(
                            "https://"
                        )
                ) {

                    patches.add(
                        patch
                    )
                }
            }
        }

        val info =
            UpdateInfo(
                versionCode =
                    root.getLong(
                        "versionCode"
                    ),
                versionName =
                    root.getString(
                        "versionName"
                    ),
                apkUrl =
                    root.getString(
                        "apkUrl"
                    ),
                sha256 =
                    root.getString(
                        "sha256"
                    )
                        .trim()
                        .lowercase(),
                publishedAt =
                    root.optString(
                        "publishedAt"
                    ),
                patches =
                    patches
                        .sortedBy {
                            it.fromVersionCode
                        }
            )

        require(
            info.apkUrl
                .startsWith(
                    "https://"
                )
        ) {
            "Invalid APK URL"
        }

        require(
            info.sha256
                .matches(
                    Regex(
                        "[0-9a-f]{64}"
                    )
                )
        ) {
            "Invalid APK checksum"
        }

        return info
    }

    private fun buildPatchChain(
        fromVersionCode: Long,
        targetVersionCode: Long,
        patches: List<PatchInfo>
    ):
        List<PatchInfo>? {

        if (
            fromVersionCode >=
            targetVersionCode
        ) {
            return emptyList()
        }

        val byFrom =
            patches
                .groupBy {
                    it.fromVersionCode
                }

        val result =
            mutableListOf<
                PatchInfo
            >()

        var current =
            fromVersionCode

        val visited =
            mutableSetOf<Long>()

        while (
            current <
            targetVersionCode
        ) {

            if (
                !visited.add(
                    current
                )
            ) {
                return null
            }

            val next =
                byFrom[
                    current
                ]
                    .orEmpty()
                    .filter {
                        it.toVersionCode <=
                            targetVersionCode
                    }
                    .maxByOrNull {
                        it.toVersionCode
                    }
                    ?: return null

            result.add(
                next
            )

            current =
                next.toVersionCode
        }

        return if (
            current ==
            targetVersionCode
        ) {
            result
        } else {
            null
        }
    }

    private fun applyPatchChain(
        context: Context,
        info: UpdateInfo,
        installedApk: File,
        chain: List<PatchInfo>,
        directory: File,
        onProgress: (Int) -> Unit
    ): File {

        var currentApk =
            installedApk

        var generatedApk:
            File? =
            null

        chain.forEachIndexed {
            index,
            patch ->

            val patchFile =
                File(
                    directory,
                    "delta-" +
                        patch.fromVersionCode +
                        "-" +
                        patch.toVersionCode +
                        ".bsdiff"
                )

            downloadFile(
                context =
                    context,
                address =
                    patch.patchUrl,
                target =
                    patchFile,
                expectedSha =
                    patch.patchSha256
            ) {
                patchProgress ->

                val overall =
                    (
                        (
                            index *
                                100
                            ) +
                            patchProgress
                        ) /
                        chain.size
                        .coerceAtLeast(
                            1
                        )

                onProgress(
                    overall
                        .coerceIn(
                            0,
                            99
                        )
                )
            }

            val rebuilt =
                File(
                    directory,
                    "rebuild-" +
                        patch.toVersionCode +
                        ".apk"
                )

            if (
                rebuilt.exists()
            ) {
                rebuilt.delete()
            }

            DeltaPatchApplier.apply(
                oldFile =
                    currentApk,
                patchFile =
                    patchFile,
                newFile =
                    rebuilt
            )

            val rebuiltSha =
                sha256(
                    rebuilt
                )

            require(
                rebuiltSha.equals(
                    patch.toSha256,
                    ignoreCase =
                        true
                )
            ) {
                "Delta update verification failed"
            }

            if (
                generatedApk !=
                    null &&
                generatedApk !=
                    installedApk
            ) {
                generatedApk
                    ?.delete()
            }

            generatedApk =
                rebuilt

            currentApk =
                rebuilt

            patchFile.delete()
        }

        require(
            currentApk.isFile
        ) {
            "Delta update did not produce an APK"
        }

        val finalSha =
            sha256(
                currentApk
            )

        require(
            finalSha.equals(
                info.sha256,
                ignoreCase =
                    true
            )
        ) {
            "Final delta APK checksum mismatch"
        }

        val finalFile =
            File(
                directory,
                "jeppiran-update.apk"
            )

        if (
            finalFile.exists()
        ) {
            finalFile.delete()
        }

        currentApk.copyTo(
            finalFile,
            overwrite =
                true
        )

        if (
            currentApk !=
            installedApk
        ) {
            currentApk.delete()
        }

        onProgress(
            100
        )

        return finalFile
    }

    private fun downloadFullApk(
        context: Context,
        info: UpdateInfo,
        directory: File,
        onProgress: (Int) -> Unit
    ): File {

        val temp =
            File(
                directory,
                "jeppiran-update.part"
            )

        val finalFile =
            File(
                directory,
                "jeppiran-update.apk"
            )

        temp.delete()

        finalFile.delete()

        downloadFile(
            context =
                context,
            address =
                info.apkUrl,
            target =
                temp,
            expectedSha =
                info.sha256,
            onProgress =
                onProgress
        )

        require(
            temp.renameTo(
                finalFile
            )
        ) {
            "Unable to finalize APK download"
        }

        onProgress(
            100
        )

        return finalFile
    }

    private fun downloadFile(
        context: Context,
        address: String,
        target: File,
        expectedSha: String,
        onProgress: (Int) -> Unit
    ) {

        var connection:
            HttpURLConnection? =
            null

        try {

            connection =
                URL(
                    address +
                        if (
                            address.contains(
                                "?"
                            )
                        ) {
                            "&t=" +
                                System.currentTimeMillis()
                        } else {
                            "?t=" +
                                System.currentTimeMillis()
                        }
                )
                    .openConnection()
                    as HttpURLConnection

            connection.instanceFollowRedirects =
                true

            connection.useCaches =
                false

            connection.connectTimeout =
                TIMEOUT_MS

            connection.readTimeout =
                TIMEOUT_MS

            connection.requestMethod =
                "GET"

            connection.setRequestProperty(
                "User-Agent",
                "JEPPIRAN/" +
                    localVersion(
                        context
                    ).second +
                    " delta-updater"
            )

            connection.setRequestProperty(
                "Cache-Control",
                "no-cache"
            )

            connection.setRequestProperty(
                "Pragma",
                "no-cache"
            )

            val code =
                connection.responseCode

            require(
                code in
                    200..299
            ) {
                "Update download failed (HTTP " +
                    code +
                    ")"
            }

            val total =
                connection.contentLengthLong

            val digest =
                MessageDigest
                    .getInstance(
                        "SHA-256"
                    )

            var downloaded =
                0L

            var lastProgress =
                -1

            target.parentFile
                ?.mkdirs()

            target
                .outputStream()
                .use {
                    output ->

                    connection.inputStream
                        .use {
                            input ->

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

                                downloaded +=
                                    count

                                if (
                                    total >
                                    0L
                                ) {

                                    val progress =
                                        (
                                            downloaded *
                                                100L /
                                                total
                                            )
                                            .toInt()
                                            .coerceIn(
                                                0,
                                                100
                                            )

                                    if (
                                        progress !=
                                        lastProgress
                                    ) {

                                        lastProgress =
                                            progress

                                        onProgress(
                                            progress
                                        )
                                    }
                                }
                            }
                        }
                }

            require(
                target.length() >
                    0L
            ) {
                "Downloaded update file is empty"
            }

            val actualSha =
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
                actualSha.equals(
                    expectedSha,
                    ignoreCase =
                        true
                )
            ) {
                "Update checksum verification failed"
            }

        } finally {

            connection
                ?.disconnect()
        }
    }

    private fun localVersion(
        context: Context
    ):
        Pair<Long, String> {

        @Suppress(
            "DEPRECATION"
        )
        val info =
            context.packageManager
                .getPackageInfo(
                    context.packageName,
                    0
                )

        val code =
            if (
                Build.VERSION.SDK_INT >=
                Build.VERSION_CODES.P
            ) {
                info.longVersionCode
            } else {
                @Suppress(
                    "DEPRECATION"
                )
                info.versionCode
                    .toLong()
            }

        return code to
            info.versionName
                .orEmpty()
    }

    private fun sha256(
        file: File
    ): String {

        val digest =
            MessageDigest
                .getInstance(
                    "SHA-256"
                )

        file.inputStream()
            .use {
                input ->

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

                    digest.update(
                        buffer,
                        0,
                        count
                    )
                }
            }

        return digest
            .digest()
            .joinToString(
                ""
            ) {
                byte ->
                "%02x".format(
                    byte
                )
            }
    }

    private fun fetchText(
        address: String
    ): String {

        var connection:
            HttpURLConnection? =
            null

        try {

            connection =
                URL(
                    address
                )
                    .openConnection()
                    as HttpURLConnection

            connection.instanceFollowRedirects =
                true

            connection.useCaches =
                false

            connection.connectTimeout =
                TIMEOUT_MS

            connection.readTimeout =
                TIMEOUT_MS

            connection.requestMethod =
                "GET"

            connection.setRequestProperty(
                "User-Agent",
                "JEPPIRAN app-updater"
            )

            connection.setRequestProperty(
                "Cache-Control",
                "no-cache"
            )

            connection.setRequestProperty(
                "Pragma",
                "no-cache"
            )

            val code =
                connection.responseCode

            require(
                code in
                    200..299
            ) {
                "Update check failed (HTTP " +
                    code +
                    ")"
            }

            return connection
                .inputStream
                .bufferedReader()
                .use {
                    it.readText()
                }

        } finally {

            connection
                ?.disconnect()
        }
    }
}
