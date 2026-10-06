package com.tareghmsr.jeppiran

import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.Editable
import android.text.TextWatcher
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class ChartsActivity :
    AppCompatActivity() {

    private lateinit var root:
        LinearLayout

    private lateinit var searchBox:
        EditText

    private lateinit var resultCount:
        TextView

    private lateinit var listContainer:
        LinearLayout

    private var allAirports =
        emptyList<ChartRepository.AirportInfo>()

    private val repository by lazy { ChartRepository(this) }
    private var sortField = "ICAO"
    private var region = "ALL"
    private val sortFields = listOf("ICAO", "NAME", "CITY", "COUNTRY")
    private val regions = listOf("ALL", "MIDDLE EAST", "EAST EUROPE", "WEST EUROPE")
    private val weatherViews = mutableMapOf<String, TextView>()
    private val metarViews = mutableMapOf<String, TextView>()
    private var descending = false
    private val weatherHandler = Handler(Looper.getMainLooper())
    private val weatherRefresh = object : Runnable {
        override fun run() {
            weatherViews.keys.toList().forEach { icao -> refreshWeather(icao) }
            weatherHandler.postDelayed(this, 300_000L)
        }
    }

    override fun onResume() {
        super.onResume()
        weatherHandler.removeCallbacks(weatherRefresh)
        weatherHandler.post(weatherRefresh)
    }

    override fun onPause() {
        weatherHandler.removeCallbacks(weatherRefresh)
        super.onPause()
    }

    override fun onCreate(
        savedInstanceState: Bundle?
    ) {

        ThemeManager.apply(
            this
        )

        super.onCreate(
            savedInstanceState
        )

        enableEdgeToEdge()

        allAirports =
            ChartRepository(
                this
            )
                .getAirports()
                .sortedBy {
                    it.icao
                }

        buildUi()
    }

    private fun buildUi() {

        root =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.VERTICAL

                setBackgroundColor(
                    color(
                        android.R.attr.colorBackground
                    )
                )
            }

        val header =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.VERTICAL

                setPadding(
                    20.dp,
                    18.dp,
                    20.dp,
                    8.dp
                )
            }

        val title =
            TextView(
                this
            ).apply {

                text =
                    "AIRPORT CHARTS"

                textSize =
                    24f

                typeface =
                    Typeface.create(
                        "sans-serif",
                        Typeface.BOLD
                    )

                setTextColor(
                    color(
                        android.R.attr.textColorPrimary
                    )
                )
            }

        val subtitle =
            TextView(
                this
            ).apply {

                text =
                    "Select an airport to view its charts"

                textSize =
                    13f

                setTextColor(
                    color(
                        android.R.attr.textColorSecondary
                    )
                )

                setPadding(
                    0,
                    4.dp,
                    0,
                    0
                )
            }

        header.addView(
            title,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )

        header.addView(
            subtitle,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )

        root.addView(
            header,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )

        val searchContainer =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.HORIZONTAL

                gravity =
                    Gravity.CENTER_VERTICAL

                background =
                    createSearchBackground()

                setPadding(
                    14.dp,
                    0,
                    14.dp,
                    0
                )
            }

        val searchIcon =
            TextView(
                this
            ).apply {

                text =
                    "⌕"

                textSize =
                    24f

                gravity =
                    Gravity.CENTER

                setTextColor(
                    color(
                        android.R.attr.textColorSecondary
                    )
                )
            }

        searchBox =
            EditText(
                this
            ).apply {

                hint =
                    "Search ICAO / Airport / City"

                isSingleLine =
                    true

                textSize =
                    16f

                background =
                    null

                setTextColor(
                    color(
                        android.R.attr.textColorPrimary
                    )
                )

                setHintTextColor(
                    color(
                        android.R.attr.textColorSecondary
                    )
                )

                setPadding(
                    10.dp,
                    0,
                    0,
                    0

                )

                importantForAutofill =
                    View.IMPORTANT_FOR_AUTOFILL_NO
            }

        searchContainer.addView(
            searchIcon,
            LinearLayout.LayoutParams(
                34.dp,
                LinearLayout.LayoutParams.MATCH_PARENT
            )
        )

        searchContainer.addView(
            searchBox,
            LinearLayout.LayoutParams(
                0,
                LinearLayout.LayoutParams.MATCH_PARENT,
                1f
            )
        )

        root.addView(
            searchContainer,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                58.dp
            ).apply {

                setMargins(
                    16.dp,
                    8.dp,
                    16.dp,
                    8.dp
                )
            }
        )

        val filters = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(16.dp, 2.dp, 16.dp, 4.dp)
        }
        fun filterButton(label: String, onClick: () -> Unit): TextView =
            TextView(this).apply {
                text = label
                textSize = 12f
                setTextColor(getColor(R.color.jeppiran_text))
                gravity = Gravity.CENTER
                background = createSearchBackground()
                setOnClickListener { onClick() }
            }
        val sortButton = filterButton("SORT: ICAO  ▾") {}
        sortButton.setOnClickListener {
            val next = (sortFields.indexOf(sortField) + 1) % sortFields.size
            sortField = sortFields[next]
            sortButton.text = "SORT: $sortField  ▾"
            displayAirports(searchBox.text.toString())
        }
        sortButton.setOnLongClickListener {
            descending = !descending
            sortButton.text = "SORT: $sortField  ${if (descending) "Z–A" else "A–Z"}"
            displayAirports(searchBox.text.toString())
            true
        }
        val regionButton = filterButton("REGION: ALL  ▾") {}
        regionButton.setOnClickListener {
            val next = (regions.indexOf(region) + 1) % regions.size
            region = regions[next]
            regionButton.text = "REGION: $region  ▾"
            displayAirports(searchBox.text.toString())
        }
        filters.addView(sortButton, LinearLayout.LayoutParams(0, 42.dp, 1f).apply { marginEnd = 6.dp })
        filters.addView(regionButton, LinearLayout.LayoutParams(0, 42.dp, 1f))
        val directionButton = filterButton("A–Z") {}
        directionButton.contentDescription = "Reverse airport sort order"
        directionButton.setOnClickListener {
            descending = !descending
            directionButton.text = if (descending) "Z–A" else "A–Z"
            displayAirports(searchBox.text.toString())
        }
        filters.addView(directionButton, LinearLayout.LayoutParams(50.dp, 42.dp).apply { marginStart = 6.dp })
        root.addView(filters)

        resultCount =
            TextView(
                this
            ).apply {

                textSize =
                    12f

                setTextColor(
                    color(
                        android.R.attr.textColorSecondary
                    )
                )

                setPadding(
                    20.dp,
                    2.dp,
                    20.dp,
                    8.dp
                )
            }

        root.addView(
            resultCount,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )

        val scrollView =
            ScrollView(
                this
            ).apply {

                isFillViewport =
                    true

                overScrollMode =
                    ScrollView.OVER_SCROLL_IF_CONTENT_SCROLLS
            }

        listContainer =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.VERTICAL

                setPadding(
                    14.dp,
                    4.dp,
                    14.dp,
                    20.dp
                )
            }

        scrollView.addView(
            listContainer,
            ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
        )

        root.addView(
            scrollView,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1f
            )
        )

        setContentView(
            root
        )

        ViewCompat.setOnApplyWindowInsetsListener(
            root
        ) { view, insets ->

            val bars =
                insets.getInsets(
                    WindowInsetsCompat.Type.systemBars()
                )

            view.setPadding(
                0,
                bars.top,
                0,
                bars.bottom
            )

            insets
        }

        ViewCompat.requestApplyInsets(
            root
        )

        searchBox.addTextChangedListener(
            object : TextWatcher {

                override fun beforeTextChanged(
                    s: CharSequence?,
                    start: Int,
                    count: Int,
                    after: Int
                ) {
                }

                override fun onTextChanged(
                    s: CharSequence?,
                    start: Int,
                    before: Int,
                    count: Int
                ) {

                    displayAirports(
                        s?.toString().orEmpty()
                    )
                }

                override fun afterTextChanged(
                    s: Editable?
                ) {
                }
            }
        )

        displayAirports()
    }

    private fun displayAirports(
        query: String = ""
    ) {

        listContainer.removeAllViews()
        weatherViews.clear()
        metarViews.clear()

        val normalized =
            query
                .trim()
                .lowercase()

        val results = allAirports.filter { airport ->
            (region == "ALL" || airportRegion(airport.icao) == region) &&
                (normalized.isBlank() || listOf(airport.icao, airport.airportName,
                    airport.city, airportCountry(airport.icao), airportRegion(airport.icao))
                    .any { it.lowercase().contains(normalized) })
        }.sortedWith(compareBy<ChartRepository.AirportInfo> { airport ->
            when (sortField) {
                "NAME" -> airport.airportName
                "CITY" -> airport.city
                "COUNTRY" -> airportCountry(airport.icao)
                else -> airport.icao
            }
        }.let { comparator -> if (descending) comparator.reversed() else comparator })

        resultCount.text =
            if (
                normalized.isBlank()
            ) {

                "${results.size} airports"

            } else {

                "${results.size} result" +
                    if (
                        results.size == 1
                    ) {
                        ""
                    } else {
                        "s"
                    }
            }

        if (
            results.isEmpty()
        ) {

            showEmptyResult()

            return
        }

        results.forEach {
            airport ->

            addAirportRow(
                airport
            )
        }
    }

    private fun addAirportRow(
        airport: ChartRepository.AirportInfo
    ) {

        val card =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.HORIZONTAL

                gravity =
                    Gravity.CENTER_VERTICAL

                background =
                    createAirportCardBackground()

                isClickable =
                    true

                isFocusable =
                    true

                minimumHeight =
                    92.dp

                setPadding(
                    16.dp,
                    12.dp,
                    14.dp,
                    12.dp
                )

                setOnClickListener {

                    openAirport(
                        airport
                    )
                }
            }

        val icaoBox =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.VERTICAL

                gravity =
                    Gravity.CENTER

                background =
                    createIcaoBackground()
            }

        val icaoText =
            TextView(
                this
            ).apply {

                text =
                    airport.icao

                textSize =
                    16f

                typeface =
                    Typeface.create(
                        "sans-serif",
                        Typeface.BOLD
                    )

                gravity =
                    Gravity.CENTER

                setTextColor(
                    Color.WHITE
                )
            }

        icaoBox.addView(
            icaoText,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )

        card.addView(
            icaoBox,
            LinearLayout.LayoutParams(
                82.dp,
                58.dp
            )
        )

        val info =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.VERTICAL

                gravity =
                    Gravity.CENTER_VERTICAL

                setPadding(
                    14.dp,
                    0,
                    8.dp,
                    0
                )
            }

        val airportName =
            TextView(
                this
            ).apply {

                text =
                    airport.airportName

                textSize =
                    16f

                maxLines =
                    2

                typeface =
                    Typeface.create(
                        "sans-serif",
                        Typeface.BOLD
                    )

                setTextColor(
                    color(
                        android.R.attr.textColorPrimary
                    )
                )
            }

        val city =
            TextView(
                this
            ).apply {

                text =
                    airport.city

                textSize =
                    13f

                setTextColor(
                    color(
                        android.R.attr.textColorSecondary
                    )
                )

                setPadding(
                    0,
                    4.dp,
                    0,
                    0
                )
            }

        info.addView(
            airportName,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )

        info.addView(
            city,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )

        val country = airportCountry(airport.icao)
        val weather = TextView(this).apply {
            text = "${countryFlag(country)}  $country  ·  WX —"
            textSize = 11f
            setTextColor(getColor(R.color.jeppiran_text_secondary))
            maxLines = 1
            setPadding(0, 3.dp, 0, 3.dp)
        }
        info.addView(weather)
        weatherViews[airport.icao] = weather
        val metar = TextView(this).apply {
            text = "METAR loading…"
            textSize = 10f
            maxLines = 1
            ellipsize = android.text.TextUtils.TruncateAt.END
            setTextColor(getColor(R.color.jeppiran_text_secondary))
        }
        info.addView(metar)
        metarViews[airport.icao] = metar
        refreshWeather(airport.icao)

        val categories = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        val airportCharts = repository.getDisplayChartsForAirport(airport.icao)
        listOf("STAR", "SID", "AIRPORT", "APP").forEach { label ->
            val count = airportCharts.count {
                ChartRepository.displayCategory(it.category) == label
            }
            val chip = TextView(this).apply {
                text = "$label $count"
                textSize = 10f
                gravity = Gravity.CENTER
                maxLines = 1
                setTextColor(getColor(R.color.jeppiran_accent))
                setPadding(2.dp, 4.dp, 2.dp, 4.dp)
                isClickable = true
                contentDescription = "Open $count $label charts for ${airport.icao}"
                setOnClickListener { openAirport(airport, label) }
            }
            categories.addView(chip, LinearLayout.LayoutParams(0,
                LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        }
        info.addView(categories)

        card.addView(
            info,
            LinearLayout.LayoutParams(
                0,
                LinearLayout.LayoutParams.MATCH_PARENT,
                1f
            )
        )

        if (
            ChartChangesStore.hasChanges(
                this,
                airport.icao
            )
        ) {

            val changes =
                ChartChangesStore.airport(
                    this,
                    airport.icao
                )


            card.addView(
                TextView(
                    this
                ).apply {

                    text =
                        "Δ"

                    textSize =
                        18f

                    gravity =
                        Gravity.CENTER

                    contentDescription =
                        "Chart changes: " +
                            changes.badgeText()

                    setTextColor(
                        Color.rgb(
                            47,
                            217,
                            255
                        )
                    )

                    background =
                        GradientDrawable()
                            .apply {

                                shape =
                                    GradientDrawable.OVAL

                                setColor(
                                    Color.rgb(
                                        5,
                                        38,
                                        68
                                    )
                                )

                                setStroke(
                                    1.dp,
                                    Color.rgb(
                                        47,
                                        217,
                                        255
                                    )
                                )
                            }

                    isClickable =
                        true

                    isFocusable =
                        true

                    setOnClickListener {

                        startActivity(
                            Intent(
                                this@ChartsActivity,
                                ChartChangesActivity::class.java
                            )
                                .putExtra(
                                    "ICAO",
                                    airport.icao
                                )
                        )
                    }
                },
                LinearLayout.LayoutParams(
                    42.dp,
                    42.dp
                ).apply {

                    marginEnd =
                        5.dp
                }
            )
        }


        val arrow =
            TextView(
                this
            ).apply {

                text =
                    "›"

                textSize =
                    28f

                gravity =
                    Gravity.CENTER

                setTextColor(
                    color(
                        android.R.attr.textColorSecondary
                    )
                )
            }

        card.addView(
            arrow,
            LinearLayout.LayoutParams(
                34.dp,
                LinearLayout.LayoutParams.MATCH_PARENT
            )
        )

        listContainer.addView(
            card,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {

                setMargins(
                    2.dp,
                    5.dp,
                    2.dp,
                    5.dp
                )
            }
        )
    }

    private fun refreshWeather(icao: String) {
        AirportWeather.get(this, icao) { report ->
            if (isFinishing || isDestroyed) return@get
            val weather = weatherViews[icao] ?: return@get
            metarViews[icao]?.text = report?.raw ?: "METAR unavailable"
            val country = airportCountry(icao)
            val category = report?.category ?: "WX —"
            weather.text = "${countryFlag(country)}  $country  ·  $category"
            weather.setTextColor(when (category) {
                "VFR" -> Color.rgb(28, 184, 97)
                "MVFR" -> Color.rgb(232, 181, 32)
                "IFR" -> Color.rgb(55, 141, 245)
                "LIFR" -> Color.rgb(236, 64, 78)
                else -> getColor(R.color.jeppiran_text_secondary)
            })
            weather.contentDescription = "$icao $category. ${report?.raw.orEmpty()}"
        }
    }

    private fun openAirport(
        airport: ChartRepository.AirportInfo,
        category: String? = null
    ) {

        val intent =
            Intent(
                this,
                AirportChartsActivity::class.java
            )

        intent.putExtra(
            "ICAO",
            airport.icao
        )

        intent.putExtra(
            "AIRPORT_NAME",
            airport.airportName
        )

        intent.putExtra(
            "CITY",
            airport.city
        )

        category?.let { intent.putExtra("SELECT_CATEGORY", it) }

        startActivity(
            intent
        )
    }

    private fun airportCountry(icao: String): String = when {
        icao.startsWith("OI") -> "Iran"
        icao.startsWith("LT") -> "Türkiye"
        icao.startsWith("OM") -> if (icao == "OMDB") "UAE" else "Oman"
        icao.startsWith("OR") -> "Iraq"
        icao.startsWith("UD") -> "Armenia"
        icao.startsWith("UG") -> "Georgia"
        else -> "Unknown"
    }

    private fun airportRegion(icao: String): String = when {
        icao.startsWith("UD") || icao.startsWith("UG") -> "EAST EUROPE"
        else -> "MIDDLE EAST"
    }

    private fun countryFlag(country: String): String = when (country) {
        "Iran" -> "🇮🇷"
        "Türkiye" -> "🇹🇷"
        "UAE" -> "🇦🇪"
        "Oman" -> "🇴🇲"
        "Iraq" -> "🇮🇶"
        "Armenia" -> "🇦🇲"
        "Georgia" -> "🇬🇪"
        else -> "🌐"
    }

    private fun showEmptyResult() {

        val container =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.VERTICAL

                gravity =
                    Gravity.CENTER

                setPadding(
                    30.dp,
                    60.dp,
                    30.dp,
                    60.dp
                )
            }

        val icon =
            TextView(
                this
            ).apply {

                text =
                    "⌕"

                textSize =
                    42f

                gravity =
                    Gravity.CENTER

                setTextColor(
                    color(
                        android.R.attr.textColorSecondary
                    )
                )
            }

        val title =
            TextView(
                this
            ).apply {

                text =
                    "No airport found"

                textSize =
                    18f

                gravity =
                    Gravity.CENTER

                typeface =
                    Typeface.DEFAULT_BOLD

                setTextColor(
                    color(
                        android.R.attr.textColorPrimary
                    )
                )

                setPadding(
                    0,
                    12.dp,
                    0,
                    0
                )
            }

        val message =
            TextView(
                this
            ).apply {

                text =
                    "Try an ICAO code, airport name, or city."

                textSize =
                    13f

                gravity =
                    Gravity.CENTER

                setTextColor(
                    color(
                        android.R.attr.textColorSecondary
                    )
                )

                setPadding(
                    0,
                    6.dp,
                    0,
                    0
                )
            }

        container.addView(
            icon
        )

        container.addView(
            title
        )

        container.addView(
            message
        )

        listContainer.addView(
            container,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )
    }

    private fun createSearchBackground():
        GradientDrawable {

        val dark =
            isDarkTheme()

        return GradientDrawable().apply {

            shape =
                GradientDrawable.RECTANGLE

            cornerRadius =
                18.dp.toFloat()

            setColor(
                if (
                    dark
                ) {

                    Color.rgb(
                        7,
                        26,
                        49
                    )

                } else {

                    Color.WHITE
                }
            )

            setStroke(
                1.dp,
                if (
                    dark
                ) {

                    Color.rgb(
                        23,
                        108,
                        181
                    )

                } else {

                    Color.rgb(
                        216,
                        224,
                        232
                    )
                }
            )
        }
    }

    private fun createAirportCardBackground():
        GradientDrawable {

        val dark =
            isDarkTheme()

        return GradientDrawable().apply {

            shape =
                GradientDrawable.RECTANGLE

            cornerRadius =
                16.dp.toFloat()

            setColor(
                if (
                    dark
                ) {

                    getColor(R.color.jeppiran_surface)

                } else {

                    Color.WHITE
                }
            )

            setStroke(
                1.dp,
                if (
                    dark
                ) {

                    getColor(R.color.jeppiran_card_stroke)

                } else {

                    getColor(R.color.jeppiran_card_stroke)
                }
            )
        }
    }

    private fun createIcaoBackground():
        GradientDrawable {

        return GradientDrawable().apply {

            shape =
                GradientDrawable.RECTANGLE

            cornerRadius =
                12.dp.toFloat()

            setColor(getColor(R.color.jeppiran_accent))
        }
    }

    private fun color(
        attribute: Int
    ): Int {

        val value =
            TypedValue()

        theme.resolveAttribute(
            attribute,
            value,
            true
        )

        return if (
            value.resourceId != 0
        ) {

            getColor(
                value.resourceId
            )

        } else {

            value.data
        }
    }

    private fun isDarkTheme():
        Boolean {

        return (
            resources.configuration.uiMode and
                android.content.res.Configuration
                    .UI_MODE_NIGHT_MASK
        ) ==
            android.content.res.Configuration
                .UI_MODE_NIGHT_YES
    }

    private val Int.dp: Int
        get() =
            (
                this *
                    resources
                        .displayMetrics
                        .density
                ).toInt()
}
