package com.tareghmsr.jeppiran

import android.graphics.Color
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.Gravity
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import com.google.android.material.card.MaterialCardView
import org.json.JSONObject

class ChartsActivity : ComponentActivity() {

    private data class Airport(
        val icao: String,
        val country: String,
        val airportCount: Int,
        val starCount: Int,
        val sidCount: Int,
        val approachCount: Int,
        val otherCount: Int
    )

    private val airports = mutableListOf<Airport>()

    private lateinit var airportList: LinearLayout
    private lateinit var searchAirport: com.google.android.material.textfield.TextInputEditText

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        enableEdgeToEdge()

        setContentView(R.layout.activity_charts)

        val mainView = findViewById<View>(R.id.chartsMain)

        ViewCompat.setOnApplyWindowInsetsListener(mainView) { view, insets ->

            val systemBars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars()
            )

            view.setPadding(
                systemBars.left + 16,
                systemBars.top + 16,
                systemBars.right + 16,
                systemBars.bottom + 16
            )

            insets
        }

        airportList = findViewById(R.id.airportList)
        searchAirport = findViewById(R.id.searchAirport)

        loadAirports()

        searchAirport.addTextChangedListener(object : TextWatcher {

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
                filterAirports(s?.toString() ?: "")
            }

            override fun afterTextChanged(s: Editable?) {
            }
        })
    }

    private fun loadAirports() {

        try {

            val jsonText = assets
                .open("charts-app-v6.json")
                .bufferedReader()
                .use { it.readText() }

            val root = JSONObject(jsonText)

            airports.clear()

            val keys = root.keys()

            while (keys.hasNext()) {

                val icao = keys.next()

                val airport = root.getJSONObject(icao)

                val country =
                    airport.optString("country", "")

                val charts =
                    airport.optJSONObject("charts")

                var airportCount = 0
                var starCount = 0
                var sidCount = 0
                var approachCount = 0
                var otherCount = 0

                if (charts != null) {

                    airportCount =
                        charts.optJSONArray("Airport")?.length() ?: 0

                    starCount =
                        charts.optJSONArray("STAR")?.length() ?: 0

                    sidCount =
                        charts.optJSONArray("SID")?.length() ?: 0

                    approachCount =
                        charts.optJSONArray("Approach")?.length() ?: 0

                    otherCount =
                        charts.optJSONArray("Other")?.length() ?: 0
                }

                airports.add(
                    Airport(
                        icao = icao,
                        country = country,
                        airportCount = airportCount,
                        starCount = starCount,
                        sidCount = sidCount,
                        approachCount = approachCount,
                        otherCount = otherCount
                    )
                )
            }

            airports.sortBy { it.icao }

            displayAirports(airports)

        } catch (e: Exception) {

            Toast.makeText(
                this,
                "خطا در خواندن اطلاعات فرودگاه‌ها",
                Toast.LENGTH_LONG
            ).show()

            e.printStackTrace()
        }
    }

    private fun filterAirports(query: String) {

        val text = query.trim().uppercase()

        val filtered = if (text.isEmpty()) {

            airports

        } else {

            airports.filter {

                it.icao.contains(text) ||
                        it.country.uppercase().contains(text)
            }
        }

        displayAirports(filtered)
    }

    private fun displayAirports(list: List<Airport>) {

        airportList.removeAllViews()

        if (list.isEmpty()) {

            val emptyText = TextView(this)

            emptyText.text = "No airport found"
            emptyText.textSize = 16f
            emptyText.gravity = Gravity.CENTER
            emptyText.setPadding(24, 40, 24, 40)

            airportList.addView(emptyText)

            return
        }

        for (airport in list) {

            val card = MaterialCardView(this)

            val cardParams =
                LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                )

            cardParams.setMargins(
                0,
                0,
                0,
                12
            )

            card.layoutParams = cardParams

            card.radius = 18f
            card.cardElevation = 2f
            card.setCardBackgroundColor(
                Color.WHITE
            )

            val content = LinearLayout(this)

            content.orientation =
                LinearLayout.VERTICAL

            content.setPadding(
                20,
                18,
                20,
                18
            )

            val title = TextView(this)

            title.text = airport.icao
            title.textSize = 21f
            title.setTextColor(
                Color.rgb(20, 40, 65)
            )

            val country = TextView(this)

            country.text = airport.country
            country.textSize = 14f
            country.setTextColor(
                Color.rgb(100, 110, 120)
            )

            country.setPadding(
                0,
                4,
                0,
                12
            )

            val charts = TextView(this)

            charts.text = buildString {

                append("Airport: ${airport.airportCount}")
                append("   •   ")

                append("STAR: ${airport.starCount}")
                append("   •   ")

                append("SID: ${airport.sidCount}")
                append("\n")

                append("Approach: ${airport.approachCount}")

                if (airport.otherCount > 0) {
                    append("   •   Other: ${airport.otherCount}")
                }
            }

            charts.textSize = 14f

            charts.setTextColor(
                Color.rgb(55, 65, 75)
            )

            content.addView(title)
            content.addView(country)
            content.addView(charts)

            card.addView(content)

            card.setOnClickListener {

                Toast.makeText(
                    this,
                    "${airport.icao} selected",
                    Toast.LENGTH_SHORT
                ).show()
            }

            airportList.addView(card)
        }
    }
}
