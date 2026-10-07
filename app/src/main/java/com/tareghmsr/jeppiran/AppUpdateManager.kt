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

    data class UpdateInfo(
        val versionCode: Long,
        val versionName: String,
        val apkUrl: String,
        val sha256: String,
        val publishedAt: String
    )

    data class CheckResult(
        val currentVersionCode: Long,
        val currentVersionName: String,
        val remote: UpdateInfo?,
        val updateAvailable: Boolean
    )

    private const val UPDATE_INFO_URL =
        "https://github.com/mahmet737ng-gif/JeppIran/releases/download/jeppiran-test/app-update.json"

    private const val TIMEOUT_MS = 30000

    fun check(context: Context): CheckResult {
        val local = localVersion(context)
        val remote = JSONObject(fetchText(UPDATE_INFO_URL)).let { root ->
            UpdateInfo(
                versionCode = root.getLong("versionCode"),
                versionName = root.getString("versionName"),
                apkUrl = root.getString("apkUrl"),
                sha256 = root.getString("sha256").trim().lowercase(),
                publishedAt = root.optString("publishedAt")
            )
        }

        require(remote.apkUrl.startsWith("https://")) {
            "Invalid APK URL"
        }

        require(remote.sha256.matches(Regex("[0-9a-f]{64}"))) {
            "Invalid APK checksum"
        }

        return CheckResult(
            currentVersionCode = local.first,
            currentVersionName = local.second,
            remote = remote,
            updateAvailable = remote.versionCode > local.first
        )
    }

    fun canInstallPackages(context: Context): Boolean {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.O ||
            context.packageManager.canRequestPackageInstalls()
    }

    fun openInstallPermission(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val intent = Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + context.packageName)
            )
            context.startActivity(intent)
        }
    }

    fun downloadAndVerify(
        context: Context,
        info: UpdateInfo,
        onProgress: (Int) -> Unit
    ): File {
        val dir = File(context.cacheDir, "updates")
        if (!dir.exists()) dir.mkdirs()

        val temp = File(dir, "jeppiran-update.part")
        val finalFile = File(dir, "jeppiran-update.apk")
        temp.delete()
        finalFile.delete()

        var connection: HttpURLConnection? = null
        try {
            connection = URL(info.apkUrl).openConnection() as HttpURLConnection
            connection.instanceFollowRedirects = true
            connection.connectTimeout = TIMEOUT_MS
            connection.readTimeout = TIMEOUT_MS
            connection.requestMethod = "GET"
            connection.setRequestProperty(
                "User-Agent",
                "JEPPIRAN/" + localVersion(context).second + " app-updater"
            )

            val code = connection.responseCode
            require(code in 200..299) {
                "APK download failed (HTTP $code)"
            }

            val total = connection.contentLengthLong
            val digest = MessageDigest.getInstance("SHA-256")
            var downloaded = 0L
            var lastProgress = -1

            connection.inputStream.use { input ->
                temp.outputStream().use { output ->
                    val buffer = ByteArray(64 * 1024)
                    while (true) {
                        val count = input.read(buffer)
                        if (count <= 0) break

                        output.write(buffer, 0, count)
                        digest.update(buffer, 0, count)
                        downloaded += count

                        if (total > 0L) {
                            val progress =
                                ((downloaded * 100L) / total)
                                    .toInt()
                                    .coerceIn(0, 100)

                            if (progress != lastProgress) {
                                lastProgress = progress
                                onProgress(progress)
                            }
                        }
                    }
                }
            }

            require(temp.length() > 0L) {
                "Downloaded APK is empty"
            }

            val actualSha = digest.digest().joinToString("") {
                "%02x".format(it)
            }

            require(actualSha.equals(info.sha256, ignoreCase = true)) {
                "APK checksum verification failed"
            }

            require(temp.renameTo(finalFile)) {
                "Unable to finalize APK download"
            }

            onProgress(100)
            return finalFile
        } finally {
            connection?.disconnect()
            if (temp.exists() && !finalFile.exists()) {
                temp.delete()
            }
        }
    }

    fun launchInstaller(context: Context, apk: File) {
        require(apk.isFile && apk.length() > 0L) {
            "APK file is missing"
        }

        val uri = FileProvider.getUriForFile(
            context,
            context.packageName + ".fileprovider",
            apk
        )

        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }

        context.startActivity(intent)
    }

    private fun localVersion(context: Context): Pair<Long, String> {
        @Suppress("DEPRECATION")
        val info = context.packageManager.getPackageInfo(
            context.packageName,
            0
        )

        val code =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                info.longVersionCode
            } else {
                @Suppress("DEPRECATION")
                info.versionCode.toLong()
            }

        return code to info.versionName.orEmpty()
    }

    private fun fetchText(address: String): String {
        var connection: HttpURLConnection? = null

        try {
            connection = URL(address).openConnection() as HttpURLConnection
            connection.instanceFollowRedirects = true
            connection.connectTimeout = TIMEOUT_MS
            connection.readTimeout = TIMEOUT_MS
            connection.requestMethod = "GET"
            connection.setRequestProperty(
                "User-Agent",
                "JEPPIRAN app-updater"
            )

            val code = connection.responseCode
            require(code in 200..299) {
                "Update check failed (HTTP $code)"
            }

            return connection.inputStream
                .bufferedReader()
                .use { it.readText() }
        } finally {
            connection?.disconnect()
        }
    }
}
