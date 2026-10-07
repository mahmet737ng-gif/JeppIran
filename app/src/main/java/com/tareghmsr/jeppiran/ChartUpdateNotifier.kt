package com.tareghmsr.jeppiran

import android.app.Activity
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.widget.Toast
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import kotlin.concurrent.thread

object ChartUpdateNotifier {

    data class UpdateNotice(
        val version: String,
        val cycle: String,
        val effectiveFrom: String,
        val effectiveTo: String,
        val changedAirports: List<String>
    ) {
        val signature: String
            get() =
                listOf(
                    "data",
                    version,
                    cycle,
                    effectiveFrom,
                    effectiveTo,
                    changedAirports.joinToString(",")
                ).joinToString(":")
    }

    private const val REMOTE_MANIFEST =
        "https://raw.githubusercontent.com/mahmet737ng-gif/JeppIran/main/app/src/main/assets/charts-manifest.json"

    private const val REMOTE_ENROUTE_MANIFEST =
        "https://raw.githubusercontent.com/mahmet737ng-gif/JeppIran/main/app/src/main/assets/enroute-manifest.json"

    private const val PREFS =
        "jeppiran_update_notifications"

    private const val LAST_DATA_NOTICE =
        "last_data_notice"

    private const val LAST_APP_NOTICE =
        "last_app_notice"

    private const val LAST_ENROUTE_NOTICE =
        "last_enroute_notice"

    private const val CHANNEL =
        "jeppiran_updates"

    private const val DATA_NOTIFICATION_ID =
        26201

    private const val APP_NOTIFICATION_ID =
        26202

    private const val ENROUTE_NOTIFICATION_ID =
        26203

    fun check(
        context: Context,
        callback: (UpdateNotice?) -> Unit
    ) {
        val appContext = context.applicationContext

        thread(
            name = "JeppIran-DataUpdateNotifier"
        ) {
            val notice =
                runCatching {
                    checkSync(appContext)
                }.getOrNull()

            callback(notice)
        }
    }

    fun checkSync(
        context: Context
    ): UpdateNotice? {
        val remote =
            JSONObject(
                fetchText(
                    context,
                    REMOTE_MANIFEST
                )
            )

        val version =
            remote.optString("version")
                .trim()

        if (version.isBlank()) {
            return null
        }

        val cycle =
            remote.optString("cycle")
                .trim()
                .ifBlank {
                    extractCycle(
                        remote.optString("source")
                    )
                }
                .ifBlank {
                    version.removePrefix("v")
                }

        val effectiveFrom =
            remote.optString("effective_from")
                .trim()

        val effectiveTo =
            remote.optString("effective_to")
                .trim()

        val repository =
            ChartRepository(context)

        val remoteAirports =
            remote.optJSONObject("airports")
                ?: return null

        val changed =
            mutableListOf<String>()

        val keys =
            remoteAirports.keys()

        while (keys.hasNext()) {
            val icao =
                keys.next()
                    .trim()
                    .uppercase(Locale.US)

            val remoteItem =
                remoteAirports
                    .optJSONObject(icao)
                    ?: continue

            val remoteSha =
                remoteItem
                    .optString("sha256")

            val localSha =
                repository
                    .getAirportPdfInfo(icao)
                    .sha256

            if (
                remoteSha.isBlank() ||
                localSha.isBlank() ||
                remoteSha != localSha
            ) {
                changed.add(icao)
            }
        }

        val localVersion =
            repository.getDataVersion()

        if (
            version == localVersion &&
            changed.isEmpty()
        ) {
            return null
        }

        return UpdateNotice(
            version = version,
            cycle = cycle,
            effectiveFrom = effectiveFrom,
            effectiveTo = effectiveTo,
            changedAirports = changed.sorted()
        )
    }

    fun checkEnrouteSync(
        context: Context
    ): EnrouteUpdateStore.ManifestInfo? {

        val raw =
            fetchText(
                context,
                REMOTE_ENROUTE_MANIFEST
            )

        val info =
            EnrouteUpdateStore
                .parseInfo(
                    raw
                )

        if (
            !info.published ||
            info.fileCount <=
                0
        ) {
            return null
        }

        val activeCycle =
            EnrouteUpdateStore
                .activeCycle(
                    context
                )

        return if (
            activeCycle ==
                info.cycle
        ) {
            null
        } else {
            info
        }
    }


