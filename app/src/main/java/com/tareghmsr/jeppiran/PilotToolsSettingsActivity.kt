package com.tareghmsr.jeppiran

import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.text.InputType
import android.view.Gravity
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

class PilotToolsSettingsActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        ThemeManager.apply(this)
        super.onCreate(savedInstanceState)
        buildUi()
    }

    private fun buildUi() {
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(18.dp, 20.dp, 18.dp, 28.dp)
            background = getDrawable(R.drawable.bg_flight_deck)
        }

        container.addView(TextView(this).apply {
            text = "PILOT DATA & LIMITS"
            textSize = 23f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(getColor(R.color.jeppiran_text))
            setPadding(2.dp, 4.dp, 2.dp, 18.dp)
        })

        container.addView(label("ICAO NOTAM API KEY"))
        val apiKey = field(PilotPreferences.notamApiKey(this), false).apply {
            hint = "Paste your ICAO Data Service API key"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
        }
        container.addView(apiKey, fieldParams())

        container.addView(help(
            "Live NOTAMs use the official ICAO Data Service. " +
                "The key is stored only in this app on this device."
        ))

        container.addView(label("MAX CROSSWIND (KT)"))
        val crosswind = field(
            PilotPreferences.maxCrosswindKt(this).takeIf { it > 0 }?.toString().orEmpty(),
            true
        )
        crosswind.hint = "Optional aircraft/company limit"
        container.addView(crosswind, fieldParams())

        container.addView(label("MAX TAILWIND (KT)"))
        val tailwind = field(
            PilotPreferences.maxTailwindKt(this).takeIf { it > 0 }?.toString().orEmpty(),
            true
        )
        tailwind.hint = "Optional aircraft/company limit"
        container.addView(tailwind, fieldParams())

        container.addView(help(
            "Limits are advisory comparison values only. " +
                "JEPPIRAN never replaces approved aircraft, operator or dispatch data."
        ))

        container.addView(TextView(this).apply {
            text = "SAVE"
            gravity = Gravity.CENTER
            textSize = 16f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(android.graphics.Color.WHITE)
            background = GradientDrawable().apply {
                cornerRadius = 16.dp.toFloat()
                setColor(getColor(R.color.jeppiran_blue))
            }
            setOnClickListener {
                PilotPreferences.setNotamApiKey(this@PilotToolsSettingsActivity, apiKey.text.toString())
                PilotPreferences.setMaxCrosswindKt(
                    this@PilotToolsSettingsActivity,
                    crosswind.text.toString().toIntOrNull() ?: 0
                )
                PilotPreferences.setMaxTailwindKt(
                    this@PilotToolsSettingsActivity,
                    tailwind.text.toString().toIntOrNull() ?: 0
                )
                Toast.makeText(
                    this@PilotToolsSettingsActivity,
                    "Pilot data settings saved",
                    Toast.LENGTH_SHORT
                ).show()
                finish()
            }
        }, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            56.dp
        ).apply { setMargins(0, 22.dp, 0, 4.dp) })

        val scroll = ScrollView(this).apply { addView(container) }
        setContentView(scroll)
    }

    private fun label(value: String) = TextView(this).apply {
        text = value
        textSize = 12f
        typeface = Typeface.DEFAULT_BOLD
        setTextColor(getColor(R.color.jeppiran_text_secondary))
        setPadding(2.dp, 16.dp, 2.dp, 8.dp)
    }

    private fun help(value: String) = TextView(this).apply {
        text = value
        textSize = 12f
        setTextColor(getColor(R.color.jeppiran_text_secondary))
        setPadding(4.dp, 8.dp, 4.dp, 4.dp)
    }

    private fun field(value: String, numeric: Boolean) = EditText(this).apply {
        setText(value)
        textSize = 15f
        setTextColor(getColor(R.color.jeppiran_text))
        setHintTextColor(getColor(R.color.jeppiran_text_secondary))
        background = GradientDrawable().apply {
            cornerRadius = 14.dp.toFloat()
            setColor(getColor(R.color.jeppiran_surface))
            setStroke(1.dp, getColor(R.color.jeppiran_card_stroke))
        }
        setPadding(14.dp, 0, 14.dp, 0)
        if (numeric) inputType = InputType.TYPE_CLASS_NUMBER
    }

    private fun fieldParams() = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        54.dp
    )

    private val Int.dp: Int
        get() = (this * resources.displayMetrics.density).toInt()
}
