package com.tareghmsr.jeppiran

import android.content.Intent
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class ChartsActivity : ComponentActivity() {

    private lateinit var searchBox: EditText
    private lateinit var listContainer: LinearLayout

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

    private data class Airport(
        val icao: String,
        val city: String
    )

    private val airports = airportCities
        .map { Airport(it.key, it.value) }
        .sortedBy { it.city }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        enableEdgeToEdge()

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(0xFFF7F8FA.toInt())
        }

        searchBox = EditText(this).apply {
            hint = "Search ICAO / Airport / City"
            singleLine = true
            textSize = 16f
            setPadding(
                20.dp,
                12.dp,
                20.dp,
                12.dp
            )
        }

        listContainer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
        }

        root.addView(
            searchBox,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                64.dp
            ).apply {
                setMargins(
                    16.dp,
                    12.dp,
                    16.dp,
                    8.dp
                )
            }
        )

        root.addView(
            listContainer,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1f
            )
        )

        setContentView(root)

        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->

            val bars = insets.getInsets(
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

        loadAirports()

        searchBox.addTextChangedListener(
            object : TextWatcher {

                override fun beforeTextChanged(
                    s: CharSequence?,
                    start: Int,
                    count: Int,
                    after: Int
                ) = Unit

                override fun onTextChanged(
                    s: CharSequence?,
                    start: Int,
                    before: Int,
                    count: Int
                ) {
                    loadAirports(
                        s?.toString().orEmpty()
                    )
                }

                override fun afterTextChanged(
                    s: Editable?
                ) = Unit
            }
        )
    }

    private fun loadAirports(query: String = "") {

        listContainer.removeAllViews()

        val q = query.trim().uppercase()

        airports
            .filter { airport ->
                q.isEmpty() ||
                        airport.icao.contains(q) ||
                        airport.city.contains(q)
            }
            .forEach { airport ->

                val row = LinearLayout(this).apply {

                    orientation = LinearLayout.VERTICAL

                    setPadding(
                        20.dp,
                        16.dp,
                        20.dp,
                        16.dp
                    )

                    setBackgroundColor(
                        0xFFFFFFFF.toInt()
                    )

                    setOnClickListener {

                        val intent = Intent(
                            this@ChartsActivity,
                            AirportChartsActivity::class.java
                        )

                        intent.putExtra(
                            "ICAO",
                            airport.icao
                        )

                        intent.putExtra(
                            "CITY",
                            airport.city
                        )

                        startActivity(intent)
                    }
                }

                val airportText = TextView(this).apply {
                    text = airport.icao
                    textSize = 18f
                    setTypeface(
                        null,
                        android.graphics.Typeface.BOLD
                    )
                }

                val cityText = TextView(this).apply {
                    text = airport.city
                    textSize = 13f
                    setTextColor(0xFF667085.toInt())
                }

                row.addView(airportText)

                row.addView(
                    cityText,
                    LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                    ).apply {
                        topMargin = 4.dp
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
    }

    private val Int.dp: Int
        get() = (
            this * resources.displayMetrics.density
        ).toInt()
}
