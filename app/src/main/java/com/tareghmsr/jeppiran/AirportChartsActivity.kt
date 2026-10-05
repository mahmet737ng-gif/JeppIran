package com.tareghmsr.jeppiran

import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import org.json.JSONObject

class AirportChartsActivity : ComponentActivity() {

    private lateinit var airportCode: String
    private lateinit var airportName: String

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        airportCode = intent.getStringExtra("ICAO") ?: return
        airportName = intent.getStringExtra("AIRPORT_NAME") ?: airportCode

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.rgb(233, 238, 243))
        }

        // Header
        val header = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(16, 16, 16, 16)
            setBackgroundColor(Color.rgb(244, 247, 250))
        }

        val back = TextView(this).apply {
            text = "‹"
            textSize = 36f
            gravity = Gravity.CENTER

            setOnClickListener {
                finish()
            }
        }

        header.addView(
            back,
            LinearLayout.LayoutParams(50, 60)
        )

        val title = TextView(this).apply {
            text = "$airportCode • $airportName"
            textSize = 20f
            setTextColor(Color.rgb(25, 35, 45))
            setPadding(12, 0, 0, 0)
        }

        header.addView(
            title,
            LinearLayout.LayoutParams(
                0,
                LinearLayout.LayoutParams.WRAP_CONTENT,
                1f
            )
        )

        root.addView(header)

        // Scrollable chart categories
        val scroll = android.widget.ScrollView(this)

        val list = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(16, 16, 16, 24)
        }

        addCategory(list, "AIRPORT", "Airport")
        addCategory(list, "STAR", "STAR")
        addCategory(list, "SID", "SID")
        addCategory(list, "APPROACH", "Approach")

        scroll.addView(list)

        root.addView(
            scroll,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1f
            )
        )

        setContentView(root)
    }

    private fun addCategory(
        parent: LinearLayout,
        title: String,
        jsonCategory: String
    ) {

        val categoryTitle = TextView(this).apply {
            text = title
            textSize = 17f
            setTextColor(Color.rgb(30, 55, 75))
            setPadding(4, 18, 4, 8)
        }

        parent.addView(categoryTitle)

        val pages = loadPages(jsonCategory)

        if (pages.isEmpty()) {

            val empty = TextView(this).apply {
                text = "No charts"
                textSize = 14f
                setTextColor(Color.DKGRAY)
                setPadding(12, 10, 12, 10)
            }

            parent.addView(empty)

            return
        }

        pages.forEachIndexed { index, page ->

            val card = TextView(this).apply {

                text = "Chart ${index + 1}    •    PDF page $page"

                textSize = 16f
                setTextColor(Color.rgb(25, 35, 45))
                gravity = Gravity.CENTER_VERTICAL

                setPadding(18, 0, 18, 0)

                setBackgroundColor(Color.WHITE)

                setOnClickListener {

                    val intent = Intent(
                        this@AirportChartsActivity,
                        PdfViewerActivity::class.java
                    )

                    intent.putExtra("PAGE", page)

                    intent.putExtra(
                        "TITLE",
                        "$airportCode • $title"
                    )

                    startActivity(intent)
                }
            }

            val params = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                58
            )

            params.setMargins(0, 4, 0, 4)

            parent.addView(card, params)
        }
    }

    private fun loadPages(category: String): List<Int> {

        val json = assets
            .open("charts-app-v9.json")
            .bufferedReader()
            .use { it.readText() }

        val root = JSONObject(json)

        if (!root.has(airportCode)) {
            return emptyList()
        }

        val airport = root.getJSONObject(airportCode)

        val charts = airport.getJSONObject("charts")

        if (!charts.has(category)) {
            return emptyList()
        }

        val array = charts.getJSONArray(category)

        val pages = mutableListOf<Int>()

        for (i in 0 until array.length()) {

            pages.add(
                array.getJSONObject(i).getInt("page")
            )
        }

        return pages
    }
}
