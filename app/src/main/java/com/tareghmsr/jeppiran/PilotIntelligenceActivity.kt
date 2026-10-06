package com.tareghmsr.jeppiran

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

class PilotIntelligenceActivity : AppCompatActivity() {
    private lateinit var repository: ChartRepository
    private var icao = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        ThemeManager.apply(this)
        super.onCreate(savedInstanceState)
        icao = intent.getStringExtra("ICAO").orEmpty().uppercase(Locale.US)
        repository = ChartRepository(this)
        buildUi()
    }

    private fun buildUi() {
        val body = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(16.dp, 18.dp, 16.dp, 28.dp)
            background = getDrawable(R.drawable.bg_flight_deck)
        }
        body.addView(title("PILOT INTELLIGENCE • " + icao))
        body.addView(card("AUTOMATIC FLIGHT-PHASE MODE",
            "Phase-aware chart suggestions are enabled as an advisory layer. JEPPIRAN never changes the active chart without pilot action."))

        val notams = NotamStore.cached(this, icao)?.items.orEmpty()
        body.addView(card("RUNWAY CONDITION / BRAKING", PilotIntelligenceStore.runwayConditionSummary(notams)))
        body.addView(card("AIRPORT HOTSPOTS", PilotIntelligenceStore.hotspotSummary(icao)))
        body.addView(card("WEATHER TREND", PilotIntelligenceStore.weatherTrend(FlightDataStore.cached(this, icao))))
        body.addView(card("PIREP / AIREP • TURBULENCE / ICING", PilotIntelligenceStore.pirepSummary()))
        body.addView(card("SMART ALTERNATE ASSISTANT",
            "Compare alternates using current/cached WX, available approaches and NOTAM state. No dispatch decision is made by the app."))

        val approaches = repository.getDisplayChartsForAirport(icao)
            .filter { ChartRepository.normalizeCategory(it.category) == "Approach" }
        val first = approaches.firstOrNull()
        val brief = first?.let { ApproachBriefStore.forPage(this, it.page) }
        val relevant = first?.let { NotamStore.relevantToApproach(notams, it.name) }.orEmpty()
        body.addView(card("APPROACH COMPATIBILITY CHECKER",
            if (first == null) "No approach chart found."
            else first.name + "\n" + PilotIntelligenceStore.compatibility(
                FlightDataStore.cached(this, icao), brief, relevant
            )))

        body.addView(section("AIRPORT / PROCEDURE HOT NOTES"))
        val note = input("Personal airport/procedure note").apply {
            minLines = 3
            setText(PilotIntelligenceStore.note(this@PilotIntelligenceActivity, icao)?.text.orEmpty())
        }
        body.addView(note)
        body.addView(button("SAVE PERSONAL NOTE") {
            PilotIntelligenceStore.saveNote(this, icao, note.text.toString())
            Toast.makeText(this, "Personal note saved", Toast.LENGTH_SHORT).show()
        })

        body.addView(card("CHART CHANGE VISUAL INTELLIGENCE",
            "Previous/current comparison and Changes Overlay remain available. Semantic summaries are only shown when source evidence is available."))

        body.addView(section("ONE-TAP DEPARTURE / ARRIVAL PACK"))
        val origin = input("Origin ICAO")
        val destination = input("Destination ICAO").apply { setText(icao) }
        val alternate = input("Alternate ICAO")
        body.addView(origin)
        body.addView(destination)
        body.addView(alternate)
        body.addView(button("BUILD OFFLINE FLIGHT PACK") {
            buildPack(origin.text.toString(), destination.text.toString(), alternate.text.toString())
        })

        body.addView(TextView(this).apply {
            text = "EXPERIMENTAL TEST BUILD • Features dependent on authoritative external datasets remain visibly unavailable rather than showing invented aviation data."
            textSize = 11f
            setTextColor(getColor(R.color.jeppiran_text_secondary))
            setPadding(4.dp, 22.dp, 4.dp, 4.dp)
        })
        setContentView(ScrollView(this).apply { addView(body) })
    }

    private fun buildPack(o: String, d: String, a: String) {
        val airports = listOf(o, d, a)
            .map { it.trim().uppercase(Locale.US) }
            .filter { it.length == 4 }
            .distinct()
        if (airports.isEmpty()) {
            Toast.makeText(this, "Enter at least one ICAO.", Toast.LENGTH_SHORT).show()
            return
        }
        Toast.makeText(this, "Building offline pack…", Toast.LENGTH_SHORT).show()
        Thread {
            val results = airports.map { it to OfflineBriefingStore.prefetch(this, it) }
            PilotIntelligenceStore.savePack(this, o, d, a)
            runOnUiThread {
                val msg = results.joinToString("\n") { pair ->
                    val code = pair.first
                    val r = pair.second
                    code + "  CHART " + (if (r.airportPdf) "✓" else "—") +
                        " • WX " + (if (r.weather) "✓" else "—") +
                        " • NOTAM " + (if (r.notams) "✓" else "—")
                }
                androidx.appcompat.app.AlertDialog.Builder(this)
                    .setTitle("READY FOR OFFLINE")
                    .setMessage(msg)
                    .setPositiveButton("OK", null)
                    .show()
            }
        }.start()
    }

    private fun title(v: String) = TextView(this).apply {
        text = v; textSize = 22f; typeface = Typeface.DEFAULT_BOLD
        setTextColor(getColor(R.color.jeppiran_text)); setPadding(2.dp, 2.dp, 2.dp, 12.dp)
    }

    private fun section(v: String) = TextView(this).apply {
        text = v; textSize = 12f; typeface = Typeface.DEFAULT_BOLD
        setTextColor(getColor(R.color.jeppiran_text_secondary)); setPadding(4.dp, 17.dp, 4.dp, 7.dp)
    }

    private fun card(h: String, b: String) = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL; background = panel(); setPadding(14.dp, 12.dp, 14.dp, 12.dp)
        addView(TextView(this@PilotIntelligenceActivity).apply {
            text = h; textSize = 13f; typeface = Typeface.DEFAULT_BOLD; setTextColor(getColor(R.color.jeppiran_accent))
        })
        addView(TextView(this@PilotIntelligenceActivity).apply {
            text = b; textSize = 13f; setTextColor(getColor(R.color.jeppiran_text)); setPadding(0, 5.dp, 0, 0)
        })
        layoutParams = LinearLayout.LayoutParams(-1, -2).apply { setMargins(0, 5.dp, 0, 5.dp) }
    }

    private fun input(h: String) = EditText(this).apply {
        hint = h; setTextColor(getColor(R.color.jeppiran_text)); setHintTextColor(getColor(R.color.jeppiran_text_secondary))
        background = panel(); setPadding(14.dp, 0, 14.dp, 0)
        layoutParams = LinearLayout.LayoutParams(-1, 52.dp).apply { setMargins(0, 4.dp, 0, 4.dp) }
    }

    private fun button(v: String, fn: () -> Unit) = TextView(this).apply {
        text = v; gravity = Gravity.CENTER; textSize = 13f; typeface = Typeface.DEFAULT_BOLD
        setTextColor(android.graphics.Color.WHITE)
        background = GradientDrawable().apply { cornerRadius = 14.dp.toFloat(); setColor(getColor(R.color.jeppiran_blue)) }
        setOnClickListener { fn() }
        layoutParams = LinearLayout.LayoutParams(-1, 52.dp).apply { setMargins(0, 8.dp, 0, 4.dp) }
    }

    private fun panel() = GradientDrawable().apply {
        cornerRadius = 15.dp.toFloat(); setColor(getColor(R.color.jeppiran_surface))
        setStroke(1.dp, getColor(R.color.jeppiran_card_stroke))
    }

    private val Int.dp: Int get() = (this * resources.displayMetrics.density).toInt()
}
