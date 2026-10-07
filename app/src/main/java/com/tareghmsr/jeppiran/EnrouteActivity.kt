package com.tareghmsr.jeppiran

import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class EnrouteActivity : AppCompatActivity() {
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
            setPadding(20.dp, 20.dp, 20.dp, 32.dp)
        }

        content.addView(TextView(this).apply {
            text = "EN-ROUTE"
            textSize = 28f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(getColor(R.color.jeppiran_text))
        })
        content.addView(TextView(this).apply {
            text = "Airways, airspace, SIGMETs and navigation data"
            textSize = 13f
            setTextColor(getColor(R.color.jeppiran_text_secondary))
            setPadding(0, 4.dp, 0, 18.dp)
        })

        addCard(content, "LOW ALTITUDE IFR", "En-route low-level structure and airway layer")
        addCard(content, "HIGH ALTITUDE IFR", "Upper routes and high-level navigation layer")
        addCard(content, "SIGMET / AIRSPACE", "Operational airspace and significant weather layer")
        addCard(content, "NAVIGATION", "Navaids, fixes and route planning workspace")

        val enrouteInfo =
            EnrouteUpdateStore
                .bundledManifest(
                    this
                )

        val activeCycle =
            EnrouteUpdateStore
                .activeCycle(
                    this
                )
                .ifBlank {
                    enrouteInfo
                        ?.cycle
                        .orEmpty()
                }

        content.addView(TextView(this).apply {
            text =
                buildString {
                    append(
                        "EN-ROUTE DATA"
                    )

                    if (
                        activeCycle.isNotBlank()
                    ) {
                        append(
                            " • "
                        )

                        append(
                            activeCycle
                        )
                    }

                    enrouteInfo
                        ?.products
                        ?.takeIf {
                            it.isNotBlank()
                        }
                        ?.let {
                            append(
                                " • "
                            )

                            append(
                                it
                            )
                        }
                }

            textSize = 10f
            gravity = Gravity.CENTER
            setTextColor(getColor(R.color.jeppiran_text_secondary))
            setPadding(0, 20.dp, 0, 0)
        })

        scroll.addView(content)
        root.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))
        setContentView(root)

        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(0, bars.top, 0, bars.bottom)
            insets
        }
    }

    private fun addCard(parent: LinearLayout, title: String, subtitle: String) {
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(18.dp, 18.dp, 18.dp, 18.dp)
            background = cardBackground()
        }
        box.addView(TextView(this).apply {
            text = title
            textSize = 17f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(getColor(R.color.jeppiran_text))
        })
        box.addView(TextView(this).apply {
            text = subtitle
            textSize = 13f
            setTextColor(getColor(R.color.jeppiran_text_secondary))
            setPadding(0, 6.dp, 0, 0)
        })
        parent.addView(box, LinearLayout.LayoutParams(-1, 88.dp).apply { setMargins(0, 5.dp, 0, 5.dp) })
    }

    private fun cardBackground() = GradientDrawable().apply {
        cornerRadius = 20.dp.toFloat()
        setColor(getColor(R.color.jeppiran_surface))
        setStroke(1.dp, getColor(R.color.jeppiran_card_stroke))
    }

    private val Int.dp: Int get() = (this * resources.displayMetrics.density).toInt()
}