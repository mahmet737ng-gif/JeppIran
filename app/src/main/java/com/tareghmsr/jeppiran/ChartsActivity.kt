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
import com.google.android.material.textfield.TextInputEditText
import org.json.JSONObject

class ChartsActivity : ComponentActivity() {

    private data class Airport(
        val icao: String,
        val city: String,
        val airportCount: Int,
        val starCount: Int,
        val sidCount: Int,
        val approachCount: Int,
        val otherCount: Int
    )

    private val airports = mutableListOf<Airport>()

    private lateinit var airportList: LinearLayout
    private lateinit var searchAirport: TextInputEditText

    /*
     * Airport / City names
     */
    private val airportCities = mapOf(
        "OIAA" to "ABADAN",
        "OIAM" to "MAHSHAHR",
        "OIAW" to "AHWAZ",
        "OIBB" to "BUSHEHR",
        "OIBK" to "KISH",
        "OIBP" to "ASALOUYEH",
        "OICC" to "KERMANSHAH",
        "OICI" to "ILAM",
        "OIFM" to "ISFAHAN",
        "OIGG" to "RASHT",
        "OIHH" to "HAMADAN",
        "OIIE" to "TEHRAN",
        "OIII" to "TEHRAN",
        "OIIP" to "KARAJ",
        "OIKK" to "KERMAN",
        "OIMB" to "BIRJAND",
        "OIMM" to "MASHHAD",
        "OIMN" to "BOJNURD",
        "OIMS" to "SABZEVAR",
        "OING" to "GORGAN",
        "OINZ" to "SARI",
        "OISS" to "SHIRAZ",
        "OITL" to "ARDABIL",
        "OITR" to "URMIA",
        "OITT" to "TABRIZ",
        "OIYY" to "YAZD",
        "OIZC" to "CHABAHAR",
        "OIZH" to "ZAHEDAN",

        "OMDB" to "DUBAI",
        "OOMS" to "MUSCAT",

        "ORBI" to "BAGHDAD",
        "ORNI" to "NAJAF",

        "UDYZ" to "YEREVAN",

        "UGSB" to "BATUMI",
        "UGTB" to "TBILISI",

        "LTFM" to "ISTANBUL"
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        enableEdgeToEdge()

        setContentView(R.layout.activity_charts)

        val mainView = findViewById<View>(R.id.chartsMain)

        /*
         * Light aviation-style background.
         * Not pure white and not too dark.
         */
        mainView.setBackgroundColor(
            Color.rgb(233, 238, 243)
        )

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

        /*
         * Live airport search
         */
        searchAirport.addTextChangedListener(
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
                    filterAirports(
                        s?.toString() ?: ""
                    )
                }

                override fun afterTextChanged(
                    s: Editable?
                ) {
                }
            }
        )
    }

    /*
     * Load airport database from assets
     */
    private fun loadAirports() {

        try {

            val jsonText = assets
                .open("charts-app-v6.json")
                .bufferedReader()
                .use {
                    it.readText()
                }

            val root = JSONObject(jsonText)

            airports.clear()

            val keys = root.keys()

            while (keys.hasNext()) {

                val icao = keys.next()

                val airport =
                    root.getJSONObject(icao)

                val charts =
                    airport.optJSONObject("charts")

                var airportCount = 0
                var starCount = 0
                var sidCount = 0
                var approachCount = 0
                var otherCount = 0

                if (charts != null) {

                    airportCount =
                        charts
                            .optJSONArray("Airport")
                            ?.length()
                            ?: 0

                    starCount =
                        charts
                            .optJSONArray("STAR")
                            ?.length()
                            ?: 0

                    sidCount =
                        charts
                            .optJSONArray("SID")
                            ?.length()
                            ?: 0

                    approachCount =
                        charts
                            .optJSONArray("Approach")
                            ?.length()
                            ?: 0

                    otherCount =
                        charts
                            .optJSONArray("Other")
                            ?.length()
                            ?: 0
                }

                val city =
                    airportCities[icao]
                        ?: icao

                airports.add(
                    Airport(
                        icao = icao,
                        city = city,
                        airportCount = airportCount,
                        starCount = starCount,
                        sidCount = sidCount,
                        approachCount = approachCount,
                        otherCount = otherCount
                    )
                )
            }

            /*
             * Sort alphabetically by ICAO
             */
            airports.sortBy {
                it.icao
            }

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

    /*
     * Airport search
     *
     * Supports:
     * ICAO
     * City
     */
    private fun filterAirports(
        query: String
    ) {

        val text =
            query
                .trim()
                .uppercase()

        val filtered =

            if (text.isEmpty()) {

                airports

            } else {

                airports.filter {

                    it.icao.contains(text) ||
                            it.city.contains(text)
                }
            }

        displayAirports(filtered)
    }

    /*
     * Draw airport cards
     */
    private fun displayAirports(
        list: List<Airport>
    ) {

        airportList.removeAllViews()

        if (list.isEmpty()) {

            val emptyText =
                TextView(this)

            emptyText.text =
                "No airport found"

            emptyText.textSize =
                16f

            emptyText.gravity =
                Gravity.CENTER

            emptyText.setTextColor(
                Color.rgb(55, 70, 85)
            )

            emptyText.setPadding(
                24,
                40,
                24,
                40
            )

            airportList.addView(
                emptyText
            )

            return
        }

        for (airport in list) {

            val card =
                MaterialCardView(this)

            val cardParams =
                LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                )

            cardParams.setMargins(
                0,
                0,
                0,
                8
            )

            card.layoutParams =
                cardParams

            /*
             * Slightly brighter than background.
             * Not pure white.
             */
            card.setCardBackgroundColor(
                Color.rgb(244, 247, 250)
            )

            card.cardElevation =
                1f

            card.radius =
                14f

            val content =
                LinearLayout(this)

            content.orientation =
                LinearLayout.VERTICAL

            content.setPadding(
                20,
                16,
                20,
                16
            )

            val title =
                TextView(this)

            title.text =
                "${airport.icao}  •  ${airport.city}"

            title.textSize =
                19f

            title.setTextColor(
                Color.rgb(25, 48, 72)
            )

            content.addView(
                title
            )

            card.addView(
                content
            )

            /*
             * Temporary click behavior.
             * Later this will open the chart categories.
             */
            card.setOnClickListener {

                Toast.makeText(
                    this,
                    "${airport.icao} • ${airport.city}",
                    Toast.LENGTH_SHORT
                ).show()
            }

            airportList.addView(
                card
            )
        }
    }
}
