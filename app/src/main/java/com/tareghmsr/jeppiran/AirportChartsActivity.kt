package com.tareghmsr.jeppiran

import android.content.Intent
import android.graphics.Typeface
import android.os.Bundle
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

class AirportChartsActivity : ComponentActivity() {

    private lateinit var listContainer: LinearLayout

    private var icao = ""
    private var city = ""

    private data class Chart(
        val page: Int,
        val name: String,
        val category: String
    )

    override fun onCreate(
        savedInstanceState: Bundle?
    ) {
        super.onCreate(
            savedInstanceState
        )

        enableEdgeToEdge()

        icao =
            intent.getStringExtra(
                "ICAO"
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
            LinearLayout(this).apply {

                orientation =
                    LinearLayout.VERTICAL

                setBackgroundColor(
                    0xFFF7F8FA.toInt()
                )
            }

        val header =
            TextView(this).apply {

                text =
                    "$icao  •  $city"

                textSize =
                    22f

                typeface =
                    Typeface.DEFAULT_BOLD

                setPadding(
                    20.dp,
                    20.dp,
                    20.dp,
                    20.dp
                )

                setBackgroundColor(
                    0xFFFFFFFF.toInt()
                )
            }

        listContainer =
            LinearLayout(this).apply {

                orientation =
                    LinearLayout.VERTICAL

                layoutParams =
                    ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT
                    )
            }

        val scrollView =
            ScrollView(this).apply {

                isFillViewport =
                    true

                overScrollMode =
                    ScrollView.OVER_SCROLL_IF_CONTENT_SCROLLS

                addView(
                    listContainer
                )
            }

        root.addView(
            header
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
    }

    private fun loadCharts() {

        val text =
            assets
                .open(
                    "charts-app-v16.json"
                )
                .bufferedReader()
                .use {
                    it.readText()
                }

        val charts =
            mutableListOf<Chart>()

        val root =
            text.trim()

        if (
            root.startsWith("[")
        ) {

            val array =
                JSONArray(root)

            readArray(
                array,
                charts
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
                        value,
                        charts
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

                    val key =
                        keys.next()

                    val value =
                        jsonObject.opt(
                            key
                        )

                    if (
                        value is JSONObject
                    ) {

                        readChartObject(
                            value,
                            charts
                        )
                    }
                }
            }
        }

        charts
            .filter {
                it.page > 0
            }
            .distinctBy {
                "${it.page}|${it.name}|${it.category}"
            }
            .sortedBy {
                it.page
            }
            .forEach { chart ->

                addChartRow(
                    chart
                )
            }
    }

    private fun readArray(
        array: JSONArray,
        charts: MutableList<Chart>
    ) {

        for (
            i in 0 until array.length()
        ) {

            val value =
                array.opt(
                    i
                )

            if (
                value is JSONObject
            ) {

                readChartObject(
                    value,
                    charts
                )
            }
        }
    }

    private fun readChartObject(
        item: JSONObject,
        charts: MutableList<Chart>
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

        charts.add(
            Chart(
                page = page,
                name = name,
                category = category
            )
        )
    }

    private fun addChartRow(
        chart: Chart
    ) {

        val row =
            LinearLayout(this).apply {

                orientation =
                    LinearLayout.VERTICAL

                setPadding(
                    20.dp,
                    15.dp,
                    20.dp,
                    15.dp
                )

                setBackgroundColor(
                    0xFFFFFFFF.toInt()
                )

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
                    17f

                typeface =
                    Typeface.DEFAULT_BOLD
            }

        val subtitle =
            TextView(this).apply {

                text =
                    "${chart.category}  •  Page ${chart.page}"

                textSize =
                    13f

                setTextColor(
                    0xFF667085.toInt()
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
                    16.dp,
                    4.dp,
                    16.dp,
                    4.dp
                )
            }
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

    private val Int.dp: Int
        get() =
            (
                this *
                    resources.displayMetrics.density
                ).toInt()
}
