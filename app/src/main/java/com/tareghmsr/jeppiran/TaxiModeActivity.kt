package com.tareghmsr.jeppiran

import android.content.Intent
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.Gravity
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import java.util.Locale

class TaxiModeActivity : AppCompatActivity() {

    private var icao = ""
    private lateinit var repository: ChartRepository

    override fun onCreate(savedInstanceState: Bundle?) {
        ThemeManager.apply(this)
        super.onCreate(savedInstanceState)

        icao = intent.getStringExtra("ICAO").orEmpty().trim().uppercase(Locale.US)
        repository = ChartRepository(this)
        buildUi()
    }

    private fun buildUi() {
        val body = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(18.dp, 22.dp, 18.dp, 30.dp)
            background = getDrawable(R.drawable.bg_flight_deck)
        }

        body.addView(TextView(this).apply {
            text = icao + "  TAXI MODE"
            textSize = 23f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(getColor(R.color.jeppiran_text))
        })

        body.addView(TextView(this).apply {
            text =
                "Enter the cleared taxi route in sequence. Example: A, A3, B, HOLD SHORT RWY 29. " +
                    "JEPPIRAN keeps the route visible over the airport diagram while aircraft position remains available."
            textSize = 13f
            setTextColor(getColor(R.color.jeppiran_text_secondary))
            setPadding(0, 8.dp, 0, 16.dp)
        })

        val route = EditText(this).apply {
            hint = "A, A3, B, HOLD SHORT RWY 29"
            textSize = 16f
            minLines = 3
            setTextColor(getColor(R.color.jeppiran_text))
            setHintTextColor(getColor(R.color.jeppiran_text_secondary))
            setPadding(14.dp, 12.dp, 14.dp, 12.dp)
            background = GradientDrawable().apply {
                cornerRadius = 16.dp.toFloat()
                setColor(getColor(R.color.jeppiran_surface))
                setStroke(1.dp, getColor(R.color.jeppiran_card_stroke))
            }
        }
        body.addView(route, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ))

        val preview = TextView(this).apply {
            text = "ROUTE PREVIEW\n—"
            textSize = 14f
            setTextColor(getColor(R.color.jeppiran_text))
            setPadding(15.dp, 14.dp, 15.dp, 14.dp)
            background = GradientDrawable().apply {
                cornerRadius = 16.dp.toFloat()
                setColor(getColor(R.color.jeppiran_surface))
                setStroke(1.dp, getColor(R.color.jeppiran_card_stroke))
            }
        }
        body.addView(preview, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply { setMargins(0, 14.dp, 0, 8.dp) })

        route.setOnFocusChangeListener { _, _ ->
            preview.text = "ROUTE PREVIEW\n" + normalizedRoute(route.text.toString())
        }

        body.addView(button("OPEN AIRPORT DIAGRAM") {
            val normalized = normalizedRoute(route.text.toString())
            if (normalized == "—") {
                Toast.makeText(this, "Enter a taxi route first.", Toast.LENGTH_SHORT).show()
                return@button
            }
            openAirportDiagram(normalized)
        })

        body.addView(button("OPEN DIAGRAM WITHOUT ROUTE") {
            openAirportDiagram("")
        })

        body.addView(TextView(this).apply {
            text =
                "Taxi Mode is a situational-awareness aid only. Follow ATC clearance, airport markings, " +
                    "current NOTAMs and the official airport diagram."
            textSize = 11f
            setTextColor(getColor(R.color.jeppiran_text_secondary))
            setPadding(4.dp, 18.dp, 4.dp, 4.dp)
        })

        setContentView(ScrollView(this).apply { addView(body) })
    }

    private fun normalizedRoute(raw: String): String {
        val cleaned = raw
            .uppercase(Locale.US)
            .replace(Regex("""\s+"""), " ")
            .trim()
        if (cleaned.isBlank()) return "—"
        return cleaned
            .split(Regex("""\s*(?:,|>|→)\s*"""))
            .filter { it.isNotBlank() }
            .joinToString("  →  ")
    }

    private fun openAirportDiagram(route: String) {
        val chart = repository.getDisplayChartsForAirport(icao).firstOrNull {
            ChartRepository.normalizeCategory(it.category) == "Airport" &&
                (
                    it.name.contains("AIRPORT DIAGRAM", true) ||
                        it.chartNumber.equals("10-9", true)
                    )
        } ?: repository.getDisplayChartsForAirport(icao).firstOrNull {
            ChartRepository.normalizeCategory(it.category) == "Airport"
        }

        if (chart == null) {
            Toast.makeText(this, "Airport diagram not found.", Toast.LENGTH_LONG).show()
            return
        }

        startActivity(Intent(this, PdfViewerActivity::class.java).apply {
            putExtra("PAGE", chart.page)
            putExtra("TITLE", chart.name)
            putExtra("ICAO", chart.icao)
            putExtra("AIRPORT_NAME", chart.airportName)
            putExtra("CITY", chart.city)
            putExtra("CATEGORY", chart.category)
            putExtra("TAXI_MODE", true)
            putExtra("TAXI_ROUTE", route)
        })
    }

    private fun button(label: String, action: () -> Unit) =
        TextView(this).apply {
            text = label
            textSize = 14f
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            setTextColor(android.graphics.Color.WHITE)
            background = GradientDrawable().apply {
                cornerRadius = 15.dp.toFloat()
                setColor(getColor(R.color.jeppiran_blue))
            }
            setOnClickListener { action() }
        }.also {
            bodyParamsHolder = it
        }

    private var bodyParamsHolder: TextView? = null

    private fun LinearLayout.addView(view: TextView) {
        addView(
            view,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                54.dp
            ).apply { setMargins(0, 7.dp, 0, 0) }
        )
    }

    private val Int.dp: Int
        get() = (this * resources.displayMetrics.density).toInt()
}
