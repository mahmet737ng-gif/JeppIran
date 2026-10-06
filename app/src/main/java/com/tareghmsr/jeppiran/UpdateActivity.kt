package com.tareghmsr.jeppiran

import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale
import kotlin.concurrent.thread

class UpdateActivity : AppCompatActivity() {

    companion object {
        private const val REMOTE_ROOT =
            "https://raw.githubusercontent.com/mahmet737ng-gif/JeppIran/main/app/src/main/assets/"

        private const val REMOTE_MANIFEST =
            REMOTE_ROOT +
                "charts-manifest.json"

        private const val REMOTE_CHARTS =
            REMOTE_ROOT +
                "charts-current.json"

        private const val REMOTE_GEOREF =
            REMOTE_ROOT +
                "chart-georef.json"

        private const val REMOTE_CHANGES =
            REMOTE_ROOT +
                "chart-changes.json"

        private const val TIMEOUT =
            20000
    }

    private lateinit var status:
        TextView

    private lateinit var changedText:
        TextView

    private lateinit var installButton:
        Button

    private lateinit var checkButton:
        Button

    private var remoteManifestRaw =
        ""

    private var remoteVersion =
        ""

    private var changedAirports =
        emptyList<String>()


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

        checkForUpdate()
    }


    private fun buildUi() {

        val root =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.VERTICAL

                background = getDrawable(R.drawable.bg_flight_deck)
            }


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
                    20.dp,
                    18.dp,
                    20.dp,
                    32.dp
                )
            }


        content.addView(
            TextView(
                this
            ).apply {

                text =
                    "CHART UPDATES"

                textSize =
                    25f

                typeface =
                    Typeface.DEFAULT_BOLD

                setTextColor(
                    primaryTextColor()
                )
            }
        )


        content.addView(
            TextView(
                this
            ).apply {

                text =
                    "New chart data is validated in a staging area before it becomes active."

                textSize =
                    13f

                setTextColor(
                    secondaryTextColor()
                )

                setPadding(
                    0,
                    5.dp,
                    0,
                    18.dp
                )
            }
        )


        status =
            TextView(
                this
            ).apply {

                text =
                    "Checking…"

                textSize =
                    16f

                typeface =
                    Typeface.DEFAULT_BOLD

                setTextColor(
                    primaryTextColor()
                )

                setPadding(
                    16.dp,
                    16.dp,
                    16.dp,
                    16.dp
                )

                background =
                    cardBackground()
            }


        content.addView(
            status
        )


        changedText =
            TextView(
                this
            ).apply {

                textSize =
                    14f

                setTextColor(
                    primaryTextColor()
                )

                setPadding(
                    16.dp,
                    16.dp,
                    16.dp,
                    16.dp
                )

                background =
                    cardBackground()
            }


        content.addView(
            changedText,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {

                topMargin =
                    12.dp
            }
        )


        installButton =
            Button(
                this
            ).apply {

                text =
                    "INSTALL UPDATE"

                isEnabled =
                    false

                setOnClickListener {

                    installUpdate()
                }
            }


        content.addView(
            installButton,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                54.dp
            ).apply {

                topMargin =
                    14.dp
            }
        )


        checkButton =
            Button(
                this
            ).apply {

                text =
                    "CHECK AGAIN"

                setOnClickListener {

                    checkForUpdate()
                }
            }


        content.addView(
            checkButton,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                54.dp
            ).apply {

                topMargin =
                    8.dp
            }
        )


        content.addView(
            TextView(
                this
            ).apply {

                text =
                    "Airport PDF files use release-specific filenames. The previous cycle remains available until the new metadata bundle has been fully validated and activated."

                textSize =
                    12f

                setTextColor(
                    secondaryTextColor()
                )

                setPadding(
                    4.dp,
                    20.dp,
                    4.dp,
                    0
                )
            }
        )


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
        ) { view, insets ->

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


        ViewCompat.requestApplyInsets(
            root
        )
    }


    private fun checkForUpdate() {

        checkButton.isEnabled =
            false

        installButton.isEnabled =
            false

        status.text =
            "Checking chart data…"

        changedText.text =
            ""


        thread(
            name =
                "JeppIran-UpdateCheck"
        ) {

            try {

                val manifestRaw =
                    fetchText(
                        REMOTE_MANIFEST
                    )


                val root =
                    JSONObject(
                        manifestRaw
                    )


                val version =
                    root.optString(
                        "version"
                    )
                        .trim()


                require(
                    version.isNotBlank()
                ) {
                    "Remote version is missing"
                }


                val airports =
                    root.optJSONObject(
                        "airports"
                    )
                        ?: error(
                            "Remote airport manifest is missing"
                        )


                val repository =
                    ChartRepository(
                        this
                    )


                val changed =
                    mutableListOf<String>()


                val keys =
                    airports.keys()


                while (
                    keys.hasNext()
                ) {

                    val icao =
                        keys.next()
                            .trim()
                            .uppercase(
                                Locale.US
                            )


                    val remote =
                        airports.optJSONObject(
                            icao
                        )
                            ?: continue


                    val remoteSha =
                        remote.optString(
                            "sha256"
                        )


                    val localSha =
                        repository
                            .getAirportPdfInfo(
                                icao
                            )
                            .sha256


                    if (
                        remoteSha.isBlank() ||
                        localSha.isBlank() ||
                        remoteSha !=
                            localSha
                    ) {

                        changed.add(
                            icao
                        )
                    }
                }


                remoteManifestRaw =
                    manifestRaw

                remoteVersion =
                    version

                changedAirports =
                    changed.sorted()


                val localVersion =
                    repository.getDataVersion()


                runOnUiThread {

                    checkButton.isEnabled =
                        true


                    if (
                        version ==
                            localVersion &&
                        changed.isEmpty()
                    ) {

                        status.text =
                            "Up to date • " +
                                localVersion

                        changedText.text =
                            "No airport chart changes are available."

                        installButton.isEnabled =
                            false

                    } else {

                        status.text =
                            "Update available • " +
                                localVersion +
                                " → " +
                                version

                        changedText.text =
                            if (
                                changed.isEmpty()
                            ) {

                                "Metadata update available."

                            } else {

                                buildString {

                                    append(
                                        changed.size
                                    )

                                    append(
                                        " airport(s) changed:\n\n"
                                    )

                                    changed.forEach {
                                        icao ->

                                        val name =
                                            ChartRepository
                                                .airport(
                                                    icao
                                                )
                                                ?.airportName
                                                .orEmpty()


                                        append(
                                            "• "
                                        )

                                        append(
                                            icao
                                        )

                                        if (
                                            name.isNotBlank()
                                        ) {

                                            append(
                                                "  "
                                            )

                                            append(
                                                name
                                            )
                                        }

                                        append(
                                            "\n"
                                        )
                                    }
                                }
                            }


                        installButton.isEnabled =
                            true
                    }
                }


            } catch (
                error: Throwable
            ) {

                runOnUiThread {

                    checkButton.isEnabled =
                        true

                    status.text =
                        "Unable to check updates"

                    changedText.text =
                        error.message
                            ?: "Network error"
                }
            }
        }
    }


    private fun installUpdate() {

        if (
            remoteManifestRaw.isBlank() ||
            remoteVersion.isBlank()
        ) {

            checkForUpdate()

            return
        }


        installButton.isEnabled =
            false

        checkButton.isEnabled =
            false

        status.text =
            "Downloading and validating " +
                remoteVersion +
                "…"


        thread(
            name =
                "JeppIran-UpdateInstall"
        ) {

            try {

                val chartsRaw =
                    fetchText(
                        REMOTE_CHARTS
                    )


                val georefRaw =
                    fetchText(
                        REMOTE_GEOREF
                    )


                val changesRaw =
                    runCatching {

                        fetchText(
                            REMOTE_CHANGES
                        )
                    }
                        .getOrDefault(
                            ""
                        )


                ChartUpdateStore
                    .activate(
                        this,
                        remoteVersion,
                        remoteManifestRaw,
                        chartsRaw,
                        georefRaw,
                        changesRaw
                    )


                val repository =
                    ChartRepository(
                        this
                    )

                repository.reload()


                runOnUiThread {

                    status.text =
                        "Installed • " +
                            repository.getDataVersion()

                    changedText.text =
                        if (
                            changedAirports.isEmpty()
                        ) {

                            "Chart metadata updated successfully."

                        } else {

                            "Updated airports are ready. Their new PDF is downloaded only when you open that airport, so old chart files cannot be overwritten mid-update."
                        }

                    checkButton.isEnabled =
                        true

                    installButton.isEnabled =
                        false
                }


            } catch (
                error: Throwable
            ) {

                runOnUiThread {

                    status.text =
                        "Update not installed"

                    changedText.text =
                        (
                            error.message
                                ?: "Validation failed"
                            ) +
                            "\n\nThe previous chart cycle is still active."

                    checkButton.isEnabled =
                        true

                    installButton.isEnabled =
                        true
                }
            }
        }
    }


    private fun fetchText(
        address: String
    ): String {

        var connection:
            HttpURLConnection? =
            null

        try {

            connection =
                URL(
                    address
                )
                    .openConnection()
                    as HttpURLConnection


            connection.connectTimeout =
                TIMEOUT

            connection.readTimeout =
                TIMEOUT

            connection.requestMethod =
                "GET"

            connection.setRequestProperty(
                "User-Agent",
                "JEPPIRAN/" + AppVersion.name(this) + " chart updater"
            )


            val code =
                connection.responseCode


            if (
                code !in
                200..299
            ) {

                error(
                    "HTTP " +
                        code
                )
            }


            return connection
                .inputStream
                .bufferedReader()
                .use {
                    reader ->

                    reader.readText()
                }

        } finally {

            connection?.disconnect()
        }
    }


    private fun cardBackground() =
        GradientDrawable()
            .apply {

                cornerRadius =
                    14.dp.toFloat()

                setColor(
                    if (
                        isDarkTheme()
                    ) {

                        getColor(R.color.jeppiran_surface)

                    } else {

                        Color.WHITE
                    }
                )

                setStroke(
                    1.dp,
                    if (
                        isDarkTheme()
                    ) {

                        getColor(R.color.jeppiran_card_stroke)

                    } else {

                        getColor(R.color.jeppiran_card_stroke)
                    }
                )
            }


    private fun backgroundColor() =
        if (
            isDarkTheme()
        ) {

            getColor(R.color.jeppiran_background)

        } else {

            getColor(R.color.jeppiran_background)
        }


    private fun primaryTextColor() =
        if (
            isDarkTheme()
        ) {

            getColor(R.color.jeppiran_text)

        } else {

            getColor(R.color.jeppiran_text)
        }


    private fun secondaryTextColor() =
        if (
            isDarkTheme()
        ) {

            getColor(R.color.jeppiran_text_secondary)

        } else {

            getColor(R.color.jeppiran_text_secondary)
        }


    private fun isDarkTheme() =
        (
            resources.configuration.uiMode and
                android.content.res.Configuration
                    .UI_MODE_NIGHT_MASK
            ) ==
            android.content.res.Configuration
                .UI_MODE_NIGHT_YES


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
