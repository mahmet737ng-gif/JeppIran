package com.tareghmsr.jeppiran

import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.Gravity
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class InfoActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        ThemeManager.apply(this)
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = getDrawable(R.drawable.bg_flight_deck)
        }
        val scroll = ScrollView(this)
        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(22.dp, 24.dp, 22.dp, 34.dp)
        }

        content.addView(ImageView(this).apply {
            setImageResource(R.drawable.jeppiran_logo)
            scaleType = ImageView.ScaleType.FIT_CENTER
        }, LinearLayout.LayoutParams(128.dp, 128.dp))

        content.addView(TextView(this).apply {
            text = "JEPPIRAN"
            textSize = 31f
            letterSpacing = 0.1f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(getColor(R.color.jeppiran_text))
        })
        content.addView(TextView(this).apply {
            text = AppVersion.name(this@InfoActivity)
            textSize = 12f
            setTextColor(getColor(R.color.jeppiran_accent))
            setPadding(0, 4.dp, 0, 20.dp)
        })

        addSection(content, "ABOUT", "Aviation chart, weather and moving-position workspace designed for fast cockpit use.")
        addSection(content, "DEVELOPER", "Taregh Msr")
        addSection(content, "DATA", "Always verify the active chart cycle and current operational information before flight.")
        addSection(content, "SUPPORT & LEGAL", "JEPPIRAN is an independent application. Use operational data only after verifying it against approved current sources.")

        scroll.addView(content)
        root.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))
        setContentView(root)

        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(0, bars.top, 0, bars.bottom)
            insets
        }
    }

    private fun addSection(parent: LinearLayout, title: String, body: String) {
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(18.dp, 16.dp, 18.dp, 16.dp)
            background = GradientDrawable().apply {
                cornerRadius = 18.dp.toFloat()
                setColor(getColor(R.color.jeppiran_surface))
                setStroke(1.dp, getColor(R.color.jeppiran_card_stroke))
            }
        }
        box.addView(TextView(this).apply {
            text = title
            textSize = 11f
            typeface = Typeface.DEFAULT_BOLD
            letterSpacing = 0.08f
            setTextColor(getColor(R.color.jeppiran_accent))
        })
        box.addView(TextView(this).apply {
            text = body
            textSize = 14f
            setLineSpacing(3f, 1.05f)
            setTextColor(getColor(R.color.jeppiran_text))
            setPadding(0, 7.dp, 0, 0)
        })
        parent.addView(box, LinearLayout.LayoutParams(-1, -2).apply { setMargins(0, 5.dp, 0, 5.dp) })
    }

    private val Int.dp: Int get() = (this * resources.displayMetrics.density).toInt()
}