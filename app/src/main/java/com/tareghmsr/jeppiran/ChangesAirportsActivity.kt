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

class ChangesAirportsActivity :
    AppCompatActivity() {

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

                gravity =
                    Gravity.CENTER_VERTICAL

                setPadding(
                    12.dp,
                    10.dp,
                    12.dp,
                    8.dp
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
                    "CHART CHANGES"

                textSize =
                    20f

                typeface =
                    Typeface.DEFAULT_BOLD

                setTextColor(
                    Color.WHITE
                )
            }
        )


        root.addView(
            header
        )


        val scroll =
            ScrollView(
                this
            )

        val list =
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


        val airports =
            ChartChangesStore
                .allChangedAirports(
                    this
                )
                .sorted()


        if (
            airports.isEmpty()
        ) {

            list.addView(
                TextView(
                    this
                ).apply {

                    text =
                        "No detailed chart-change metadata is available for the active cycle."

                    textSize =
                        14f

                    setTextColor(
                        Color.rgb(
                            175,
                            195,
                            211
                        )
                    )

                    setPadding(
                        10.dp,
                        18.dp,
                        10.dp,
                        18.dp
                    )
                }
            )

        } else {

            airports.forEach {
                icao ->

                val changes =
                    ChartChangesStore.airport(
                        this,
                        icao
                    )

                val airport =
                    ChartRepository.airport(
                        icao
                    )


                list.addView(
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
                            GradientDrawable()
                                .apply {

                                    cornerRadius =
                                        14.dp.toFloat()

                                    setColor(
                                        Color.argb(
                                            230,
                                            3,
                                            24,
                                            52
                                        )
                                    )

                                    setStroke(
                                        1.dp,
                                        Color.rgb(
                                            47,
                                            217,
                                            255
                                        )
                                    )
                                }

                        isClickable =
                            true

                        isFocusable =
                            true

                        setOnClickListener {

                            startActivity(
                                Intent(
                                    this@ChangesAirportsActivity,
                                    ChartChangesActivity::class.java
                                )
                                    .putExtra(
                                        "ICAO",
                                        icao
                                    )
                            )
                        }

                        addView(
                            TextView(
                                this@ChangesAirportsActivity
                            ).apply {

                                text =
                                    icao +
                                        "  " +
                                        (
                                            airport
                                                ?.airportName
                                                .orEmpty()
                                            )

                                textSize =
                                    15f

                                typeface =
                                    Typeface.DEFAULT_BOLD

                                setTextColor(
                                    Color.WHITE
                                )
                            }
                        )

                        addView(
                            TextView(
                                this@ChangesAirportsActivity
                            ).apply {

                                text =
                                    changes.badgeText()

                                textSize =
                                    12f

                                setTextColor(
                                    Color.rgb(
                                        47,
                                        217,
                                        255
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
                    },
                    LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                    ).apply {

                        bottomMargin =
                            8.dp
                    }
                )
            }
        }


        scroll.addView(
            list
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
