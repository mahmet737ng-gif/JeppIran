package com.tareghmsr.jeppiran

import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
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

                background = getDrawable(R.drawable.bg_flight_deck)
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

        val aircraftTitle =
            TextView(this).apply {

                text =
                    "AIRCRAFT POSITION"

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
            aircraftTitle
        )

        val aircraftOption =
            TextView(this).apply {

                text =
                    if (
                        AircraftPositionStore.isEnabled(
                            this@SettingsActivity
                        )
                    ) {
                        "✓   Aircraft Position"
                    } else {
                        "     Aircraft Position"
                    }

                textSize =
                    17f

                setTextColor(
                    textColor()
                )

                background =
                    roundedSurface()

                gravity =
                    Gravity.CENTER_VERTICAL

                setPadding(
                    24.dp,
                    18.dp,
                    24.dp,
                    18.dp
                )

                setOnClickListener {

                    val enabled =
                        !AircraftPositionStore.isEnabled(
                            this@SettingsActivity
                        )

                    AircraftPositionStore.setEnabled(
                        this@SettingsActivity,
                        enabled
                    )

                    recreate()
                }
            }

        root.addView(
            aircraftOption,
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

                background =
                    roundedSurface()

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

        val pilotTitle =
            TextView(this).apply {
                text = "PILOT DATA & LIMITS"
                textSize = 12f
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(secondaryTextColor())
                setPadding(20.dp, 18.dp, 20.dp, 10.dp)
            }

        root.addView(pilotTitle)

        val pilotOption =
            TextView(this).apply {
                text = "     NOTAM source • Wind limits • Briefing data"
                textSize = 17f
                setTextColor(textColor())
                background = roundedSurface()
                gravity = Gravity.CENTER_VERTICAL
                setPadding(24.dp, 18.dp, 24.dp, 18.dp)
                setOnClickListener {
                    startActivity(
                        android.content.Intent(
                            this@SettingsActivity,
                            PilotToolsSettingsActivity::class.java
                        )
                    )
                }
            }

        root.addView(
            pilotOption,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                60.dp
            ).apply {
                setMargins(16.dp, 4.dp, 16.dp, 4.dp)
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
                    "JEPPIRAN  •  " + AppVersion.name(this@SettingsActivity)

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

        BackNavigation.install(
            this
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

                background =
                    roundedSurface()

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

    private fun roundedSurface() =
        GradientDrawable().apply {

            shape =
                GradientDrawable.RECTANGLE

            cornerRadius =
                16.dp.toFloat()

            setColor(
                getColor(
                    R.color.jeppiran_surface
                )
            )

            setStroke(
                1.dp,
                getColor(
                    R.color.jeppiran_card_stroke
                )
            )
        }


    private fun backgroundColor():
        Int {

        return if (
            isDarkTheme()
        ) {
            getColor(R.color.jeppiran_background)
        } else {
            getColor(R.color.jeppiran_background)
        }
    }

    private fun textColor():
        Int {

        return if (
            isDarkTheme()
        ) {
            getColor(R.color.jeppiran_text)
        } else {
            getColor(R.color.jeppiran_text)
        }
    }

    private fun secondaryTextColor():
        Int {

        return if (
            isDarkTheme()
        ) {
            getColor(R.color.jeppiran_text_secondary)
        } else {
            getColor(R.color.jeppiran_text_secondary)
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
