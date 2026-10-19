package com.tareghmsr.jeppiran

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.ForegroundInfo
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/** Persistent per-download state; independent of UpdateActivity lifecycle. */
object DurableUpdateQueue {
    const val TERMINAL = "terminal"
    const val ENROUTE = "enroute"
    const val APPLICATION = "application"
    private const val PREFS = "jeppiran_durable_updates_v1"
    private val types = setOf(TERMINAL, ENROUTE, APPLICATION)
    private const val APP_TARGET_VERSION = "application_target_version"

    /** The completed flag means only that a download finished, not that an
     * APK still needs installing. Reconcile it against the actual installed
     * package on every return to Updates (also handles old persisted states).
     * Never touch a queued/running/paused download. */
    @Suppress("DEPRECATION")
    fun pendingApplicationApk(context: Context): java.io.File? {
        if (state(context, APPLICATION) != "completed") return null
        val apk = java.io.File(context.cacheDir, "updates/jeppiran-update.apk")
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (!apk.isFile || apk.length() == 0L) {
            clearStagedApplication(context, "No verified APK is staged. Check for updates.")
            return null
        }

        // Old installers did not record the target. Recover it once from the
        // staged APK rather than leaving an immortal INSTALL button.
        var target = prefs.getLong(APP_TARGET_VERSION, -1L)
        if (target <= 0L) {
            val archive = context.packageManager.getPackageArchiveInfo(apk.absolutePath, 0)
            if (archive == null || archive.packageName != context.packageName) {
                clearStagedApplication(context, "Staged APK is invalid. Check for updates.")
                return null
            }
            target = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                archive.longVersionCode
            } else {
                archive.versionCode.toLong()
            }
            prefs.edit().putLong(APP_TARGET_VERSION, target).apply()
        }
        val installed = try {
            val info = context.packageManager.getPackageInfo(context.packageName, 0)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) info.longVersionCode
            else info.versionCode.toLong()
        } catch (_: Exception) {
            // A transient PackageManager failure must not lose a valid download.
            return apk
        }
        if (installed >= target) {
            clearStagedApplication(
                context, "JEPPIRAN is up to date • " + AppVersion.name(context)
            )
            return null
        }
        return apk
    }

    internal fun recordApplicationTarget(context: Context, versionCode: Long) {
        require(versionCode > 0L)
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putLong(APP_TARGET_VERSION, versionCode).apply()
    }

    private fun clearStagedApplication(context: Context, message: String) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(APPLICATION + "_state", "idle")
            .putInt(APPLICATION + "_progress", 0)
            .putString(APPLICATION + "_detail", message)
            .remove(APP_TARGET_VERSION)
            .remove(APPLICATION + "_paused")
            .apply()
        java.io.File(context.cacheDir, "updates/jeppiran-update.apk").delete()
    }

    fun enqueue(context: Context, type: String) {
        require(type in types)
        val app = context.applicationContext
        val request = OneTimeWorkRequestBuilder<DurableUpdateWorker>()
            .setInputData(workDataOf("type" to type))
            .setConstraints(Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED).build())
            .addTag("jeppiran-update-" + type)
            .build()
        if (type == APPLICATION) {
            // No previous completed APK/version can be reused as a new target.
            app.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit().remove(APP_TARGET_VERSION).apply()
        }
        record(app, type, "queued", 0, "Waiting for network")
        app.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putBoolean(type + "_paused", false).apply()
        WorkManager.getInstance(app).enqueueUniqueWork(
            "jeppiran-update-download-" + type, ExistingWorkPolicy.KEEP, request)
    }
    fun state(context: Context, type: String): String =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(type + "_state", "idle") ?: "idle"
    fun progress(context: Context, type: String): Int =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getInt(type + "_progress", 0)
    fun detail(context: Context, type: String): String =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(type + "_detail", "") ?: ""
    fun isPaused(context: Context, type: String): Boolean =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getBoolean(type + "_paused", false)
    fun togglePause(context: Context, type: String) {
        if (state(context, type) !in setOf("running", "paused", "queued")) return
        val paused = !isPaused(context, type)
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putBoolean(type + "_paused", paused)
            .putString(type + "_state", if (paused) "paused" else "running")
            .apply()
    }
    internal fun record(context: Context, type: String, state: String,
                        progress: Int, detail: String) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(type + "_state", state)
            .putInt(type + "_progress", progress.coerceIn(0, 100))
            .putString(type + "_detail", detail).apply()
    }
}