    fun postEnrouteNotification(
        context: Context,
        info: EnrouteUpdateStore.ManifestInfo
    ) {
        if (
            !notificationsAllowed(
                context
            )
        ) {
            return
        }

        val signature =
            listOf(
                "enroute",
                info.cycle,
                info.products,
                info.effectiveFrom,
                info.effectiveTo
            )
                .joinToString(
                    ":"
                )

        val prefs =
            context
                .getSharedPreferences(
                    PREFS,
                    Context.MODE_PRIVATE
                )

        if (
            prefs.getString(
                LAST_ENROUTE_NOTICE,
                ""
            ) ==
            signature
        ) {
            return
        }

        val manager =
            notificationManager(
                context
            )

        ensureChannel(
            manager
        )

        val validity =
            validityText(
                info.effectiveFrom,
                info.effectiveTo
            )

        val title =
            "JEPPIRAN • Enroute Data " +
                info.cycle

        val text =
            buildString {
                append(
                    "Enroute Data "
                )

                append(
                    info.cycle
                )

                if (
                    info.products.isNotBlank()
                ) {
                    append(
                        " • "
                    )

                    append(
                        info.products
                    )
                }

                append(
                    " is available"
                )

                if (
                    validity.isNotBlank()
                ) {
                    append(
                        " • Valid "
                    )

                    append(
                        validity
                    )
                }

                append(
                    ". Tap to update."
                )
            }

        manager.notify(
            ENROUTE_NOTIFICATION_ID,
            notificationBuilder(
                context,
                title,
                text
            )
                .build()
        )

        prefs.edit()
            .putString(
                LAST_ENROUTE_NOTICE,
                signature
            )
            .apply()
    }


