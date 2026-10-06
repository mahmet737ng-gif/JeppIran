package com.tareghmsr.jeppiran

import android.content.Intent
import android.content.res.Configuration
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.Editable
import android.text.TextWatcher
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.PopupMenu
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import org.json.JSONArray
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale
import kotlin.concurrent.thread
import kotlin.math.min

class ChartsActivity : AppCompatActivity() {

    private data class WeatherInfo(
        val raw: String,
        val category: String,
        val tempC: String,
        val wind: String
    )

    private data class AirportMeta(
        val country: String,
        val region: String,
        val flag: String
    )

    private lateinit var root: FrameLayout
    private lateinit var contentRoot: LinearLayout
    private lateinit var listContainer: LinearLayout
    private lateinit var searchBox: EditText
    private lateinit var airportCountText: TextView
    private lateinit var sortText: TextView
    private lateinit var regionText: TextView

    private lateinit var repository: ChartRepository

    private var allAirports = emptyList<ChartRepository.AirportInfo>()
    private val weatherByIcao = linkedMapOf<String, WeatherInfo>()
    private val countsByIcao = linkedMapOf<String, Map<String, Int>>()

    private var sortField = "ICAO"
    private var sortAscending = true
    private var selectedRegion = "All Regions"

    private val weatherHandler = Handler(Looper.getMainLooper())

    private val weatherRefreshRunnable =
        object : Runnable {
            override fun run() {
                refreshWeather()
                weatherHandler.postDelayed(
                    this,
                    5 * 60 * 1000L
                )
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        ThemeManager.apply(this)
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        repository = ChartRepository(this)
        allAirports = repository.getAirports()

        allAirports.forEach { airport ->
            countsByIcao[airport.icao] =
                repository
                    .getDisplayChartsForAirport(airport.icao)
                    .groupingBy {
                        ChartRepository.normalizeCategory(it.category)
                    }
                    .eachCount()
        }

        buildUi()
        renderAirports()
        refreshWeather()

        weatherHandler.postDelayed(
            weatherRefreshRunnable,
            5 * 60 * 1000L
        )
    }

    override fun onDestroy() {
        weatherHandler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }

    private fun buildUi() {
        root = FrameLayout(this)

        root.addView(
            AviationBackdropView(this),
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        )

        contentRoot =
            LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
            }

        root.addView(
            contentRoot,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        )

        contentRoot.addView(buildTopBar())
        contentRoot.addView(buildTitleBlock())
        contentRoot.addView(buildSearchBar())
        contentRoot.addView(buildSummaryBar())

        val scroll =
            ScrollView(this).apply {
                isFillViewport = true
                overScrollMode = ScrollView.OVER_SCROLL_IF_CONTENT_SCROLLS
                clipToPadding = false
            }

        listContainer =
            LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(14.dp, 4.dp, 14.dp, 20.dp)
            }

        scroll.addView(
            listContainer,
            ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
        )

