package com.tareghmsr.jeppiran

import android.content.Intent
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import org.json.JSONArray
import org.json.JSONObject

class AirportChartsActivity :
    ComponentActivity() {

    private lateinit var chartScrollView:
        ScrollView

    private lateinit var listContainer:
        LinearLayout

    private lateinit var categoryContainer:
        LinearLayout

    private lateinit var selectedCategoryTitle:
        TextView

    private var icao =
        ""

    private var airportName =
        ""

    private var city =
        ""

    private data class Chart(
        val page: Int,
        val name: String,
        val category: String,
        val chartNumber: String
    )

    private data class CategoryItem(
        val key: String,
        val label: String
    )

    private val categories =
        listOf(
            CategoryItem(
                "STAR",
                "STAR"
            ),
            CategoryItem(
                "SID",
                "SID"
            ),
            CategoryItem(
                "Airport",
                "AIRPORT"
            ),
            CategoryItem(
                "Approach",
                "APPROACH"
            ),
            CategoryItem(
                "Other",
                "OTHER"
            )
        )

    private val allCharts =
        mutableListOf<Chart>()

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
            intent.getStringExtra(
                "ICAO"
            ).orEmpty()

        airportName =
            intent.getStringExtra(
                "AIRPORT_NAME"
            ).orEmpty()

        city =
            intent.getStringExtra(
                "CITY"
            ).orEmpty()

        buildUi()

        loadCharts()
    }

    private fun buildUi() {

        val root =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.VERTICAL

                setBackgroundColor(
                    resolveColor(
                        android.R.attr.colorBackground
                    )
                )
            }

        val header =
            TextView(this).apply {

                text =
                    buildAirportTitle()

                textSize =
                    21f

                typeface =
                    Typeface.create(
                        "sans-serif",
                        Typeface.BOLD
                    )

                setTextColor(
                    resolveColor(
                        android.R.attr.textColorPrimary
                    )
                )

                gravity =
                    Gravity.CENTER_VERTICAL

                setPadding(
                    20.dp,
                    18.dp,
                    20.dp,
                    18.dp
                )
            }

        selectedCategoryTitle =
            TextView(this).apply {

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
                    resolveColor(
                        android.R.attr.textColorSecondary
                    )
                )

                setPadding(
                    18.dp,
                    10.dp,
                    18.dp,
                    10.dp
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
                    listContainer
                )
            }

        categoryContainer =
            LinearLayout(
                this
            ).apply {

                setBackgroundColor(
                    resolveColor(
                        android.R.attr.colorBackground
                    )
                )

                elevation =
                    8.dp.toFloat()
            }

        val landscape =
            resources.displayMetrics.widthPixels >=
                resources.displayMetrics.heightPixels

        if (
            landscape
        ) {

            buildLandscape(
                root,
                header,
                selectedCategoryTitle,
                chartScrollView
            )

        } else {

            buildPortrait(
                root,
                header,
                selectedCategoryTitle,
                chartScrollView
            )
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
    }

    private fun buildPortrait(
        root: LinearLayout,
        header: TextView,
        title: TextView,
        chartScroll: ScrollView
    ) {

        root.addView(
            header,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )

        val content =
            LinearLayout(this).apply {
                orientation =
                    LinearLayout.VERTICAL
            }

        content.addView(
            title,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )

        content.addView(
            buildChartScroller(
                chartScroll
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

        configureCategoryContainer(
            horizontal = true
        )

        root.addView(
            categoryContainer,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                72.dp
            )
        )

        createCategoryButtons()
    }

    private fun buildLandscape(
        root: LinearLayout,
        header: TextView,
        title: TextView,
        chartScroll: ScrollView
    ) {

        root.addView(
            header,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )

        val workspace =
            LinearLayout(this).apply {
                orientation =
                    LinearLayout.HORIZONTAL
            }

        configureCategoryContainer(
            horizontal = false
        )

        workspace.addView(
            categoryContainer,
            LinearLayout.LayoutParams(
                122.dp,
                LinearLayout.LayoutParams.MATCH_PARENT
            )
        )

        val content =
            LinearLayout(this).apply {
                orientation =
                    LinearLayout.VERTICAL
            }

        content.addView(
            title,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )

        content.addView(
            buildChartScroller(
                chartScroll
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

        createCategoryButtons()
    }

    private fun buildChartScroller(
        scrollView: ScrollView
    ): LinearLayout {

        val wrapper =
            LinearLayout(this).apply {
                orientation =
                    LinearLayout.VERTICAL
            }

        val up =
            TextView(this).apply {

                text =
                    "▲"

                textSize =
                    18f

                gravity =
                    Gravity.CENTER

                setTextColor(
                    resolveColor(
                        android.R.attr.textColorSecondary
                    )
                )

                setOnClickListener {

                    scrollView.smoothScrollBy(
                        0,
                        -420.dp
                    )
                }
            }

        val down =
            TextView(this).apply {

                text =
                    "▼"

                textSize =
                    18f

                gravity =
                    Gravity.CENTER

                setTextColor(
                    resolveColor(
                        android.R.attr.textColorSecondary
                    )
                )

                setOnClickListener {

                    scrollView.smoothScrollBy(
                        0,
                        420.dp
                    )
                }
            }

        wrapper.addView(
            up,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                34.dp
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
            down,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                34.dp
            )
        )

        scrollView
            .viewTreeObserver
            .addOnScrollChangedListener {

                up.alpha =
                    if (
                        scrollView.scrollY > 0
                    ) {
                        1f
                    } else {
                        0.25f
                    }

                val child =
                    scrollView.getChildAt(
                        0
                    )

                if (
                    child != null
                ) {

                    val maxScroll =
                        child.height -
                            scrollView.height

                    down.alpha =
                        if (
                            maxScroll > 0 &&
                            scrollView.scrollY <
                                maxScroll
                        ) {
                            1f
                        } else {
                            0.25f
                        }
                }
            }

        return wrapper
    }

    private fun configureCategoryContainer(
        horizontal: Boolean
    ) {

        categoryContainer.orientation =
            if (
                horizontal
            ) {
                LinearLayout.HORIZONTAL
            } else {
                LinearLayout.VERTICAL
            }

        categoryContainer.gravity =
            Gravity.CENTER

        categoryContainer.setPadding(
            if (horizontal) 8.dp else 6.dp,
            6.dp,
            if (horizontal) 8.dp else 6.dp,
            6.dp
        )
    }

    private fun createCategoryButtons() {

        categoryContainer.removeAllViews()

        val available =
            categories.filter {
                category ->

                allCharts.any {

                    normalizeCategory(
                        it.category
                    ) ==
                        normalizeCategory(
                            category.key
                        )
                }
            }

        if (
            available.isEmpty()
        ) {
            return
        }

        val horizontal =
            categoryContainer.orientation ==
                LinearLayout.HORIZONTAL

        available.forEach {
            category ->

            val count =
                allCharts.count {

                    normalizeCategory(
                        it.category
                    ) ==
                        normalizeCategory(
                            category.key
                        )
                }

            val button =
                TextView(this).apply {

                    text =
                        "${category.label}\n$count"

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

                    setPadding(
                        8.dp,
                        6.dp,
                        8.dp,
                        6.dp
                    )

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

            val params =
                if (
                    horizontal
                ) {

                    LinearLayout.LayoutParams(
                        0,
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        1f
                    )

                } else {

                    LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        0,
                        1f
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

        refreshCategoryButtonStates(
            available.first().key
        )
    }

    private fun selectCategory(
        selected: CategoryItem
    ) {

        selectedCategoryTitle.text =
            "${selected.label}  •  CHARTS"

        val filtered =
            allCharts
                .filter {
                    normalizeCategory(
                        it.category
                    ) ==
                        normalizeCategory(
                            selected.key
                        )
                }
                .sortedBy {
                    it.page
                }

        listContainer.removeAllViews()

        filtered.forEach { chart ->

            addChartRow(
                chart
            )
        }

        chartScrollView.post {
            chartScrollView.fullScroll(
                View.FOCUS_UP
            )
        }

        refreshCategoryButtonStates(
            selected.key
        )
    }

    private fun refreshCategoryButtonStates(
        selectedKey: String
    ) {

        val selected =
            normalizeCategory(
                selectedKey
            )

        for (
            i in 0 until categoryContainer.childCount
        ) {

            val child =
                categoryContainer.getChildAt(
                    i
                )

            if (
                child !is TextView
            ) {
                continue
            }

            val value =
                child.text
                    .toString()
                    .uppercase()

            val active =
                value.startsWith(
                    selected
                )

            child.background =
                createCategoryBackground(
                    active
                )

            child.setTextColor(
                if (
                    active
                ) {
                    Color.WHITE
                } else {
                    resolveColor(
                        android.R.attr.textColorPrimary
                    )
                }
            )
        }
    }

    private fun addChartRow(
        chart: Chart
    ) {

        val row =
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

                setOnClickListener {

                    val intent =
                        Intent(
                            this@AirportChartsActivity,
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
                        icao
                    )

                    intent.putExtra(
                        "AIRPORT_NAME",
                        airportName
                    )

                    intent.putExtra(
                        "CITY",
                        city
                    )

                    intent.putExtra(
                        "CATEGORY",
                        chart.category
                    )

                    startActivity(
                        intent
                    )
                }
            }

        val title =
            TextView(this).apply {

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
                    resolveColor(
                        android.R.attr.textColorPrimary
                    )
                )
            }

        val subtitle =
            TextView(this).apply {

                text =
                    chart.category +
                        "  •  Page " +
                        chart.page

                textSize =
                    12f

                setTextColor(
                    resolveColor(
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

        row.addView(
            title
        )

        row.addView(
            subtitle
        )

        listContainer.addView(
            row,
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

    private fun loadCharts() {

        allCharts.clear()

        try {

            val raw =
                assets
                    .open(
                        "charts-app-v16.json"
                    )
                    .bufferedReader()
                    .use {
                        it.readText()
                    }
                    .trim()

            if (
                raw.startsWith("[")
            ) {

                readArray(
                    JSONArray(
                        raw
                    )
                )

            } else {

                val root =
                    JSONObject(
                        raw
                    )

                val arrays =
                    listOf(
                        "charts",
                        "data",
                        "items",
                        "pages"
                    )

                var loaded =
                    false

                for (
                    key in arrays
                ) {

                    val value =
                        root.opt(
                            key
                        )

                    if (
                        value is JSONArray
                    ) {

                        readArray(
                            value
                        )

                        loaded =
                            true

                        break
                    }
                }

                if (
                    !loaded
                ) {

                    val keys =
                        root.keys()

                    while (
                        keys.hasNext()
                    ) {

                        val value =
                            root.opt(
                                keys.next()
                            )

                        if (
                            value is JSONObject
                        ) {

                            readChartObject(
                                value
                            )
                        }
                    }
                }
            }

        } catch (
            _: Exception
        ) {
        }

        createCategoryButtons()

        val first =
            categories.firstOrNull {
                category ->

                allCharts.any {

                    normalizeCategory(
                        it.category
                    ) ==
                        normalizeCategory(
                            category.key
                        )
                }
            }

        if (
            first != null
        ) {

            selectCategory(
                first
            )
        }
    }

    private fun readArray(
        array: JSONArray
    ) {

        for (
            i in 0 until array.length()
        ) {

            val item =
                array.optJSONObject(
                    i
                )
                    ?: continue

            readChartObject(
                item
            )
        }
    }

    private fun readChartObject(
        item: JSONObject
    ) {

        val itemIcao =
            firstNonEmpty(
                item.optString(
                    "icao"
                ),
                item.optString(
                    "airport"
                ),
                item.optString(
                    "airport_icao"
                )
            ).uppercase()

        if (
            itemIcao.isNotBlank() &&
            itemIcao != icao.uppercase()
        ) {
            return
        }

        val page =
            firstPositiveInt(
                item.optInt(
                    "page",
                    -1
                ),
                item.optInt(
                    "pageNumber",
                    -1
                ),
                item.optInt(
                    "page_number",
                    -1
                )
            )

        if (
            page <= 0
        ) {
            return
        }

        val chartCategory =
            firstNonEmpty(
                item.optString(
                    "category"
                ),
                item.optString(
                    "type"
                ),
                item.optString(
                    "chart_type"
                ),
                "Other"
            )

        val chartNumber =
            firstNonEmpty(
                item.optString(
                    "chart_number"
                ),
                item.optString(
                    "chartNumber"
                )
            )

        val rawName =
            firstNonEmpty(
                item.optString(
                    "name"
                ),
                item.optString(
                    "title"
                ),
                item.optString(
                    "chart_name"
                )
            )

        val name =
            makeChartDisplayName(
                rawName,
                chartCategory,
                chartNumber
            )

        allCharts.add(
            Chart(
                page,
                name,
                chartCategory,
                chartNumber
            )
        )
    }

    private fun makeChartDisplayName(
        rawName: String,
        category: String,
        chartNumber: String
    ): String {

        val clean =
            rawName.trim()

        val placeholder =
            clean.isBlank() ||
                clean.matches(
                    Regex(
                        "(?i)chart\\s*page\\s*\\d+"
                    )
                )

        if (
            !placeholder
        ) {
            return clean
        }

        if (
            chartNumber.isNotBlank()
        ) {

            return category
                .trim()
                .uppercase() +
                " " +
                chartNumber.trim()
        }

        return category
            .trim()
            .uppercase() +
            " CHART"
    }

    private fun normalizeCategory(
        value: String
    ): String {

        return when (
            value.trim().uppercase()
        ) {

            "STAR" ->
                "STAR"

            "SID" ->
                "SID"

            "AIRPORT" ->
                "AIRPORT"

            "APPROACH" ->
                "APPROACH"

            else ->
                "OTHER"
        }
    }

    private fun buildAirportTitle():
        String {

        return listOf(
            icao.trim(),
            airportName.trim(),
            city.trim()
        )
            .filter {
                it.isNotEmpty()
            }
            .joinToString(
                "  •  "
            )
    }

    private fun firstNonEmpty(
        vararg values: String
    ): String {

        return values.firstOrNull {
            it.trim().isNotEmpty()
        }
            ?.trim()
            ?: ""
    }

    private fun firstPositiveInt(
        vararg values: Int
    ): Int {

        return values.firstOrNull {
            it > 0
        }
            ?: -1
    }

    private fun resolveColor(
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

    private fun createChartBackground():
        GradientDrawable {

        val dark =
            isDarkTheme()

        return GradientDrawable().apply {

            shape =
                GradientDrawable.RECTANGLE

            cornerRadius =
                14.dp.toFloat()

            setColor(
                if (
                    dark
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
                    dark
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

        val dark =
            isDarkTheme()

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
                        25,
                        115,
                        125
                    )
                )

                setStroke(
                    1.dp,
                    Color.rgb(
                        25,
                        115,
                        125
                    )
                )

            } else {

                setColor(
                    if (
                        dark
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
                        dark
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
