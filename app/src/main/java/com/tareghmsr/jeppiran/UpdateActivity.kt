package com.tareghmsr.jeppiran

import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.util.TypedValue
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

        private const val REMOTE_MANIFEST = REMOTE_ROOT + "charts-manifest.json"
        private const val REMOTE_CHARTS = REMOTE_ROOT + "charts-current.json"
        private const val REMOTE_GEOREF = REMOTE_ROOT + "chart-georef.json"
        private const val REMOTE_CHANGES = REMOTE_ROOT + "chart-changes.json"
        private const val TIMEOUT = 20000
    }

    private lateinit var dataStatus: TextView
    private lateinit var dataDetails: TextView
    private lateinit var dataUpdateButton: Button

    private lateinit var appStatus: TextView
    private lateinit var appDetails: TextView
    private lateinit var appUpdateButton: Button

    private lateinit var viewChangesButton: Button
    private lateinit var checkButton: Button

    private var remoteManifestRaw = ""
    private var remoteDataVersion = ""
    private var changedAirports = emptyList<String>()
    private var remoteAppInfo: AppUpdateManager.UpdateInfo? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        ThemeManager.apply(this)
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        buildUi()
        checkAllUpdates()
    }

    override fun onResume() {
        super.onResume()

        if (::appStatus.isInitialized &&
            remoteAppInfo != null &&
            AppUpdateManager.canInstallPackages(this)
        ) {
            appStatus.text = "Ready to install app update"
            appUpdateButton.isEnabled = true
        }
    }

    private fun buildUi() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = getDrawable(R.drawable.bg_flight_deck)
        }

        val scroll = ScrollView(this)
        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(20.dp, 18.dp, 20.dp, 32.dp)
        }

        content.addView(TextView(this).apply {
            text = "UPDATES"
            textSize = 27f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(primaryTextColor())
        })

        content.addView(TextView(this).apply {
            text = "Chart-cycle data and the JEPPIRAN application are updated independently."
            textSize = 13f
            setTextColor(secondaryTextColor())
            setPadding(0, 5.dp, 0, 18.dp)
        })

        addSectionTitle(content, "DATA CYCLE")

        dataStatus = statusCard("Checking chart data…")
        content.addView(dataStatus)

        dataDetails = detailCard()
        content.addView(
            dataDetails,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { topMargin = 10.dp }
        )

        dataUpdateButton = actionButton("UPDATE DATA CYCLE") {
            installDataUpdate()
        }.apply {
            isEnabled = false
        }
        content.addView(dataUpdateButton, buttonParams(12))

        viewChangesButton = actionButton("VIEW ACTIVE CYCLE CHANGES") {
            startActivity(
                android.content.Intent(
                    this@UpdateActivity,
                    ChangesAirportsActivity::class.java
                )
            )
        }.apply {
            isEnabled =
                ChartChangesStore
                    .allChangedAirports(this@UpdateActivity)
                    .isNotEmpty()
        }
        content.addView(viewChangesButton, buttonParams(8))

        addSectionTitle(content, "APPLICATION", 24)

        appStatus = statusCard("Checking application version…")
        content.addView(appStatus)

        appDetails = detailCard()
        content.addView(
            appDetails,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { topMargin = 10.dp }
        )

        appUpdateButton = actionButton("UPDATE APP") {
            installAppUpdate()
        }.apply {
            isEnabled = false
        }
        content.addView(appUpdateButton, buttonParams(12))

        checkButton = actionButton("CHECK ALL UPDATES") {
            checkAllUpdates()
        }
        content.addView(checkButton, buttonParams(22))

        content.addView(TextView(this).apply {
            text =
                "Data Cycle updates chart metadata, georeferencing and cycle-change data without reinstalling the app. " +
                "Update App downloads a signed JEPPIRAN APK, verifies its SHA-256 checksum, then opens the Android installer."
            textSize = 12f
            setTextColor(secondaryTextColor())
            setPadding(4.dp, 18.dp, 4.dp, 0)
        })

        scroll.addView(content)
        root.addView(
            scroll,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1f
            )
        )

        setContentView(root)

        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val bars =
                insets.getInsets(WindowInsetsCompat.Type.systemBars())

            view.setPadding(
                bars.left,
                bars.top,
                bars.right,
                bars.bottom
            )
            insets
        }

        ViewCompat.requestApplyInsets(root)
    }

    private fun checkAllUpdates() {
        checkButton.isEnabled = false
        checkDataUpdate()
        checkAppUpdate()
    }

    private fun checkDataUpdate() {
        dataUpdateButton.isEnabled = false
        dataStatus.text = "Checking chart data…"
        dataDetails.text = ""

        thread(name = "JeppIran-DataUpdateCheck") {
            try {
                val manifestRaw = fetchText(REMOTE_MANIFEST)
                val root = JSONObject(manifestRaw)
                val version = root.optString("version").trim()

                require(version.isNotBlank()) {
                    "Remote data version is missing"
                }

                val airports =
                    root.optJSONObject("airports")
                        ?: error("Remote airport manifest is missing")

                val repository = ChartRepository(this)
                val changed = mutableListOf<String>()
                val keys = airports.keys()

                while (keys.hasNext()) {
                    val icao =
                        keys.next()
                            .trim()
                            .uppercase(Locale.US)

                    val remote =
                        airports.optJSONObject(icao)
                            ?: continue

                    val remoteSha =
                        remote.optString("sha256")

                    val localSha =
                        repository
                            .getAirportPdfInfo(icao)
                            .sha256

                    if (
                        remoteSha.isBlank() ||
                        localSha.isBlank() ||
                        remoteSha != localSha
                    ) {
                        changed.add(icao)
                    }
                }

                remoteManifestRaw = manifestRaw
                remoteDataVersion = version
                changedAirports = changed.sorted()

                val localVersion =
                    repository.getDataVersion()

                runOnUiThread {
                    if (
                        version == localVersion &&
                        changed.isEmpty()
                    ) {
                        dataStatus.text =
                            "Up to date • " + localVersion

                        dataDetails.text =
                            "No chart-cycle update is available."

                        dataUpdateButton.isEnabled = false
                    } else {
                        dataStatus.text =
                            "Data update available • " +
                                localVersion +
                                " → " +
                                version

                        dataDetails.text =
                            if (changed.isEmpty()) {
                                "New chart metadata is available."
                            } else {
                                buildString {
                                    append(changed.size)
                                    append(" airport(s) changed:\n\n")

                                    changed.sorted().forEach { icao ->
                                        append("• ")
                                        append(icao)

                                        val name =
                                            ChartRepository
                                                .airport(icao)
                                                ?.airportName
                                                .orEmpty()

                                        if (name.isNotBlank()) {
                                            append("  ")
                                            append(name)
                                        }

                                        append("\n")
                                    }
                                }
                            }

                        dataUpdateButton.isEnabled = true
                    }

                    refreshCheckButton()
                }
            } catch (error: Throwable) {
                runOnUiThread {
                    dataStatus.text = "Unable to check data cycle"
                    dataDetails.text =
                        error.message ?: "Network error"
                    refreshCheckButton()
                }
            }
        }
    }

    private fun checkAppUpdate() {
        appUpdateButton.isEnabled = false
        appStatus.text = "Checking application version…"
        appDetails.text = ""

        thread(name = "JeppIran-AppUpdateCheck") {
            try {
                val result =
                    AppUpdateManager.check(this)

                remoteAppInfo = result.remote

                runOnUiThread {
                    if (
                        result.updateAvailable &&
                        result.remote != null
                    ) {
                        appStatus.text =
                            "App update available • " +
                                result.currentVersionName +
                                " → " +
                                result.remote.versionName

                        appDetails.text =
                            "A newer signed JEPPIRAN build is ready. " +
                                "Tap Update App to download, verify and install it."

                        appUpdateButton.isEnabled = true
                    } else {
                        appStatus.text =
                            "App up to date • " +
                                result.currentVersionName

                        appDetails.text =
                            "You already have the newest JEPPIRAN build."

                        appUpdateButton.isEnabled = false
                    }

                    refreshCheckButton()
                }
            } catch (error: Throwable) {
                runOnUiThread {
                    appStatus.text = "Unable to check app version"
                    appDetails.text =
                        (error.message ?: "Network error") +
                            "\n\nIf this is the first updater-enabled build, install it once manually; future builds will update from here."

                    refreshCheckButton()
                }
            }
        }
    }

    private fun installDataUpdate() {
        if (
            remoteManifestRaw.isBlank() ||
            remoteDataVersion.isBlank()
        ) {
            checkDataUpdate()
            return
        }

        dataUpdateButton.isEnabled = false
        checkButton.isEnabled = false
        dataStatus.text =
            "Downloading and validating " +
                remoteDataVersion +
                "…"

        thread(name = "JeppIran-DataUpdateInstall") {
            try {
                val chartsRaw = fetchText(REMOTE_CHARTS)
                val georefRaw = fetchText(REMOTE_GEOREF)
                val changesRaw =
                    runCatching {
                        fetchText(REMOTE_CHANGES)
                    }.getOrDefault("")

                ChartUpdateStore.activate(
                    this,
                    remoteDataVersion,
                    remoteManifestRaw,
                    chartsRaw,
                    georefRaw,
                    changesRaw
                )

                val repository =
                    ChartRepository(this)

                repository.reload()

                runOnUiThread {
                    dataStatus.text =
                        "Installed • " +
                            repository.getDataVersion()

                    dataDetails.text =
                        if (changedAirports.isEmpty()) {
                            "Chart metadata updated successfully."
                        } else {
                            "The new cycle is active. Updated airport PDFs are downloaded when needed."
                        }

                    dataUpdateButton.isEnabled = false
                    viewChangesButton.isEnabled =
                        ChartChangesStore
                            .allChangedAirports(this)
                            .isNotEmpty()

                    refreshCheckButton()
                }
            } catch (error: Throwable) {
                runOnUiThread {
                    dataStatus.text =
                        "Data update not installed"

                    dataDetails.text =
                        (error.message ?: "Validation failed") +
                            "\n\nThe previous chart cycle is still active."

                    dataUpdateButton.isEnabled = true
                    refreshCheckButton()
                }
            }
        }
    }

    private fun installAppUpdate() {
        val info = remoteAppInfo

        if (info == null) {
            checkAppUpdate()
            return
        }

        if (!AppUpdateManager.canInstallPackages(this)) {
            appStatus.text = "Installation permission required"
            appDetails.text =
                "Enable “Allow from this source” for JEPPIRAN, return here, then tap Update App again."

            AppUpdateManager.openInstallPermission(this)
            return
        }

        appUpdateButton.isEnabled = false
        checkButton.isEnabled = false
        appStatus.text =
            "Downloading " +
                info.versionName +
                "…"

        thread(name = "JeppIran-AppUpdateInstall") {
            try {
                val apk =
                    AppUpdateManager.downloadAndVerify(
                        this,
                        info
                    ) { progress ->
                        runOnUiThread {
                            appStatus.text =
                                "Downloading " +
                                    info.versionName +
                                    " • " +
                                    progress +
                                    "%"
                        }
                    }

                runOnUiThread {
                    appStatus.text =
                        "Verified • opening Android installer"

                    appDetails.text =
                        "SHA-256 verified. Android will now ask you to install the update."

                    AppUpdateManager.launchInstaller(
                        this,
                        apk
                    )

                    refreshCheckButton()
                }
            } catch (error: Throwable) {
                runOnUiThread {
                    appStatus.text =
                        "App update failed"

                    appDetails.text =
                        error.message ?: "Unable to install update"

                    appUpdateButton.isEnabled = true
                    refreshCheckButton()
                }
            }
        }
    }

    private fun refreshCheckButton() {
        checkButton.isEnabled = true
    }

    private fun fetchText(address: String): String {
        var connection: HttpURLConnection? = null

        try {
            connection =
                URL(address)
                    .openConnection()
                    as HttpURLConnection

            connection.instanceFollowRedirects = true
            connection.connectTimeout = TIMEOUT
            connection.readTimeout = TIMEOUT
            connection.requestMethod = "GET"
            connection.setRequestProperty(
                "User-Agent",
                "JEPPIRAN data-updater"
            )

            val code = connection.responseCode

            require(code in 200..299) {
                "HTTP " + code
            }

            return connection
                .inputStream
                .bufferedReader()
                .use { it.readText() }
        } finally {
            connection?.disconnect()
        }
    }

    private fun addSectionTitle(
        parent: LinearLayout,
        title: String,
        topMarginDp: Int = 0
    ) {
        parent.addView(
            TextView(this).apply {
                text = title
                textSize = 15f
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(primaryTextColor())
                setPadding(
                    4.dp,
                    topMarginDp.dp,
                    4.dp,
                    8.dp
                )
            }
        )
    }

    private fun statusCard(textValue: String): TextView =
        TextView(this).apply {
            text = textValue
            textSize = 16f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(primaryTextColor())
            setPadding(16.dp, 16.dp, 16.dp, 16.dp)
            background = cardBackground()
        }

    private fun detailCard(): TextView =
        TextView(this).apply {
            textSize = 14f
            setTextColor(primaryTextColor())
            setPadding(16.dp, 16.dp, 16.dp, 16.dp)
            background = cardBackground()
        }

    private fun actionButton(
        label: String,
        action: () -> Unit
    ): Button =
        Button(this).apply {
            text = label
            gravity = Gravity.CENTER
            setOnClickListener { action() }
        }

    private fun buttonParams(topMarginDp: Int):
        LinearLayout.LayoutParams =
        LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            54.dp
        ).apply {
            topMargin = topMarginDp.dp
        }

    private fun primaryTextColor(): Int =
        resolveColor(
            android.R.attr.textColorPrimary,
            Color.WHITE
        )

    private fun secondaryTextColor(): Int =
        resolveColor(
            android.R.attr.textColorSecondary,
            Color.LTGRAY
        )

    private fun resolveColor(
        attr: Int,
        fallback: Int
    ): Int {
        val value = TypedValue()

        return if (
            theme.resolveAttribute(
                attr,
                value,
                true
            )
        ) {
            value.data
        } else {
            fallback
        }
    }

    private fun cardBackground(): GradientDrawable =
        GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = 14.dp.toFloat()

            val base =
                resolveColor(
                    android.R.attr.colorBackground,
                    Color.DKGRAY
                )

            setColor(
                Color.argb(
                    220,
                    Color.red(base),
                    Color.green(base),
                    Color.blue(base)
                )
            )

            setStroke(
                1.dp,
                Color.argb(
                    55,
                    255,
                    255,
                    255
                )
            )
        }

    private val Int.dp: Int
        get() =
            (this * resources.displayMetrics.density)
                .toInt()
}
