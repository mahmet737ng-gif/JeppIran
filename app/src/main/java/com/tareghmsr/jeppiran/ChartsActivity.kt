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

            val airports = root.getJSONArray("airports")

            val airportList = findViewById<LinearLayout>(R.id.airportList)

            airportList.removeAllViews()

            for (i in 0 until airports.length()) {

                val airport = airports.getJSONObject(i)

                val icao = airport.getString("icao")
                val name = airport.optString("name", "")
                val country = airport.optString("country", "")

                val card = TextView(this)

                card.text = buildString {
                    append(icao)

                    if (name.isNotBlank()) {
                        append("  ")
                        append(name)
                    }

                    if (country.isNotBlank()) {
                        append("\n")
                        append(country)
                    }
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
                        "Airport: $icao",
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
