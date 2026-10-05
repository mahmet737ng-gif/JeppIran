package com.tareghmsr.jeppiran

import android.graphics.Color
import android.graphics.Typeface
import android.os.Bundle
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.activity.enableEdgeToEdge

class SettingsActivity :
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

        buildUi()
    }

    private fun buildUi() {

        val root =
            LinearLayout(this).apply {

                orientation =
                    LinearLayout.VERTICAL

                setBackgroundColor(
                    backgroundColor()
                )
            }

        val header =
            TextView(this).apply {

                text =
                    "SETTINGS"

                textSize =
                    24f

                typeface =
                    Typeface.DEFAULT_BOLD

                setTextColor(
                    textColor()
                )

                setPadding(
                    20.dp,
                    22.dp,
                    20.dp,
                    22.dp
                )
            }

        root.addView(
            header
        )

        val themeTitle =
            TextView(this).apply {

                text =
                    "APPEARANCE"

                textSize =
                    12f

                typeface =
                    Typeface.DEFAULT_BOLD

                setTextColor(
                    secondaryTextColor()
                )

                setPadding(
                    20.dp,
                    14.dp,
                    20.dp,
                    10.dp
                )
            }

        root.addView(
            themeTitle
        )

        addThemeOption(
            root,
            "System default",
            ThemeManager.SYSTEM
        )

        addThemeOption(
            root,
            "Light",
            ThemeManager.LIGHT
        )

        addThemeOption(
            root,
            "Dark",
            ThemeManager.DARK
        )

        val simulatorTitle =
            TextView(this).apply {

                text =
                    "FLIGHT SIMULATOR"

                textSize =
                    12f

                typeface =
                    Typeface.DEFAULT_BOLD

                setTextColor(
                    secondaryTextColor()
                )

                setPadding(
                    20.dp,
                    18.dp,
                    20.dp,
                    10.dp
                )
            }

        root.addView(
            simulatorTitle
        )

        val simulatorOption =
            TextView(this).apply {

                text =
                    "     Connect to Simulator"

                textSize =
                    17f

                setTextColor(
                    textColor()
                )

                gravity =
                    Gravity.CENTER_VERTICAL

                setPadding(
                    24.dp,
                    18.dp,
                    24.dp,
                    18.dp
                )

                setOnClickListener {

                    startActivity(
                        android.content.Intent(
                            this@SettingsActivity,
                            SimulatorActivity::class.java
                        )
                    )
                }
            }

        root.addView(
            simulatorOption,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                60.dp
            ).apply {

                setMargins(
                    16.dp,
                    4.dp,
                    16.dp,
                    4.dp
                )
            }
        )

        val spacer =
            LinearLayout(this)

        root.addView(
            spacer,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1f
            )
        )

        val footer =
            TextView(this).apply {

                text =
                    "JeppIran  •  Application Settings"

                textSize =
                    11f

                gravity =
                    Gravity.CENTER

                setTextColor(
                    secondaryTextColor()
                )

                setPadding(
                    20.dp,
                    20.dp,
                    20.dp,
                    28.dp
                )
            }

        root.addView(
            footer
        )

        setContentView(
            root
        )
    }

    private fun addThemeOption(
        root: LinearLayout,
        title: String,
        mode: String
    ) {

        val option =
            TextView(this).apply {

                text =
                    if (
                        ThemeManager.getTheme(
                            this@SettingsActivity
                        ) == mode
                    ) {
                        "✓   $title"
                    } else {
                        "     $title"
                    }

                textSize =
                    17f

                setTypeface(
                    null,
                    Typeface.NORMAL
                )

                setTextColor(
                    textColor()
                )

                gravity =
                    Gravity.CENTER_VERTICAL

                setPadding(
                    24.dp,
                    18.dp,
                    24.dp,
                    18.dp
                )

                setOnClickListener {

                    ThemeManager.setTheme(
                        this@SettingsActivity,
                        mode
                    )

                    recreate()
                }
            }

        root.addView(
            option,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                60.dp
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

    private fun backgroundColor():
        Int {

        return if (
            isDarkTheme()
        ) {
            Color.rgb(
                14,
                22,
                30
            )
        } else {
            Color.rgb(
                244,
                247,
                250
            )
        }
    }

    private fun textColor():
        Int {

        return if (
            isDarkTheme()
        ) {
            Color.rgb(
                241,
                245,
                248
            )
        } else {
            Color.rgb(
                18,
                32,
                48
            )
        }
    }

    private fun secondaryTextColor():
        Int {

        return if (
            isDarkTheme()
        ) {
            Color.rgb(
                158,
                174,
                187
            )
        } else {
            Color.rgb(
                91,
                107,
                122
            )
        }
    }

    private fun isDarkTheme():
        Boolean {

        return (
            resources.configuration.uiMode
                and
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
                    resources.displayMetrics.density
                ).toInt()
}