    fun notificationsAllowed(
        context: Context
    ): Boolean =
        Build.VERSION.SDK_INT < 33 ||
            context.checkSelfPermission(
                android.Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED

    fun postNotification(
        context: Context,
        notice: UpdateNotice
    ) {
        if (!notificationsAllowed(context)) {
            return
        }

        val prefs =
            context.getSharedPreferences(
                PREFS,
                Context.MODE_PRIVATE
            )

        if (
            prefs.getString(
                LAST_DATA_NOTICE,
                ""
            ) == notice.signature
        ) {
            return
        }

        val manager =
            notificationManager(context)

        ensureChannel(manager)

        val validity =
            validityText(
                notice.effectiveFrom,
                notice.effectiveTo
            )

        val title =
            if (notice.cycle.isNotBlank()) {
                "JEPPIRAN • Terminal Charts " +
                    notice.cycle
            } else {
                "JEPPIRAN • Terminal Charts Update"
            }

        val text =
            buildString {
                if (notice.cycle.isNotBlank()) {
                    append("Terminal Charts ")
                    append(notice.cycle)
                    append(" is available")
                } else {
                    append("New Terminal Charts data is available")
                }

                if (validity.isNotBlank()) {
                    append(" • Valid ")
                    append(validity)
                }

                append(". Tap to update.")
            }

        manager.notify(
            DATA_NOTIFICATION_ID,
            notificationBuilder(
                context,
                title,
                text
            ).build()
        )

        prefs.edit()
            .putString(
                LAST_DATA_NOTICE,
                notice.signature
            )
            .apply()
    }

    fun postAppNotification(
        context: Context,
        info: AppUpdateManager.UpdateInfo
    ) {
        if (!notificationsAllowed(context)) {
            return
        }

        val signature =
            "app:" +
                info.versionCode +
                ":" +
                info.versionName

        val prefs =
            context.getSharedPreferences(
                PREFS,
                Context.MODE_PRIVATE
            )

        if (
            prefs.getString(
                LAST_APP_NOTICE,
                ""
            ) == signature
        ) {
            return
        }

        val manager =
            notificationManager(context)

        ensureChannel(manager)

        val title =
            "JEPPIRAN • App Update"

        val text =
            "JEPPIRAN " +
                info.versionName +
                " is available. Tap to review and install the new app version."

        manager.notify(
            APP_NOTIFICATION_ID,
            notificationBuilder(
                context,
                title,
                text
            ).build()
        )

        prefs.edit()
            .putString(
                LAST_APP_NOTICE,
                signature
            )
            .apply()
    }

    fun showInAppNotice(
        activity: Activity,
        notice: UpdateNotice
    ) {
        val validity =
            validityText(
                notice.effectiveFrom,
                notice.effectiveTo
            )

        val text =
            buildString {
                if (notice.cycle.isNotBlank()) {
                    append("Data Cycle ")
                    append(notice.cycle)
                    append(" is available")
                } else {
                    append("New chart data is available")
                }

                if (validity.isNotBlank()) {
                    append(" • Valid ")
                    append(validity)
                }

                append(". Open Update.")
            }

        Toast.makeText(
            activity,
            text,
            Toast.LENGTH_LONG
        ).show()
    }

    private fun notificationBuilder(
        context: Context,
        title: String,
        text: String
    ): android.app.Notification.Builder {
        val intent =
            Intent(
                context,
                UpdateActivity::class.java
            )

        val pending =
            PendingIntent.getActivity(
                context,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or
                    PendingIntent.FLAG_IMMUTABLE
            )

        val builder =
            if (
                Build.VERSION.SDK_INT >=
                Build.VERSION_CODES.O
            ) {
                android.app.Notification
                    .Builder(
                        context,
                        CHANNEL
                    )
            } else {
                @Suppress("DEPRECATION")
                android.app.Notification
                    .Builder(context)
            }

        return builder
            .setSmallIcon(
                R.drawable.ic_jeppiran_launcher
            )
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(
                android.app.Notification
                    .BigTextStyle()
                    .bigText(text)
            )
            .setAutoCancel(true)
            .setContentIntent(pending)
    }

    private fun notificationManager(
        context: Context
    ): NotificationManager =
        context.getSystemService(
            Context.NOTIFICATION_SERVICE
        ) as NotificationManager

    private fun ensureChannel(
        manager: NotificationManager
    ) {
        if (
            Build.VERSION.SDK_INT >=
            Build.VERSION_CODES.O
        ) {
            manager.createNotificationChannel(
                NotificationChannel(
                    CHANNEL,
                    "JEPPIRAN updates",
                    NotificationManager.IMPORTANCE_DEFAULT
                ).apply {
                    description =
                        "Application and chart data-cycle updates"
                }
            )
        }
    }

    private fun extractCycle(
        source: String
    ): String =
        Regex("(\\d{4})")
            .find(source)
            ?.groupValues
            ?.getOrNull(1)
            .orEmpty()

    private fun validityText(
        from: String,
        to: String
    ): String {
        if (
            from.isBlank() ||
            to.isBlank()
        ) {
            return ""
        }

        val input =
            SimpleDateFormat(
                "yyyy-MM-dd",
                Locale.US
            ).apply {
                isLenient = false
                timeZone =
                    TimeZone.getTimeZone("UTC")
            }

        val output =
            SimpleDateFormat(
                "d MMM",
                Locale.US
            ).apply {
                timeZone =
                    TimeZone.getTimeZone("UTC")
            }

        return runCatching {
            val start =
                input.parse(from)
                    ?: return@runCatching ""

            val end =
                input.parse(to)
                    ?: return@runCatching ""

            output.format(start) +
                "–" +
                output.format(end)
        }.getOrDefault("")
    }

    private fun fetchText(
        context: Context,
        address: String
    ): String {
        var connection: HttpURLConnection? =
            null

        try {
            connection =
                URL(address)
                    .openConnection()
                    as HttpURLConnection

            connection.connectTimeout =
                12000

            connection.readTimeout =
                12000

            connection.requestMethod =
                "GET"

            connection.setRequestProperty(
                "User-Agent",
                "JEPPIRAN/" +
                    AppVersion.name(context) +
                    " update notifier"
            )

            val code =
                connection.responseCode

            if (
                code !in
                200..299
            ) {
                error(
                    "HTTP " +
                        code
                )
            }

            return connection
                .inputStream
                .bufferedReader()
                .use {
                    reader ->
                    reader.readText()
                }
        } finally {
            connection?.disconnect()
        }
    }
}
