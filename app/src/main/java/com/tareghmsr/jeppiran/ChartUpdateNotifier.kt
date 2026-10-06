package com.tareghmsr.jeppiran

import android.app.Activity
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.widget.Toast
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale
import kotlin.concurrent.thread

object ChartUpdateNotifier {

    data class UpdateNotice(
        val version: String,
        val changedAirports: List<String>
    ) {
        val signature:
            String
            get() =
                version +
                    ":" +
                    changedAirports
                        .joinToString(
                            ","
                        )
    }


    private const val REMOTE_MANIFEST =
        "https://raw.githubusercontent.com/mahmet737ng-gif/JeppIran/main/app/src/main/assets/charts-manifest.json"

    private const val PREFS =
        "jeppiran_update_notifications"

    private const val LAST_NOTICE =
        "last_notice"

    private const val CHANNEL =
        "chart_updates"

    private const val NOTIFICATION_ID =
        2620


    fun check(
        context: Context,
        callback: (UpdateNotice?) -> Unit
    ) {

        val appContext =
            context.applicationContext


        thread(
            name =
                "JeppIran-UpdateNotifier"
        ) {

            val notice =
                runCatching {

                    val remote =
                        JSONObject(
                            fetchText(
                                REMOTE_MANIFEST
                            )
                        )


                    val version =
                        remote.optString(
                            "version"
                        )
                            .trim()


                    if (
                        version.isBlank()
                    ) {
                        return@runCatching null
                    }


                    val repository =
                        ChartRepository(
                            appContext
                        )


                    val remoteAirports =
                        remote.optJSONObject(
                            "airports"
                        )
                            ?: return@runCatching null


                    val changed =
                        mutableListOf<String>()


                    val keys =
                        remoteAirports.keys()


                    while (
                        keys.hasNext()
                    ) {

                        val icao =
                            keys.next()
                                .trim()
                                .uppercase(
                                    Locale.US
                                )


                        val remoteItem =
                            remoteAirports
                                .optJSONObject(
                                    icao
                                )
                                    ?: continue


                        val remoteSha =
                            remoteItem
                                .optString(
                                    "sha256"
                                )


                        val localSha =
                            repository
                                .getAirportPdfInfo(
                                    icao
                                )
                                .sha256


                        if (
                            remoteSha.isBlank() ||
                            localSha.isBlank() ||
                            remoteSha !=
                                localSha
                        ) {

                            changed.add(
                                icao
                            )
                        }
                    }


                    val localVersion =
                        repository
                            .getDataVersion()


                    if (
                        version ==
                            localVersion &&
                        changed.isEmpty()
                    ) {

                        null

                    } else {

                        UpdateNotice(
                            version,
                            changed.sorted()
                        )
                    }

                }
                    .getOrNull()


            callback(
                notice
            )
        }
    }


    fun postNotification(
        context: Context,
        notice: UpdateNotice
    ) {

        val prefs =
            context.getSharedPreferences(
                PREFS,
                Context.MODE_PRIVATE
            )


        if (
            prefs.getString(
                LAST_NOTICE,
                ""
            ) ==
            notice.signature
        ) {
            return
        }


        val manager =
            context.getSystemService(
                Context.NOTIFICATION_SERVICE
            )
                as NotificationManager


        if (
            Build.VERSION.SDK_INT >=
            Build.VERSION_CODES.O
        ) {

            manager.createNotificationChannel(
                NotificationChannel(
                    CHANNEL,
                    "Chart updates",
                    NotificationManager
                        .IMPORTANCE_DEFAULT
                ).apply {

                    description =
                        "JEPPIRAN airport chart-cycle updates"
                }
            )
        }


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


        val count =
            notice.changedAirports.size


        val text =
            if (
                count > 0
            ) {

                buildString {

                    append(
                        "Updated: "
                    )

                    notice.changedAirports
                        .forEachIndexed {
                            index,
                            icao ->

                            if (
                                index >
                                0
                            ) {

                                append(
                                    "\n"
                                )
                            }


                            val airportName =
                                ChartRepository
                                    .airport(
                                        icao
                                    )
                                    ?.airportName
                                    .orEmpty()


                            append(
                                "• "
                            )

                            append(
                                icao
                            )


                            if (
                                airportName.isNotBlank()
                            ) {

                                append(
                                    " — "
                                )

                                append(
                                    airportName
                                )
                            }
                        }


                    append(
                        "\nTap to update."
                    )
                }

            } else {

                "New chart data " +
                    notice.version +
                    " is available."
            }


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

                @Suppress(
                    "DEPRECATION"
                )
                android.app.Notification
                    .Builder(
                        context
                    )
            }


        builder
            .setSmallIcon(
                R.drawable.ic_jeppiran_launcher
            )
            .setContentTitle(
                if (
                    count ==
                    1
                ) {

                    notice.changedAirports
                        .firstOrNull()
                        ?.let {
                            icao ->

                            icao +
                                " chart updated"
                        }
                        ?: "JEPPIRAN chart update"

                } else {

                    "JEPPIRAN • " +
                        count +
                        " airports updated"
                }
            )
            .setContentText(
                text
            )
            .setStyle(
                android.app.Notification
                    .BigTextStyle()
                    .bigText(
                        text
                    )
            )
            .setAutoCancel(
                true
            )
            .setContentIntent(
                pending
            )


        manager.notify(
            NOTIFICATION_ID,
            builder.build()
        )


        prefs.edit()
            .putString(
                LAST_NOTICE,
                notice.signature
            )
            .apply()
    }


    fun showInAppNotice(
        activity: Activity,
        notice: UpdateNotice
    ) {

        val prefs =
            activity.getSharedPreferences(
                PREFS,
                Context.MODE_PRIVATE
            )


        if (
            prefs.getString(
                LAST_NOTICE,
                ""
            ) ==
            notice.signature
        ) {
            return
        }


        val count =
            notice.changedAirports.size


        Toast.makeText(
            activity,
            if (
                count > 0
            ) {

                notice.changedAirports
                    .joinToString(
                        prefix =
                            "Updated: ",
                        separator =
                            ", "
                    ) +
                    ". Open Update."

            } else {

                "New chart data available. Open Update."
            },
            Toast.LENGTH_LONG
        ).show()


        prefs.edit()
            .putString(
                LAST_NOTICE,
                notice.signature
            )
            .apply()
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


            connection.connectTimeout =
                12000

            connection.readTimeout =
                12000

            connection.requestMethod =
                "GET"

            connection.setRequestProperty(
                "User-Agent",
                "JEPPIRAN/" + BuildConfig.VERSION_NAME + " update notifier"
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