        contentRoot.addView(
            scroll,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1f
            )
        )

        setContentView(root)

        ViewCompat.setOnApplyWindowInsetsListener(root) { _, insets ->
            val bars =
                insets.getInsets(
                    WindowInsetsCompat.Type.systemBars()
                )

            contentRoot.setPadding(
                bars.left,
                bars.top,
                bars.right,
                bars.bottom
            )

            insets
        }

        ViewCompat.requestApplyInsets(root)
    }

    private fun buildTopBar(): View {
        val bar =
            LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(16.dp, 10.dp, 16.dp, 4.dp)
            }

        val menu =
            glassButton("☰", 22f).apply {
                contentDescription = "Menu"
                setOnClickListener {
                    showTopMenu(this)
                }
            }

        bar.addView(
            menu,
            LinearLayout.LayoutParams(
                52.dp,
                52.dp
            )
        )

        val brand =
            LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER
            }

        brand.addView(
            TextView(this).apply {
                text = "➤"
                textSize = 29f
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(accent())
                rotation = -12f
                gravity = Gravity.CENTER
            },
            LinearLayout.LayoutParams(
                42.dp,
                52.dp
            )
        )

        brand.addView(
            TextView(this).apply {
                text = "JEPPIRAN"
                textSize = 23f
                letterSpacing = 0.07f
                typeface = Typeface.create("sans-serif", Typeface.BOLD)
                setTextColor(primaryText())
                gravity = Gravity.CENTER_VERTICAL
            }
        )

        bar.addView(
            brand,
            LinearLayout.LayoutParams(
                0,
                56.dp,
                1f
            )
        )

        val weather =
            glassButton("☀☁", 16f).apply {
                contentDescription = "Weather"
                setOnClickListener {
                    startActivity(
                        Intent(
                            this@ChartsActivity,
                            WxActivity::class.java
                        )
                    )
                }
            }

        val aircraft =
            glassButton("✈", 22f).apply {
                contentDescription = "Simulator"
                setOnClickListener {
                    startActivity(
                        Intent(
                            this@ChartsActivity,
                            SimulatorActivity::class.java
                        )
                    )
                }
            }

        val theme =
            glassButton(
                if (isDarkTheme()) "☾" else "☀",
                22f
            ).apply {
                contentDescription = "Toggle theme"
                setOnClickListener {
                    ThemeManager.setTheme(
                        this@ChartsActivity,
                        if (isDarkTheme()) {
                            ThemeManager.LIGHT
                        } else {
                            ThemeManager.DARK
                        }
                    )
                    recreate()
                }
            }

        listOf(
            weather,
            aircraft,
            theme
        ).forEach { button ->
            bar.addView(
                button,
                LinearLayout.LayoutParams(
                    52.dp,
                    52.dp
                ).apply {
                    marginStart = 6.dp
                }
            )
        }

        return bar
    }

    private fun buildTitleBlock(): View {
        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(20.dp, 5.dp, 20.dp, 7.dp)

            addView(
                TextView(this@ChartsActivity).apply {
                    text = "AIRPORT CHARTS"
                    textSize = 30f
                    typeface = Typeface.create("sans-serif", Typeface.BOLD)
                    setTextColor(primaryText())
                }
            )

            addView(
                TextView(this@ChartsActivity).apply {
                    text = "Browse and view aeronautical charts"
                    textSize = 14f
                    setTextColor(secondaryText())
                    setPadding(0, 2.dp, 0, 0)
                }
            )
        }
    }

    private fun buildSearchBar(): View {
        val row =
            LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(12.dp, 0, 8.dp, 0)
                background = panelBackground(22, true)
                elevation = 5.dp.toFloat()
            }

        row.addView(
            TextView(this).apply {
                text = "⌕"
                textSize = 28f
                gravity = Gravity.CENTER
                setTextColor(accentSoft())
            },
            LinearLayout.LayoutParams(
                42.dp,
                58.dp
            )
        )

        searchBox =
            EditText(this).apply {
                hint = "Search ICAO / Airport / City / Country"
                isSingleLine = true
                textSize = 15f
                background = null
                setTextColor(primaryText())
                setHintTextColor(secondaryText())
                importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_NO

                addTextChangedListener(
                    object : TextWatcher {
                        override fun beforeTextChanged(
                            s: CharSequence?,
                            start: Int,
                            count: Int,
                            after: Int
                        ) = Unit

                        override fun afterTextChanged(
                            s: Editable?
                        ) = Unit

                        override fun onTextChanged(
                            s: CharSequence?,
                            start: Int,
                            before: Int,
                            count: Int
                        ) {
                            renderAirports()
                        }
                    }
                )
            }

        row.addView(
            searchBox,
            LinearLayout.LayoutParams(
                0,
                58.dp,
                1f
            )
        )

        row.addView(
            glassButton("≡", 20f).apply {
                contentDescription = "Sort"
                setOnClickListener {
                    showSortDialog()
                }
            },
            LinearLayout.LayoutParams(
                48.dp,
                48.dp
            )
        )

        return FrameLayout(this).apply {
            setPadding(
                14.dp,
                4.dp,
                14.dp,
                8.dp
            )

            addView(
                row,
                FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    60.dp
                )
            )
        }
    }

    private fun buildSummaryBar(): View {
        val row =
            LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(8.dp, 4.dp, 8.dp, 4.dp)
                background = panelBackground(18, false)
            }

        val countCell = summaryCell("▣")
        airportCountText = countCell.second

        row.addView(
            countCell.first,
            LinearLayout.LayoutParams(
                0,
                62.dp,
                1f
            )
        )

        sortText =
            TextView(this).apply {
                textSize = 12f
                typeface = Typeface.DEFAULT_BOLD
                gravity = Gravity.CENTER
                setTextColor(primaryText())
                setPadding(5.dp, 0, 5.dp, 0)
                setOnClickListener {
                    showSortDialog()
                }
            }

        row.addView(
            sortText,
            LinearLayout.LayoutParams(
                0,
                62.dp,
                1f
            )
        )

        regionText =
            TextView(this).apply {
                textSize = 12f
                typeface = Typeface.DEFAULT_BOLD
                gravity = Gravity.CENTER
                setTextColor(primaryText())
                setPadding(5.dp, 0, 5.dp, 0)
                setOnClickListener {
                    showRegionDialog()
                }
            }

        row.addView(
            regionText,
            LinearLayout.LayoutParams(
                0,
                62.dp,
                1f
            )
        )

        updateSummaryTexts()

        return FrameLayout(this).apply {
            setPadding(
                14.dp,
                0,
                14.dp,
                8.dp
            )

            addView(
                row,
                FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    66.dp
                )
            )
        }
    }

    private fun summaryCell(
        icon: String
    ): Pair<View, TextView> {
        val box =
            LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER
            }

        box.addView(
            TextView(this).apply {
                text = icon
                textSize = 22f
                setTextColor(accent())
                gravity = Gravity.CENTER
            },
            LinearLayout.LayoutParams(
                34.dp,
                54.dp
            )
        )

        val textView =
            TextView(this).apply {
                textSize = 12f
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(primaryText())
                gravity = Gravity.CENTER_VERTICAL
            }

        box.addView(
            textView,
            LinearLayout.LayoutParams(
                0,
                54.dp,
                1f
            )
        )

        return box to textView
    }

    private fun updateSummaryTexts(
        visibleCount: Int = allAirports.size
    ) {
        if (::airportCountText.isInitialized) {
            airportCountText.text =
                visibleCount.toString() +
                    " Airports\nCharts available"
        }

        if (::sortText.isInitialized) {
            sortText.text =
                "Sorted by\n" +
                    sortField +
                    if (sortAscending) {
                        " (A → Z)"
                    } else {
                        " (Z → A)"
                    }
        }

        if (::regionText.isInitialized) {
            regionText.text =
                "◉  " +
                    selectedRegion +
                    "\nRegion"
        }
    }

    private fun renderAirports() {
        if (!::listContainer.isInitialized) {
            return
        }

        val query =
            if (::searchBox.isInitialized) {
                searchBox.text
                    ?.toString()
                    .orEmpty()
                    .trim()
                    .lowercase(Locale.US)
            } else {
                ""
            }

        var results =
            allAirports.filter { airport ->
                val meta =
                    airportMeta(
                        airport.icao
                    )

                val regionMatch =
                    selectedRegion ==
                        "All Regions" ||
                        meta.region ==
                            selectedRegion

                val searchMatch =
                    query.isBlank() ||
                        airport.icao
                            .lowercase(Locale.US)
                            .contains(query) ||
                        airport.airportName
                            .lowercase(Locale.US)
                            .contains(query) ||
                        airport.city
                            .lowercase(Locale.US)
                            .contains(query) ||
                        meta.country
                            .lowercase(Locale.US)
                            .contains(query)

                regionMatch &&
                    searchMatch
            }

        val comparator =
            compareBy<ChartRepository.AirportInfo> {
                when (sortField) {
                    "Airport" ->
                        it.airportName

                    "City" ->
                        it.city

                    "Country" ->
                        airportMeta(
                            it.icao
                        ).country

                    else ->
                        it.icao
                }
                    .uppercase(Locale.US)
            }

        results =
            if (sortAscending) {
                results.sortedWith(
                    comparator
                )
            } else {
                results.sortedWith(
                    comparator.reversed()
                )
            }

        updateSummaryTexts(
            results.size
        )

        listContainer.removeAllViews()

        if (results.isEmpty()) {
            listContainer.addView(
                TextView(this).apply {
                    text =
                        "No airports match this search or region."
                    textSize = 15f
                    gravity = Gravity.CENTER
                    setTextColor(secondaryText())
                    setPadding(
                        20.dp,
                        50.dp,
                        20.dp,
                        50.dp
                    )
                }
            )
            return
        }

        results.forEach { airport ->
            listContainer.addView(
                buildAirportCard(
                    airport
                ),
                LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    setMargins(
                        0,
                        5.dp,
                        0,
                        7.dp
                    )
                }
            )
        }
    }

    private fun buildAirportCard(
        airport: ChartRepository.AirportInfo
    ): View {
        val meta =
            airportMeta(
                airport.icao
            )

        val weather =
            weatherByIcao[
                airport.icao
            ]

        val category =
            weather
                ?.category
                ?.uppercase(Locale.US)
                .orEmpty()

        val counts =
            countsByIcao[
                airport.icao
            ].orEmpty()

        val card =
            FrameLayout(this).apply {
                background = cardBackground()
                elevation = 8.dp.toFloat()
                clipToOutline = true
                isClickable = true
                isFocusable = true

                setOnClickListener {
                    openAirport(
                        airport,
                        null
                    )
                }
            }

        card.addView(
            AirportArtView(
                this,
                airport.icao
            ),
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                170.dp
            )
        )

        val overlay =
            LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(
                    12.dp,
                    10.dp,
                    12.dp,
                    9.dp
                )
            }

        val top =
            LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
            }

        top.addView(
            TextView(this).apply {
                text = airport.icao
                textSize = 18f
                typeface = Typeface.DEFAULT_BOLD
                gravity = Gravity.CENTER
                setTextColor(Color.WHITE)
                background = icaoBackground()
            },
            LinearLayout.LayoutParams(
                82.dp,
                58.dp
            )
        )

        val names =
            LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(
                    12.dp,
                    0,
                    6.dp,
                    0
                )

                addView(
                    TextView(this@ChartsActivity).apply {
                        text = airport.airportName
                        textSize = 16f
                        maxLines = 2
                        typeface = Typeface.DEFAULT_BOLD
                        setTextColor(primaryText())
                    }
                )

                addView(
                    TextView(this@ChartsActivity).apply {
                        text =
                            meta.flag +
                                "  " +
                                airport.city.titleCase() +
                                " • " +
                                meta.country
                        textSize = 12f
                        setTextColor(secondaryText())
                        setPadding(
                            0,
                            2.dp,
                            0,
                            0
                        )
                    }
                )
            }

        top.addView(
            names,
            LinearLayout.LayoutParams(
                0,
                64.dp,
                1f
            )
        )

        top.addView(
            WeatherGlyphView(
                this,
                category
            ),
            LinearLayout.LayoutParams(
                42.dp,
                42.dp
            )
        )

        top.addView(
            TextView(this).apply {
                text =
                    if (category.isBlank()) {
                        "WX"
                    } else {
                        category
                    }

                textSize = 12f
                typeface = Typeface.DEFAULT_BOLD
                gravity = Gravity.CENTER
                setTextColor(
                    flightCategoryColor(
                        category
                    )
                )
                background =
                    flightCategoryBackground(
                        category
                    )
            },
            LinearLayout.LayoutParams(
                64.dp,
                34.dp
            ).apply {
                marginStart = 6.dp
            }
        )

        overlay.addView(top)

        overlay.addView(
            TextView(this).apply {
                text =
                    if (weather == null) {
                        airport.icao +
                            " METAR • loading weather…"
                    } else {
                        weather.raw +
                            if (weather.tempC.isBlank()) {
                                ""
                            } else {
                                "   " +
                                    weather.tempC
                            } +
                            if (weather.wind.isBlank()) {
                                ""
                            } else {
                                "   " +
                                    weather.wind
                            }
                    }

                maxLines = 2
                textSize = 10.5f

                setTextColor(
                    if (isDarkTheme()) {
                        Color.rgb(
                            164,
                            196,
                            228
                        )
                    } else {
                        Color.rgb(
                            58,
                            91,
                            123
                        )
                    }
                )

                setPadding(
                    94.dp,
                    2.dp,
                    2.dp,
                    5.dp
                )
            }
        )

        overlay.addView(
            View(this).apply {
                setBackgroundColor(
                    if (isDarkTheme()) {
                        Color.argb(
                            120,
                            0,
                            180,
                            255
                        )
                    } else {
                        Color.argb(
                            90,
                            22,
                            102,
                            164
                        )
                    }
                )
            },
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                1.dp
            )
        )

        val countRow =
            LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER
                setPadding(
                    82.dp,
                    4.dp,
                    0,
                    0
                )
            }

        countRow.addView(
            categoryChip(
                airport,
                "★",
                "STAR",
                "STAR",
                counts["STAR"] ?: 0
            ),
            LinearLayout.LayoutParams(
                0,
                52.dp,
                1f
            )
        )

        countRow.addView(
            categoryChip(
                airport,
                "↑",
                "SID",
                "SID",
                counts["SID"] ?: 0
            ),
            LinearLayout.LayoutParams(
                0,
                52.dp,
                1f
            )
        )

        countRow.addView(
            categoryChip(
                airport,
                "▣",
                "AIRPORT",
                "Airport",
                counts["Airport"] ?: 0
            ),
            LinearLayout.LayoutParams(
                0,
                52.dp,
                1f
            )
        )

        countRow.addView(
            categoryChip(
                airport,
                "◎",
                "APP",
                "Approach",
                counts["Approach"] ?: 0
            ),
            LinearLayout.LayoutParams(
                0,
                52.dp,
                1f
            )
        )

        countRow.addView(
            TextView(this).apply {
                text = "›"
                textSize = 28f
                gravity = Gravity.CENTER
                setTextColor(primaryText())
            },
            LinearLayout.LayoutParams(
                32.dp,
                52.dp
            )
        )

        overlay.addView(countRow)

        card.addView(
            overlay,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                170.dp
            )
        )

        return card
    }

    private fun categoryChip(
        airport: ChartRepository.AirportInfo,
        icon: String,
        label: String,
        category: String,
        count: Int
    ): View {
        return LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            isClickable = true
            isFocusable = true

            setOnClickListener {
                openAirport(
                    airport,
                    category
                )
            }

            addView(
                TextView(this@ChartsActivity).apply {
                    text = icon
                    textSize = 18f
                    setTextColor(accent())
                    gravity = Gravity.CENTER
                },
                LinearLayout.LayoutParams(
                    28.dp,
                    44.dp
                )
            )

            addView(
                TextView(this@ChartsActivity).apply {
                    text =
                        label +
                            "\n" +
                            count.toString()

                    textSize = 9.5f
                    typeface = Typeface.DEFAULT_BOLD
                    gravity = Gravity.CENTER_VERTICAL
                    setTextColor(primaryText())
                },
                LinearLayout.LayoutParams(
                    0,
                    44.dp,
                    1f
                )
            )
        }
    }

    private fun showTopMenu(
        anchor: View
    ) {
        PopupMenu(
            this,
            anchor
        ).apply {
            menu.add("Settings")
            menu.add("Info")

            setOnMenuItemClickListener {
                when (
                    it.title.toString()
                ) {
                    "Settings" ->
                        startActivity(
                            Intent(
                                this@ChartsActivity,
                                SettingsActivity::class.java
                            )
                        )

                    "Info" ->
                        startActivity(
                            Intent(
                                this@ChartsActivity,
                                InfoActivity::class.java
                            )
                        )
                }

                true
            }

            show()
        }
    }

    private fun showSortDialog() {
        val labels =
            arrayOf(
                "ICAO  A → Z",
                "ICAO  Z → A",
                "Airport  A → Z",
                "Airport  Z → A",
                "City  A → Z",
                "City  Z → A",
                "Country  A → Z",
                "Country  Z → A"
            )

        androidx.appcompat.app.AlertDialog
            .Builder(this)
            .setTitle("Sort airports")
            .setItems(
                labels
            ) { _, which ->
                sortField =
                    when (
                        which / 2
                    ) {
                        1 -> "Airport"
                        2 -> "City"
                        3 -> "Country"
                        else -> "ICAO"
                    }

                sortAscending =
                    which % 2 == 0

                renderAirports()
            }
            .show()
    }

    private fun showRegionDialog() {
        val regions =
            arrayOf(
                "All Regions",
                "Middle East",
                "East Europe",
                "West Europe"
            )

        androidx.appcompat.app.AlertDialog
            .Builder(this)
            .setTitle("Region")
            .setSingleChoiceItems(
                regions,
                regions.indexOf(
                    selectedRegion
                ).coerceAtLeast(
                    0
                )
            ) {
                    dialog,
                    which ->

                selectedRegion =
                    regions[
                        which
                    ]

                renderAirports()
                dialog.dismiss()
            }
            .show()
    }

    private fun openAirport(
        airport: ChartRepository.AirportInfo,
        category: String?
    ) {
        val intent =
            Intent(
                this,
                AirportChartsActivity::class.java
            )
                .putExtra(
                    "ICAO",
                    airport.icao
                )
                .putExtra(
                    "AIRPORT_NAME",
                    airport.airportName
                )
                .putExtra(
                    "CITY",
                    airport.city
                )

        if (
            !category.isNullOrBlank()
        ) {
            intent.putExtra(
                "CATEGORY",
                category
            )
        }

        startActivity(
            intent
        )
    }

    private fun refreshWeather() {
        if (
            allAirports.isEmpty()
        ) {
            return
        }

        val ids =
            allAirports.joinToString(
                ","
            ) {
                it.icao
            }

        thread {
            var connection:
                HttpURLConnection? =
                null

            try {
                connection =
                    URL(
                        "https://aviationweather.gov/api/data/metar" +
                            "?ids=" +
                            ids +
                            "&format=json"
                    )
                        .openConnection()
                        as HttpURLConnection

                connection.connectTimeout =
                    15000

                connection.readTimeout =
                    15000

                connection.requestMethod =
                    "GET"

                connection.setRequestProperty(
                    "Accept",
                    "application/json"
                )

                connection.setRequestProperty(
                    "User-Agent",
                    "JeppIran/1.0"
                )

                connection.connect()

                if (
                    connection.responseCode !in
                    200..299
                ) {
                    return@thread
                }

                val body =
                    connection
                        .inputStream
                        .bufferedReader()
                        .use {
                            it.readText()
                        }

                val array =
                    JSONArray(
                        body
                    )

                val newMap =
                    linkedMapOf<
                        String,
                        WeatherInfo
                    >()

                for (
                    index in
                    0 until array.length()
                ) {
                    val item =
                        array.optJSONObject(
                            index
                        )
                            ?: continue

                    val icao =
                        item.optString(
                            "icaoId",
                            ""
                        )
                            .trim()
                            .uppercase(
                                Locale.US
                            )

                    if (
                        icao.isBlank()
                    ) {
                        continue
                    }

                    val raw =
                        item.optString(
                            "rawOb",
                            ""
                        )
                            .trim()

                    val category =
                        item.optString(
                            "fltCat",
                            ""
                        )
                            .trim()
                            .uppercase(
                                Locale.US
                            )
                            .ifBlank {
                                deriveFlightCategory(
                                    raw
                                )
                            }

                    val tempRaw =
                        item.optString(
                            "temp",
                            ""
                        )
                            .trim()

                    val temp =
                        if (
                            tempRaw.isBlank()
                        ) {
                            ""
                        } else {
                            tempRaw +
                                "°C"
                        }

                    val direction =
                        item.optString(
                            "wdir",
                            ""
                        )
                            .trim()

                    val speed =
                        item.optString(
                            "wspd",
                            ""
                        )
                            .trim()

                    val wind =
                        if (
                            direction.isBlank() &&
                            speed.isBlank()
                        ) {
                            ""
                        } else {
                            direction.ifBlank {
                                "---"
                            } +
                                "° " +
                                speed.ifBlank {
                                    "0"
                                } +
                                "KT"
                        }

                    newMap[
                        icao
                    ] =
                        WeatherInfo(
                            raw =
                                raw.ifBlank {
                                    icao +
                                        " METAR • no report available"
                                },
                            category =
                                category,
                            tempC =
                                temp,
                            wind =
                                wind
                        )
                }

                runOnUiThread {
                    weatherByIcao.putAll(
                        newMap
                    )
                    renderAirports()
                }

            } catch (
                _: Exception
            ) {
            } finally {
                connection?.disconnect()
            }
        }
    }

    private fun deriveFlightCategory(
        raw: String
    ): String {
        if (
            raw.isBlank()
        ) {
            return ""
        }

        var ceiling =
            Int.MAX_VALUE

        Regex(
            "(BKN|OVC|VV)(\\d{3})"
        )
            .findAll(
                raw
            )
            .forEach {
                match ->

                val hundreds =
                    match.groupValues
                        .getOrNull(
                            2
                        )
                        ?.toIntOrNull()
                        ?: return@forEach

                ceiling =
                    min(
                        ceiling,
                        hundreds * 100
                    )
            }

        var visibility =
            99.0

        val visMatch =
            Regex(
                "\\s(\\d+)(?:/(\\d+))?SM"
            )
                .find(
                    raw
                )

        if (
            visMatch != null
        ) {
            val whole =
                visMatch
                    .groupValues
                    .getOrNull(
                        1
                    )
                    ?.toDoubleOrNull()
                    ?: 99.0

            val denominator =
                visMatch
                    .groupValues
                    .getOrNull(
                        2
                    )
                    ?.toDoubleOrNull()

            visibility =
                if (
                    denominator != null &&
                    denominator > 0
                ) {
                    whole /
                        denominator
                } else {
                    whole
                }
        }

        return when {
            ceiling < 500 ||
                visibility < 1.0 ->
                "LIFR"

            ceiling < 1000 ||
                visibility < 3.0 ->
                "IFR"

            ceiling <= 3000 ||
                visibility <= 5.0 ->
                "MVFR"

            else ->
                "VFR"
        }
    }

    private fun airportMeta(
        icao: String
    ): AirportMeta {
        return when {
            icao == "LTFM" ->
                AirportMeta(
                    "Türkiye",
                    "East Europe",
                    "🇹🇷"
                )

            icao.startsWith("OI") ->
                AirportMeta(
                    "Iran",
                    "Middle East",
                    "🇮🇷"
                )

            icao.startsWith("OM") ->
                AirportMeta(
                    "United Arab Emirates",
                    "Middle East",
                    "🇦🇪"
                )

            icao.startsWith("OO") ->
                AirportMeta(
                    "Oman",
                    "Middle East",
                    "🇴🇲"
                )

            icao.startsWith("OR") ->
                AirportMeta(
                    "Iraq",
                    "Middle East",
                    "🇮🇶"
                )

            icao.startsWith("UD") ->
                AirportMeta(
                    "Armenia",
                    "East Europe",
                    "🇦🇲"
                )

            icao.startsWith("UG") ->
                AirportMeta(
                    "Georgia",
                    "East Europe",
                    "🇬🇪"
                )

            else ->
                AirportMeta(
                    "Unknown",
                    "Other",
                    "✈"
                )
        }
    }

    private fun String.titleCase():
        String {
        return lowercase(
            Locale.US
        )
            .split(
                " "
            )
            .joinToString(
                " "
            ) {
                word ->

                word.replaceFirstChar {
                    char ->

                    if (
                        char.isLowerCase()
                    ) {
                        char.titlecase(
                            Locale.US
                        )
                    } else {
                        char.toString()
                    }
                }
            }
    }

    private fun glassButton(
        label: String,
        size: Float
    ): TextView {
        return TextView(this).apply {
            text = label
            textSize = size
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            setTextColor(primaryText())
            background =
                panelBackground(
                    17,
                    true
                )
            elevation = 5.dp.toFloat()
            isClickable = true
            isFocusable = true
        }
    }

    private fun panelBackground(
        radius: Int,
        strong: Boolean
    ): GradientDrawable {
        val dark =
            isDarkTheme()

        return GradientDrawable().apply {
            shape =
                GradientDrawable.RECTANGLE

            cornerRadius =
                radius.dp.toFloat()

            colors =
                if (dark) {
                    intArrayOf(
                        Color.argb(
                            if (strong) 238 else 224,
                            4,
                            31,
                            68
                        ),
                        Color.argb(
                            if (strong) 244 else 228,
                            2,
                            17,
                            40
                        )
                    )
                } else {
                    intArrayOf(
                        Color.argb(
                            if (strong) 250 else 238,
                            255,
                            255,
                            255
                        ),
                        Color.argb(
                            if (strong) 248 else 232,
                            229,
                            243,
                            255
                        )
                    )
                }

            orientation =
                GradientDrawable
                    .Orientation
                    .TL_BR

            setStroke(
                1.dp,
                if (dark) {
                    Color.rgb(
                        0,
                        178,
                        255
                    )
                } else {
                    Color.rgb(
                        91,
                        166,
                        219
                    )
                }
            )
        }
    }

    private fun cardBackground():
        GradientDrawable {
        val dark =
            isDarkTheme()

        return GradientDrawable().apply {
            shape =
                GradientDrawable.RECTANGLE

            cornerRadius =
                22.dp.toFloat()

            colors =
                if (dark) {
                    intArrayOf(
                        Color.argb(
                            244,
                            3,
                            25,
                            55
                        ),
                        Color.argb(
                            246,
                            2,
                            14,
                            34
                        )
                    )
                } else {
                    intArrayOf(
                        Color.rgb(
                            253,
                            255,
                            255
                        ),
                        Color.rgb(
                            233,
                            246,
                            255
                        )
                    )
                }

            orientation =
                GradientDrawable
                    .Orientation
                    .LEFT_RIGHT

            setStroke(
                1.dp,
                if (dark) {
                    Color.rgb(
                        0,
                        190,
                        255
                    )
                } else {
                    Color.rgb(
                        76,
                        158,
                        214
                    )
                }
            )
        }
    }

    private fun icaoBackground():
        GradientDrawable {
        return GradientDrawable().apply {
            shape =
                GradientDrawable.RECTANGLE

            cornerRadius =
                14.dp.toFloat()

            colors =
                intArrayOf(
                    Color.rgb(
                        0,
                        185,
                        255
                    ),
                    Color.rgb(
                        0,
                        91,
                        204
                    )
                )

            orientation =
                GradientDrawable
                    .Orientation
                    .TL_BR

            setStroke(
                1.dp,
                Color.rgb(
                    89,
                    229,
                    255
                )
            )
        }
    }

    private fun flightCategoryBackground(
        category: String
    ): GradientDrawable {
        val color =
            flightCategoryColor(
                category
            )

        return GradientDrawable().apply {
            shape =
                GradientDrawable.RECTANGLE

            cornerRadius =
                17.dp.toFloat()

            setColor(
                Color.argb(
                    if (isDarkTheme()) {
                        84
                    } else {
                        48
                    },
                    Color.red(
                        color
                    ),
                    Color.green(
                        color
                    ),
                    Color.blue(
                        color
                    )
                )
            )

            setStroke(
                2.dp,
                color
            )
        }
    }

    private fun flightCategoryColor(
        category: String
    ): Int {
        return when (
            category.uppercase(
                Locale.US
            )
        ) {
            "VFR" ->
                Color.rgb(
                    45,
                    230,
                    132
                )

            "MVFR",
            "MARGINAL VFR" ->
                Color.rgb(
                    255,
                    213,
                    37
                )

            "IFR" ->
                Color.rgb(
                    38,
                    174,
                    255
                )

            "LIFR",
            "LIMITED IFR" ->
                Color.rgb(
                    255,
                    66,
                    73
                )

            else ->
                if (isDarkTheme()) {
                    Color.rgb(
                        155,
                        174,
                        191
                    )
                } else {
                    Color.rgb(
                        90,
                        112,
                        132
                    )
                }
        }
    }

    private fun primaryText():
        Int {
        return if (
            isDarkTheme()
        ) {
            Color.rgb(
                246,
                250,
                255
            )
        } else {
            Color.rgb(
                5,
                31,
                57
            )
        }
    }

    private fun secondaryText():
        Int {
        return if (
            isDarkTheme()
        ) {
            Color.rgb(
                164,
                185,
                207
            )
        } else {
            Color.rgb(
                72,
                96,
                120
            )
        }
    }

    private fun accent():
        Int {
        return Color.rgb(
            25,
            188,
            255
        )
    }

    private fun accentSoft():
        Int {
        return if (
            isDarkTheme()
        ) {
            Color.rgb(
                130,
                211,
                255
            )
        } else {
            Color.rgb(
                26,
                119,
                190
            )
        }
    }

    private fun isDarkTheme():
        Boolean {
        return (
            resources.configuration.uiMode and
                Configuration.UI_MODE_NIGHT_MASK
            ) ==
            Configuration.UI_MODE_NIGHT_YES
    }

    private inner class AviationBackdropView(
        context: android.content.Context
    ) :
        View(
            context
        ) {
        private val paint =
            Paint(
                Paint.ANTI_ALIAS_FLAG
            )

        private val line =
            Paint(
                Paint.ANTI_ALIAS_FLAG
            ).apply {
                style =
                    Paint.Style.STROKE
                strokeWidth =
                    1.2f
            }

        override fun onDraw(
            canvas: Canvas
        ) {
            super.onDraw(
                canvas
            )

            val widthValue =
                width.toFloat()
                    .coerceAtLeast(
                        1f
                    )

            val heightValue =
                height.toFloat()
                    .coerceAtLeast(
                        1f
                    )

            val dark =
                isDarkTheme()

            paint.shader =
                LinearGradient(
                    0f,
                    0f,
                    0f,
                    heightValue,
                    if (dark) {
                        intArrayOf(
                            Color.rgb(
                                0,
                                20,
                                50
                            ),
                            Color.rgb(
                                1,
                                12,
                                31
                            ),
                            Color.rgb(
                                1,
                                7,
                                19
                            )
                        )
                    } else {
                        intArrayOf(
                            Color.rgb(
                                229,
                                244,
                                255
                            ),
                            Color.rgb(
                                246,
                                251,
                                255
                            ),
                            Color.rgb(
                                235,
                                246,
                                255
                            )
                        )
                    },
                    null,
                    Shader.TileMode.CLAMP
                )

            canvas.drawRect(
                0f,
                0f,
                widthValue,
                heightValue,
                paint
            )

            paint.shader =
                RadialGradient(
                    widthValue * .72f,
                    heightValue * .10f,
                    widthValue * .58f,
                    if (dark) {
                        Color.argb(
                            110,
                            0,
                            119,
                            255
                        )
                    } else {
                        Color.argb(
                            90,
                            75,
                            177,
                            245
                        )
                    },
                    Color.TRANSPARENT,
                    Shader.TileMode.CLAMP
                )

            canvas.drawRect(
                0f,
                0f,
                widthValue,
                heightValue * .42f,
                paint
            )

            paint.shader =
                null

            line.color =
                if (dark) {
                    Color.argb(
                        48,
                        60,
                        189,
                        255
                    )
                } else {
                    Color.argb(
                        45,
                        31,
                        111,
                        172
                    )
                }

            repeat(
                7
            ) {
                index ->

                val radius =
                    widthValue *
                        (
                            .18f +
                                index *
                                    .11f
                            )

                canvas.drawCircle(
                    widthValue * .72f,
                    heightValue * .12f,
                    radius,
                    line
                )
            }

            val horizonY =
                heightValue * .17f

            paint.color =
                if (dark) {
                    Color.rgb(
                        4,
                        27,
                        51
                    )
                } else {
                    Color.rgb(
                        196,
                        224,
                        242
                    )
                }

            canvas.drawRect(
                0f,
                horizonY,
                widthValue,
                horizonY +
                    50.dp,
                paint
            )

            paint.color =
                if (dark) {
                    Color.rgb(
                        10,
                        46,
                        73
                    )
                } else {
                    Color.rgb(
                        162,
                        208,
                        232
                    )
                }

            val skyline =
                Path().apply {
                    moveTo(
                        0f,
                        horizonY +
                            50.dp
                    )
                    lineTo(
                        widthValue * .07f,
                        horizonY +
                            28.dp
                    )
                    lineTo(
                        widthValue * .16f,
                        horizonY +
                            38.dp
                    )
                    lineTo(
                        widthValue * .28f,
                        horizonY +
                            16.dp
                    )
                    lineTo(
                        widthValue * .40f,
                        horizonY +
                            34.dp
                    )
                    lineTo(
                        widthValue * .53f,
                        horizonY +
                            10.dp
                    )
                    lineTo(
                        widthValue * .66f,
                        horizonY +
                            31.dp
                    )
                    lineTo(
                        widthValue * .80f,
                        horizonY +
                            14.dp
                    )
                    lineTo(
                        widthValue,
                        horizonY +
                            32.dp
                    )
                    lineTo(
                        widthValue,
                        horizonY +
                            50.dp
                    )
                    close()
                }

            canvas.drawPath(
                skyline,
                paint
            )

            paint.color =
                if (dark) {
                    Color.rgb(
                        0,
                        178,
                        255
                    )
                } else {
                    Color.rgb(
                        22,
                        116,
                        190
                    )
                }

            repeat(
                22
            ) {
                index ->

                val x =
                    (
                        index /
                            21f
                        ) *
                        widthValue

                val y =
                    horizonY +
                        44.dp +
                        (
                            index %
                                3
                            ) *
                            2.dp

                canvas.drawCircle(
                    x,
                    y,
                    1.5f * resources.displayMetrics.density,
                    paint
                )
            }
        }
    }

    private inner class AirportArtView(
        context: android.content.Context,
        private val icao: String
    ) :
        View(
            context
        ) {

        private val paint =
            Paint(
                Paint.ANTI_ALIAS_FLAG
            )

        private val linePaint =
            Paint(
                Paint.ANTI_ALIAS_FLAG
            ).apply {
                style = Paint.Style.STROKE
                strokeCap = Paint.Cap.ROUND
            }

        /*
         * Each ICAO gets a deterministic visual seed. There are eighteen
         * main composition families and then airport-specific variations
         * inside each family, so cards do not repeat in obvious batches.
         */
        private val seed =
            abs(
                icao
                    .uppercase(
                        Locale.US
                    )
                    .hashCode()
            )

        private fun value(
            slot: Int,
            minValue: Float,
            maxValue: Float
        ): Float {

            val mixed =
                (
                    seed *
                        (
                            31 +
                                slot *
                                    17
                            ) +
                        slot *
                            7919
                    ) and
                    0x7fffffff

            val ratio =
                (
                    mixed %
                        1000
                    ) /
                    999f

            return minValue +
                (
                    maxValue -
                        minValue
                    ) *
                    ratio
        }

        private fun terrain():
            String {

            val mountain =
                setOf(
                    "OICC",
                    "OICI",
                    "OIHH",
                    "OIIE",
                    "OIII",
                    "OIIP",
                    "OIMN",
                    "OISS",
                    "OITL",
                    "OITR",
                    "OITT",
                    "OOMS",
                    "UDYZ",
                    "UGSB",
                    "UGTB"
                )

            val coastal =
                setOf(
                    "OIAM",
                    "OIBB",
                    "OIBK",
                    "OIBP",
                    "OIZC",
                    "OMDB",
                    "UGSB"
                )

            val green =
                setOf(
                    "OIGG",
                    "OING",
                    "OINZ"
                )

            val desert =
                setOf(
                    "OIFM",
                    "OIKK",
                    "OIMB",
                    "OIMS",
                    "OIYY",
                    "OIZH",
                    "ORNI"
                )

            return when {

                icao in
                    coastal ->
                    "COAST"

                icao in
                    mountain ->
                    "MOUNTAIN"

                icao in
                    green ->
                    "GREEN"

                icao in
                    desert ->
                    "DESERT"

                else ->
                    "CITY"
            }
        }

        override fun onDraw(
            canvas: Canvas
        ) {

            super.onDraw(
                canvas
            )

            val widthValue =
                width
                    .toFloat()
                    .coerceAtLeast(
                        1f
                    )

            val heightValue =
                height
                    .toFloat()
                    .coerceAtLeast(
                        1f
                    )

            val dark =
                isDarkTheme()

            val scene =
                seed %
                    18

            drawSky(
                canvas,
                widthValue,
                heightValue,
                dark,
                scene
            )

            drawTerrain(
                canvas,
                widthValue,
                heightValue,
                dark
            )

            drawAirportBuildings(
                canvas,
                widthValue,
                heightValue,
                dark,
                scene
            )

            drawRunway(
                canvas,
                widthValue,
                heightValue,
                dark,
                scene
            )

            if (
                scene %
                    3 ==
                    0 ||
                scene %
                    5 ==
                    1
            ) {

                drawAircraft(
                    canvas,
                    widthValue,
                    heightValue,
                    dark,
                    scene
                )
            }

            /*
             * Light/dark readability scrim. It is intentionally asymmetric
             * because ICAO/name/weather content sits toward the left and top.
             */
            paint.shader =
                LinearGradient(
                    0f,
                    0f,
                    widthValue,
                    0f,
                    if (
                        dark
                    ) {
                        intArrayOf(
                            Color.argb(
                                148,
                                1,
                                13,
                                31
                            ),
                            Color.argb(
                                64,
                                2,
                                17,
                                38
                            ),
                            Color.argb(
                                16,
                                0,
                                0,
                                0
                            )
                        )
                    } else {
                        intArrayOf(
                            Color.argb(
                                136,
                                245,
                                251,
                                255
                            ),
                            Color.argb(
                                56,
                                238,
                                248,
                                255
                            ),
                            Color.argb(
                                8,
                                255,
                                255,
                                255
                            )
                        )
                    },
                    floatArrayOf(
                        0f,
                        .48f,
                        1f
                    ),
                    Shader.TileMode.CLAMP
                )

            canvas.drawRoundRect(
                RectF(
                    0f,
                    0f,
                    widthValue,
                    heightValue
                ),
                22.dp.toFloat(),
                22.dp.toFloat(),
                paint
            )

            paint.shader =
                null
        }

        private fun drawSky(
            canvas: Canvas,
            widthValue: Float,
            heightValue: Float,
            dark: Boolean,
            scene: Int
        ) {

            val palettes =
                if (
                    dark
                ) {
                    arrayOf(
                        intArrayOf(
                            Color.rgb(
                                1,
                                20,
                                47
                            ),
                            Color.rgb(
                                10,
                                72,
                                113
                            ),
                            Color.rgb(
                                33,
                                126,
                                167
                            )
                        ),
                        intArrayOf(
                            Color.rgb(
                                8,
                                25,
                                48
                            ),
                            Color.rgb(
                                44,
                                74,
                                111
                            ),
                            Color.rgb(
                                128,
                                87,
                                96
                            )
                        ),
                        intArrayOf(
                            Color.rgb(
                                0,
                                31,
                                49
                            ),
                            Color.rgb(
                                11,
                                94,
                                109
                            ),
                            Color.rgb(
                                74,
                                150,
                                155
                            )
                        ),
                        intArrayOf(
                            Color.rgb(
                                20,
                                25,
                                54
                            ),
                            Color.rgb(
                                74,
                                71,
                                112
                            ),
                            Color.rgb(
                                151,
                                92,
                                109
                            )
                        ),
                        intArrayOf(
                            Color.rgb(
                                3,
                                25,
                                57
                            ),
                            Color.rgb(
                                29,
                                83,
                                139
                            ),
                            Color.rgb(
                                100,
                                160,
                                198
                            )
                        ),
                        intArrayOf(
                            Color.rgb(
                                18,
                                32,
                                45
                            ),
                            Color.rgb(
                                62,
                                82,
                                98
                            ),
                            Color.rgb(
                                142,
                                130,
                                111
                            )
                        )
                    )
                } else {
                    arrayOf(
                        intArrayOf(
                            Color.rgb(
                                163,
                                218,
                                248
                            ),
                            Color.rgb(
                                206,
                                237,
                                252
                            ),
                            Color.rgb(
                                247,
                                251,
                                253
                            )
                        ),
                        intArrayOf(
                            Color.rgb(
                                176,
                                207,
                                238
                            ),
                            Color.rgb(
                                229,
                                223,
                                237
                            ),
                            Color.rgb(
                                255,
                                239,
                                220
                            )
                        ),
                        intArrayOf(
                            Color.rgb(
                                151,
                                218,
                                224
                            ),
                            Color.rgb(
                                211,
                                240,
                                239
                            ),
                            Color.rgb(
                                250,
                                251,
                                244
                            )
                        ),
                        intArrayOf(
                            Color.rgb(
                                186,
                                196,
                                232
                            ),
                            Color.rgb(
                                235,
                                220,
                                237
                            ),
                            Color.rgb(
                                255,
                                236,
                                224
                            )
                        ),
                        intArrayOf(
                            Color.rgb(
                                158,
                                209,
                                248
                            ),
                            Color.rgb(
                                216,
                                240,
                                255
                            ),
                            Color.rgb(
                                249,
                                252,
                                255
                            )
                        ),
                        intArrayOf(
                            Color.rgb(
                                193,
                                209,
                                217
                            ),
                            Color.rgb(
                                231,
                                231,
                                221
                            ),
                            Color.rgb(
                                255,
                                244,
                                220
                            )
                        )
                    )
                }

            val palette =
                palettes[
                    scene %
                        palettes.size
                ]

            paint.shader =
                LinearGradient(
                    0f,
                    0f,
                    0f,
                    heightValue,
                    palette,
                    null,
                    Shader.TileMode.CLAMP
                )

            canvas.drawRoundRect(
                RectF(
                    0f,
                    0f,
                    widthValue,
                    heightValue
                ),
                22.dp.toFloat(),
                22.dp.toFloat(),
                paint
            )

            val sunX =
                widthValue *
                    value(
                        1,
                        .56f,
                        .91f
                    )

            val sunY =
                heightValue *
                    value(
                        2,
                        .13f,
                        .34f
                    )

            paint.shader =
                RadialGradient(
                    sunX,
                    sunY,
                    widthValue *
                        .12f,
                    if (
                        dark
                    ) {
                        Color.argb(
                            82,
                            255,
                            203,
                            121
                        )
                    } else {
                        Color.argb(
                            110,
                            255,
                            221,
                            144
                        )
                    },
                    Color.TRANSPARENT,
                    Shader.TileMode.CLAMP
                )

            canvas.drawCircle(
                sunX,
                sunY,
                widthValue *
                    .12f,
                paint
            )

            paint.shader =
                null
        }

        private fun drawTerrain(
            canvas: Canvas,
            widthValue: Float,
            heightValue: Float,
            dark: Boolean
        ) {

            val horizon =
                heightValue *
                    value(
                        3,
                        .48f,
                        .60f
                    )

            when (
                terrain()
            ) {

                "MOUNTAIN" -> {

                    val back =
                        Path().apply {

                            moveTo(
                                0f,
                                heightValue
                            )

                            moveTo(
                                0f,
                                horizon +
                                    22.dp
                            )

                            var x =
                                0f

                            var step =
                                0

                            while (
                                x <=
                                widthValue +
                                    120.dp
                            ) {

                                val peak =
                                    horizon -
                                        value(
                                            20 +
                                                step,
                                            18.dp.toFloat(),
                                            78.dp.toFloat()
                                        )

                                lineTo(
                                    x,
                                    peak
                                )

                                x +=
                                    value(
                                        40 +
                                            step,
                                        78.dp.toFloat(),
                                        150.dp.toFloat()
                                    )

                                step++
                            }

                            lineTo(
                                widthValue,
                                heightValue
                            )

                            lineTo(
                                0f,
                                heightValue
                            )

                            close()
                        }

                    paint.color =
                        if (
                            dark
                        ) {
                            Color.argb(
                                196,
                                18,
                                39,
                                55
                            )
                        } else {
                            Color.argb(
                                175,
                                108,
                                143,
                                160
                            )
                        }

                    canvas.drawPath(
                        back,
                        paint
                    )
                }

                "COAST" -> {

                    paint.color =
                        if (
                            dark
                        ) {
                            Color.argb(
                                195,
                                4,
                                62,
                                91
                            )
                        } else {
                            Color.argb(
                                150,
                                49,
                                153,
                                192
                            )
                        }

                    canvas.drawRect(
                        0f,
                        horizon,
                        widthValue,
                        heightValue,
                        paint
                    )

                    linePaint.color =
                        if (
                            dark
                        ) {
                            Color.argb(
                                74,
                                141,
                                226,
                                255
                            )
                        } else {
                            Color.argb(
                                85,
                                255,
                                255,
                                255
                            )
                        }

                    linePaint.strokeWidth =
                        1.dp.toFloat()

                    repeat(
                        6
                    ) {
                        index ->

                        val y =
                            horizon +
                                (
                                    10 +
                                        index *
                                            11
                                    )
                                    .dp

                        canvas.drawLine(
                            0f,
                            y.toFloat(),
                            widthValue,
                            y.toFloat(),
                            linePaint
                        )
                    }
                }

                "GREEN" -> {

                    val hill =
                        Path().apply {

                            moveTo(
                                0f,
                                heightValue
                            )

                            lineTo(
                                0f,
                                horizon +
                                    24.dp
                            )

                            cubicTo(
                                widthValue *
                                    .22f,
                                horizon -
                                    14.dp,
                                widthValue *
                                    .40f,
                                horizon +
                                    14.dp,
                                widthValue *
                                    .58f,
                                horizon -
                                    10.dp
                            )

                            cubicTo(
                                widthValue *
                                    .76f,
                                horizon -
                                    28.dp,
                                widthValue *
                                    .88f,
                                horizon +
                                    18.dp,
                                widthValue,
                                horizon
                            )

                            lineTo(
                                widthValue,
                                heightValue
                            )

                            close()
                        }

                    paint.color =
                        if (
                            dark
                        ) {
                            Color.argb(
                                185,
                                24,
                                67,
                                54
                            )
                        } else {
                            Color.argb(
                                150,
                                94,
                                155,
                                119
                            )
                        }

                    canvas.drawPath(
                        hill,
                        paint
                    )
                }

                "DESERT" -> {

                    val dunes =
                        Path().apply {

                            moveTo(
                                0f,
                                heightValue
                            )

                            lineTo(
                                0f,
                                horizon +
                                    12.dp
                            )

                            cubicTo(
                                widthValue *
                                    .22f,
                                horizon -
                                    12.dp,
                                widthValue *
                                    .34f,
                                horizon +
                                    26.dp,
                                widthValue *
                                    .52f,
                                horizon +
                                    4.dp
                            )

                            cubicTo(
                                widthValue *
                                    .72f,
                                horizon -
                                    18.dp,
                                widthValue *
                                    .84f,
                                horizon +
                                    20.dp,
                                widthValue,
                                horizon +
                                    6.dp
                            )

                            lineTo(
                                widthValue,
                                heightValue
                            )

                            close()
                        }

                    paint.color =
                        if (
                            dark
                        ) {
                            Color.argb(
                                178,
                                91,
                                66,
                                45
                            )
                        } else {
                            Color.argb(
                                155,
                                205,
                                171,
                                123
                            )
                        }

                    canvas.drawPath(
                        dunes,
                        paint
                    )
                }

                else -> {

                    paint.color =
                        if (
                            dark
                        ) {
                            Color.argb(
                                175,
                                20,
                                37,
                                51
                            )
                        } else {
                            Color.argb(
                                152,
                                135,
                                164,
                                181
                            )
                        }

                    canvas.drawRect(
                        0f,
                        horizon,
                        widthValue,
                        heightValue,
                        paint
                    )
                }
            }
        }

        private fun drawAirportBuildings(
            canvas: Canvas,
            widthValue: Float,
            heightValue: Float,
            dark: Boolean,
            scene: Int
        ) {

            val baseY =
                heightValue *
                    .68f

            val buildingColor =
                if (
                    dark
                ) {
                    Color.argb(
                        224,
                        11,
                        29,
                        43
                    )
                } else {
                    Color.argb(
                        205,
                        78,
                        106,
                        124
                    )
                }

            paint.color =
                buildingColor

            /*
             * Terminal roof family. Six genuinely different silhouettes are
             * mixed with ICAO-specific width/height/position values.
             */
            val terminalX =
                widthValue *
                    value(
                        70,
                        .12f,
                        .31f
                    )

            val terminalWidth =
                widthValue *
                    value(
                        71,
                        .30f,
                        .47f
                    )

            val terminalHeight =
                heightValue *
                    value(
                        72,
                        .20f,
                        .35f
                    )

            when (
                scene %
                    6
            ) {

                0 -> {

                    canvas.drawRoundRect(
                        RectF(
                            terminalX,
                            baseY -
                                terminalHeight,
                            terminalX +
                                terminalWidth,
                            baseY
                        ),
                        10.dp.toFloat(),
                        10.dp.toFloat(),
                        paint
                    )

                    val roof =
                        Path().apply {
                            moveTo(
                                terminalX,
                                baseY -
                                    terminalHeight
                            )
                            lineTo(
                                terminalX +
                                    terminalWidth *
                                        .48f,
                                baseY -
                                    terminalHeight -
                                    18.dp
                            )
                            lineTo(
                                terminalX +
                                    terminalWidth,
                                baseY -
                                    terminalHeight
                            )
                            close()
                        }

                    canvas.drawPath(
                        roof,
                        paint
                    )
                }

                1 -> {

                    canvas.drawRect(
                        terminalX,
                        baseY -
                            terminalHeight +
                            9.dp,
                        terminalX +
                            terminalWidth,
                        baseY,
                        paint
                    )

                    repeat(
                        5
                    ) {
                        index ->

                        val left =
                            terminalX +
                                terminalWidth *
                                    index /
                                    5f

                        val right =
                            terminalX +
                                terminalWidth *
                                    (
                                        index +
                                            1
                                        ) /
                                    5f

                        val roof =
                            Path().apply {
                                moveTo(
                                    left,
                                    baseY -
                                        terminalHeight +
                                        9.dp
                                )
                                lineTo(
                                    (
                                        left +
                                            right
                                        ) /
                                        2f,
                                    baseY -
                                        terminalHeight -
                                        8.dp
                                )
                                lineTo(
                                    right,
                                    baseY -
                                        terminalHeight +
                                        9.dp
                                )
                                close()
                            }

                        canvas.drawPath(
                            roof,
                            paint
                        )
                    }
                }

                2 -> {

                    canvas.drawRoundRect(
                        RectF(
                            terminalX,
                            baseY -
                                terminalHeight,
                            terminalX +
                                terminalWidth,
                            baseY +
                                14.dp
                        ),
                        terminalHeight /
                            2f,
                        terminalHeight /
                            2f,
                        paint
                    )
                }

                3 -> {

                    val terminal =
                        Path().apply {
                            moveTo(
                                terminalX,
                                baseY
                            )
                            lineTo(
                                terminalX +
                                    10.dp,
                                baseY -
                                    terminalHeight *
                                        .82f
                            )
                            lineTo(
                                terminalX +
                                    terminalWidth *
                                        .38f,
                                baseY -
                                    terminalHeight -
                                    12.dp
                            )
                            lineTo(
                                terminalX +
                                    terminalWidth,
                                baseY -
                                    terminalHeight *
                                        .72f
                            )
                            lineTo(
                                terminalX +
                                    terminalWidth,
                                baseY
                            )
                            close()
                        }

                    canvas.drawPath(
                        terminal,
                        paint
                    )
                }

                4 -> {

                    canvas.drawRect(
                        terminalX,
                        baseY -
                            terminalHeight *
                                .72f,
                        terminalX +
                            terminalWidth,
                        baseY,
                        paint
                    )

                    canvas.drawOval(
                        RectF(
                            terminalX,
                            baseY -
                                terminalHeight -
                                8.dp,
                            terminalX +
                                terminalWidth,
                            baseY -
                                terminalHeight *
                                    .45f
                        ),
                        paint
                    )
                }

                else -> {

                    val terminal =
                        Path().apply {
                            moveTo(
                                terminalX,
                                baseY
                            )
                            lineTo(
                                terminalX +
                                    18.dp,
                                baseY -
                                    terminalHeight
                            )
                            lineTo(
                                terminalX +
                                    terminalWidth *
                                        .70f,
                                baseY -
                                    terminalHeight -
                                    8.dp
                            )
                            lineTo(
                                terminalX +
                                    terminalWidth,
                                baseY -
                                    terminalHeight *
                                        .35f
                            )
                            lineTo(
                                terminalX +
                                    terminalWidth,
                                baseY
                            )
                            close()
                        }

                    canvas.drawPath(
                        terminal,
                        paint
                    )
                }
            }

            paint.color =
                if (
                    dark
                ) {
                    Color.argb(
                        125,
                        114,
                        209,
                        244
                    )
                } else {
                    Color.argb(
                        115,
                        232,
                        249,
                        255
                    )
                }

            repeat(
                7
            ) {
                index ->

                val x =
                    terminalX +
                        terminalWidth *
                            (
                                .10f +
                                    index *
                                        .12f
                                )

                canvas.drawRect(
                    x,
                    baseY -
                        terminalHeight *
                            .56f,
                    x +
                        terminalWidth *
                            .06f,
                    baseY -
                        terminalHeight *
                            .42f,
                    paint
                )
            }

            drawTower(
                canvas,
                widthValue,
                heightValue,
                dark,
                scene
            )

            if (
                icao ==
                    "OMDB"
            ) {

                paint.color =
                    if (
                        dark
                    ) {
                        Color.argb(
                            155,
                            82,
                            145,
                            181
                        )
                    } else {
                        Color.argb(
                            150,
                            82,
                            121,
                            145
                        )
                    }

                val x =
                    widthValue *
                        .92f

                canvas.drawRect(
                    x -
                        2.dp,
                    heightValue *
                        .29f,
                    x +
                        2.dp,
                    baseY,
                    paint
                )

                val spire =
                    Path().apply {
                        moveTo(
                            x,
                            heightValue *
                                .10f
                        )
                        lineTo(
                            x -
                                8.dp,
                            heightValue *
                                .29f
                        )
                        lineTo(
                            x +
                                8.dp,
                            heightValue *
                                .29f
                        )
                        close()
                    }

                canvas.drawPath(
                    spire,
                    paint
                )
            }
        }

        private fun drawTower(
            canvas: Canvas,
            widthValue: Float,
            heightValue: Float,
            dark: Boolean,
            scene: Int
        ) {

            val x =
                widthValue *
                    value(
                        90,
                        .66f,
                        .90f
                    )

            val bottom =
                heightValue *
                    .68f

            val towerHeight =
                heightValue *
                    value(
                        91,
                        .31f,
                        .52f
                    )

            val shaftHalf =
                widthValue *
                    value(
                        92,
                        .010f,
                        .018f
                    )

            paint.color =
                if (
                    dark
                ) {
                    Color.argb(
                        232,
                        9,
                        27,
                        42
                    )
                } else {
                    Color.argb(
                        214,
                        72,
                        102,
                        121
                    )
                }

            val shaft =
                Path().apply {
                    moveTo(
                        x -
                            shaftHalf,
                        bottom
                    )
                    lineTo(
                        x +
                            shaftHalf,
                        bottom
                    )
                    lineTo(
                        x +
                            shaftHalf *
                                .56f,
                        bottom -
                            towerHeight *
                                .72f
                    )
                    lineTo(
                        x -
                            shaftHalf *
                                .56f,
                        bottom -
                            towerHeight *
                                .72f
                    )
                    close()
                }

            canvas.drawPath(
                shaft,
                paint
            )

            val cabHalf =
                widthValue *
                    value(
                        93,
                        .025f,
                        .043f
                    )

            val cabTop =
                bottom -
                    towerHeight

            val cabBottom =
                cabTop +
                    heightValue *
                        value(
                            94,
                            .07f,
                            .11f
                        )

            when (
                scene /
                    6
            ) {

                0 -> {

                    canvas.drawRoundRect(
                        RectF(
                            x -
                                cabHalf,
                            cabTop,
                            x +
                                cabHalf,
                            cabBottom
                        ),
                        4.dp.toFloat(),
                        4.dp.toFloat(),
                        paint
                    )
                }

                1 -> {

                    val cab =
                        Path().apply {
                            moveTo(
                                x -
                                    cabHalf *
                                        .70f,
                                cabTop
                            )
                            lineTo(
                                x +
                                    cabHalf *
                                        .70f,
                                cabTop
                            )
                            lineTo(
                                x +
                                    cabHalf,
                                cabBottom
                            )
                            lineTo(
                                x -
                                    cabHalf,
                                cabBottom
                            )
                            close()
                        }

                    canvas.drawPath(
                        cab,
                        paint
                    )
                }

                else -> {

                    canvas.drawOval(
                        RectF(
                            x -
                                cabHalf,
                            cabTop,
                            x +
                                cabHalf,
                            cabBottom
                        ),
                        paint
                    )
                }
            }

            paint.color =
                if (
                    dark
                ) {
                    Color.argb(
                        145,
                        117,
                        219,
                        255
                    )
                } else {
                    Color.argb(
                        150,
                        224,
                        248,
                        255
                    )
                }

            canvas.drawRect(
                x -
                    cabHalf *
                        .68f,
                cabTop +
                    (
                        cabBottom -
                            cabTop
                        ) *
                        .34f,
                x +
                    cabHalf *
                        .68f,
                cabTop +
                    (
                        cabBottom -
                            cabTop
                        ) *
                        .67f,
                paint
            )
        }

        private fun drawRunway(
            canvas: Canvas,
            widthValue: Float,
            heightValue: Float,
            dark: Boolean,
            scene: Int
        ) {

            val farY =
                heightValue *
                    value(
                        110,
                        .60f,
                        .70f
                    )

            val center =
                widthValue *
                    value(
                        111,
                        .43f,
                        .61f
                    )

            val direction =
                when (
                    scene %
                        3
                ) {

                    0 ->
                        -1f

                    1 ->
                        0f

                    else ->
                        1f
                }

            val nearCenter =
                center +
                    direction *
                        widthValue *
                        .10f

            val farHalf =
                widthValue *
                    value(
                        112,
                        .035f,
                        .065f
                    )

            val nearHalf =
                widthValue *
                    value(
                        113,
                        .30f,
                        .46f
                    )

            val runway =
                Path().apply {
                    moveTo(
                        center -
                            farHalf,
                        farY
                    )
                    lineTo(
                        center +
                            farHalf,
                        farY
                    )
                    lineTo(
                        nearCenter +
                            nearHalf,
                        heightValue
                    )
                    lineTo(
                        nearCenter -
                            nearHalf,
                        heightValue
                    )
                    close()
                }

            paint.color =
                if (
                    dark
                ) {
                    Color.argb(
                        230,
                        15,
                        23,
                        31
                    )
                } else {
                    Color.argb(
                        220,
                        78,
                        85,
                        91
                    )
                }

            canvas.drawPath(
                runway,
                paint
            )

            linePaint.strokeWidth =
                1.4.dp.toFloat()

            linePaint.color =
                if (
                    dark
                ) {
                    Color.argb(
                        165,
                        230,
                        241,
                        247
                    )
                } else {
                    Color.argb(
                        178,
                        255,
                        255,
                        255
                    )
                }

            canvas.drawLine(
                center -
                    farHalf,
                farY,
                nearCenter -
                    nearHalf,
                heightValue,
                linePaint
            )

            canvas.drawLine(
                center +
                    farHalf,
                farY,
                nearCenter +
                    nearHalf,
                heightValue,
                linePaint
            )

            repeat(
                8
            ) {
                index ->

                if (
                    index %
                        2 ==
                        1
                ) {
                    return@repeat
                }

                val t0 =
                    index /
                        8f

                val t1 =
                    (
                        index +
                            .50f
                        ) /
                        8f

                val y0 =
                    farY +
                        (
                            heightValue -
                                farY
                            ) *
                            t0

                val y1 =
                    farY +
                        (
                            heightValue -
                                farY
                            ) *
                            t1

                val x0 =
                    center +
                        (
                            nearCenter -
                                center
                            ) *
                            t0

                val x1 =
                    center +
                        (
                            nearCenter -
                                center
                            ) *
                            t1

                linePaint.strokeWidth =
                    (
                        1.2f +
                            index *
                                .42f
                        )
                        .dp

                canvas.drawLine(
                    x0,
                    y0,
                    x1,
                    y1,
                    linePaint
                )
            }

            paint.color =
                if (
                    dark
                ) {
                    Color.rgb(
                        53,
                        220,
                        255
                    )
                } else {
                    Color.rgb(
                        0,
                        153,
                        218
                    )
                }

            repeat(
                10
            ) {
                index ->

                val t =
                    index /
                        9f

                val y =
                    farY +
                        (
                            heightValue -
                                farY
                            ) *
                            t

                val currentCenter =
                    center +
                        (
                            nearCenter -
                                center
                            ) *
                            t

                val half =
                    farHalf +
                        (
                            nearHalf -
                                farHalf
                            ) *
                            t

                val radius =
                    (
                        .8f +
                            t *
                                1.8f
                        )
                        .dp

                canvas.drawCircle(
                    currentCenter -
                        half,
                    y,
                    radius,
                    paint
                )

                canvas.drawCircle(
                    currentCenter +
                        half,
                    y,
                    radius,
                    paint
                )
            }
        }

        private fun drawAircraft(
            canvas: Canvas,
            widthValue: Float,
            heightValue: Float,
            dark: Boolean,
            scene: Int
        ) {

            val x =
                widthValue *
                    value(
                        130,
                        .48f,
                        .76f
                    )

            val y =
                heightValue *
                    value(
                        131,
                        .20f,
                        .38f
                    )

            val scale =
                value(
                    132,
                    .68f,
                    1.12f
                )

            paint.color =
                if (
                    dark
                ) {
                    Color.argb(
                        118,
                        223,
                        242,
                        252
                    )
                } else {
                    Color.argb(
                        128,
                        70,
                        110,
                        137
                    )
                }

            val airplane =
                Path().apply {

                    moveTo(
                        x,
                        y -
                            18.dp *
                            scale
                    )

                    lineTo(
                        x +
                            5.dp *
                            scale,
                        y
                    )

                    lineTo(
                        x +
                            37.dp *
                            scale,
                        y +
                            6.dp *
                            scale
                    )

                    lineTo(
                        x +
                            6.dp *
                            scale,
                        y +
                            10.dp *
                            scale
                    )

                    lineTo(
                        x +
                            4.dp *
                            scale,
                        y +
                            28.dp *
                            scale
                    )

                    lineTo(
                        x,
                        y +
                            23.dp *
                            scale
                    )

                    lineTo(
                        x -
                            4.dp *
                            scale,
                        y +
                            28.dp *
                            scale
                    )

                    lineTo(
                        x -
                            6.dp *
                            scale,
                        y +
                            10.dp *
                            scale
                    )

                    lineTo(
                        x -
                            37.dp *
                            scale,
                        y +
                            6.dp *
                            scale
                    )

                    lineTo(
                        x -
                            5.dp *
                            scale,
                        y
                    )

                    close()
                }

            canvas.drawPath(
                airplane,
                paint
            )
        }
    }

    private inner class WeatherGlyphView(
        context: android.content.Context,
        private val category: String
    ) :
        View(
            context
        ) {
        private val paint =
            Paint(
                Paint.ANTI_ALIAS_FLAG
            )

        override fun onDraw(
            canvas: Canvas
        ) {
            super.onDraw(
                canvas
            )

            val widthValue =
                width.toFloat()

            val heightValue =
                height.toFloat()

            if (
                category ==
                    "VFR" ||
                category ==
                    "MVFR" ||
                category.isBlank()
            ) {
                paint.color =
                    Color.rgb(
                        255,
                        211,
                        46
                    )

                canvas.drawCircle(
                    widthValue * .66f,
                    heightValue * .34f,
                    widthValue * .17f,
                    paint
                )
            }

            paint.color =
                if (isDarkTheme()) {
                    Color.rgb(
                        214,
                        239,
                        255
                    )
                } else {
                    Color.rgb(
                        117,
                        167,
                        199
                    )
                }

            canvas.drawCircle(
                widthValue * .38f,
                heightValue * .58f,
                widthValue * .18f,
                paint
            )

            canvas.drawCircle(
                widthValue * .52f,
                heightValue * .48f,
                widthValue * .21f,
                paint
            )

            canvas.drawRoundRect(
                RectF(
                    widthValue * .23f,
                    heightValue * .55f,
                    widthValue * .76f,
                    heightValue * .76f
                ),
                widthValue * .10f,
                widthValue * .10f,
                paint
            )

            if (
                category ==
                    "IFR" ||
                category ==
                    "LIFR"
            ) {
                paint.color =
                    if (
                        category ==
                            "LIFR"
                    ) {
                        Color.rgb(
                            255,
                            66,
                            73
                        )
                    } else {
                        Color.rgb(
                            38,
                            174,
                            255
                        )
                    }

                paint.strokeWidth =
                    2.dp.toFloat()

                repeat(
                    3
                ) {
                    index ->

                    canvas.drawLine(
                        widthValue *
                            (
                                .34f +
                                    index *
                                        .15f
                                ),
                        heightValue *
                            .82f,
                        widthValue *
                            (
                                .30f +
                                    index *
                                        .15f
                                ),
                        heightValue *
                            .96f,
                        paint
                    )
                }
            }
        }
    }

    private val Int.dp:
        Int
        get() =
            (
                this *
                    resources
                        .displayMetrics
                        .density
                )
                .toInt()
}
