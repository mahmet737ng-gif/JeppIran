package com.tareghmsr.jeppiran

import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
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
        val category: String
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

        airportName =
            intent
                .getStringExtra(
                    "AIRPORT_NAME"
                )
                .orEmpty()

        city =
            intent
                .getStringExtra(
                    "CITY"
                )
                .orEmpty()

        buildUi()

        loadCharts()
    }

    private fun buildUi() {

        val root =
            LinearLayout(this).apply {

                orientation =
                    LinearLayout.VERTICAL

                setBackgroundColor(
                    Color.rgb(
                        244,
                        247,
                        250
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
                    Color.rgb(
                        18,
                        32,
                        48
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

                setBackgroundColor(
                    Color.WHITE
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
                    Color.rgb(
                        80,
                        96,
                        112
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
            LinearLayout(this).apply {

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
            ScrollView(this).apply {

                isFillViewport =
                    true

                overScrollMode =
                    ScrollView.OVER_SCROLL_IF_CONTENT_SCROLLS

                addView(
                    listContainer
                )
            }

        categoryContainer =
            LinearLayout(this).apply {

                setBackgroundColor(
                    Color.WHITE
                )

                elevation =
                    8.dp.toFloat()
            }

        val landscape =
            resources.displayMetrics.widthPixels >=
                    resources.displayMetrics.heightPixels

        if (landscape) {

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

        val upButton =
            TextView(this).apply {

                text =
                    "▲"

                textSize =
                    18f

                gravity =
                    Gravity.CENTER

                setTextColor(
                    Color.rgb(
                        66,
                        82,
                        98
                    )
                )

                setBackgroundColor(
                    Color.argb(
                        20,
                        20,
                        45,
                        65
                    )
                )

                setOnClickListener {

                    scrollView.smoothScrollBy(
                        0,
                        -420.dp
                    )
                }
            }

        val downButton =
            TextView(this).apply {

                text =
                    "▼"

                textSize =
                    18f

                gravity =
                    Gravity.CENTER

                setTextColor(
                    Color.rgb(
                        66,
                        82,
                        98
                    )
                )

                setBackgroundColor(
                    Color.argb(
                        20,
                        20,
                        45,
                        65
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
            upButton,
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
            downButton,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                34.dp
            )
        )

        scrollView.viewTreeObserver.addOnScrollChangedListener {

            upButton.alpha =
                if (
                    scrollView.scrollY > 0
                ) {
                    1f
                } else {
                    0.25f
                }

            val child =
                scrollView.getChildAt(0)

            val maxScroll =
                child.height -
                        scrollView.height

            downButton.alpha =
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

        return wrapper
    }

    private fun configureCategoryContainer(
        horizontal: Boolean
    ) {

        categoryContainer.orientation =
            if (horizontal) {
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

        val availableCategories =
            categories.filter { category ->

                allCharts.any {
                    normalizeCategory(
                        it.category
                    ) == normalizeCategory(
                        category.key
                    )
                }
            }

        if (
            availableCategories.isEmpty()
        ) {
            return
        }

        val horizontal =
            categoryContainer.orientation ==
                    LinearLayout.HORIZONTAL

        availableCategories.forEach {
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
                        if (horizontal) {
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
                if (horizontal) {

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
    }

    private fun selectCategory(
        category: CategoryItem
    ) {

        selectedCategoryTitle.text =
            "${category.label}  •  CHARTS"

        val filtered =
            allCharts
                .filter {
                    normalizeCategory(
                        it.category
                    ) ==
                            normalizeCategory(
                                category.key
                            )
                }
                .sortedBy {
                    it.page
                }

        listContainer.removeAllViews()

        filtered.forEach {
            chart ->

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
            category.key
        )
    }

    private fun refreshCategoryButtonStates(
        selectedKey: String
    ) {

        val selectedNormalized =
            normalizeCategory(
                selectedKey
            )

        for (
            i in 0 until
                    categoryContainer.childCount
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

            val rawText =
                child.text
                    .toString()
                    .uppercase()

            val isSelected =
                rawText.startsWith(
                    selectedNormalized
                )

            child.background =
                createCategoryBackground(
                    isSelected
                )

            child.setTextColor(
                if (isSelected) {
                    Color.WHITE
                } else {
                    Color.rgb(
                        45,
                        61,
                        78
                    )
                }
            )
        }
    }

    private fun addChartRow(
        chart: Chart
    ) {

        val row =
            LinearLayout(this).apply {

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
                    Color.rgb(
                        23,
                        38,
                        54
                    )
                )
            }

        val subtitle =
            TextView(this).apply {

                text =
                    "${chart.category}  •  Page ${chart.page}"

                textSize =
                    12f

                setTextColor(
                    Color.rgb(
                        102,
                        116,
                        132
                    )
                )
            }

        row.addView(
            title
        )

        row.addView(
            subtitle,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {

                topMargin =
                    4.dp
            }
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

        val text =
            assets
                .open(
                    "charts-app-v16.json"
                )
                .bufferedReader()
                .use {
                    it.readText()
                }

        val root =
            text.trim()

        if (
            root.startsWith("[")
        ) {

            readArray(
                JSONArray(root)
            )

        } else {

            val jsonObject =
                JSONObject(root)

            val possibleArrays =
                listOf(
                    "charts",
                    "data",
                    "items",
                    "pages"
                )

            var found =
                false

            for (
                key in possibleArrays
            ) {

                val value =
                    jsonObject.opt(
                        key
                    )

                if (
                    value is JSONArray
                ) {

                    readArray(
                        value
                    )

                    found =
                        true

                    break
                }
            }

            if (!found) {

                val keys =
                    jsonObject.keys()

                while (
                    keys.hasNext()
                ) {

                    val value =
                        jsonObject.opt(
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

        createCategoryButtons()

        val firstAvailable =
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
            firstAvailable != null
        ) {

            selectCategory(
                firstAvailable
            )
        }
    }

    private fun readArray(
        array: JSONArray
    ) {

        for (
            index in
            0 until array.length()
        ) {

            val value =
                array.opt(
                    index
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
            itemIcao.isNotEmpty() &&
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

        val category =
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

        val name =
            firstNonEmpty(
                item.optString(
                    "name"
                ),
                item.optString(
                    "title"
                ),
                item.optString(
                    "chart_name"
                ),
                "Chart page $page"
            )

        allCharts.add(
            Chart(
                page =
                    page,
                name =
                    name,
                category =
                    category
            )
        )
    }

    private fun normalizeCategory(
        value: String
    ): String {

        return when (
            value
                .trim()
                .uppercase()
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

        val cleanIcao =
            icao.trim()

        val cleanAirport =
            airportName.trim()

        val cleanCity =
            city.trim()

        return listOf(
            cleanIcao,
            cleanAirport,
            cleanCity
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

        return values
            .firstOrNull {
                it.trim().isNotEmpty()
            }
            ?.trim()
            ?: ""
    }

    private fun firstPositiveInt(
        vararg values: Int
    ): Int {

        return values
            .firstOrNull {
                it > 0
            }
            ?: -1
    }

    private fun createChartBackground():
            GradientDrawable {

        return GradientDrawable().apply {

            shape =
                GradientDrawable.RECTANGLE

            cornerRadius =
                14.dp.toFloat()

            setColor(
                Color.WHITE
            )

            setStroke(
                1.dp,
                Color.rgb(
                    224,
                    230,
                    236
                )
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

            if (selected) {

                setColor(
                    Color.rgb(
                        25,
                        97,
                        111
                    )
                )

                setStroke(
                    1.dp,
                    Color.rgb(
                        25,
                        97,
                        111
                    )
                )

            } else {

                setColor(
                    Color.rgb(
                        239,
                        243,
                        247
                    )
                )

                setStroke(
                    1.dp,
                    Color.rgb(
                        215,
                        223,
                        231
                    )
                )
            }
        }
    }

    private val Int.dp: Int
        get() =
            (
                this *
                    resources.displayMetrics.density
                ).toInt()
}