/** WorkManager foreground job keeps transfers running after navigating away. */
class DurableUpdateWorker(ctx: Context, params: WorkerParameters) : Worker(ctx, params) {
    companion object {
        private const val CHANNEL = "jeppiran-update-downloads"
        private const val REMOTE =
            "https://raw.githubusercontent.com/mahmet737ng-gif/JeppIran/main/app/src/main/assets/"
        private const val RELEASE =
            "https://github.com/mahmet737ng-gif/JeppIran/releases/download/"
    }
    private val type = inputData.getString("type") ?: ""
    private var percentage = 0
    override fun doWork(): Result {
        if (type !in setOf(DurableUpdateQueue.TERMINAL,
                DurableUpdateQueue.ENROUTE, DurableUpdateQueue.APPLICATION)) return Result.failure()
        setForegroundAsync(foreground("Starting download", 0)).get()
        try {
            checkpoint()
            when (type) {
                DurableUpdateQueue.TERMINAL -> terminal()
                DurableUpdateQueue.ENROUTE -> enroute()
                DurableUpdateQueue.APPLICATION -> application()
            }
            update(100, if (type == DurableUpdateQueue.APPLICATION)
                "Verified APK ready. Return to Update to install."
                else "Verified update installed.", "completed")
            return Result.success()
        } catch (error: InterruptedException) {
            Thread.currentThread().interrupt()
            return Result.retry()
        } catch (error: Throwable) {
            DurableUpdateQueue.record(applicationContext, type, "failed", percentage,
                error.message ?: "Download failed; previous version retained")
            return Result.failure()
        }
    }
    private fun checkpoint() {
        if (isStopped || Thread.currentThread().isInterrupted) throw InterruptedException()
        var notified = false
        while (DurableUpdateQueue.isPaused(applicationContext, type)) {
            if (isStopped || Thread.currentThread().isInterrupted) throw InterruptedException()
            if (!notified) {
                DurableUpdateQueue.record(applicationContext, type, "paused", percentage,
                    "Paused • Resume from Update")
                setForegroundAsync(foreground("Paused", percentage)).get()
                notified = true
            }
            Thread.sleep(250)
        }
        if (notified) update(percentage, "Resuming", "running")
    }
    private fun update(percent: Int, detail: String, state: String = "running") {
        percentage = percent.coerceIn(0, 100)
        DurableUpdateQueue.record(applicationContext, type, state, percentage, detail)
        if (percentage % 10 == 0 || state != "running")
            setForegroundAsync(foreground(detail, percentage)).get()
    }
    private fun foreground(detail: String, percent: Int): ForegroundInfo {
        val ctx = applicationContext
        val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= 26)
            nm.createNotificationChannel(NotificationChannel(
                CHANNEL, "JeppIran Updates", NotificationManager.IMPORTANCE_LOW))
        val pi = PendingIntent.getActivity(ctx, 104,
            Intent(ctx, UpdateActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val note = NotificationCompat.Builder(ctx, CHANNEL)
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setContentTitle("JeppIran • " + type)
            .setContentText(detail).setContentIntent(pi)
            .setOngoing(true).setOnlyAlertOnce(true)
            .setProgress(100, percent, percent == 0).build()
        val id = 600 + when (type) {
            DurableUpdateQueue.TERMINAL -> 1
            DurableUpdateQueue.ENROUTE -> 2
            else -> 3
        }
        return if (Build.VERSION.SDK_INT >= 29)
            ForegroundInfo(id, note, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        else ForegroundInfo(id, note)
    }
    private fun getText(address: String): String {
        checkpoint()
        require(address.startsWith("https://")) { "An HTTPS update URL is required" }
        val connection = URL(address).openConnection() as HttpURLConnection
        try {
            connection.instanceFollowRedirects = true
            connection.connectTimeout = 25000
            connection.readTimeout = 30000
            connection.setRequestProperty("User-Agent", "JeppIran Verified Updater")
            require(connection.responseCode in 200..299) {
                "Update server HTTP " + connection.responseCode
            }
            return connection.inputStream.bufferedReader().use { reader ->
                val out = StringBuilder()
                val buffer = CharArray(8192)
                while (true) {
                    checkpoint()
                    val n = reader.read(buffer)
                    if (n < 0) break
                    out.append(buffer, 0, n)
                }
                out.toString()
            }
        } finally { connection.disconnect() }
    }
    private fun terminal() {
        val context = applicationContext
        update(5, "Checking Terminal Charts")
        val raw = getText(REMOTE + "charts-manifest.json")
        val json = JSONObject(raw)
        val version = json.getString("version")
        val tag = json.getString("release_tag")
        require(version.isNotBlank() && tag.matches(Regex("[A-Za-z0-9._-]+"))) {
            "Invalid chart manifest"
        }
        update(25, "Downloading chart index")
        val charts = getText(REMOTE + "charts-current.json")
        update(50, "Downloading georeferences")
        val geo = getText(RELEASE + tag + "/chart-georef.json")
        update(75, "Verifying and staging chart data")
        val changes = try { getText(REMOTE + "chart-changes.json") }
            catch (_: Exception) { "" }
        checkpoint()
        ChartUpdateStore.activate(context, version, raw, charts, geo, changes)
        ChartRepository(context).reload()
    }
    private fun enroute() {
        update(2, "Reading Enroute manifest")
        val raw = getText(REMOTE + "enroute-manifest.json")
        val info = EnrouteUpdateStore.parseInfo(raw)
        require(info.published && info.fileCount > 0) { "Enroute package not published" }
        checkpoint()
        EnrouteUpdateStore.activate(applicationContext, raw,
            onProgress = { progress ->
                checkpoint()
                update(progress, "Enroute " + info.cycle + " • " + progress + "%")
            }, onCheckpoint = { checkpoint() })
    }
    private fun application() {
        require(!applicationContext.packageName.endsWith(".phoneqa")) {
            "QA APKs are updated through the separate test build"
        }
        update(1, "Checking published application version")
        val check = AppUpdateManager.check(applicationContext)
        require(check.updateAvailable && check.remote != null) { "Already up to date" }
        checkpoint()
        AppUpdateManager.downloadAndVerify(applicationContext, check.remote) { progress ->
            checkpoint()
            update(progress, "Verifying APK • " + progress + "%")
        }
        // Write target only AFTER the signed APK has been reconstructed or
        // downloaded and verified. doWork() then marks the queue completed.
        DurableUpdateQueue.recordApplicationTarget(
            applicationContext, check.remote.versionCode
        )
    }
}
