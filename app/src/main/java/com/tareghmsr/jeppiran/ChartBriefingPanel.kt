package com.tareghmsr.jeppiran

import android.app.Activity
import android.app.Dialog
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.ColorDrawable
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.View
import android.view.Window
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

class ChartBriefingPanel(
    private val activity: Activity,
    @Suppress("UNUSED_PARAMETER")
    private val root: FrameLayout,
    private val brief: ChartBriefingEngine.Brief,
    private val onClose: () -> Unit
) {

    private val dark =
        (activity.resources.configuration.uiMode and
            Configuration.UI_MODE_NIGHT_MASK) ==
            Configuration.UI_MODE_NIGHT_YES

    private val density =
        activity.resources.displayMetrics.density

    private fun Int.dp(): Int =
        (this * density).toInt()

    private fun panelColor(): Int =
        if (dark) Color.rgb(3, 20, 42) else Color.rgb(245, 249, 252)

    private fun cardColor(): Int =
        if (dark) Color.rgb(7, 36, 63) else Color.WHITE

    private fun primaryText(): Int =
        if (dark) Color.rgb(239, 246, 250) else Color.rgb(19, 34, 49)

    private fun secondaryText(): Int =
        if (dark) Color.rgb(176, 195, 210) else Color.rgb(72, 92, 108)

    private fun accent(): Int =
        Color.rgb(35, 160, 238)

    private fun border(): Int =
        if (dark) Color.rgb(38, 74, 103) else Color.rgb(203, 216, 226)

    private fun background(
        color: Int,
        radius: Int = 12,
        strokeColor: Int = border()
    ): GradientDrawable =
        GradientDrawable().apply {
            setColor(color)
            cornerRadius = radius.dp().toFloat()
            setStroke(1.dp(), strokeColor)
        }

    private fun text(
        value: String,
        size: Float = 13f,
        bold: Boolean = false,
        color: Int = primaryText()
    ): TextView =
        TextView(activity).apply {
            text = value
            textSize = size
            setTextColor(color)
            if (bold) {
                typeface = Typeface.create("sans-serif-medium", Typeface.BOLD)
            }
            setPadding(10.dp(), 7.dp(), 10.dp(), 7.dp())
        }

    fun show() {
        val landscape =
            activity.resources.configuration.orientation ==
                Configuration.ORIENTATION_LANDSCAPE

        val dialog = Dialog(activity).apply {
            requestWindowFeature(Window.FEATURE_NO_TITLE)
            setCancelable(true)
            setCanceledOnTouchOutside(landscape)
        }

        var closed = false
        fun closeOnce() {
            if (!closed) {
                closed = true
                onClose()
            }
        }

        val stage =
            FrameLayout(activity).apply {
                setBackgroundColor(
                    if (landscape) {
                        Color.argb(112, 0, 0, 0)
                    } else {
                        panelColor()
                    }
                )
            }

        val panel =
            LinearLayout(activity).apply {
                orientation = LinearLayout.VERTICAL
                background = background(panelColor(), if (landscape) 18 else 0)
                elevation = 24.dp().toFloat()
            }

        val header =
            LinearLayout(activity).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(10.dp(), 8.dp(), 6.dp(), 8.dp())
            }

        header.addView(
            text("▣", 23f, true, accent()).apply {
                gravity = Gravity.CENTER
            },
            LinearLayout.LayoutParams(42.dp(), 48.dp())
        )

        val titles =
            LinearLayout(activity).apply {
                orientation = LinearLayout.VERTICAL
            }

        titles.addView(
            text(brief.title, 19f, true).apply {
                setPadding(4.dp(), 3.dp(), 6.dp(), 0)
            }
        )

        titles.addView(
            text(brief.subtitle, 11.5f, false, secondaryText()).apply {
                setPadding(4.dp(), 0, 6.dp(), 3.dp())
            }
        )

        header.addView(
            titles,
            LinearLayout.LayoutParams(
                0,
                LinearLayout.LayoutParams.WRAP_CONTENT,
                1f
            )
        )

        header.addView(
            text("×", 30f, false, primaryText()).apply {
                gravity = Gravity.CENTER
                contentDescription = "Close briefing"
                setOnClickListener {
                    dialog.dismiss()
                }
            },
            LinearLayout.LayoutParams(54.dp(), 54.dp())
        )

        panel.addView(header)

        val tabNames =
            if (brief.phase == ChartBriefingEngine.Phase.APPROACH) {
                linkedMapOf(
                    "overview" to "Overview",
                    "descent" to "Descent",
                    "approach" to "Approach",
                    "missed" to "Missed",
                    "airport" to "Airport"
                )
            } else {
                linkedMapOf(
                    "overview" to "Overview",
                    "route" to "Route",
                    "climb" to "Climb",
                    "restrictions" to "Restrictions",
                    "airport" to "Airport"
                )
            }

        var selectedKey = "overview"

        val tabStrip =
            LinearLayout(activity).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(8.dp(), 0, 8.dp(), 6.dp())
            }

        val body =
            LinearLayout(activity).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(9.dp(), 5.dp(), 9.dp(), 14.dp())
            }

        val tabViews =
            linkedMapOf<String, TextView>()

        fun addWeatherCard() {
            val weather = brief.weather

            val card =
                LinearLayout(activity).apply {
                    orientation = LinearLayout.VERTICAL
                    background = background(cardColor(), 10)
                    setPadding(4.dp(), 2.dp(), 4.dp(), 4.dp())
                }

            card.addView(
                text("CURRENT WEATHER", 12f, true, accent())
            )

            if (weather == null) {
                card.addView(
                    text(
                        "No cached METAR yet. Use WX to refresh the current report.",
                        12f,
                        false,
                        secondaryText()
                    )
                )
            } else {
                card.addView(
                    text(
                        weather.raw,
                        11.5f,
                        false,
                        primaryText()
                    )
                )

                val summary =
                    LinearLayout(activity).apply {
                        orientation = LinearLayout.HORIZONTAL
                    }

                summary.addView(
                    text(
                        "Ceiling",
                        11f,
                        true,
                        secondaryText()
                    ),
                    LinearLayout.LayoutParams(
                        90.dp(),
                        LinearLayout.LayoutParams.WRAP_CONTENT
                    )
                )

                summary.addView(
                    text(
                        weather.ceiling,
                        11.5f,
                        false,
                        primaryText()
                    ),
                    LinearLayout.LayoutParams(
                        0,
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                        1f
                    )
                )

                card.addView(summary)

                weather.visibility?.let { visibility ->
                    val visRow =
                        LinearLayout(activity).apply {
                            orientation = LinearLayout.HORIZONTAL
                        }

                    visRow.addView(
                        text(
                            "Visibility",
                            11f,
                            true,
                            secondaryText()
                        ),
                        LinearLayout.LayoutParams(
                            90.dp(),
                            LinearLayout.LayoutParams.WRAP_CONTENT
                        )
                    )

                    visRow.addView(
                        text(
                            visibility,
                            11.5f,
                            false,
                            Color.rgb(255, 184, 77)
                        ),
                        LinearLayout.LayoutParams(
                            0,
                            LinearLayout.LayoutParams.WRAP_CONTENT,
                            1f
                        )
                    )

                    card.addView(visRow)
                }
            }

            body.addView(
                card,
                LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    setMargins(0, 0, 0, 8.dp())
                }
            )
        }

        fun addSection(section: ChartBriefingEngine.Section) {
            val card =
                LinearLayout(activity).apply {
                    orientation = LinearLayout.VERTICAL
                    background = background(cardColor(), 10)
                    setPadding(4.dp(), 1.dp(), 4.dp(), 5.dp())
                }

            card.addView(
                text(
                    section.title,
                    12f,
                    true,
                    if (dark) {
                        Color.rgb(154, 207, 247)
                    } else {
                        Color.rgb(16, 88, 145)
                    }
                )
            )

            section.rows.forEach { row ->
                val line =
                    LinearLayout(activity).apply {
                        orientation = LinearLayout.HORIZONTAL
                        gravity = Gravity.TOP
                    }

                line.addView(
                    text(
                        row.label,
                        11f,
                        true,
                        secondaryText()
                    ),
                    LinearLayout.LayoutParams(
                        if (landscape) 150.dp() else 112.dp(),
                        LinearLayout.LayoutParams.WRAP_CONTENT
                    )
                )

                line.addView(
                    text(
                        row.value,
                        12f,
                        false,
                        if (row.caution) {
                            Color.rgb(255, 184, 77)
                        } else {
                            primaryText()
                        }
                    ),
                    LinearLayout.LayoutParams(
                        0,
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                        1f
                    )
                )

                card.addView(line)
            }

            body.addView(
                card,
                LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    setMargins(0, 0, 0, 8.dp())
                }
            )
        }

        fun updateTabs() {
            tabViews.forEach { entry ->
                val selected =
                    entry.key == selectedKey

                entry.value.apply {
                    setTextColor(
                        if (selected) {
                            Color.WHITE
                        } else {
                            secondaryText()
                        }
                    )

                    typeface =
                        Typeface.create(
                            "sans-serif-medium",
                            if (selected) Typeface.BOLD else Typeface.NORMAL
                        )

                    background =
                        if (selected) {
                            background(
                                if (dark) {
                                    Color.rgb(0, 103, 163)
                                } else {
                                    Color.rgb(20, 132, 205)
                                },
                                8,
                                accent()
                            )
                        } else {
                            background(
                                if (dark) {
                                    Color.rgb(8, 33, 57)
                                } else {
                                    Color.rgb(238, 244, 248)
                                },
                                8
                            )
                        }
                }
            }
        }

        fun renderSelected() {
            body.removeAllViews()

            if (selectedKey == "overview" || selectedKey == "airport") {
                addWeatherCard()
            }

            val selected =
                brief.sections.filter {
                    it.key == selectedKey
                }

            if (selected.isEmpty()) {
                if (selectedKey == "airport") {
                    addSection(
                        ChartBriefingEngine.Section(
                            key = "airport",
                            title = "OPERATIONAL NOTAMS",
                            rows = listOf(
                                ChartBriefingEngine.Row(
                                    "Status",
                                    "No cached operational NOTAM affecting this chart."
                                )
                            )
                        )
                    )
                }
            } else {
                selected.forEach {
                    addSection(it)
                }
            }

            if (selectedKey == "overview" && brief.notams.isNotEmpty()) {
                val alert =
                    LinearLayout(activity).apply {
                        orientation = LinearLayout.HORIZONTAL
                        gravity = Gravity.CENTER_VERTICAL
                        background = background(
                            if (dark) {
                                Color.rgb(51, 39, 18)
                            } else {
                                Color.rgb(255, 247, 224)
                            },
                            10,
                            Color.rgb(202, 143, 45)
                        )
                        setPadding(8.dp(), 4.dp(), 8.dp(), 4.dp())
                    }

                alert.addView(
                    text(
                        "⚠ " + brief.notams.size +
                            " operational NOTAM" +
                            if (brief.notams.size == 1) "" else "s",
                        11.5f,
                        true,
                        Color.rgb(255, 184, 77)
                    ),
                    LinearLayout.LayoutParams(
                        0,
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                        1f
                    )
                )

                alert.addView(
                    text(
                        "VIEW",
                        11f,
                        true,
                        accent()
                    ).apply {
                        gravity = Gravity.CENTER
                        setOnClickListener {
                            selectedKey = "airport"
                            updateTabs()
                            renderSelected()
                        }
                    },
                    LinearLayout.LayoutParams(
                        64.dp(),
                        42.dp()
                    )
                )

                body.addView(alert)
            }
        }

        tabNames.forEach { entry ->
            val tab =
                text(entry.value, 10.5f, false).apply {
                    gravity = Gravity.CENTER
                    setPadding(4.dp(), 0, 4.dp(), 0)
                    setOnClickListener {
                        selectedKey = entry.key
                        updateTabs()
                        renderSelected()
                    }
                }

            tabViews[entry.key] = tab

            tabStrip.addView(
                tab,
                LinearLayout.LayoutParams(
                    0,
                    42.dp(),
                    1f
                ).apply {
                    setMargins(2.dp(), 0, 2.dp(), 0)
                }
            )
        }

        panel.addView(tabStrip)

        val scroll =
            ScrollView(activity).apply {
                isFillViewport = true
                overScrollMode = ScrollView.OVER_SCROLL_IF_CONTENT_SCROLLS
                addView(body)
            }

        panel.addView(
            scroll,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1f
            )
        )

        val footer =
            LinearLayout(activity).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(8.dp(), 4.dp(), 8.dp(), 8.dp())
            }

        val actions =
            LinearLayout(activity).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER
            }

        val weatherButton =
            text("☁  METAR / TAF", 11.5f, true).apply {
                gravity = Gravity.CENTER
                background = background(cardColor(), 9)
                setOnClickListener {
                    selectedKey = "overview"
                    updateTabs()
                    renderSelected()
                }
            }

        val notamButton =
            text("▤  NOTAM / INFO", 11.5f, true).apply {
                gravity = Gravity.CENTER
                background = background(cardColor(), 9)
                setOnClickListener {
                    selectedKey = "airport"
                    updateTabs()
                    renderSelected()
                }
            }

        actions.addView(
            weatherButton,
            LinearLayout.LayoutParams(
                0,
                46.dp(),
                1f
            ).apply {
                setMargins(0, 0, 4.dp(), 0)
            }
        )

        actions.addView(
            notamButton,
            LinearLayout.LayoutParams(
                0,
                46.dp(),
                1f
            ).apply {
                setMargins(4.dp(), 0, 0, 0)
            }
        )

        footer.addView(actions)

        footer.addView(
            text(
                "JEPPIRAN BRIEF UI 2  •  " + AppVersion.name(activity),
                9.5f,
                false,
                secondaryText()
            ).apply {
                gravity = Gravity.CENTER
                setPadding(4.dp(), 6.dp(), 4.dp(), 0)
            }
        )

        panel.addView(footer)

        updateTabs()
        renderSelected()

        val screenWidth =
            activity.resources.displayMetrics.widthPixels

        val panelWidth =
            if (landscape) {
                minOf(
                    760.dp(),
                    maxOf(
                        520.dp(),
                        (screenWidth * 0.56f).toInt()
                    )
                )
            } else {
                FrameLayout.LayoutParams.MATCH_PARENT
            }

        stage.addView(
            panel,
            FrameLayout.LayoutParams(
                panelWidth,
                FrameLayout.LayoutParams.MATCH_PARENT
            ).apply {
                gravity =
                    if (landscape) {
                        Gravity.END
                    } else {
                        Gravity.CENTER
                    }
            }
        )

        if (landscape) {
            stage.setOnClickListener {
                if (it === stage) {
                    dialog.dismiss()
                }
            }
            panel.isClickable = true
        }

        dialog.setContentView(stage)

        dialog.setOnDismissListener {
            closeOnce()
        }

        dialog.setOnCancelListener {
            closeOnce()
        }

        dialog.window?.apply {
            setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
            setLayout(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.MATCH_PARENT
            )
            addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS)
            statusBarColor =
                if (dark) Color.rgb(3, 20, 42) else Color.rgb(245, 249, 252)
            navigationBarColor =
                if (dark) Color.rgb(3, 20, 42) else Color.rgb(245, 249, 252)
        }

        dialog.show()

        dialog.window?.setLayout(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT
        )
    }
}
