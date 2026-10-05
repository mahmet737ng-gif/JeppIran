package com.tareghmsr.jeppiran

import android.os.Bundle
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import org.json.JSONObject

class ChartsActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        enableEdgeToEdge()

        setContentView(R.layout.activity_charts)

        val mainView = findViewById<android.view.View>(R.id.chartsMain)

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

        loadAirports()
    }

    private fun loadAirports() {

        try {

            val jsonText = assets
                .open("charts-app-v6.json")
                .bufferedReader()
                .use { it.readText() }

            val root = JSONObject(jsonText)

            val airportList =
                findViewById<LinearLayout>(R.id.airportList)

            airportList.removeAllViews()

            val keys = root.keys()

            while (keys.hasNext()) {

                val icao = keys.next()

                val airport = root.getJSONObject(icao)

                val country =
                    airport.optString("country", "")

                val charts =
                    airport.optJSONObject("charts")

                var chartCount = 0

                if (charts != null) {

                    val categories = charts.keys()

                    while (categories.hasNext()) {

                        val category = categories.next()

                        val items =
                            charts.optJSONArray(category)

                        if (items != null) {
                            chartCount += items.length()
                        }
                    }
                }

                val card = TextView(this)

                card.text = buildString {

                    append(icao)

                    if (country.isNotBlank()) {
                        append("  •  ")
                        append(country)
                    }

                    append("\n")
                    append("$chartCount charts")
                }

                card.textSize = 17f

                card.setPadding(
                    24,
                    24,
                    24,
                    24
                )

                card.setOnClickListener {

                    Toast.makeText(
                        this,
                        "$icao\n$chartCount charts",
                        Toast.LENGTH_SHORT
                    ).show()
                }

                airportList.addView(card)
            }

        } catch (e: Exception) {

            Toast.makeText(
                this,
                "خطا در خواندن اطلاعات فرودگاه‌ها",
                Toast.LENGTH_LONG
            ).show()

            e.printStackTrace()
        }
    }
}
