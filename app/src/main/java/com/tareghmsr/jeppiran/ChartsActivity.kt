package com.tareghmsr.jeppiran

import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class ChartsActivity :
    AppCompatActivity() {

    private lateinit var root:
        LinearLayout

    private lateinit var searchBox:
        EditText

    private lateinit var resultCount:
        TextView

    private lateinit var listContainer:
        LinearLayout

    private var allAirports =
        emptyList<ChartRepository.AirportInfo>()

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

        allAirports =
            ChartRepository(
                this
            )
                .getAirports()
                .sortedBy {
                    it.icao
                }

        buildUi()
    }

    private fun buildUi() {

        root =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.VERTICAL

                setBackgroundColor(
                    color(
                        android.R.attr.colorBackground
                    )
                )
            }

        val header =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.VERTICAL

                setPadding(
                    20.dp,
                    18.dp,
                    20.dp,
                    8.dp
                )
            }

        val title =
            TextView(
                this
            ).apply {

                text =
                    "AIRPORT CHARTS"

                textSize =
                    24f

                typeface =
                    Typeface.create(
                        "sans-serif",
                        Typeface.BOLD
                    )

                setTextColor(
                    color(
                        android.R.attr.textColorPrimary
                    )
                )
            }

        val subtitle =
            TextView(
                this
            ).apply {

                text =
                    "Select an airport to view its charts"

                textSize =
                    13f

                setTextColor(
                    color(
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

        header.addView(
            title,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )

        header.addView(
            subtitle,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )

        root.addView(
            header,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )

        val searchContainer =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.HORIZONTAL

                gravity =
                    Gravity.CENTER_VERTICAL

                background =
                    createSearchBackground()

                setPadding(
                    14.dp,
                    0,
                    14.dp,
                    0
                )
            }

        val searchIcon =
            TextView(
                this
            ).apply {

                text =
                    "⌕"

                textSize =
                    24f

                gravity =
                    Gravity.CENTER

                setTextColor(
                    color(
                        android.R.attr.textColorSecondary
                    )
                )
            }

        searchBox =
            EditText(
                this
            ).apply {

                hint =
                    "Search ICAO / Airport / City"

                isSingleLine =
                    true

                textSize =
                    16f

                background =
                    null

                setTextColor(
                    color(
                        android.R.attr.textColorPrimary
                    )
                )

                setHintTextColor(
                    color(
                        android.R.attr.textColorSecondary
                    )
                )

                setPadding(
                    10.dp,
                    0,
                    0,
                    0

                )

                importantForAutofill =
                    View.IMPORTANT_FOR_AUTOFILL_NO
            }

        searchContainer.addView(
            searchIcon,
            LinearLayout.LayoutParams(
                34.dp,
                LinearLayout.LayoutParams.MATCH_PARENT
            )
        )

        searchContainer.addView(
            searchBox,
            LinearLayout.LayoutParams(
                0,
                LinearLayout.LayoutParams.MATCH_PARENT,
                1f
            )
        )

        root.addView(
            searchContainer,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                58.dp
            ).apply {

                setMargins(
                    16.dp,
                    8.dp,
                    16.dp,
                    8.dp
                )
            }
        )

        resultCount =
            TextView(
                this
            ).apply {

                textSize =
                    12f

                setTextColor(
                    color(
                        android.R.attr.textColorSecondary
                    )
                )

                setPadding(
                    20.dp,
                    2.dp,
                    20.dp,
                    8.dp
                )
            }

        root.addView(
            resultCount,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )

        val scrollView =
            ScrollView(
                this
            ).apply {

                isFillViewport =
                    true

                overScrollMode =
                    ScrollView.OVER_SCROLL_IF_CONTENT_SCROLLS
            }

        listContainer =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.VERTICAL

                setPadding(
                    14.dp,
                    4.dp,
                    14.dp,
                    20.dp
                )
            }

        scrollView.addView(
            listContainer,
            ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
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

        ViewCompat.requestApplyInsets(
            root
        )

        searchBox.addTextChangedListener(
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

                    displayAirports(
                        s?.toString().orEmpty()
                    )
                }

                override fun afterTextChanged(
                    s: Editable?
                ) {
                }
            }
        )

        displayAirports()
    }

    private fun displayAirports(
        query: String = ""
    ) {

        listContainer.removeAllViews()

        val normalized =
            query
                .trim()
                .lowercase()

        val results =
            if (
                normalized.isBlank()
            ) {

                allAirports

            } else {

                allAirports.filter {
                    airport ->

                    airport.icao
                        .lowercase()
                        .contains(
                            normalized
                        ) ||

                    airport.airportName
                        .lowercase()
                        .contains(
                            normalized
                        ) ||

                    airport.city
                        .lowercase()
                        .contains(
                            normalized
                        )
                }
            }

        resultCount.text =
            if (
                normalized.isBlank()
            ) {

                "${allAirports.size} airports"

            } else {

                "${results.size} result" +
                    if (
                        results.size == 1
                    ) {
                        ""
                    } else {
                        "s"
                    }
            }

        if (
            results.isEmpty()
        ) {

            showEmptyResult()

            return
        }

        results.forEach {
            airport ->

            addAirportRow(
                airport
            )
        }
    }

    private fun addAirportRow(
        airport: ChartRepository.AirportInfo
    ) {

        val card =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.HORIZONTAL

                gravity =
                    Gravity.CENTER_VERTICAL

                background =
                    createAirportCardBackground()

                isClickable =
                    true

                isFocusable =
                    true

                minimumHeight =
                    92.dp

                setPadding(
                    16.dp,
                    12.dp,
                    14.dp,
                    12.dp
                )

                setOnClickListener {

                    openAirport(
                        airport
                    )
                }
            }

        val icaoBox =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.VERTICAL

                gravity =
                    Gravity.CENTER

                background =
                    createIcaoBackground()
            }

        val icaoText =
            TextView(
                this
            ).apply {

                text =
                    airport.icao

                textSize =
                    16f

                typeface =
                    Typeface.create(
                        "sans-serif",
                        Typeface.BOLD
                    )

                gravity =
                    Gravity.CENTER

                setTextColor(
                    Color.WHITE
                )
            }

        icaoBox.addView(
            icaoText,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )

        card.addView(
            icaoBox,
            LinearLayout.LayoutParams(
                82.dp,
                58.dp
            )
        )

        val info =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.VERTICAL

                gravity =
                    Gravity.CENTER_VERTICAL

                setPadding(
                    14.dp,
                    0,
                    8.dp,
                    0
                )
            }

        val airportName =
            TextView(
                this
            ).apply {

                text =
                    airport.airportName

                textSize =
                    16f

                maxLines =
                    2

                typeface =
                    Typeface.create(
                        "sans-serif",
                        Typeface.BOLD
                    )

                setTextColor(
                    color(
                        android.R.attr.textColorPrimary
                    )
                )
            }

        val city =
            TextView(
                this
            ).apply {

                text =
                    airport.city

                textSize =
                    13f

                setTextColor(
                    color(
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

        info.addView(
            airportName,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )

        info.addView(
            city,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )

        card.addView(
            info,
            LinearLayout.LayoutParams(
                0,
                LinearLayout.LayoutParams.MATCH_PARENT,
                1f
            )
        )

        val arrow =
            TextView(
                this
            ).apply {

                text =
                    "›"

                textSize =
                    28f

                gravity =
                    Gravity.CENTER

                setTextColor(
                    color(
                        android.R.attr.textColorSecondary
                    )
                )
            }

        card.addView(
            arrow,
            LinearLayout.LayoutParams(
                34.dp,
                LinearLayout.LayoutParams.MATCH_PARENT
            )
        )

        listContainer.addView(
            card,
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

    private fun openAirport(
        airport: ChartRepository.AirportInfo
    ) {

        val intent =
            Intent(
                this,
                AirportChartsActivity::class.java
            )

        intent.putExtra(
            "ICAO",
            airport.icao
        )

        intent.putExtra(
            "AIRPORT_NAME",
            airport.airportName
        )

        intent.putExtra(
            "CITY",
            airport.city
        )

        startActivity(
            intent
        )
    }

    private fun showEmptyResult() {

        val container =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.VERTICAL

                gravity =
                    Gravity.CENTER

                setPadding(
                    30.dp,
                    60.dp,
                    30.dp,
                    60.dp
                )
            }

        val icon =
            TextView(
                this
            ).apply {

                text =
                    "⌕"

                textSize =
                    42f

                gravity =
                    Gravity.CENTER

                setTextColor(
                    color(
                        android.R.attr.textColorSecondary
                    )
                )
            }

        val title =
            TextView(
                this
            ).apply {

                text =
                    "No airport found"

                textSize =
                    18f

                gravity =
                    Gravity.CENTER

                typeface =
                    Typeface.DEFAULT_BOLD

                setTextColor(
                    color(
                        android.R.attr.textColorPrimary
                    )
                )

                setPadding(
                    0,
                    12.dp,
                    0,
                    0
                )
            }

        val message =
            TextView(
                this
            ).apply {

                text =
                    "Try an ICAO code, airport name, or city."

                textSize =
                    13f

                gravity =
                    Gravity.CENTER

                setTextColor(
                    color(
                        android.R.attr.textColorSecondary
                    )
                )

                setPadding(
                    0,
                    6.dp,
                    0,
                    0
                )
            }

        container.addView(
            icon
        )

        container.addView(
            title
        )

        container.addView(
            message
        )

        listContainer.addView(
            container,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )
    }

    private fun createSearchBackground():
        GradientDrawable {

        val dark =
            isDarkTheme()

        return GradientDrawable().apply {

            shape =
                GradientDrawable.RECTANGLE

            cornerRadius =
                18.dp.toFloat()

            setColor(
                if (
                    dark
                ) {

                    Color.rgb(
                        27,
                        38,
                        49
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
                        63,
                        79,
                        94
                    )

                } else {

                    Color.rgb(
                        216,
                        224,
                        232
                    )
                }
            )
        }
    }

    private fun createAirportCardBackground():
        GradientDrawable {

        val dark =
            isDarkTheme()

        return GradientDrawable().apply {

            shape =
                GradientDrawable.RECTANGLE

            cornerRadius =
                16.dp.toFloat()

            setColor(
                if (
                    dark
                ) {

                    getColor(R.color.jeppiran_surface)

                } else {

                    Color.WHITE
                }
            )

            setStroke(
                1.dp,
                if (
                    dark
                ) {

                    getColor(R.color.jeppiran_card_stroke)

                } else {

                    getColor(R.color.jeppiran_card_stroke)
                }
            )
        }
    }

    private fun createIcaoBackground():
        GradientDrawable {

        return GradientDrawable().apply {

            shape =
                GradientDrawable.RECTANGLE

            cornerRadius =
                12.dp.toFloat()

            setColor(getColor(R.color.jeppiran_accent))
        }
    }

    private fun color(
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

    private fun isDarkTheme():
        Boolean {

        return (
            resources.configuration.uiMode and
                android.content.res.Configuration
                    .UI_MODE_NIGHT_MASK
        ) ==
            android.content.res.Configuration
                .UI_MODE_NIGHT_YES
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
