package com.tareghmsr.jeppiran

import android.app.Activity
import android.app.Application
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.TextView
import androidx.core.view.ViewCompat

class JeppIranApplication :
    Application(),
    Application.ActivityLifecycleCallbacks {

    private var startedActivities =
        0

    override fun onCreate() {
        super.onCreate()
        registerActivityLifecycleCallbacks(
            this
        )
    }

    override fun onActivityStarted(
        activity: Activity
    ) {
        startedActivities++
    }

    override fun onActivityStopped(
        activity: Activity
    ) {
        startedActivities =
            (startedActivities - 1)
                .coerceAtLeast(
                    0
                )

        if (
            startedActivities == 0 &&
            !activity.isChangingConfigurations
        ) {
            getSharedPreferences(
                "jeppiran_process_lifecycle",
                MODE_PRIVATE
            )
                .edit()
                .putLong(
                    "last_background_at",
                    System.currentTimeMillis()
                )
                .apply()
        }
    }

    override fun onActivityResumed(
        activity: Activity
    ) {
        if (
            activity is MainActivity ||
            activity is SplashActivity
        ) {
            return
        }

        activity.window.decorView.post {
            installBackButtonIfMissing(
                activity
            )
        }
    }

    private fun installBackButtonIfMissing(
        activity: Activity
    ) {
        val content =
            activity.findViewById<FrameLayout>(
                android.R.id.content
            )
                ?: return

        if (
            findBackControl(
                content
            )
        ) {
            return
        }

        if (
            content.findViewWithTag<View>(
                BACK_TAG
            ) != null
        ) {
            return
        }

        val density =
            activity.resources
                .displayMetrics
                .density

        fun dp(value: Int): Int =
            (value * density)
                .toInt()

        val statusBarHeight =
            activity.resources
                .getIdentifier(
                    "status_bar_height",
                    "dimen",
                    "android"
                )
                .takeIf {
                    it != 0
                }
                ?.let {
                    activity.resources
                        .getDimensionPixelSize(
                            it
                        )
                }
                ?: 0

        val button =
            TextView(
                activity
            ).apply {
                tag =
                    BACK_TAG

                text =
                    "‹"

                contentDescription =
                    "Back"

                textSize =
                    30f

                typeface =
                    Typeface.DEFAULT_BOLD

                gravity =
                    Gravity.CENTER

                setTextColor(
                    Color.WHITE
                )

                background =
                    GradientDrawable().apply {
                        cornerRadius =
                            dp(
                                22
                            ).toFloat()

                        setColor(
                            Color.argb(
                                238,
                                3,
                                28,
                                61
                            )
                        )

                        setStroke(
                            dp(
                                1
                            ),
                            Color.rgb(
                                20,
                                190,
                                245
                            )
                        )
                    }

                elevation =
                    dp(
                        8
                    ).toFloat()

                setOnClickListener {
                    val componentActivity =
                        activity as?
                            androidx.activity.ComponentActivity

                    if (
                        componentActivity !=
                        null
                    ) {
                        componentActivity
                            .onBackPressedDispatcher
                            .onBackPressed()
                    } else {
                        @Suppress(
                            "DEPRECATION"
                        )
                        activity.onBackPressed()
                    }
                }
            }

        content.addView(
            button,
            FrameLayout.LayoutParams(
                dp(
                    52
                ),
                dp(
                    52
                )
            ).apply {
                gravity =
                    Gravity.TOP or
                        Gravity.START

                leftMargin =
                    dp(
                        16
                    )

                topMargin =
                    statusBarHeight +
                        dp(
                            10
                        )
            }
        )
    }

    private fun findBackControl(
        root: View
    ): Boolean {
        val description =
            root.contentDescription
                ?.toString()
                ?.trim()

        if (
            description.equals(
                "Back",
                ignoreCase =
                    true
            )
        ) {
            return true
        }

        if (
            root is ViewGroup
        ) {
            for (
                index in
                0 until
                    root.childCount
            ) {
                if (
                    findBackControl(
                        root.getChildAt(
                            index
                        )
                    )
                ) {
                    return true
                }
            }
        }

        return false
    }

    override fun onActivityCreated(
        activity: Activity,
        savedInstanceState: Bundle?
    ) = Unit

    override fun onActivityPaused(
        activity: Activity
    ) = Unit

    override fun onActivitySaveInstanceState(
        activity: Activity,
        outState: Bundle
    ) = Unit

    override fun onActivityDestroyed(
        activity: Activity
    ) = Unit

    companion object {
        private const val BACK_TAG =
            "jeppiran_global_back_button"
    }
}
