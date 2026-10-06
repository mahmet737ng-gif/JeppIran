package com.tareghmsr.jeppiran

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.location.Location
import android.location.LocationManager
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import java.text.DateFormat
import java.util.Date
import java.util.Locale

class EfbLabActivity : AppCompatActivity() {

    private lateinit var repository: ChartRepository
    private var focusIcao = ""

    private lateinit var body: LinearLayout
    private lateinit var statusText: TextView
    private lateinit var focusField: EditText
    private lateinit var originField: EditText
    private lateinit var destinationField: EditText
    private lateinit var alternateField: EditText

    private var lastLocation: Location? = null
    private var trend: List<EfbIntelligenceStore.MetarTrend> = emptyList()
    private var pireps: List<EfbIntelligenceStore.Pirep> = emptyList()

    private val permissionLauncher =
        registerForActivityResult(
            ActivityResultContracts.RequestMultiplePermissions()
        ) { result ->
            if (result.values.any { it }) {
                updateLastLocation()
                renderModules()
            } else {
                Toast.makeText(
                    this,
                    "Location permission is required only for automatic flight-phase suggestions.",
                    Toast.LENGTH_LONG
                ).show()
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        ThemeManager.apply(this)
        super.onCreate(savedInstanceState)

        repository = ChartRepository(this)
        focusIcao = intent.getStringExtra("ICAO")
            .orEmpty()
            .trim()
            .uppercase(Locale.US)

        if (focusIcao.isBlank()) {
            focusIcao = FlightPlanStore.load(this).destination
        }
        if (focusIcao.isBlank()) {
            focusIcao = repository.getAirports().firstOrNull()?.icao.orEmpty()
        }

        buildUi()
        updateLastLocation()
        renderModules()
    }

    private fun buildUi() {
        body = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(16.dp, 18.dp, 16.dp, 36.dp)
            background = getDrawable(R.drawable.bg_flight_deck)
        }

        body.addView(TextView(this).apply {
            text = "JEPPIRAN  •  EFB LAB"
            textSize = 24f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(textColor())
        })

        body.addView(TextView(this).apply {
            text =
                "Experimental pilot-assistance modules. Every module is isolated behind a feature flag so individual parts can be removed later without undoing the rest."
            textSize = 12f
            setTextColor(secondaryColor())
            setPadding(0, 5.dp, 0, 10.dp)
        })

        statusText = TextView(this).apply {
            text = "Ready"
            textSize = 12f
            setTextColor(secondaryColor())
            setPadding(0, 0, 0, 10.dp)
        }
        body.addView(statusText)

        focusField = field(focusIcao, "Focus airport ICAO")
        body.addView(label("FOCUS AIRPORT"))
        body.addView(focusField, fieldParams())

        val plan = FlightPlanStore.load(this)
        body.addView(label("FLIGHT PACK"))
        originField = field(plan.origin, "Origin ICAO")
        destinationField = field(plan.destination, "Destination ICAO")
        alternateField = field(plan.alternate, "Alternate ICAO")
        body.addView(originField, fieldParams())
        body.addView(destinationField, fieldParams())
        body.addView(alternateField, fieldParams())

        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        row.addView(action("APPLY") {
            applyFocusAndPlan()
        }, actionParams())
        row.addView(action("REFRESH") {
            applyFocusAndPlan()
            refreshLive()
        }, actionParams())
        row.addView(action("MODULES") {
            showModuleDialog()
        }, actionParams())
        body.addView(
            row,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                50.dp
            ).apply { setMargins(0, 8.dp, 0, 8.dp) }
        )

