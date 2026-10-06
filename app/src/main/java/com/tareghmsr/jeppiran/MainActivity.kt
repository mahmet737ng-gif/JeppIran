package com.tareghmsr.jeppiran

import android.content.Intent
import android.os.Bundle
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
