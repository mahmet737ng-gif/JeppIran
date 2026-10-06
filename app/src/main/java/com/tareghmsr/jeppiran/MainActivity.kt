package com.tareghmsr.jeppiran

import android.content.Intent
import android.os.Bundle
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.widget.CheckBox
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AlertDialog
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.activity.result.contract.ActivityResultContracts
import android.content.pm.PackageManager
import android.os.Build

class MainActivity :
    AppCompatActivity() {

    private var pendingUpdateNotice:
        ChartUpdateNotifier.UpdateNotice? =
        null

    private val notificationPermissionLauncher =
        registerForActivityResult(
            ActivityResultContracts.RequestPermission()
        ) { granted ->

            val notice =
                pendingUpdateNotice

            pendingUpdateNotice =
                null

            if (
                granted &&
                notice != null
            ) {

                ChartUpdateNotifier
                    .postNotification(
                        this,
                        notice
                    )

            } else if (
                notice != null
            ) {

                ChartUpdateNotifier
                    .showInAppNotice(
                        this,
                        notice
                    )
            }
        }

    private fun currentVersionCode(): Long {

        val info =
            packageManager.getPackageInfo(
                packageName,
                0
            )

        return if (
            Build.VERSION.SDK_INT >= 28
        ) {
            info.longVersionCode
        } else {
            @Suppress("DEPRECATION")
            info.versionCode.toLong()
        }
    }

    private fun showUsageNoticeIfNeeded() {

        val prefs =
            getSharedPreferences(
                "jeppiran_usage_notice",
                MODE_PRIVATE
            )

        val versionCode =
            currentVersionCode()

        if (
            prefs.getLong(
                "accepted_hide_version",
                -1L
            ) == versionCode
        ) {
            return
        }

        val dark =
            resources.configuration.uiMode and
                android.content.res.Configuration.UI_MODE_NIGHT_MASK ==
                android.content.res.Configuration.UI_MODE_NIGHT_YES

        val panel =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.VERTICAL

                setPadding(
                    22.dp,
                    20.dp,
                    22.dp,
                    16.dp
                )

                background =
                    GradientDrawable().apply {

                        cornerRadius =
                            22.dp.toFloat()

                        setColor(
                            if (
                                dark
                            ) {
                                Color.rgb(
                                    3,
                                    18,
                                    42
                                )
                            } else {
                                Color.rgb(
                                    247,
                                    251,
                                    255
                                )
                            }
                        )

                        setStroke(
                            1.dp,
                            if (
                                dark
                            ) {
                                Color.rgb(
                                    0,
                                    184,
                                    255
                                )
                            } else {
                                Color.rgb(
                                    26,
                                    116,
                                    190
                                )
                            }
                        )
                    }
            }

        panel.addView(
            TextView(
                this
            ).apply {

                text =
                    "IMPORTANT NOTICE"

                textSize =
                    20f

                typeface =
                    Typeface.DEFAULT_BOLD

                gravity =
                    Gravity.CENTER

                setTextColor(
                    if (
                        dark
                    ) {
                        Color.WHITE
                    } else {
                        Color.rgb(
                            5,
                            31,
                            57
                        )
                    }
                )
            }
        )

        panel.addView(
            TextView(
                this
            ).apply {

                text =
                    "This App is for personal use only.\n\n" +
                        "DO NOT use for Actual Navigation.\n\n" +
                        "Commercial and/or public use by individuals or legal entities, " +
                        "including flight schools, airlines, organizations, or any other " +
                        "commercial users, requires the developer's prior consent."

                textSize =
                    14f

                setPadding(
                    0,
                    16.dp,
                    0,
                    10.dp
                )

                setTextColor(
                    if (
                        dark
                    ) {
                        Color.rgb(
                            220,
                            231,
                            241
                        )
                    } else {
                        Color.rgb(
                            42,
                            56,
                            71
                        )
                    }
                )
            }
        )

        val dontShowAgain =
            CheckBox(
                this
            ).apply {

                text =
                    "I understand and don't show again"

                setTextColor(
                    if (
                        dark
                    ) {
                        Color.WHITE
                    } else {
                        Color.rgb(
                            5,
                            31,
                            57
                        )
                    }
                )
            }

        panel.addView(
            dontShowAgain
        )

        val dialog =
            AlertDialog.Builder(
                this
            )
                .setView(
                    panel
                )
                .setPositiveButton(
                    "AGREE",
                    null
                )
                .setCancelable(
                    false
                )
                .create()

        dialog.setCanceledOnTouchOutside(
            false
        )

        dialog.setOnShowListener {

            dialog.getButton(
                AlertDialog.BUTTON_POSITIVE
            ).setOnClickListener {

                if (
                    dontShowAgain.isChecked
                ) {

                    prefs.edit()
                        .putLong(
                            "accepted_hide_version",
                            versionCode
                        )
                        .apply()
                }

                dialog.dismiss()
            }
        }

        dialog.show()
    }


    override fun onCreate(
        savedInstanceState: Bundle?
    ) {

        ThemeManager.apply(
            this
        )

        super.onCreate(
            savedInstanceState
        )

        enableEdgeToEdge()

        setContentView(
            R.layout.activity_main
        )

        showUsageNoticeIfNeeded()

        val mainView =
            findViewById<android.view.View>(
                R.id.main
            )

        ViewCompat.setOnApplyWindowInsetsListener(
            mainView
        ) { view, insets ->

            val systemBars =
                insets.getInsets(
                    WindowInsetsCompat.Type.systemBars()
                )

            view.setPadding(
                systemBars.left + 16,
                systemBars.top + 16,
                systemBars.right + 16,
                systemBars.bottom + 16
            )

            insets
        }

        findViewById<android.widget.TextView>(
            R.id.versionText
        ).text = AppVersion.name(this)

        findViewById<android.view.View>(
            R.id.cardCharts
        ).setOnClickListener {

            startActivity(
                Intent(
                    this,
                    ChartsActivity::class.java
                )
            )
        }

        findViewById<android.view.View>(
            R.id.cardEnroute
        ).setOnClickListener {
            startActivity(
                Intent(
                    this,
                    EnrouteActivity::class.java
                )
            )
        }

        findViewById<android.view.View>(
            R.id.cardWx
        ).setOnClickListener {

            startActivity(
                Intent(
                    this,
                    WxActivity::class.java
                )
            )
        }

        findViewById<android.view.View>(
            R.id.cardUpdate
        ).setOnClickListener {

            startActivity(
                Intent(
                    this,
                    UpdateActivity::class.java
                )
            )
        }

        findViewById<android.view.View>(
            R.id.cardSettings
        ).setOnClickListener {

            startActivity(
                Intent(
                    this,
                    SettingsActivity::class.java
                )
            )
        }

        findViewById<android.view.View>(
            R.id.cardInfo
        ).setOnClickListener {
            startActivity(
                Intent(
                    this,
                    InfoActivity::class.java
                )
            )
        }


        ChartUpdateNotifier
            .check(
                this
            ) { notice ->

                if (
                    notice ==
                    null
                ) {
                    return@check
                }

                runOnUiThread {

                    if (
                        Build.VERSION.SDK_INT >=
                        33 &&
                        checkSelfPermission(
                            android.Manifest
                                .permission
                                .POST_NOTIFICATIONS
                        ) !=
                        PackageManager.PERMISSION_GRANTED
                    ) {

                        pendingUpdateNotice =
                            notice

                        val prefs =
                            getSharedPreferences(
                                "jeppiran_update_notifications",
                                MODE_PRIVATE
                            )

                        val asked =
                            prefs.getBoolean(
                                "permission_asked",
                                false
                            )

                        if (
                            !asked
                        ) {

                            prefs.edit()
                                .putBoolean(
                                    "permission_asked",
                                    true
                                )
                                .apply()

                            notificationPermissionLauncher
                                .launch(
                                    android.Manifest
                                        .permission
                                        .POST_NOTIFICATIONS
                                )

                        } else {

                            pendingUpdateNotice =
                                null

                            ChartUpdateNotifier
                                .showInAppNotice(
                                    this,
                                    notice
                                )
                        }

                    } else {

                        ChartUpdateNotifier
                            .postNotification(
                                this,
                                notice
                            )
                    }
                }
            }
    }
}
