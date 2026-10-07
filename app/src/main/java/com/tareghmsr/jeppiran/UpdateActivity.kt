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
import androidx.core.content.ContextCompat
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
        private const val REMOTE_ENROUTE_MANIFEST = REMOTE_ROOT + "enroute-manifest.json"
        private const val TIMEOUT = 20000
    }

    private lateinit var dataStatus: TextView
    private lateinit var dataDetails: TextView
    private lateinit var dataUpdateButton: Button

    private lateinit var enrouteStatus: TextView
    private lateinit var enrouteDetails: TextView
    private lateinit var enrouteUpdateButton: Button

    private lateinit var appStatus: TextView
    private lateinit var appUpdateButton: Button

    private lateinit var viewChangesButton: Button
    private lateinit var checkButton: Button

    private var remoteManifestRaw = ""
    private var remoteDataVersion = ""
    private var remoteCycle = ""
    private var remoteEffectiveFrom = ""
    private var remoteEffectiveTo = ""
    private var changedAirports = emptyList<String>()

    private var remoteEnrouteManifestRaw = ""
    private var remoteEnrouteInfo: EnrouteUpdateStore.ManifestInfo? = null

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

        addSectionTitle(content, "TERMINAL CHARTS")

        dataStatus = statusCard("Checking available Terminal Charts…")
        content.addView(dataStatus)

        dataDetails = detailCard("Checking cycle validity…")
        content.addView(
            dataDetails,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { topMargin = 10.dp }
        )

        dataUpdateButton = actionButton("UPDATE TERMINAL CHARTS") {
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

        addSectionTitle(content, "ENROUTE DATA", 24)

        enrouteStatus =
            statusCard(
                "Checking available Enroute Data…"
            )

        content.addView(
            enrouteStatus
        )

        enrouteDetails =
            detailCard(
                "Checking Enroute validity…"
            )

        content.addView(
            enrouteDetails,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                topMargin =
                    10.dp
            }
        )

        enrouteUpdateButton =
            actionButton(
                "UPDATE ENROUTE DATA"
            ) {
                installEnrouteUpdate()
            }.apply {
                isEnabled =
                    false
            }

        content.addView(
            enrouteUpdateButton,
            buttonParams(12)
        )

        addSectionTitle(content, "APPLICATION", 24)

        appStatus = statusCard("Checking application version…")
        content.addView(appStatus)

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
                "Terminal Charts updates airport chart data and georeferencing. " +
                "Enroute Data updates the separate FD / FS/M Enroute package. " +
                "Update App downloads and verifies the signed JEPPIRAN APK."
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
        checkEnrouteUpdate()
        checkAppUpdate()
    }

    private fun checkDataUpdate() {
        dataUpdateButton.isEnabled = false
        dataStatus.text = "Checking available Data Cycle…"
        dataDetails.text = "Checking cycle validity…"

        thread(name = "JeppIran-DataUpdateCheck") {
            try {
                val manifestRaw = fetchText(REMOTE_MANIFEST)
                val root = JSONObject(manifestRaw)
                val version = root.optString("version").trim()

                val cycle =
                    root.optString("cycle")
                        .trim()
                        .ifBlank {
                            Regex("(\\d{4})")
                                .find(
                                    root.optString("source")
                                )
                                ?.groupValues
                                ?.getOrNull(1)
                                .orEmpty()
                        }
                        .ifBlank {
                            version
                                .removePrefix("v")
                                .trim()
                        }

                val effectiveFrom =
                    root.optString("effective_from")
                        .trim()

                val effectiveTo =
                    root.optString("effective_to")
                        .trim()

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
                remoteCycle = cycle
                remoteEffectiveFrom = effectiveFrom
                remoteEffectiveTo = effectiveTo
                changedAirports = changed.sorted()

                val localVersion =
                    repository.getDataVersion()

                runOnUiThread {
                    val cycleLabel =
                        cycle.ifBlank {
                            version
                        }

                    val validity =
                        formatValidity(
                            effectiveFrom,
                            effectiveTo
                        )

                    if (
                        version == localVersion &&
                        changed.isEmpty()
                    ) {
                        dataStatus.text =
                            "Terminal Charts " +
                                cycleLabel +
                                " • Up to date"

                        dataDetails.text =
                            validity.ifBlank {
                                "Validity dates not published"
                            }

                        dataUpdateButton.isEnabled = false
                    } else {
                        dataStatus.text =
                            "Available Terminal Charts • " +
                                cycleLabel

                        dataDetails.text =
                            validity.ifBlank {
                                "Validity dates not published"
                            }

                        dataUpdateButton.isEnabled = true
                    }

                    refreshCheckButton()
                }
            } catch (error: Throwable) {
                runOnUiThread {
                    dataStatus.text = "Unable to check Terminal Charts"
                    dataDetails.text =
                        "Validity unavailable • " +
                            (error.message ?: "Network error")
                    refreshCheckButton()
                }
            }
        }
    }

    private fun checkEnrouteUpdate() {
        enrouteUpdateButton.isEnabled =
            false

        enrouteStatus.text =
            "Checking available Enroute Data…"

        enrouteDetails.text =
            "Checking Enroute validity…"

        thread(
            name =
                "JeppIran-EnrouteUpdateCheck"
        ) {
            try {
                val manifestRaw =
                    fetchText(
                        REMOTE_ENROUTE_MANIFEST
                    )

                val info =
                    EnrouteUpdateStore
                        .parseInfo(
                            manifestRaw
                        )

                remoteEnrouteManifestRaw =
                    manifestRaw

                remoteEnrouteInfo =
                    info

                val activeCycle =
                    EnrouteUpdateStore
                        .activeCycle(
                            this
                        )

                val validity =
                    formatValidity(
                        info.effectiveFrom,
                        info.effectiveTo
                    )

                runOnUiThread {
                    val productSuffix =
                        info.products
                            .takeIf {
                                it.isNotBlank()
                            }
                            ?.let {
                                " • " + it
                            }
                            .orEmpty()

                    when {
                        !info.published ||
                            info.fileCount <=
                                0 -> {

                            enrouteStatus.text =
                                "Enroute Data " +
                                    info.cycle +
                                    productSuffix

                            enrouteDetails.text =
                                validity.ifBlank {
                                    "Validity dates not published"
                                } +
                                    " • Package not published"

                            enrouteUpdateButton.isEnabled =
                                false
                        }

                        activeCycle ==
                            info.cycle -> {

                            enrouteStatus.text =
                                "Enroute Data " +
                                    info.cycle +
                                    productSuffix +
                                    " • Up to date"

                            enrouteDetails.text =
                                validity.ifBlank {
                                    "Validity dates not published"
                                }

                            enrouteUpdateButton.isEnabled =
                                false
                        }

                        else -> {

                            enrouteStatus.text =
                                "Available Enroute Data • " +
                                    info.cycle +
                                    productSuffix

                            enrouteDetails.text =
                                validity.ifBlank {
                                    "Validity dates not published"
                                }

                            enrouteUpdateButton.isEnabled =
                                true
                        }
                    }

                    refreshCheckButton()
                }

            } catch (
                error: Throwable
            ) {
                runOnUiThread {
                    enrouteStatus.text =
                        "Unable to check Enroute Data"

                    enrouteDetails.text =
                        error.message
                            ?: "Network error"

                    enrouteUpdateButton.isEnabled =
                        false

                    refreshCheckButton()
                }
            }
        }
    }


    private fun checkAppUpdate() {
        appUpdateButton.isEnabled = false
        appStatus.text = "Checking JEPPIRAN version…"

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
                            "Available version • " +
                                result.remote.versionName

                        appUpdateButton.isEnabled = true
                    } else {
                        appStatus.text =
                            "JEPPIRAN is up to date • " +
                                result.currentVersionName

                        appUpdateButton.isEnabled = false
                    }

                    refreshCheckButton()
                }
            } catch (error: Throwable) {
                runOnUiThread {
                    appStatus.text =
                        "Unable to check JEPPIRAN version • " +
                            (error.message ?: "Network error")

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
                        "Data Cycle " +
                            remoteCycle.ifBlank {
                                repository.getDataVersion()
                            } +
                            " • Up to date"

                    dataDetails.text =
                        formatValidity(
                            remoteEffectiveFrom,
                            remoteEffectiveTo
                        ).ifBlank {
                            "Validity dates not published"
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

    private fun installEnrouteUpdate() {
        val info =
            remoteEnrouteInfo

        if (
            info == null ||
            remoteEnrouteManifestRaw.isBlank()
        ) {
            checkEnrouteUpdate()
            return
        }

        if (
            !info.published ||
            info.fileCount <=
                0
        ) {
            enrouteStatus.text =
                "Enroute Data " +
                    info.cycle +
                    " • Package not published"

            enrouteUpdateButton.isEnabled =
                false

            return
        }

        enrouteUpdateButton.isEnabled =
            false

        checkButton.isEnabled =
            false

        enrouteStatus.text =
            "Downloading Enroute Data " +
                info.cycle +
                "…"

        thread(
            name =
                "JeppIran-EnrouteUpdateInstall"
        ) {
            try {
                EnrouteUpdateStore
                    .activate(
                        this,
                        remoteEnrouteManifestRaw
                    ) {
                        progress ->

                        runOnUiThread {
                            enrouteStatus.text =
                                "Downloading Enroute Data " +
                                    info.cycle +
                                    " • " +
                                    progress +
                                    "%"
                        }
                    }

                runOnUiThread {
                    val productSuffix =
                        info.products
                            .takeIf {
                                it.isNotBlank()
                            }
                            ?.let {
                                " • " + it
                            }
                            .orEmpty()

                    enrouteStatus.text =
                        "Enroute Data " +
                            info.cycle +
                            productSuffix +
                            " • Up to date"

                    enrouteDetails.text =
                        formatValidity(
                            info.effectiveFrom,
                            info.effectiveTo
                        ).ifBlank {
                            "Validity dates not published"
                        }

                    enrouteUpdateButton.isEnabled =
                        false

                    refreshCheckButton()
                }

            } catch (
                error: Throwable
            ) {
                runOnUiThread {
                    enrouteStatus.text =
                        "Enroute update failed"

                    enrouteDetails.text =
                        error.message
                            ?: "Unable to install Enroute package"

                    enrouteUpdateButton.isEnabled =
                        true

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
            appStatus.text =
                "Installation permission required • Allow JEPPIRAN from this source"

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

                    AppUpdateManager.launchInstaller(
                        this,
                        apk
                    )

                    refreshCheckButton()
                }
            } catch (error: Throwable) {
                runOnUiThread {
                    appStatus.text =
                        "App update failed • " +
                            (error.message ?: "Unable to install update")

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

    private fun detailCard(
        textValue: String
    ): TextView =
        TextView(this).apply {
            text = textValue
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

    private fun formatValidity(
        from: String,
        to: String
    ): String {

        if (
            from.isBlank() ||
            to.isBlank()
        ) {
            return ""
        }

        val input =
            java.text.SimpleDateFormat(
                "yyyy-MM-dd",
                Locale.US
            ).apply {
                isLenient = false
                timeZone =
                    java.util.TimeZone
                        .getTimeZone("UTC")
            }

        val output =
            java.text.SimpleDateFormat(
                "d MMM yyyy",
                Locale.US
            ).apply {
                timeZone =
                    java.util.TimeZone
                        .getTimeZone("UTC")
            }

        return runCatching {
            val start =
                input.parse(from)
                    ?: return@runCatching ""

            val end =
                input.parse(to)
                    ?: return@runCatching ""

            "Valid • " +
                output.format(start) +
                " – " +
                output.format(end)
        }
            .getOrDefault("")
    }


    private fun primaryTextColor(): Int =
        ContextCompat.getColor(
            this,
            R.color.jeppiran_text
        )

    private fun secondaryTextColor(): Int =
        ContextCompat.getColor(
            this,
            R.color.jeppiran_text_secondary
        )

    private fun cardBackground(): GradientDrawable =
        GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = 14.dp.toFloat()

            setColor(
                ContextCompat.getColor(
                    this@UpdateActivity,
                    R.color.jeppiran_surface
                )
            )

            setStroke(
                1.dp,
                ContextCompat.getColor(
                    this@UpdateActivity,
                    R.color.jeppiran_card_stroke
                )
            )
        }

    private val Int.dp: Int
        get() =
            (this * resources.displayMetrics.density)
                .toInt()
}
