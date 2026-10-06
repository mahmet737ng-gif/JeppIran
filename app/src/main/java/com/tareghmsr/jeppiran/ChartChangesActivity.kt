package com.tareghmsr.jeppiran

import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class ChartChangesActivity :
    AppCompatActivity() {

    private var icao =
        ""

    private lateinit var repository:
        ChartRepository


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

        icao =
            intent
                .getStringExtra(
                    "ICAO"
                )
                .orEmpty()
                .trim()
                .uppercase()

        repository =
            ChartRepository(
                this
            )

        buildUi()
    }


    private fun buildUi() {

        val changes =
            ChartChangesStore.airport(
                this,
                icao
            )

        val root =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.VERTICAL

                background =
                    getDrawable(
                        R.drawable.bg_flight_deck
                    )
            }

        val header =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.HORIZONTAL

                gravity =
                    Gravity.CENTER_VERTICAL

                setPadding(
                    14.dp,
                    12.dp,
                    14.dp,
                    10.dp
                )
            }

        header.addView(
            TextView(
                this
            ).apply {

                text =
                    "‹"

                textSize =
                    34f

                gravity =
                    Gravity.CENTER

                setTextColor(
                    Color.WHITE
                )

                setOnClickListener {
                    finish()
                }
            },
            LinearLayout.LayoutParams(
                48.dp,
                48.dp
            )
        )

        header.addView(
            TextView(
                this
            ).apply {

                text =
                    "CHANGES • " +
                        icao

                textSize =
                    20f

                typeface =
                    Typeface.DEFAULT_BOLD

                setTextColor(
                    Color.WHITE
                )
            },
            LinearLayout.LayoutParams(
                0,
                LinearLayout.LayoutParams.WRAP_CONTENT,
                1f
            )
        )

        root.addView(
            header
        )


        val scroll =
            ScrollView(
                this
            )

        val content =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.VERTICAL

                setPadding(
                    16.dp,
                    8.dp,
                    16.dp,
                    28.dp
                )
            }


        content.addView(
            TextView(
                this
            ).apply {

                text =
                    if (
                        changes.hasAny()
                    ) {

                        changes.badgeText()

                    } else {

                        "No recorded changes for this cycle"
                    }

                textSize =
                    15f

                typeface =
                    Typeface.DEFAULT_BOLD

                setTextColor(
                    Color.rgb(
                        47,
                        217,
                        255
                    )
                )

                setPadding(
                    14.dp,
                    14.dp,
                    14.dp,
                    14.dp
                )

                background =
                    cardBackground(
                        true
                    )
            }
        )


        if (
            changes.changes.isNotEmpty()
        ) {

            sectionTitle(
                content,
                "CYCLE CHANGES"
            )

            changes.changes.forEach {
                change ->

                val row =
                    LinearLayout(
                        this
                    ).apply {

                        orientation =
                            LinearLayout.VERTICAL

                        setPadding(
                            14.dp,
                            12.dp,
                            14.dp,
                            12.dp
                        )

                        background =
                            cardBackground(
                                change.action ==
                                    "REV"
                            )

                        isClickable =
                            true

                        isFocusable =
                            true

                        setOnClickListener {

                            openChange(
                                change
                            )
                        }
                    }


                row.addView(
                    TextView(
                        this
                    ).apply {

                        text =
                            change.action +
                                "  •  " +
                                change.procedure

                        textSize =
                            15f

                        typeface =
                            Typeface.DEFAULT_BOLD

                        setTextColor(
                            Color.WHITE
                        )
                    }
                )


                val meta =
                    listOf(
                        change.index,
                        change.revisionDate,
                        change.effectiveDate
                    )
                        .filter {
                            it.isNotBlank()
                        }
                        .joinToString(
                            "  •  "
                        )


                if (
                    meta.isNotBlank()
                ) {

                    row.addView(
                        TextView(
                            this
                        ).apply {

                            text =
                                meta

                            textSize =
                                12f

                            setTextColor(
                                Color.rgb(
                                    175,
                                    195,
                                    211
                                )
                            )

                            setPadding(
                                0,
                                5.dp,
                                0,
                                0
                            )
                        }
                    )
                }


                if (
                    change.action ==
                    "REV"
                ) {

                    row.addView(
                        TextView(
                            this
                        ).apply {

                            text =
                                "Tap to compare Previous / Current / Changes Overlay"

                            textSize =
                                11f

                            setTextColor(
                                Color.rgb(
                                    47,
                                    217,
                                    255
                                )
                            )

                            setPadding(
                                0,
                                7.dp,
                                0,
                                0
                            )
                        }
                    )
                }


                content.addView(
                    row,
                    LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                    ).apply {

                        topMargin =
                            8.dp
                    }
                )
            }
        }


        if (
            changes.notices.isNotEmpty()
        ) {

            sectionTitle(
                content,
                "OFFICIAL TERMINAL CHANGE NOTICES"
            )

            changes.notices.forEach {
                notice ->

                val text =
                    buildString {

                        if (
                            notice.type.isNotBlank()
                        ) {

                            append(
                                "Type: "
                            )

                            append(
                                notice.type
                            )

                            append(
                                "\n"
                            )
                        }

                        if (
                            notice.effectivity.isNotBlank()
                        ) {

                            append(
                                "Effectivity: "
                            )

                            append(
                                notice.effectivity
                            )

                            append(
                                "\n"
                            )
                        }

                        if (
                            notice.beginDate.isNotBlank()
                        ) {

                            append(
                                "Begin: "
                            )

                            append(
                                notice.beginDate
                            )

                            append(
                                "\n"
                            )
                        }

                        if (
                            notice.endDate.isNotBlank()
                        ) {

                            append(
                                "End: "
                            )

                            append(
                                notice.endDate
                            )

                            append(
                                "\n"
                            )
                        }

                        if (
                            notice.text.isNotBlank()
                        ) {

                            if (
                                isNotEmpty()
                            ) {

                                append(
                                    "\n"
                                )
                            }

                            append(
                                notice.text
                            )
                        }
                    }


                content.addView(
                    TextView(
                        this
                    ).apply {

                        this.text =
                            text

                        textSize =
                            13f

                        setTextColor(
                            Color.WHITE
                        )

                        setPadding(
                            14.dp,
                            12.dp,
                            14.dp,
                            12.dp
                        )

                        background =
                            cardBackground(
                                false
                            )
                    },
                    LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                    ).apply {

                        topMargin =
                            8.dp
                    }
                )
            }
        }


        scroll.addView(
            content
        )

        root.addView(
            scroll,
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
        ) {
            view,
            insets ->

            val bars =
                insets.getInsets(
                    WindowInsetsCompat.Type.systemBars()
                )

            view.setPadding(
                bars.left,
                bars.top,
                bars.right,
                bars.bottom
            )

            insets
        }
    }


    private fun openChange(
        change: ChartCycleChange
    ) {

        if (
            change.action ==
            "DEL"
        ) {

            return
        }


        if (
            change.action ==
            "REV"
        ) {

            startActivity(
                Intent(
                    this,
                    ChartDiffActivity::class.java
                )
                    .putExtra(
                        "ICAO",
                        icao
                    )
                    .putExtra(
                        "CHART_NUMBER",
                        change.index
                    )
                    .putExtra(
                        "PROCEDURE",
                        change.procedure
                    )
            )

            return
        }


        val chart =
            repository
                .getChartsForAirport(
                    icao
                )
                .firstOrNull {
                    it.chartNumber.equals(
                        change.index,
                        ignoreCase =
                            true
                    )
                }
                ?: repository
                    .getChartsForAirport(
                        icao
                    )
                    .firstOrNull {
                        it.name.contains(
                            change.procedure,
                            ignoreCase =
                                true
                        )
                    }
                ?: return


        startActivity(
            Intent(
                this,
                PdfViewerActivity::class.java
            )
                .putExtra(
                    "ICAO",
                    chart.icao
                )
                .putExtra(
                    "AIRPORT_NAME",
                    chart.airportName
                )
                .putExtra(
                    "CITY",
                    chart.city
                )
                .putExtra(
                    "CATEGORY",
                    chart.category
                )
                .putExtra(
                    "TITLE",
                    chart.name
                )
                .putExtra(
                    "PAGE",
                    chart.page
                )
        )
    }


    private fun sectionTitle(
        container: LinearLayout,
        title: String
    ) {

        container.addView(
            TextView(
                this
            ).apply {

                text =
                    title

                textSize =
                    12f

                typeface =
                    Typeface.DEFAULT_BOLD

                setTextColor(
                    Color.rgb(
                        175,
                        195,
                        211
                    )
                )

                setPadding(
                    4.dp,
                    22.dp,
                    4.dp,
                    4.dp
                )
            }
        )
    }


    private fun cardBackground(
        active: Boolean
    ):
        GradientDrawable =
        GradientDrawable()
            .apply {

                cornerRadius =
                    14.dp.toFloat()

                setColor(
                    Color.argb(
                        225,
                        3,
                        24,
                        52
                    )
                )

                setStroke(
                    1.dp,
                    if (
                        active
                    ) {

                        Color.rgb(
                            47,
                            217,
                            255
                        )

                    } else {

                        Color.rgb(
                            23,
                            108,
                            181
                        )
                    }
                )
            }


    private val Int.dp:
        Int
        get() =
            (
                this *
                    resources
                        .displayMetrics
                        .density
                )
                .toInt()
}
