package com.tareghmsr.jeppiran

import android.content.Intent
import android.graphics.Typeface
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class ChartsActivity : ComponentActivity() {

    private lateinit var searchBox: EditText
    private lateinit var listContainer: LinearLayout

    private data class Airport(
        val icao: String,
        val airportName: String,
        val city: String
    )

    private val airports =
        listOf(
            Airport("LTFM", "ISTANBUL", "ISTANBUL"),
            Airport("OIAA", "ABADAN", "ABADAN"),
            Airport("OIAM", "MAHSHAHR", "MAHSHAHR"),
            Airport("OIAW", "AHWAZ", "AHWAZ"),
            Airport("OIBB", "BUSHEHR", "BUSHEHR"),
            Airport("OIBK", "KISH", "KISH"),
            Airport("OIBP", "ASALOUYEH", "ASALOUYEH"),
            Airport("OICC", "KERMANSHAH", "KERMANSHAH"),
            Airport("OICI", "ILAM", "ILAM"),
            Airport("OIFM", "ISFAHAN", "ISFAHAN"),
            Airport("OIGG", "RASHT", "RASHT"),
            Airport("OIHH", "HAMADAN", "HAMADAN"),
            Airport("OIIE", "IMAM KHOMEINI", "TEHRAN"),
            Airport("OIII", "MEHRABAD", "TEHRAN"),
            Airport("OIIP", "KARAJ", "KARAJ"),
            Airport("OIKK", "KERMAN", "KERMAN"),
            Airport("OIMB", "BIRJAND", "BIRJAND"),
            Airport("OIMM", "MASHHAD", "MASHHAD"),
            Airport("OIMN", "BOJNURD", "BOJNURD"),
            Airport("OIMS", "SABZEVAR", "SABZEVAR"),
            Airport("OING", "GORGAN", "GORGAN"),
            Airport("OINZ", "SARI", "SARI"),
            Airport("OISS", "SHIRAZ", "SHIRAZ"),
            Airport("OITL", "ARDABIL", "ARDABIL"),
            Airport("OITR", "URMIA", "URMIA"),
            Airport("OITT", "TABRIZ", "TABRIZ"),
            Airport("OIYY", "YAZD", "YAZD"),
            Airport("OIZC", "CHABAHAR", "CHABAHAR"),
            Airport("OIZH", "ZAHEDAN", "ZAHEDAN"),
            Airport("OMDB", "DUBAI INTL", "DUBAI"),
            Airport("OOMS", "MUSCAT INTL", "MUSCAT"),
            Airport("ORBI", "BAGHDAD INTL", "BAGHDAD"),
            Airport("ORNI", "NAJAF", "NAJAF"),
            Airport("UDYZ", "ZVARTNOTS", "YEREVAN"),
            Airport("UGSB", "BATUMI", "BATUMI"),
            Airport("UGTB", "TBILISI", "TBILISI")
        )
            .sortedBy {
                it.icao
            }

    override fun onCreate(
        savedInstanceState: Bundle?
    ) {
        super.onCreate(
            savedInstanceState
        )

        enableEdgeToEdge()

        val root =
            LinearLayout(this).apply {
                orientation =
                    LinearLayout.VERTICAL

                setBackgroundColor(
                    0xFFF7F8FA.toInt()
                )
            }

        searchBox =
            EditText(this).apply {
                hint =
                    "Search ICAO / Airport / City"

                isSingleLine =
                    true

                textSize =
                    16f

                setPadding(
                    20.dp,
                    12.dp,
                    20.dp,
                    12.dp
                )
            }

        listContainer =
            LinearLayout(this).apply {
                orientation =
                    LinearLayout.VERTICAL
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

    private fun loadAirports(
        query: String = ""
    ) {

        listContainer.removeAllViews()

        val q =
            query
                .trim()
                .uppercase()

        airports
            .filter { airport ->

                q.isEmpty() ||
                        airport.icao.contains(
                            q
                        ) ||
                        airport.airportName.contains(
                            q
                        ) ||
                        airport.city.contains(
                            q
                        )
            }
            .forEach { airport ->

                val row =
                    LinearLayout(this).apply {

                        orientation =
                            LinearLayout.VERTICAL

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

                            val intent =
                                Intent(
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

                            startActivity(
                                intent
                            )
                        }
                    }

                val icaoText =
                    TextView(this).apply {

                        text =
                            airport.icao

                        textSize =
                            18f

                        setTypeface(
                            null,
                            Typeface.BOLD
                        )

                        setTextColor(
                            0xFF172033.toInt()
                        )
                    }

                val airportNameText =
                    TextView(this).apply {

                        text =
                            airport.airportName

                        textSize =
                            15f

                        setTypeface(
                            null,
                            Typeface.BOLD
                        )

                        setTextColor(
                            0xFF344054.toInt()
                        )
                    }

                val cityText =
                    TextView(this).apply {

                        text =
                            airport.city

                        textSize =
                            13f

                        setTextColor(
                            0xFF667085.toInt()
                        )
                    }

                row.addView(
                    icaoText
                )

                row.addView(
                    airportNameText,
                    LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                    ).apply {
                        topMargin =
                            4.dp
                    }
                )

                row.addView(
                    cityText,
                    LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                    ).apply {
                        topMargin =
                            2.dp
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
        get() =
            (
                this *
                    resources.displayMetrics.density
                ).toInt()
}
