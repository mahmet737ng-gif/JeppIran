package com.tareghmsr.jeppiran

import android.app.Activity
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.TextView
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

object BackNavigation {
    private const val TAG = "jeppiran_shared_back"

    fun install(activity: Activity) {
        val content =
            activity.findViewById<ViewGroup>(android.R.id.content)
                ?: return

        if (content.findViewWithTag<View>(TAG) != null) {
            return
        }

        val density = activity.resources.displayMetrics.density
        fun dp(value: Int): Int = (value * density).toInt()

        val dark =
            activity.resources.configuration.uiMode and
                android.content.res.Configuration.UI_MODE_NIGHT_MASK ==
                android.content.res.Configuration.UI_MODE_NIGHT_YES

        val button =
            TextView(activity).apply {
                tag = TAG
                text = "‹"
                textSize = 30f
                typeface = Typeface.DEFAULT_BOLD
                gravity = Gravity.CENTER
                setTextColor(
                    if (dark) Color.WHITE
                    else Color.rgb(9, 48, 82)
                )
                background =
                    GradientDrawable().apply {
                        shape = GradientDrawable.RECTANGLE
                        cornerRadius = dp(18).toFloat()
                        setColor(
                            if (dark) {
                                Color.argb(236, 4, 31, 65)
                            } else {
                                Color.argb(242, 244, 251, 255)
                            }
                        )
                        setStroke(
                            dp(1),
                            if (dark) {
                                Color.rgb(0, 183, 235)
                            } else {
                                Color.rgb(38, 135, 195)
                            }
                        )
                    }
                elevation = dp(8).toFloat()
                contentDescription = "Back"
                setOnClickListener {
                    activity.finish()
                }
            }

        val params =
            FrameLayout.LayoutParams(
                dp(46),
                dp(46),
                Gravity.TOP or Gravity.START
            ).apply {
                marginStart = dp(10)
                topMargin = dp(8)
            }

        content.addView(button, params)

        ViewCompat.setOnApplyWindowInsetsListener(button) { view, insets ->
            val bars =
                insets.getInsets(WindowInsetsCompat.Type.systemBars())

            val layout =
                view.layoutParams as FrameLayout.LayoutParams

            layout.topMargin = bars.top + dp(8)
            layout.marginStart = bars.left + dp(10)
            view.layoutParams = layout
            insets
        }

        ViewCompat.requestApplyInsets(button)
        button.bringToFront()
    }
}
