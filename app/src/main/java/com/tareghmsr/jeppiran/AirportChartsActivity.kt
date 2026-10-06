package com.tareghmsr.jeppiran

import android.content.Intent
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.view.View
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class AirportChartsActivity :
    AppCompatActivity() {

    private lateinit var root:
        LinearLayout

    private lateinit var chartScrollView:
        ScrollView

    private lateinit var listContainer:
        LinearLayout

    private lateinit var categoryTitle:
        TextView

    private lateinit var categoryContainer:
        LinearLayout

    private lateinit var portraitCategoryScroll:
        HorizontalScrollView

    private lateinit var landscapeCategoryScroll:
        ScrollView

    private var icao =
        ""

    private var airportName =
        ""

    private var city =
        ""

    private var selectedCategory =
        ""

    private lateinit var repository:
        ChartRepository

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

        icao =
            intent
                .getStringExtra(
                    "ICAO"
                )
                .orEmpty()
                .trim()
                .uppercase()

        airportName =
            intent
                .getStringExtra(
                    "AIRPORT_NAME"
                )
                .orEmpty()
                .trim()

        city =
            intent
                .getStringExtra(
                    "CITY"
                )
                .orEmpty()
                .trim()

        repository =
            ChartRepository(
                this
            )

        if (
            airportName.isBlank()
        ) {

            airportName =
                ChartRepository.airportName(icao)
        }

        if (
            city.isBlank()
        ) {

            city =
                ChartRepository.city(icao)
        }

        buildUi()

        loadCharts()
    }

    private fun buildUi() {

        root =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.VERTICAL

                setBackgroundColor(
                    backgroundColor()
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
                    10.dp
                )
            }

        val title =
            TextView(
                this
            ).apply {

                text =
                    if (
                        icao.isNotBlank()
                    ) {
                        icao
                    } else {
                        "AIRPORT CHARTS"
                    }

                textSize =
                    24f

                typeface =
                    Typeface.create(
                        "sans-serif",
                        Typeface.BOLD
                    )

                setTextColor(
                    primaryTextColor()
                )

                maxLines =
                    1
            }

        val airportText =
            TextView(
                this
            ).apply {

                text =
                    buildAirportSubtitle()

                textSize =
                    15f

                typeface =
                    Typeface.create(
                        "sans-serif-medium",
                        Typeface.NORMAL
                    )

                setTextColor(
                    primaryTextColor()
                )

                maxLines =
                    2

                setPadding(
                    0,
                    4.dp,
                    0,
                    0
                )
            }

        val cityText =
            TextView(
                this
            ).apply {

                text =
                    city

                textSize =
                    13f

                setTextColor(
                    secondaryTextColor()
                )

                setPadding(
                    0,
                    3.dp,
                    0,
                    0
                )

                visibility =
                    if (
                        city.isBlank()
                    ) {
                        View.GONE
                    } else {
                        View.VISIBLE
                    }
            }

        header.addView(
            title,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )

        header.addView(
            airportText,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )

        header.addView(
            cityText,
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

        categoryTitle =
            TextView(
                this
            ).apply {

                text =
                    "SELECT A CHART CATEGORY"

                textSize =
                    12f

                typeface =
                    Typeface.create(
                        "sans-serif-medium",
                        Typeface.NORMAL
                    )

                setTextColor(
                    secondaryTextColor()
                )

                setPadding(
                    18.dp,
                    8.dp,
                    18.dp,
                    8.dp
                )
            }

        listContainer =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.VERTICAL

                setPadding(
                    14.dp,
                    6.dp,
                    14.dp,
                    14.dp
                )
            }

        chartScrollView =
            ScrollView(
                this
            ).apply {

                isFillViewport =
                    true

                overScrollMode =
                    ScrollView.OVER_SCROLL_IF_CONTENT_SCROLLS

                addView(
                    listContainer,
                    ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT
                    )
                )
            }

        categoryContainer =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.HORIZONTAL

                gravity =
                    Gravity.CENTER_VERTICAL

                setPadding(
                    8.dp,
                    6.dp,
                    8.dp,
                    6.dp
                )
            }

        val landscape =
            resources.configuration.orientation ==
                Configuration.ORIENTATION_LANDSCAPE


        if (
            landscape
        ) {

            landscapeCategoryScroll =
                ScrollView(
                    this
                ).apply {

                    isVerticalScrollBarEnabled =
                        false

                    overScrollMode =
                        ScrollView.OVER_SCROLL_IF_CONTENT_SCROLLS

                    addView(
                        categoryContainer,
                        ViewGroup.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.WRAP_CONTENT
                        )
                    )
                }

        } else {

            portraitCategoryScroll =
                HorizontalScrollView(
                    this
                ).apply {

                    isHorizontalScrollBarEnabled =
                        false

                    overScrollMode =
                        HorizontalScrollView.OVER_SCROLL_IF_CONTENT_SCROLLS

                    addView(
                        categoryContainer,
                        ViewGroup.LayoutParams(
                            ViewGroup.LayoutParams.WRAP_CONTENT,
                            ViewGroup.LayoutParams.MATCH_PARENT
                        )
                    )
                }
        }
        if (
            landscape
        ) {

            buildLandscape()

        } else {

            buildPortrait()
        }

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
    }

    private fun buildPortrait() {

        val content =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.VERTICAL
            }

        content.addView(
            categoryTitle,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )

        content.addView(
            buildChartScroller(
                chartScrollView
            ),
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1f
            )
        )

        root.addView(
            content,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1f
            )
        )

        root.addView(
            portraitCategoryScroll,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                78.dp
            )
        )
    }

    private fun buildLandscape() {

        val workspace =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.HORIZONTAL
            }

        val categoryPane =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.VERTICAL

                gravity =
                    Gravity.CENTER

                setBackgroundColor(
                    surfaceColor()
                )

                elevation =
                    8.dp.toFloat()
            }

        val categoryHeader =
            TextView(
                this
            ).apply {

                text =
                    "CATEGORIES"

                textSize =
                    11f

                typeface =
                    Typeface.create(
                        "sans-serif-medium",
                        Typeface.NORMAL
                    )

                gravity =
                    Gravity.CENTER

                setTextColor(
                    secondaryTextColor()
                )

                setPadding(
                    6.dp,
                    8.dp,
                    6.dp,
                    8.dp
                )
            }

        categoryPane.addView(
            categoryHeader,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                36.dp
            )
        )

        categoryPane.addView(
            landscapeCategoryScroll,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1f
            )
        )

        workspace.addView(
            categoryPane,
            LinearLayout.LayoutParams(
                132.dp,
                LinearLayout.LayoutParams.MATCH_PARENT
            )
        )

        val content =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.VERTICAL
            }

        content.addView(
            categoryTitle,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )

        content.addView(
            buildChartScroller(
                chartScrollView
            ),
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1f
            )
        )

        workspace.addView(
            content,
            LinearLayout.LayoutParams(
                0,
                LinearLayout.LayoutParams.MATCH_PARENT,
                1f
            )
        )

        root.addView(
            workspace,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1f
            )
        )
    }

    private fun buildChartScroller(
        scrollView: ScrollView
    ): LinearLayout {

        val wrapper =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.VERTICAL
            }

        val topIndicator =
            TextView(
                this
            ).apply {

                text =
                    "▲"

                textSize =
                    17f

                gravity =
                    Gravity.CENTER

                setTextColor(
                    secondaryTextColor()
                )

                alpha =
                    0.25f

                setOnClickListener {

                    scrollView.smoothScrollBy(
                        0,
                        -450.dp
                    )
                }
            }

        val bottomIndicator =
            TextView(
                this
            ).apply {

                text =
                    "▼"

                textSize =
                    17f

                gravity =
                    Gravity.CENTER

                setTextColor(
                    secondaryTextColor()
                )

                alpha =
                    0.25f

                setOnClickListener {

                    scrollView.smoothScrollBy(
                        0,
                        450.dp
                    )
                }
            }

        wrapper.addView(
            topIndicator,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                32.dp
            )
        )

        wrapper.addView(
            scrollView,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1f
            )
        )

        wrapper.addView(
            bottomIndicator,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                32.dp
            )
        )

        scrollView
            .viewTreeObserver
            .addOnScrollChangedListener {

                val child =
                    scrollView.getChildAt(
                        0
                    )

                val maxScroll =
                    if (
                        child != null
                    ) {
                        (
                            child.height -
                                scrollView.height
                            ).coerceAtLeast(
                                0
                            )
                    } else {
                        0
                    }

                topIndicator.alpha =
                    if (
                        scrollView.scrollY > 0
                    ) {
                        1f
                    } else {
                        0.25f
                    }

                bottomIndicator.alpha =
                    if (
                        scrollView.scrollY <
                            maxScroll
                    ) {
                        1f
                    } else {
                        0.25f
                    }
            }

        return wrapper
    }

    private fun loadCharts() {

        val charts =
            repository
                .getDisplayChartsForAirport(
                    icao
                )

        categoryContainer
            .removeAllViews()

        listContainer
            .removeAllViews()

        if (
            charts.isEmpty()
        ) {

            categoryTitle.text =
                "NO CHARTS AVAILABLE"

            showNoChartsMessage()

            return
        }

        val categories =
            charts
                .map {
                    ChartRepository
                        .normalizeCategory(
                            it.category
                        )
                }
                .distinct()
                .sortedBy {
                    ChartRepository
                        .categoryOrder(
                            it
                        )
                }

        categories.forEach {
            addCategoryButton(
                it,
                charts.count { item ->
                    ChartRepository
                        .normalizeCategory(
                            item.category
                        ) == it
                }
            )
        }

        val firstCategory =
            categories.firstOrNull()

        if (
            firstCategory != null
        ) {

            selectCategory(
                firstCategory
            )
        }
    }

    private fun addCategoryButton(
        category: String,
        count: Int
    ) {

        val horizontal =
            resources.configuration.orientation ==
                Configuration.ORIENTATION_PORTRAIT

        val button =
            TextView(
                this
            ).apply {

                text =
                    buildCategoryButtonText(
                        category,
                        count
                    )

                textSize =
                    if (
                        horizontal
                    ) {
                        10f
                    } else {
                        11f
                    }

                gravity =
                    Gravity.CENTER

                typeface =
                    Typeface.create(
                        "sans-serif-medium",
                        Typeface.NORMAL
                    )

                setTextColor(
                    primaryTextColor()
                )

                setPadding(
                    8.dp,
                    7.dp,
                    8.dp,
                    7.dp
                )

                minWidth =
                    if (
                        horizontal
                    ) {
                        82.dp
                    } else {
                        106.dp
                    }

                minHeight =
                    if (
                        horizontal
                    ) {
                        54.dp
                    } else {
                        64.dp
                    }

                isClickable =
                    true

                isFocusable =
                    true

                setOnClickListener {

                    selectCategory(
                        category
                    )
                }
            }

        button.background =
            createCategoryBackground(
                category ==
                    selectedCategory
            )

        val params =
            if (
                horizontal
            ) {

                LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.MATCH_PARENT
                )

            } else {

                LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                )
            }

        params.setMargins(
            4.dp,
            3.dp,
            4.dp,
            3.dp
        )

        categoryContainer.addView(
            button,
            params
        )
    }

    private fun buildCategoryButtonText(
        category: String,
        count: Int
    ): String {

        val label =
            ChartRepository
                .displayCategory(
                    category
                )

        return "$label\n$count"
    }

    private fun selectCategory(
        category: String
    ) {

        selectedCategory =
            ChartRepository
                .normalizeCategory(
                    category
                )

        val charts =
            repository
                .getDisplayChartsForAirport(
                    icao
                )
                .filter {
                    ChartRepository
                        .normalizeCategory(
                            it.category
                        ) ==
                        selectedCategory
                }
                .sortedBy {
                    it.page
                }

        categoryTitle.text =
            ChartRepository
                .displayCategory(
                    selectedCategory
                ) +
                "  •  " +
                charts.size +
                " CHARTS"

        listContainer.removeAllViews()

        charts.forEach {
            addChartRow(
                it
            )
        }

        refreshCategoryButtons()

        chartScrollView.post {

            chartScrollView.fullScroll(
                View.FOCUS_UP
            )
        }
    }

    private fun refreshCategoryButtons() {

        for (
            index in 0 until
                categoryContainer.childCount
        ) {

            val child =
                categoryContainer
                    .getChildAt(
                        index
                    )

            if (
                child !is TextView
            ) {
                continue
            }

            val raw =
                child.text
                    .toString()

            val category =
                raw
                    .lineSequence()
                    .firstOrNull()
                    .orEmpty()

            val normalized =
                ChartRepository
                    .normalizeCategory(
                        category
                    )

            child.background =
                createCategoryBackground(
                    normalized ==
                        selectedCategory
                )

            child.setTextColor(
                if (
                    normalized ==
                        selectedCategory
                ) {
                    Color.WHITE
                } else {
                    primaryTextColor()
                }
            )
        }
    }

    private fun addChartRow(
        chart: ChartRepository.ChartInfo
    ) {

        val card =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.VERTICAL

                setPadding(
                    18.dp,
                    15.dp,
                    18.dp,
                    15.dp
                )

                background =
                    createChartBackground()

                isClickable =
                    true

                isFocusable =
                    true

                minimumHeight =
                    82.dp

                setOnClickListener {

                    openChart(
                        chart
                    )
                }
            }

        val title =
            TextView(
                this
            ).apply {

                text =
                    chart.name

                textSize =
                    16f

                typeface =
                    Typeface.create(
                        "sans-serif",
                        Typeface.BOLD
                    )

                setTextColor(
                    primaryTextColor()
                )

                maxLines =
                    4
            }

        val number =
            TextView(
                this
            ).apply {

                text =
                    if (
                        chart.chartNumber.isNotBlank()
                    ) {

                        "Chart ${chart.chartNumber}"

                    } else {

                        "Chart"
                    }

                textSize =
                    11f

                setTextColor(
                    secondaryTextColor()
                )

                setPadding(
                    0,
                    5.dp,
                    0,
                    0
                )
            }

        val subtitle =
            TextView(
                this
            ).apply {

                text =
                    "${chart.category}  •  PDF Page ${chart.page}"

                textSize =
                    12f

                setTextColor(
                    secondaryTextColor()
                )

                setPadding(
                    0,
                    3.dp,
                    0,
                    0
                )
            }

        card.addView(
            title,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )

        card.addView(
            number,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )

        card.addView(
            subtitle,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
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

    private fun openChart(
        chart: ChartRepository.ChartInfo
    ) {

        val intent =
            Intent(
                this,
                PdfViewerActivity::class.java
            )

        intent.putExtra(
            "PAGE",
            chart.page
        )

        intent.putExtra(
            "TITLE",
            chart.name
        )

        intent.putExtra(
            "ICAO",
            chart.icao
        )

        intent.putExtra(
            "AIRPORT_NAME",
            chart.airportName
        )

        intent.putExtra(
            "CITY",
            chart.city
        )

        intent.putExtra(
            "CATEGORY",
            chart.category
        )

        startActivity(
            intent
        )
    }

    private fun showNoChartsMessage() {

        val box =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.VERTICAL

                gravity =
                    Gravity.CENTER

                setPadding(
                    30.dp,
                    70.dp,
                    30.dp,
                    70.dp
                )
            }

        val icon =
            TextView(
                this
            ).apply {

                text =
                    "⊘"

                textSize =
                    42f

                gravity =
                    Gravity.CENTER

                setTextColor(
                    secondaryTextColor()
                )
            }

        val title =
            TextView(
                this
            ).apply {

                text =
                    "No charts found"

                textSize =
                    18f

                gravity =
                    Gravity.CENTER

                typeface =
                    Typeface.DEFAULT_BOLD

                setTextColor(
                    primaryTextColor()
                )

                setPadding(
                    0,
                    12.dp,
                    0,
                    0
                )
            }

        box.addView(
            icon
        )

        box.addView(
            title
        )

        listContainer.addView(
            box,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )
    }

    private fun buildAirportSubtitle():
        String {

        return airportName
            .ifBlank {
                "Airport charts"
            }
    }

    private fun createChartBackground():
        GradientDrawable {

        return GradientDrawable().apply {

            shape =
                GradientDrawable.RECTANGLE

            cornerRadius =
                16.dp.toFloat()

            setColor(
                if (
                    isDarkTheme()
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
    }

    private fun createCategoryBackground(
        selected: Boolean
    ): GradientDrawable {

        return GradientDrawable().apply {

            shape =
                GradientDrawable.RECTANGLE

            cornerRadius =
                12.dp.toFloat()

            if (
                selected
            ) {

                setColor(
                    Color.rgb(
                        9,
                        105,
                        181
                    )
                )

                setStroke(
                    1.dp,
                    Color.rgb(
                        9,
                        105,
                        181
                    )
                )

            } else {

                setColor(
                    if (
                        isDarkTheme()
                    ) {
                        Color.rgb(
                            31,
                            43,
                            55
                        )
                    } else {
                        Color.rgb(
                            239,
                            243,
                            247
                        )
                    }
                )

                setStroke(
                    1.dp,
                    if (
                        isDarkTheme()
                    ) {
                        Color.rgb(
                            60,
                            76,
                            91
                        )
                    } else {
                        Color.rgb(
                            215,
                            223,
                            231
                        )
                    }
                )
            }
        }
    }

    private fun backgroundColor():
        Int {

        return if (
            isDarkTheme()
        ) {
            Color.rgb(
                2,
                11,
                26
            )
        } else {
            Color.rgb(
                244,
                247,
                250
            )
        }
    }

    private fun surfaceColor():
        Int {

        return if (
            isDarkTheme()
        ) {
            Color.rgb(
                7,
                26,
                49
            )
        } else {
            Color.WHITE
        }
    }

    private fun primaryTextColor():
        Int {

        return if (
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
    }

    private fun secondaryTextColor():
        Int {

        return if (
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
    }

    private fun isDarkTheme():
        Boolean {

        return (
            resources.configuration.uiMode and
                Configuration.UI_MODE_NIGHT_MASK
        ) ==
            Configuration.UI_MODE_NIGHT_YES
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
