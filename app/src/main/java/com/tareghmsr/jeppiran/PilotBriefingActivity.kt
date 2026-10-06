package com.tareghmsr.jeppiran

import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import java.text.DateFormat
import java.util.Date
import java.util.Locale

class PilotBriefingActivity : AppCompatActivity() {

    private lateinit var repository: ChartRepository
    private var icao: String = ""
    private lateinit var weatherText: TextView
    private lateinit var windText: TextView
    private lateinit var notamContainer: LinearLayout
    private lateinit var approachContainer: LinearLayout
    private lateinit var statusText: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        ThemeManager.apply(this)
        super.onCreate(savedInstanceState)

        icao = intent.getStringExtra("ICAO").orEmpty().trim().uppercase(Locale.US)
        repository = ChartRepository(this)
        buildUi()
        renderCached()
        refreshAll(false)
    }

    override fun onResume() {
        super.onResume()
        if (::windText.isInitialized) renderCached()
    }

    private fun buildUi() {
        val body = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(16.dp, 18.dp, 16.dp, 30.dp)
            background = getDrawable(R.drawable.bg_flight_deck)
        }

        body.addView(TextView(this).apply {
            text = icao + "  OPERATIONAL BRIEF"
            textSize = 23f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(getColor(R.color.jeppiran_text))
        })

        statusText = TextView(this).apply {
            text = "Cached data shown while JEPPIRAN checks for updates."
            textSize = 12f
            setTextColor(getColor(R.color.jeppiran_text_secondary))
            setPadding(0, 5.dp, 0, 12.dp)
        }
        body.addView(statusText)

        val actions = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        actions.addView(action("REFRESH") { refreshAll(true) }, actionParams())
        actions.addView(action("TAXI") {
            startActivity(Intent(this, TaxiModeActivity::class.java).putExtra("ICAO", icao))
        }, actionParams())
        actions.addView(action("OFFLINE") { saveOffline() }, actionParams())
        actions.addView(action("DATA") {
            startActivity(Intent(this, PilotToolsSettingsActivity::class.java))
        }, actionParams())
        body.addView(actions, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            50.dp
        ))

        body.addView(
            action("EFB LAB • 10 EXPERIMENTAL MODULES") {
                startActivity(
                    Intent(
                        this,
                        EfbLabActivity::class.java
                    ).putExtra("ICAO", icao)
                )
            },
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                46.dp
            ).apply {
                setMargins(3.dp, 8.dp, 3.dp, 2.dp)
            }
        )

        body.addView(sectionTitle("WEATHER NOW"))
        weatherText = sectionCard()
        body.addView(weatherText, cardParams())

        body.addView(sectionTitle("RUNWAY WIND"))
        windText = sectionCard()
        body.addView(windText, cardParams())

        body.addView(sectionTitle("NOTAMS"))
        notamContainer = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        body.addView(notamContainer)

        body.addView(sectionTitle("APPROACH BRIEF"))
        approachContainer = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        body.addView(approachContainer)

        body.addView(TextView(this).apply {
            text =
                "JEPPIRAN organizes source data for situational awareness. " +
                    "Always verify current official charts, NOTAMs, weather, aircraft limitations and operator procedures."
            textSize = 11f
            setTextColor(getColor(R.color.jeppiran_text_secondary))
            setPadding(6.dp, 22.dp, 6.dp, 4.dp)
        })

        setContentView(ScrollView(this).apply { addView(body) })
    }

    private fun renderCached() {
        val weather = FlightDataStore.cached(this, icao)
        renderWeather(weather)
        renderWind(weather)
        renderNotams(NotamStore.cached(this, icao))
        renderApproaches(NotamStore.cached(this, icao)?.items.orEmpty())
    }

    private fun refreshAll(userRequested: Boolean) {
        statusText.text = "Updating weather and NOTAM data…"
        Thread {
            val weather = runCatching { FlightDataStore.fetch(this, icao) }
            val notams = if (NotamStore.configured(this)) {
                runCatching { NotamStore.fetch(this, icao) }
            } else {
                Result.success(NotamStore.cached(this, icao))
            }

            runOnUiThread {
                val weatherValue = weather.getOrNull() ?: FlightDataStore.cached(this, icao)
                val notamValue = notams.getOrNull() ?: NotamStore.cached(this, icao)
                renderWeather(weatherValue)
                renderWind(weatherValue)
                renderNotams(notamValue)
                renderApproaches(notamValue?.items.orEmpty())

                val messages = mutableListOf<String>()
                weather.exceptionOrNull()?.message?.let { messages += "WX: " + it }
                if (!NotamStore.configured(this)) {
                    messages += "NOTAM API key not configured"
                } else {
                    notams.exceptionOrNull()?.message?.let { messages += "NOTAM: " + it }
                }

                statusText.text = if (messages.isEmpty()) {
                    "Updated " + DateFormat.getTimeInstance(DateFormat.SHORT).format(Date())
                } else {
                    messages.joinToString(" • ") + " • cached data retained where available"
                }

                if (userRequested && messages.isNotEmpty()) {
                    Toast.makeText(this, statusText.text, Toast.LENGTH_LONG).show()
                }
            }
        }.start()
    }

    private fun renderWeather(snapshot: FlightDataStore.WeatherSnapshot?) {
        weatherText.text = if (snapshot == null) {
            "No cached weather. Tap REFRESH."
        } else {
            val ceiling = FlightDataStore.ceilingFeet(snapshot.metar)
            val visibility = FlightDataStore.visibilityMeters(snapshot.metar)
            buildString {
                append("METAR\n")
                append(snapshot.metar.ifBlank { "No METAR available." })
                append("\n\nTAF\n")
                append(snapshot.taf.ifBlank { "No TAF available." })
                append("\n\nWX CROSS-CHECK\n")
                append("Ceiling: ")
                append(ceiling?.let { it.toString() + " ft" } ?: "not reported / not parsed")
                append("   •   Visibility: ")
                append(visibility?.let {
                    if (it >= 10000) "10 km or more" else it.toString() + " m"
                } ?: "not parsed")
            }
        }
    }

    private fun renderWind(snapshot: FlightDataStore.WeatherSnapshot?) {
        val wind = snapshot?.let { FlightDataStore.parseWind(it.metar) }
        if (wind == null) {
            windText.text = "Wind not available from cached METAR."
            return
        }
        val runways = FlightDataStore.runwayDesignators(repository, icao)
        if (runways.isEmpty()) {
            windText.text = "Wind parsed, but no runway designators were found in the current chart set."
            return
        }

        val maxCross = PilotPreferences.maxCrosswindKt(this)
        val maxTail = PilotPreferences.maxTailwindKt(this)
        windText.text = buildString {
            append("METAR wind: ")
            append(wind.direction?.let { "%03d°".format(it) } ?: "VRB")
            append(" / ")
            append(wind.speedKt)
            append(" kt")
            wind.gustKt?.let { append(" G").append(it) }
            append("\n\n")
            runways.forEach { runway ->
                val item = FlightDataStore.components(wind, runway) ?: return@forEach
                val tailwind = (-item.headwindKt).coerceAtLeast(0)
                append("RWY ").append(item.runway).append("  •  ")
                if (item.headwindKt >= 0) {
                    append("HW ").append(item.headwindKt).append(" kt")
                } else {
                    append("TW ").append(tailwind).append(" kt")
                }
                append("  •  XW ").append(item.crosswindKt).append(" kt")
                val alerts = mutableListOf<String>()
                if (maxCross > 0 && item.crosswindKt > maxCross) alerts += "XW > SET LIMIT"
                if (maxTail > 0 && tailwind > maxTail) alerts += "TW > SET LIMIT"
                if (alerts.isNotEmpty()) append("  ⚠ ").append(alerts.joinToString(", "))
                append("\n")
            }
            if (maxCross <= 0 && maxTail <= 0) {
                append("\nNo aircraft/company wind limits are configured.")
            } else {
                append("\nConfigured advisory limits: XW ")
                    .append(if (maxCross > 0) maxCross.toString() + " kt" else "—")
                    .append(" • TW ")
                    .append(if (maxTail > 0) maxTail.toString() + " kt" else "—")
            }
        }
    }

    private fun renderNotams(snapshot: NotamStore.Snapshot?) {
        notamContainer.removeAllViews()
        if (!NotamStore.configured(this)) {
            notamContainer.addView(infoCard(
                "LIVE NOTAMS NOT CONFIGURED\nAdd an ICAO Data Service API key under DATA. " +
                    "Cached NOTAMs remain available if previously downloaded."
            ))
        }
        val items = snapshot?.items.orEmpty()
        if (items.isEmpty()) {
            notamContainer.addView(infoCard("No cached NOTAM items for " + icao + "."))
            return
        }

        items.groupBy { it.category }.forEach { (category, group) ->
            notamContainer.addView(TextView(this).apply {
                text = category + "  •  " + group.size
                textSize = 12f
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(getColor(R.color.jeppiran_accent))
                setPadding(6.dp, 8.dp, 6.dp, 5.dp)
            })
            group.take(12).forEach { notam ->
                notamContainer.addView(infoCard(
                    buildString {
                        if (notam.id.isNotBlank()) append(notam.id).append("\n")
                        append(notam.text)
                        if (notam.begin.isNotBlank() || notam.end.isNotBlank()) {
                            append("\n")
                            if (notam.begin.isNotBlank()) append("From ").append(notam.begin).append("  ")
                            if (notam.end.isNotBlank()) append("To ").append(notam.end)
                        }
                    }
                ))
            }
        }
    }

    private fun renderApproaches(notams: List<NotamStore.Notam>) {
        approachContainer.removeAllViews()
        val charts = repository.getDisplayChartsForAirport(icao)
            .filter { ChartRepository.normalizeCategory(it.category) == "Approach" }
        if (charts.isEmpty()) {
            approachContainer.addView(infoCard("No approach charts found."))
            return
        }

        charts.forEach { chart ->
            val brief = ApproachBriefStore.forPage(this, chart.page)
            val relevant = NotamStore.relevantToApproach(notams, chart.name)
            val card = TextView(this).apply {
                text = buildString {
                    append(chart.name)
                    if (relevant.isNotEmpty()) append("   ⚠ ").append(relevant.size).append(" related NOTAM")
                    append("\n")
                    if (brief != null) {
                        if (brief.frequencies.isNotEmpty()) {
                            append("FREQ  ").append(brief.frequencies.joinToString(", ")).append("\n")
                        }
                        if (brief.course.isNotBlank()) append("COURSE  ").append(brief.course).append("\n")
                        if (brief.minimums.isNotBlank()) append("MINIMUMS  ").append(brief.minimums).append("\n")
                        if (brief.missedApproach.isNotBlank()) {
                            append("MISSED  ").append(brief.missedApproach)
                        }
                    } else {
                        append("Tap to open chart.")
                    }
                }.trim()
                textSize = 13f
                setTextColor(getColor(R.color.jeppiran_text))
                setPadding(15.dp, 13.dp, 15.dp, 13.dp)
                background = cardBackground()
                setOnClickListener { openChart(chart) }
            }
            approachContainer.addView(card, cardParams())
        }
    }

    private fun saveOffline() {
        statusText.text = "Saving " + icao + " charts, weather and NOTAM cache for offline use…"
        Thread {
            val result = OfflineBriefingStore.prefetch(this, icao)
            runOnUiThread {
                statusText.text =
                    "Offline: chart " + yesNo(result.airportPdf) +
                        " • WX " + yesNo(result.weather) +
                        " • NOTAM " + yesNo(result.notams)
                Toast.makeText(this, result.message, Toast.LENGTH_LONG).show()
                renderCached()
            }
        }.start()
    }

    private fun openChart(chart: ChartRepository.ChartInfo) {
        startActivity(Intent(this, PdfViewerActivity::class.java).apply {
            putExtra("PAGE", chart.page)
            putExtra("TITLE", chart.name)
            putExtra("ICAO", chart.icao)
            putExtra("AIRPORT_NAME", chart.airportName)
            putExtra("CITY", chart.city)
            putExtra("CATEGORY", chart.category)
        })
    }

    private fun action(text: String, click: () -> Unit) = TextView(this).apply {
        this.text = text
        textSize = 11f
        gravity = Gravity.CENTER
        typeface = Typeface.DEFAULT_BOLD
        setTextColor(Color.WHITE)
        background = GradientDrawable().apply {
            cornerRadius = 14.dp.toFloat()
            setColor(getColor(R.color.jeppiran_blue))
        }
        setOnClickListener { click() }
    }

    private fun actionParams() = LinearLayout.LayoutParams(
        0,
        LinearLayout.LayoutParams.MATCH_PARENT,
        1f
    ).apply { setMargins(3.dp, 3.dp, 3.dp, 3.dp) }

    private fun sectionTitle(value: String) = TextView(this).apply {
        text = value
        textSize = 12f
        typeface = Typeface.DEFAULT_BOLD
        setTextColor(getColor(R.color.jeppiran_text_secondary))
        setPadding(4.dp, 18.dp, 4.dp, 7.dp)
    }

    private fun sectionCard() = TextView(this).apply {
        textSize = 13f
        setTextColor(getColor(R.color.jeppiran_text))
        setPadding(15.dp, 14.dp, 15.dp, 14.dp)
        background = cardBackground()
        setTextIsSelectable(true)
    }

    private fun infoCard(value: String) = sectionCard().apply { text = value }

    private fun cardParams() = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
    ).apply { setMargins(0, 4.dp, 0, 4.dp) }

    private fun cardBackground() = GradientDrawable().apply {
        cornerRadius = 16.dp.toFloat()
        setColor(getColor(R.color.jeppiran_surface))
        setStroke(1.dp, getColor(R.color.jeppiran_card_stroke))
    }

    private fun yesNo(value: Boolean) = if (value) "✓" else "—"

    private val Int.dp: Int
        get() = (this * resources.displayMetrics.density).toInt()
}