        val scroll = ScrollView(this).apply {
            addView(body)
        }
        setContentView(scroll)
    }

    private fun applyFocusAndPlan() {
        focusIcao = focusField.text.toString().trim().uppercase(Locale.US)
        if (repository.getAirports().none { it.icao == focusIcao }) {
            Toast.makeText(
                this,
                "Airport is not in the current JEPPIRAN chart set.",
                Toast.LENGTH_LONG
            ).show()
            return
        }

        FlightPlanStore.save(
            this,
            originField.text.toString(),
            destinationField.text.toString(),
            alternateField.text.toString()
        )
        renderModules()
    }

    private fun refreshLive() {
        val target = focusIcao
        if (target.isBlank()) return

        statusText.text = "Refreshing " + target + " live data…"

        Thread {
            val errors = mutableListOf<String>()

            runCatching { FlightDataStore.fetch(this, target) }
                .onFailure { errors += "WX " + (it.message ?: "failed") }

            if (NotamStore.configured(this)) {
                runCatching { NotamStore.fetch(this, target) }
                    .onFailure { errors += "NOTAM " + (it.message ?: "failed") }
            } else {
                errors += "NOTAM API key not configured"
            }

            if (ExperimentalFeatureStore.isEnabled(this, "weather_trend")) {
                trend = runCatching {
                    EfbIntelligenceStore.fetchMetarTrend(target, 12)
                }.onFailure {
                    errors += "Trend " + (it.message ?: "failed")
                }.getOrDefault(emptyList())
            }

            if (ExperimentalFeatureStore.isEnabled(this, "pirep")) {
                pireps = runCatching {
                    EfbIntelligenceStore.fetchPireps(target, 150, 6)
                }.onFailure {
                    errors += "PIREP " + (it.message ?: "failed")
                }.getOrDefault(emptyList())
            }

            runOnUiThread {
                statusText.text =
                    if (errors.isEmpty()) {
                        "Updated " + DateFormat.getTimeInstance(DateFormat.SHORT).format(Date())
                    } else {
                        errors.joinToString(" • ")
                    }
                renderModules()
            }
        }.start()
    }

    private fun renderModules() {
        while (body.childCount > 10) {
            body.removeViewAt(body.childCount - 1)
        }

        val notams = NotamStore.cached(this, focusIcao)?.items.orEmpty()

        ifEnabled("runway_condition") {
            body.addView(section("1  RUNWAY CONDITION / BRAKING ASSISTANT"))
            val conditions = EfbIntelligenceStore.runwayConditions(notams)
            body.addView(card(
                if (conditions.isEmpty()) {
                    "No runway-condition/braking keywords detected in the cached NOTAM set. " +
                        "This is not a declaration that the runway is dry or unrestricted."
                } else {
                    conditions.joinToString("\n\n") {
                        "RWY " + it.runway + "  •  " + it.severity + "\n" + it.text
                    }
                }
            ))
        }

        ifEnabled("hotspot_watch") {
            body.addView(section("2  AIRPORT HOTSPOT & RUNWAY INCURSION WATCH"))
            val hotspots = HotspotStore.forAirport(this, focusIcao)
            val text =
                if (hotspots.isEmpty()) {
                    "No printed HOT SPOT / HS label was detected in the current airport-chart text. " +
                        "JEPPIRAN will not invent hotspot locations."
                } else {
                    hotspots.joinToString("\n\n") { item ->
                        val proximity =
                            if (
                                lastLocation != null &&
                                item.latitude != null &&
                                item.longitude != null
                            ) {
                                val nm = AirportGeoStore.distanceNm(
                                    lastLocation!!.latitude,
                                    lastLocation!!.longitude,
                                    AirportGeoStore.Point(item.latitude, item.longitude)
                                )
                                if (nm < 0.4) {
                                    "  ⚠ HOTSPOT NEARBY " + "%.2f NM".format(nm)
                                } else {
                                    "  •  " + "%.2f NM".format(nm)
                                }
                            } else {
                                ""
                            }
                        item.label + proximity + " • " + item.chartName + "\n" + item.snippet
                    }
                }
            body.addView(card(text).apply {
                setOnClickListener {
                    if (hotspots.isNotEmpty()) {
                        openPage(hotspots.first().page)
                    }
                }
            })
        }

        ifEnabled("auto_phase") {
            body.addView(section("3  AUTOMATIC FLIGHT-PHASE MODE"))
            val plan = FlightPlanStore.load(this)
            val destination = AirportGeoStore.center(this, plan.destination)
            val phase = EfbIntelligenceStore.flightPhase(lastLocation, destination)
            val locationStatus =
                if (lastLocation == null) {
                    "No aircraft/device location available."
                } else {
                    val speedKt =
                        if (lastLocation!!.hasSpeed()) {
                            "%.0f kt".format(lastLocation!!.speed * 1.943844f)
                        } else {
                            "speed —"
                        }
                    "Position available • " + speedKt
                }
            body.addView(card(
                phase.first + "\n" + phase.second + "\n\n" + locationStatus +
                    if (plan.destination.isBlank()) {
                        "\nSet a destination above for arrival-distance logic."
                    } else {
                        "\nDestination: " + plan.destination
                    }
            ).apply {
                setOnClickListener {
                    ensureLocationPermission()
                }
            })
        }

        ifEnabled("weather_trend") {
            body.addView(section("4  WEATHER TREND • LAST 12 HOURS"))
            val display =
                if (trend.isEmpty()) {
                    "Tap REFRESH to request recent METAR history. " +
                        "Current cached METAR:\n" +
                        (FlightDataStore.cached(this, focusIcao)?.metar ?: "—")
                } else {
                    trend.takeLast(12).joinToString("\n") {
                        it.timeLabel + "  •  " + it.wind +
                            "  •  VIS " + it.visibility +
                            "  •  CIG " + it.ceiling
                    }
                }
            body.addView(card(display))
        }

        ifEnabled("pirep") {
            body.addView(section("5  NEARBY PIREP / AIREP"))
            body.addView(card(
                if (pireps.isEmpty()) {
                    "No report loaded. Tap REFRESH. Coverage is strongest in the U.S. and North Atlantic; " +
                        "an empty result is shown as empty rather than fabricated."
                } else {
                    pireps.take(10).joinToString("\n\n") {
                        it.timeLabel + " • " + it.altitude + " • " + it.summary + "\n" + it.raw
                    }
                }
            ))
        }

        ifEnabled("alternate") {
            body.addView(section("6  SMART ALTERNATE ASSISTANT"))
            val alternates = EfbIntelligenceStore.alternates(this, focusIcao, 6)
            body.addView(card(
                if (alternates.isEmpty()) {
                    "No georeferenced alternate candidates are available in this chart set."
                } else {
                    alternates.joinToString("\n\n") {
                        val metar = it.metar.ifBlank { "WX not cached" }
                        it.icao + "  " + it.airportName +
                            "\n" + "%.0f NM".format(it.distanceNm) +
                            " • APP " + it.approaches +
                            " • RWY IDs " + it.runwayCount +
                            " • NOTAM " + it.notamCount +
                            "\n" + metar.take(170)
                    }
                }
            ))
        }

        ifEnabled("approach_check") {
            body.addView(section("7  APPROACH COMPATIBILITY CHECKER"))
            val checks = EfbIntelligenceStore.approachChecks(this, focusIcao)
            val container = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
            if (checks.isEmpty()) {
                container.addView(card("No approach charts found."))
            } else {
                checks.take(20).forEach { item ->
                    container.addView(card(
                        item.chart.name +
                            "\n" + item.assessment +
                            "\n" + item.weatherLine +
                            if (item.minimaSource.isBlank()) {
                                ""
                            } else {
                                "\nMINIMA SOURCE: " + item.minimaSource.take(260)
                            } +
                            if (item.relatedNotams.isEmpty()) {
                                ""
                            } else {
                                "\nRELATED NOTAM: " +
                                    item.relatedNotams.joinToString(" | ") { it.text.take(160) }
                            }
                    ).apply {
                        setOnClickListener { openPage(item.chart.page) }
                    })
                }
            }
            body.addView(container)
        }

        ifEnabled("hot_notes") {
            body.addView(section("8  AIRPORT / PROCEDURE HOT NOTES"))
            val note = HotNotesStore.airportNote(this, focusIcao)
            body.addView(card(
                if (note.isBlank()) {
                    "No personal airport note. Tap to add one."
                } else {
                    "PERSONAL NOTE • " + focusIcao + "\n" + note + "\n\nTap to edit."
                }
            ).apply {
                setOnClickListener { editAirportNote() }
            })
        }

        ifEnabled("semantic_changes") {
            body.addView(section("9  CHART CHANGE VISUAL INTELLIGENCE"))
            val changes = EfbIntelligenceStore.changeInsights(this, focusIcao)
            body.addView(card(
                if (changes.isEmpty()) {
                    "No current-cycle change metadata is recorded for " + focusIcao + "."
                } else {
                    changes.take(20).joinToString("\n\n") {
                        it.category + "\n" + it.title +
                            if (it.detail.isBlank()) "" else "\n" + it.detail.take(260)
                    } + "\n\nTap to open Previous / Current / Changes Overlay."
                }
            ).apply {
                setOnClickListener {
                    startActivity(
                        Intent(this@EfbLabActivity, ChartChangesActivity::class.java)
                            .putExtra("ICAO", focusIcao)
                    )
                }
            })
        }

        ifEnabled("flight_pack") {
            body.addView(section("10  ONE-TAP DEPARTURE / ARRIVAL PACK"))
            val plan = FlightPlanStore.load(this)
            val airports = listOf(plan.origin, plan.destination, plan.alternate)
                .filter { it.isNotBlank() }
                .distinct()
            body.addView(card(
                if (airports.isEmpty()) {
                    "Set Origin / Destination / Alternate above, then tap this card."
                } else {
                    "PACK: " + airports.joinToString(" → ") +
                        "\nDownloads each airport chart PDF and refreshes its weather/NOTAM cache where configured." +
                        "\n\nTap to build offline pack."
                }
            ).apply {
                setOnClickListener { buildFlightPack(airports) }
            })
        }

        body.addView(TextView(this).apply {
            text =
                "EFB LAB is advisory. It must not be used as a substitute for current approved charts, " +
                    "operator procedures, aircraft limitations, ATC instructions or official briefing sources."
            textSize = 10.5f
            setTextColor(secondaryColor())
            setPadding(4.dp, 22.dp, 4.dp, 10.dp)
        })
    }

    private fun buildFlightPack(airports: List<String>) {
        if (airports.isEmpty()) return
        statusText.text = "Building offline flight pack…"

        Thread {
            val lines = mutableListOf<String>()
            airports.forEach { airport ->
                val result = runCatching {
                    OfflineBriefingStore.prefetch(this, airport)
                }.getOrElse {
                    lines += airport + " • failed: " + (it.message ?: "unknown")
                    return@forEach
                }
                lines += airport +
                    " • chart " + yesNo(result.airportPdf) +
                    " • WX " + yesNo(result.weather) +
                    " • NOTAM " + yesNo(result.notams)
            }

            runOnUiThread {
                statusText.text = "Offline pack complete"
                AlertDialog.Builder(this)
                    .setTitle("Flight Pack")
                    .setMessage(lines.joinToString("\n"))
                    .setPositiveButton("OK", null)
                    .show()
            }
        }.start()
    }

    private fun editAirportNote() {
        val input = EditText(this).apply {
            setText(HotNotesStore.airportNote(this@EfbLabActivity, focusIcao))
            hint = "Personal note for " + focusIcao
            minLines = 5
            setSelection(text.length)
        }

        AlertDialog.Builder(this)
            .setTitle("Hot Note • " + focusIcao)
            .setView(input)
            .setNegativeButton("Cancel", null)
            .setNeutralButton("Clear") { _, _ ->
                HotNotesStore.setAirportNote(this, focusIcao, "")
                renderModules()
            }
            .setPositiveButton("Save") { _, _ ->
                HotNotesStore.setAirportNote(this, focusIcao, input.text.toString())
                renderModules()
            }
            .show()
    }

    private fun showModuleDialog() {
        val features = ExperimentalFeatureStore.features
        val checked = BooleanArray(features.size) {
            ExperimentalFeatureStore.isEnabled(this, features[it].key)
        }

        AlertDialog.Builder(this)
            .setTitle("EFB Lab Modules")
            .setMultiChoiceItems(
                features.map { it.title }.toTypedArray(),
                checked
            ) { _, which, value ->
                checked[which] = value
            }
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Apply") { _, _ ->
                features.forEachIndexed { index, feature ->
                    ExperimentalFeatureStore.setEnabled(this, feature.key, checked[index])
                }
                renderModules()
            }
            .show()
    }

    private fun ensureLocationPermission() {
        if (
            ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED ||
            ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED
        ) {
            updateLastLocation()
            renderModules()
            return
        }

        permissionLauncher.launch(
            arrayOf(
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            )
        )
    }

    private fun updateLastLocation() {
        val fine = ActivityCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        val coarse = ActivityCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        if (!fine && !coarse) return

        val manager = getSystemService(LocationManager::class.java)
        val candidates = listOf(
            LocationManager.GPS_PROVIDER,
            LocationManager.NETWORK_PROVIDER
        ).mapNotNull { provider ->
            runCatching { manager.getLastKnownLocation(provider) }.getOrNull()
        }

        lastLocation = candidates.maxByOrNull { it.time }
    }

    private fun openPage(page: Int) {
        val chart = repository.getChartForPage(focusIcao, page) ?: return
        startActivity(
            Intent(this, PdfViewerActivity::class.java).apply {
                putExtra("PAGE", chart.page)
                putExtra("TITLE", chart.name)
                putExtra("ICAO", chart.icao)
                putExtra("AIRPORT_NAME", chart.airportName)
                putExtra("CITY", chart.city)
                putExtra("CATEGORY", chart.category)
            }
        )
    }

    private inline fun ifEnabled(key: String, block: () -> Unit) {
        if (ExperimentalFeatureStore.isEnabled(this, key)) block()
    }

    private fun label(value: String) = TextView(this).apply {
        text = value
        textSize = 11f
        typeface = Typeface.DEFAULT_BOLD
        setTextColor(secondaryColor())
        setPadding(2.dp, 10.dp, 2.dp, 6.dp)
    }

    private fun field(value: String, hintValue: String) = EditText(this).apply {
        setText(value)
        hint = hintValue
        isSingleLine = true
        textSize = 14f
        setTextColor(textColor())
        setHintTextColor(secondaryColor())
        background = panelBackground()
        setPadding(13.dp, 0, 13.dp, 0)
    }

    private fun fieldParams() = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        50.dp
    ).apply { setMargins(0, 2.dp, 0, 4.dp) }

    private fun section(value: String) = TextView(this).apply {
        text = value
        textSize = 12f
        typeface = Typeface.DEFAULT_BOLD
        setTextColor(getColor(R.color.jeppiran_accent))
        setPadding(3.dp, 18.dp, 3.dp, 7.dp)
    }

    private fun card(value: String) = TextView(this).apply {
        text = value
        textSize = 13f
        setTextColor(textColor())
        setTextIsSelectable(true)
        setPadding(14.dp, 13.dp, 14.dp, 13.dp)
        background = panelBackground()
        isClickable = true
        isFocusable = true
    }

    private fun action(value: String, click: () -> Unit) = TextView(this).apply {
        text = value
        textSize = 11f
        typeface = Typeface.DEFAULT_BOLD
        gravity = Gravity.CENTER
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

    private fun panelBackground() = GradientDrawable().apply {
        cornerRadius = 16.dp.toFloat()
        setColor(getColor(R.color.jeppiran_surface))
        setStroke(1.dp, getColor(R.color.jeppiran_card_stroke))
    }

    private fun textColor(): Int = getColor(R.color.jeppiran_text)
    private fun secondaryColor(): Int = getColor(R.color.jeppiran_text_secondary)
    private fun yesNo(value: Boolean) = if (value) "✓" else "—"

    private val Int.dp: Int
        get() = (this * resources.displayMetrics.density).toInt()
}
