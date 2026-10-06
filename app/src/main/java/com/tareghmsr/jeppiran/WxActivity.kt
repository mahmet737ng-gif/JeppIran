package com.tareghmsr.jeppiran

import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.text.InputFilter
import android.text.InputType
import android.view.Gravity
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Spinner
import android.widget.TextView
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.concurrent.thread

class WxActivity : AppCompatActivity() {

    companion object {
        private const val PREFS = "jeppiran_wx_cache"
        private const val LAST_ICAO = "last_icao"
        private const val TIMEOUT_MS = 15000
    }

    private lateinit var icaoInput: EditText
    private lateinit var statusText: TextView
    private lateinit var metarText: TextView
    private lateinit var tafText: TextView
    private lateinit var refreshButton: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        ThemeManager.apply(this)
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        buildUi()
    }

    private fun buildUi() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(backgroundColor())
        }

        val scroll = ScrollView(this)
        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(20.dp, 18.dp, 20.dp, 32.dp)
        }

        content.addView(TextView(this).apply {
            text = "WX"
            textSize = 27f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(primaryTextColor())
        })

        content.addView(TextView(this).apply {
            text = "Latest aviation weather for an ICAO station"
            textSize = 13f
            setTextColor(secondaryTextColor())
            setPadding(0, 4.dp, 0, 18.dp)
        })

        val airports = ChartRepository.airports().sortedBy { airport ->
            airport.icao
        }

        val airportLabels = airports.map { airport ->
            airport.icao + "   " + airport.airportName
        }

        content.addView(sectionTitle("CHART AIRPORT"))

        val airportSpinner = Spinner(this).apply {
            adapter = ArrayAdapter(
                this@WxActivity,
                android.R.layout.simple_spinner_dropdown_item,
                airportLabels
            )
            background = surfaceBackground()
        }

        content.addView(
            airportSpinner,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                54.dp
            ).apply {
                bottomMargin = 10.dp
            }
        )

        content.addView(sectionTitle("ICAO"))

        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }

        icaoInput = EditText(this).apply {
            hint = "OIII"
            textSize = 18f
            isSingleLine = true
            inputType =
                InputType.TYPE_CLASS_TEXT or
                    InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS
            filters = arrayOf(InputFilter.LengthFilter(4))
            setTextColor(primaryTextColor())
            setHintTextColor(secondaryTextColor())
            background = surfaceBackground()
            setPadding(16.dp, 0, 16.dp, 0)
        }

        row.addView(
            icaoInput,
            LinearLayout.LayoutParams(
                0,
                54.dp,
                1f
            ).apply {
                rightMargin = 10.dp
            }
        )

        refreshButton = Button(this).apply {
            text = "REFRESH"
            setOnClickListener {
                refreshWeather()
            }
        }

        row.addView(
            refreshButton,
            LinearLayout.LayoutParams(
                112.dp,
                54.dp
            )
        )

        content.addView(row)

        statusText = TextView(this).apply {
            textSize = 12f
            setTextColor(secondaryTextColor())
            setPadding(4.dp, 8.dp, 4.dp, 8.dp)
        }
        content.addView(statusText)

        content.addView(sectionTitle("METAR"))
        metarText = weatherCard()
        content.addView(
            metarText,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )

        content.addView(sectionTitle("TAF"))
        tafText = weatherCard()
        content.addView(
            tafText,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )

        content.addView(TextView(this).apply {
            text =
                "Source: AviationWeather.gov • Cached reports remain visible if the network is temporarily unavailable."
            textSize = 11f
            setTextColor(secondaryTextColor())
            setPadding(2.dp, 20.dp, 2.dp, 0)
        })

        scroll.addView(content)

        root.addView(
            scroll,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1f
            )
        )

        setContentView(root)

        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val bars =
                insets.getInsets(
                    WindowInsetsCompat.Type.systemBars()
                )

            view.setPadding(
                bars.left,
                bars.top,
                bars.right,
                bars.bottom
            )

            insets
        }

        ViewCompat.requestApplyInsets(root)

        val prefs =
            getSharedPreferences(
                PREFS,
                MODE_PRIVATE
            )

        val saved =
            prefs.getString(
                LAST_ICAO,
                "OIII"
            )
                .orEmpty()
                .uppercase(Locale.US)
                .ifBlank { "OIII" }

        icaoInput.setText(saved)

        val savedIndex =
            airports.indexOfFirst { airport ->
                airport.icao == saved
            }

        if (savedIndex >= 0) {
            airportSpinner.setSelection(savedIndex)
        }

        airportSpinner.onItemSelectedListener =
            object : android.widget.AdapterView.OnItemSelectedListener {

                override fun onItemSelected(
                    parent: android.widget.AdapterView<*>?,
                    view: android.view.View?,
                    position: Int,
                    id: Long
                ) {
                    val airport =
                        airports.getOrNull(position)
                            ?: return

                    icaoInput.setText(
                        airport.icao
                    )

                    showCached(
                        airport.icao
                    )
                }

                override fun onNothingSelected(
                    parent: android.widget.AdapterView<*>?
                ) {
                }
            }

        showCached(saved)
    }

    private fun weatherCard(): TextView =
        TextView(this).apply {
            text = "No cached report."
            textSize = 15f
            typeface = Typeface.MONOSPACE
            setTextColor(primaryTextColor())
            setLineSpacing(4f, 1.08f)
            setPadding(16.dp, 16.dp, 16.dp, 16.dp)
            background = surfaceBackground()
        }

    private fun refreshWeather() {
        val icao =
            icaoInput.text
                .toString()
                .trim()
                .uppercase(Locale.US)

        if (!Regex("^[A-Z]{4}$").matches(icao)) {
            statusText.text =
                "Enter a valid four-letter ICAO code."
            return
        }

        getSharedPreferences(
            PREFS,
            MODE_PRIVATE
        )
            .edit()
            .putString(
                LAST_ICAO,
                icao
            )
            .apply()

        showCached(icao)

        refreshButton.isEnabled = false
        statusText.text =
            icao + " • updating…"

        thread(
            name = "JeppIran-WX"
        ) {
            val metarResult =
                runCatching {
                    fetchRaw(
                        "metar",
                        icao
                    )
                }

            val tafResult =
                runCatching {
                    fetchRaw(
                        "taf",
                        icao
                    )
                }

            val metar =
                metarResult.getOrNull()
                    .orEmpty()
                    .trim()

            val taf =
                tafResult.getOrNull()
                    .orEmpty()
                    .trim()

            val now =
                System.currentTimeMillis()

            if (
                metarResult.isSuccess ||
                tafResult.isSuccess
            ) {
                getSharedPreferences(
                    PREFS,
                    MODE_PRIVATE
                )
                    .edit()
                    .putString(
                        "metar_" + icao,
                        metar
                    )
                    .putString(
                        "taf_" + icao,
                        taf
                    )
                    .putLong(
                        "time_" + icao,
                        now
                    )
                    .apply()
            }

            runOnUiThread {
                refreshButton.isEnabled = true

                if (
                    metarResult.isFailure &&
                    tafResult.isFailure
                ) {
                    statusText.text =
                        icao + " • network unavailable • showing cache"

                    showCached(
                        icao
                    )

                    return@runOnUiThread
                }

                metarText.text =
                    metar.ifBlank {
                        "No current METAR available for " + icao + "."
                    }

                tafText.text =
                    taf.ifBlank {
                        "No current TAF available for " + icao + "."
                    }

                statusText.text =
                    icao + " • updated " + formatTime(now)
            }
        }
    }

    private fun fetchRaw(
        product: String,
        icao: String
    ): String {
        var connection:
            HttpURLConnection? =
            null

        try {
            connection =
                URL(
                    "https://aviationweather.gov/api/data/" +
                        product +
                        "?ids=" +
                        icao +
                        "&format=raw"
                )
                    .openConnection()
                    as HttpURLConnection

            connection.connectTimeout =
                TIMEOUT_MS

            connection.readTimeout =
                TIMEOUT_MS

            connection.requestMethod =
                "GET"

            connection.setRequestProperty(
                "Accept",
                "text/plain"
            )

            connection.setRequestProperty(
                "User-Agent",
                "JEPPIRAN/1.0 Android aviation chart client"
            )

            val code =
                connection.responseCode

            if (
                code !in
                200..299
            ) {
                error(
                    "HTTP " + code
                )
            }

            return connection
                .inputStream
                .bufferedReader()
                .use { reader ->
                    reader.readText()
                }

        } finally {
            connection?.disconnect()
        }
    }

    private fun showCached(
        icao: String
    ) {
        val prefs =
            getSharedPreferences(
                PREFS,
                MODE_PRIVATE
            )

        val metar =
            prefs.getString(
                "metar_" + icao,
                ""
            )
                .orEmpty()

        val taf =
            prefs.getString(
                "taf_" + icao,
                ""
            )
                .orEmpty()

        val time =
            prefs.getLong(
                "time_" + icao,
                0L
            )

        metarText.text =
            metar.ifBlank {
                "No cached METAR for " + icao + "."
            }

        tafText.text =
            taf.ifBlank {
                "No cached TAF for " + icao + "."
            }

        statusText.text =
            if (
                time > 0L
            ) {

                icao + " • cached " + formatTime(time)

            } else {

                icao + " • no cached weather yet"
            }
    }

    private fun formatTime(
        millis: Long
    ): String =
        SimpleDateFormat(
            "dd MMM HH:mm",
            Locale.US
        )
            .format(
                Date(millis)
            )

    private fun sectionTitle(
        value: String
    ): TextView =
        TextView(this).apply {
            text = value
            textSize = 12f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(secondaryTextColor())
            setPadding(2.dp, 18.dp, 2.dp, 8.dp)
        }

    private fun surfaceBackground() =
        GradientDrawable().apply {
            shape =
                GradientDrawable.RECTANGLE

            cornerRadius =
                14.dp.toFloat()

            setColor(
                if (
                    isDarkTheme()
                ) {

                    Color.rgb(
                        25,
                        35,
                        45
                    )

                } else {

                    Color.WHITE
                }
            )

            setStroke(
                1.dp,
                if (
                    isDarkTheme()
                ) {

                    Color.rgb(
                        55,
                        70,
                        84
                    )

                } else {

                    Color.rgb(
                        224,
                        230,
                        236
                    )
                }
            )
        }

    private fun backgroundColor() =
        if (
            isDarkTheme()
        ) {

            Color.rgb(
                14,
                22,
                30
            )

        } else {

            Color.rgb(
                244,
                247,
                250
            )
        }

    private fun primaryTextColor() =
        if (
            isDarkTheme()
        ) {

            Color.rgb(
                241,
                245,
                248
            )

        } else {

            Color.rgb(
                18,
                32,
                48
            )
        }

    private fun secondaryTextColor() =
        if (
            isDarkTheme()
        ) {

            Color.rgb(
                158,
                174,
                187
            )

        } else {

            Color.rgb(
                91,
                107,
                122
            )
        }

    private fun isDarkTheme() =
        (
            resources.configuration.uiMode and
                android.content.res.Configuration
                    .UI_MODE_NIGHT_MASK
            ) ==
            android.content.res.Configuration
                .UI_MODE_NIGHT_YES

    private val Int.dp: Int
        get() =
            (
                this *
                    resources
                        .displayMetrics
                        .density
                ).toInt()
}
