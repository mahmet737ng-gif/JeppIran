package com.tareghmsr.jeppiran

import android.Manifest
import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.ValueAnimator
import android.app.AlertDialog
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.pm.ActivityInfo
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PointF
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.pdf.PdfRenderer
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.ParcelFileDescriptor
import android.os.SystemClock
import android.text.InputType
import android.view.Gravity
import android.view.MotionEvent
import android.view.ViewGroup
import android.view.View
import android.view.ViewConfiguration
import android.view.WindowManager
import android.view.animation.DecelerateInterpolator
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale
import kotlin.concurrent.thread
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt


class PdfViewerActivity :
    AppCompatActivity() {


private val locationPermissionLauncher =
    registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { result ->

        val granted =
            result.values.any {
                it
            }

        if (!positionResumed || !AircraftPositionStore.isEnabled(this)) {
            return@registerForActivityResult
        }

        if (granted) {

            startGps()

        } else {

            updateGpsText(
                "GPS • PERMISSION DENIED"
            )
        }
    }



    companion object {

        private const val ANNOTATION_PREFS =
            "jeppiran_annotations"

        private const val GPS_PERMISSION_REQUEST =
            7001

        private const val METAR_TIMEOUT =
            15000

        private const val METAR_POLL_INTERVAL =
            5 * 60 * 1000L

        private const val METAR_DISPLAY_DURATION =
            30000L

        private const val TOP_CROP_PERCENT =
            0.014f

        private const val ACTIVE_RENDER_QUALITY =
            3.0f

        private const val NEIGHBOR_RENDER_QUALITY = 3.0f

        private const val MAX_ZOOM =
            3.5f

        private const val SWIPE_THRESHOLD =
            0.22f

        private const val DOUBLE_TAP_TIMEOUT_MS =
            280L

        private const val DOUBLE_TAP_ZOOM =
            2.0f

        private const val VIEWER_TRANSITION_MS =
            220L
    }


    private data class RenderedPageGeometry(
        val pdfWidth: Int, val pdfHeight: Int,
        val fullWidth: Int, val fullHeight: Int, val cropTop: Int = 0
    )
    private val renderGeometries = java.util.Collections.synchronizedMap(
        java.util.WeakHashMap<Bitmap, RenderedPageGeometry>()
    )

    private var positionResumed = false
    private var gpsGeneration = 0
    private var locationPermissionRequested = false

    private var renderer:
        PdfRenderer? =
        null

    private var descriptor:
        ParcelFileDescriptor? =
        null


    private lateinit var repository:
        ChartRepository


    private lateinit var root:
        FrameLayout

    private lateinit var chartView:
        ChartView

    private lateinit var topToolbar:
        LinearLayout

    private lateinit var toolScroll:
        HorizontalScrollView

    private lateinit var eraserModeBar:
        LinearLayout

    private lateinit var annotationContextBar:
        LinearLayout

    private lateinit var chartTreePanel:
        LinearLayout

    private lateinit var chartTreeScroll:
        ScrollView

    private lateinit var chartTreeContent:
        LinearLayout

    private val expandedChartCategories =
        mutableSetOf<String>()

    private var penWidth =
        5f

    private var highlightWidth =
        22f

    private var textDefaultSize =
        20f

    private var insetLeft =
        0

    private var insetTop =
        0

    private var insetRight =
        0

    private var insetBottom =
        0

    private lateinit var titleText:
        TextView

    private lateinit var pageText:
        TextView

    private lateinit var metarBanner:
        TextView

    private lateinit var metarIcon:
        TextView

    private lateinit var gpsText:
        TextView

    private lateinit var loadingText:
        TextView

    private lateinit var progressBar:
        ProgressBar


    private val airportCharts =
        mutableListOf<
            ChartRepository.ChartInfo
        >()


    private var currentChartIndex =
        0


    private var currentIcao =
        ""


    private var airportName =
        ""

    private var city =
        ""

    private var category =
        ""

    private var chartTitle =
        ""


    private var totalPdfPages =
        0


    private var currentPdfFile:
        File? =
        null


    private var previousBitmap:
        Bitmap? =
        null

    private var nextBitmap:
        Bitmap? =
        null


    private var invertChart =
        false

    private var controlsVisible =
        true

    private var chartTreeOpen =
        false

    private var viewerChromeTransitioning =
        false

    private var lastVisibleChartInsets =
        intArrayOf(
            0,
            0,
            0,
            0
        )


    private var annotationMode =
        false


    private var annotationTool: Tool? = null


    private var eraserMode = EraserMode.OBJECT

    private var penColor = Color.rgb(255, 60, 130)
    private var highlightColor = Color.argb(105, 255, 220, 0)
    private var textColor = Color.rgb(255, 60, 130)
    private var lastMetarValue = ""


    private var lastMetarIcao =
        ""


    private var metarRequestId =
        0


    private var metarRemoveRunnable:
        Runnable? =
        null

    private var metarPollRunnable:
        Runnable? =
        null

    private lateinit var aircraftPositionButton:
        TextView

    private lateinit var chartTreeButton:
        TextView


    private var locationManager:
        LocationManager? =
        null


    private var locationListener:
        LocationListener? =
        null


    private var lastGpsLocation:
        Location? =
        null


    private var pdfRequestId =
        0


    private val handler =
        Handler(
            Looper.getMainLooper()
        )


    private enum class Tool {
        PEN,
        HIGHLIGHT,
        TEXT,
        ERASER
    }


    private enum class EraserMode {
        OBJECT,
        PIXEL
    }


    private enum class TextAlign {
        LEFT,
        CENTER,
        RIGHT
    }


    private data class StoredStroke(
        val points:
            MutableList<PointF>,
        val highlight:
            Boolean,
        val color:
            Int,
        val width:
            Float
    )


    private data class StoredText(
        var text:
            String,
        var x:
            Float,
        var y:
            Float,
        var scale:
            Float,
        var rotation:
            Float,
        var align:
            TextAlign,
        var size:
            Float = 20f,
        var color:
            Int = Color.rgb(
                255,
                60,
                130
            )
    )


    override fun onCreate(
        savedInstanceState: Bundle?
    ) {

        ThemeManager.apply(
            this
        )

        super.onCreate(
            savedInstanceState
        )


        requestedOrientation =
            ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED


        repository =
            ChartRepository(
                this
            )


        currentIcao =
            savedInstanceState
                ?.getString(
                    "ICAO"
                )
                ?: intent
                    .getStringExtra(
                        "ICAO"
                    )
                    .orEmpty()
                    .trim()
                    .uppercase(
                        Locale.US
                    )


        airportName =
            savedInstanceState
                ?.getString(
                    "AIRPORT_NAME"
                )
                ?: intent
                    .getStringExtra(
                        "AIRPORT_NAME"
                    )
                    .orEmpty()


        city =
            savedInstanceState
                ?.getString(
                    "CITY"
                )
                ?: intent
                    .getStringExtra(
                        "CITY"
                    )
                    .orEmpty()


        category =
            savedInstanceState
                ?.getString(
                    "CATEGORY"
                )
                ?: intent
                    .getStringExtra(
                        "CATEGORY"
                    )
                    .orEmpty()


        chartTitle =
            savedInstanceState
                ?.getString(
                    "TITLE"
                )
                ?: intent
                    .getStringExtra(
                        "TITLE"
                    )
                    .orEmpty()


        val savedIndex =
            savedInstanceState
                ?.getInt(
                    "CHART_INDEX",
                    -1
                )
                ?: -1


        val requestedGlobalPage =
            savedInstanceState
                ?.getInt(
                    "GLOBAL_PAGE",
                    -1
                )
                ?: intent.getIntExtra(
                    "PAGE",
                    -1
                )


        loadAirportCharts()


        if (
            savedIndex >= 0 &&
            savedIndex <
            airportCharts.size
        ) {

            currentChartIndex =
                savedIndex

        } else {

            val found =
                airportCharts
                    .indexOfFirst {

                        it.page ==
                            requestedGlobalPage
                    }


            currentChartIndex =
                if (
                    found >= 0
                ) {

                    found

                } else {

                    0
                }
        }


        WindowCompat.setDecorFitsSystemWindows(
            window,
            false
        )


        window.statusBarColor =
            Color.TRANSPARENT

        window.navigationBarColor =
            Color.TRANSPARENT


        buildLoadingUi(
            "Preparing airport chart..."
        )


        openCurrentAirport()
    }


    override fun onSaveInstanceState(
        outState: Bundle
    ) {

        outState.putString(
            "ICAO",
            currentIcao
        )

        outState.putString(
            "AIRPORT_NAME",
            airportName
        )

        outState.putString(
            "CITY",
            city
        )

        outState.putString(
            "CATEGORY",
            category
        )

        outState.putString(
            "TITLE",
            chartTitle
        )

        outState.putInt(
            "CHART_INDEX",
            currentChartIndex
        )

        outState.putInt(
            "GLOBAL_PAGE",
            currentChartGlobalPage()
        )

        super.onSaveInstanceState(
            outState
        )
    }


    override fun onResume() {
        super.onResume()
        positionResumed = true
        if (::aircraftPositionButton.isInitialized) {
            updateToggleButton(aircraftPositionButton, AircraftPositionStore.isEnabled(this))
        }
        startGps()
    }

    override fun onPause() {
        positionResumed = false
        stopGps()
        handler.removeCallbacks(simulatorUpdateRunnable)
        super.onPause()
    }

    override fun onDestroy() {

        pdfRequestId++


        metarRequestId++


        metarRemoveRunnable?.let {
            handler.removeCallbacks(
                it
            )
        }

        metarPollRunnable?.let {
            handler.removeCallbacks(
                it
            )
        }

        stopGps()

        handler.removeCallbacks(
            simulatorUpdateRunnable
        )


        previousBitmap
            ?.takeIf {
                !it.isRecycled
            }
            ?.recycle()


        nextBitmap
            ?.takeIf {
                !it.isRecycled
            }
            ?.recycle()


        chartViewBitmapCleanup()
        renderGeometries.clear()


        renderer?.close()

        renderer =
            null


        descriptor?.close()

        descriptor =
            null


        super.onDestroy()
    }


    private fun chartViewBitmapCleanup() {

        if (
            !::chartView
                .isInitialized
        ) {
            return
        }


        chartView.releaseBitmap()
    }


    private fun loadAirportCharts() {

        airportCharts.clear()


        if (
            currentIcao.isBlank()
        ) {
            return
        }


        airportCharts.addAll(
            repository
                .getChartsForAirport(
                    currentIcao
                )
        )


        airportCharts.sortBy {
            it.page
        }


        if (
            currentChartIndex >=
            airportCharts.size
        ) {

            currentChartIndex =
                max(
                    0,
                    airportCharts.size - 1
                )
        }


        ChartRepository.airport(currentIcao)
            ?.let {

                if (
                    airportName.isBlank()
                ) {

                    airportName =
                        it.airportName
                }


                if (
                    city.isBlank()
                ) {

                    city =
                        it.city
                }
            }
    }


    private fun openCurrentAirport() {

        if (
            currentIcao.isBlank()
        ) {

            showError(
                "Airport ICAO is missing."
            )

            return
        }


        if (
            airportCharts.isEmpty()
        ) {

            showError(
                "No chart data is available for $currentIcao."
            )

            return
        }


        val pdfInfo =
            repository.getAirportPdfInfo(
                currentIcao
            )


        val releaseTag =
            repository.getReleaseTag()


        val fileName =
            "airport_${currentIcao}_${releaseTag}.pdf"


        val file =
            File(
                filesDir,
                fileName
            )


        currentPdfFile =
            file


        if (
            file.exists() &&
            file.length() > 0
        ) {

            buildViewerUi()

            openPdf(
                file
            )

            return
        }


        buildLoadingUi(
            "Downloading $currentIcao charts..."
        )


        downloadAirportPdf(
            pdfInfo.url,
            file
        )
    }


    private fun downloadAirportPdf(
        url: String,
        file: File
    ) {

        val requestId =
            ++pdfRequestId


        thread {

            var connection:
                HttpURLConnection? =
                null


            val temporary =
                File(
                    filesDir,
                    "${file.name}.tmp"
                )


            try {

                connection =
                    URL(
                        url
                    )
                        .openConnection()
                        as HttpURLConnection


                connection.connectTimeout =
                    30000

                connection.readTimeout =
                    60000

                connection.requestMethod =
                    "GET"


                connection.setRequestProperty(
                    "User-Agent",
                    "JEPPIRAN/" + AppVersion.name(this@PdfViewerActivity)
                )


                connection.connect()


                if (
                    connection.responseCode !in
                    200..299
                ) {

                    throw Exception(
                        "HTTP ${connection.responseCode}"
                    )
                }


                val total =
                    connection.contentLengthLong


                connection.inputStream.use {
                    input ->

                    FileOutputStream(
                        temporary
                    ).use {
                        output ->

                        val buffer =
                            ByteArray(
                                64 * 1024
                            )


                        var downloaded =
                            0L


                        while (
                            true
                        ) {

                            val count =
                                input.read(
                                    buffer
                                )


                            if (
                                count <= 0
                            ) {

                                break
                            }


                            output.write(
                                buffer,
                                0,
                                count
                            )


                            downloaded +=
                                count


                            if (
                                total > 0
                            ) {

                                val percent =
                                    (
                                        downloaded *
                                            100L /
                                            total
                                        )
                                        .toInt()
                                        .coerceIn(
                                            0,
                                            100
                                        )


                                runOnUiThread {

                                    if (
                                        requestId !=
                                        pdfRequestId
                                    ) {

                                        return@runOnUiThread
                                    }


                                    if (
                                        ::progressBar
                                            .isInitialized
                                    ) {

                                        progressBar.progress =
                                            percent
                                    }


                                    if (
                                        ::loadingText
                                            .isInitialized
                                    ) {

                                        loadingText.text =
                                            "Downloading $currentIcao charts... $percent%"
                                    }
                                }
                            }
                        }
                    }
                }


                if (
                    requestId !=
                    pdfRequestId
                ) {

                    temporary.delete()

                    return@thread
                }


                if (
                    !temporary.renameTo(
                        file
                    )
                ) {

                    temporary.copyTo(
                        file,
                        overwrite = true
                    )

                    temporary.delete()
                }


                runOnUiThread {

                    if (
                        requestId !=
                        pdfRequestId
                    ) {
                        return@runOnUiThread
                    }


                    buildViewerUi()

                    openPdf(
                        file
                    )
                }


            } catch (
                error: Exception
            ) {

                temporary.delete()


                runOnUiThread {

                    if (
                        requestId !=
                        pdfRequestId
                    ) {
                        return@runOnUiThread
                    }


                    showError(
                        "Unable to download $currentIcao charts:\n${error.message}"
                    )
                }

            } finally {

                connection?.disconnect()
            }
        }
    }


    private fun buildLoadingUi(
        message: String
    ) {

        root =
            FrameLayout(
                this
            ).apply {

                setBackgroundColor(
                    Color.rgb(
                        14,
                        18,
                        23
                    )
                )
            }


        val box =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.VERTICAL

                gravity =
                    Gravity.CENTER

                setPadding(
                    30.dp,
                    30.dp,
                    30.dp,
                    30.dp
                )
            }


        progressBar =
            ProgressBar(
                this,
                null,
                android.R.attr.progressBarStyleHorizontal
            ).apply {

                max =
                    100

                progress =
                    0
            }


        loadingText =
            TextView(
                this
            ).apply {

                text =
                    message

                textSize =
                    15f

                gravity =
                    Gravity.CENTER

                setTextColor(
                    Color.WHITE
                )

                setPadding(
                    0,
                    18.dp,
                    0,
                    0
                )
            }


        box.addView(
            progressBar,
            LinearLayout.LayoutParams(
                300.dp,
                8.dp
            )
        )


        box.addView(
            loadingText,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )


        root.addView(
            box,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        )


        setContentView(
            root
        )
    }


    private fun buildViewerUi() {

        root =
            FrameLayout(
                this
            ).apply {

                setBackgroundColor(
                    Color.rgb(
                        14,
                        18,
                        23
                    )
                )
            }


        chartView =
            ChartView(
                this
            )


        root.addView(
            chartView,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        )


        buildTopToolbar()

        buildToolToolbar()

        buildChartTreePanel()

        buildMetarBanner()


        setContentView(
            root
        )


        applyInsets()

        startMetarPolling()
    }


    private fun buildTopToolbar() {

        topToolbar =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.HORIZONTAL

                gravity =
                    Gravity.CENTER_VERTICAL

                setBackgroundColor(
                    Color.rgb(
                        3,
                        18,
                        42
                    )
                )

                elevation =
                    8.dp.toFloat()
            }


        val back =
            toolbarButton(
                "‹",
                24f
            )


        back.contentDescription =
            "Back"


        back.setOnClickListener {
            finish()
        }


        topToolbar.addView(
            back,
            toolbarButtonParams(
                44.dp
            )
        )


        chartTreeButton =
            toolbarButton(
                "☰",
                19f
            ).apply {

                contentDescription =
                    "Bookmarks"

                setOnClickListener {
                    toggleChartTree()
                }
            }

        topToolbar.addView(
            chartTreeButton,
            toolbarButtonParams(
                44.dp
            )
        )


        val search =
            toolbarButton(
                "⌕",
                22f
            )


        search.contentDescription =
            "Search"


        search.setOnClickListener {
            showSearchDialog()
        }


        topToolbar.addView(
            search,
            toolbarButtonParams(
                44.dp
            )
        )


        titleText =
            TextView(
                this
            ).apply {

                text =
                    chartTitle.ifBlank {
                        "JeppIran Chart"
                    }

                textSize = 17f

                typeface =
                    Typeface.DEFAULT_BOLD

                maxLines =
                    2

                gravity =
                    Gravity.CENTER_VERTICAL

                setTextColor(
                    Color.WHITE
                )

                setPadding(
                    4.dp,
                    0,
                    4.dp,
                    0
                )
            }


        topToolbar.addView(
            titleText,
            LinearLayout.LayoutParams(
                0,
                LinearLayout.LayoutParams.MATCH_PARENT,
                1f
            )
        )


        pageText =
            TextView(
                this
            ).apply {

                textSize =
                    10f

                maxLines =
                    2

                gravity =
                    Gravity.CENTER

                setTextColor(
                    Color.rgb(
                        180,
                        190,
                        200
                    )
                )
            }


        val previous =
            toolbarButton("‹", 25f)


        previous.contentDescription =
            "Previous chart"


        previous.setOnClickListener {

            navigateWithinAirport(
                -1
            )
        }


        topToolbar.addView(
            previous,
            toolbarButtonParams(
                42.dp
            )
        )


        val next =
            toolbarButton("›", 25f)


        next.contentDescription =
            "Next chart"


        next.setOnClickListener {

            navigateWithinAirport(
                1
            )
        }


        topToolbar.addView(
            next,
            toolbarButtonParams(
                42.dp
            )
        )


        metarIcon =
            toolbarButton(
                "",
                10f
            ).apply {
                contentDescription =
                    "Show cached weather"

                setCompoundDrawablesWithIntrinsicBounds(
                    R.drawable.ic_weather,
                    0,
                    0,
                    0
                )

                setOnClickListener {
                    toggleCachedMetarBanner()
                }
            }

        topToolbar.addView(
            metarIcon,
            toolbarButtonParams(
                42.dp
            )
        )


        aircraftPositionButton =
            toolbarButton(
                "✈",
                18f
            )

        aircraftPositionButton.contentDescription =
            "Aircraft position"

        updateToggleButton(
            aircraftPositionButton,
            AircraftPositionStore.isEnabled(this)
        )

        aircraftPositionButton.setOnClickListener {
            val enabled =
                !AircraftPositionStore.isEnabled(this)

            AircraftPositionStore.setEnabled(
                this,
                enabled
            )

            updateToggleButton(
                aircraftPositionButton,
                enabled
            )

            if (enabled) {
                locationPermissionRequested = false
                startGps()
                updateGpsLabel()
            } else {
                stopGps()
                handler.removeCallbacks(simulatorUpdateRunnable)
                updateGpsText("Aircraft position OFF")
                if (::chartView.isInitialized) {
                    chartView.invalidate()
                }
            }
        }

        topToolbar.addView(
            aircraftPositionButton,
            toolbarButtonParams(
                42.dp
            )
        )


        if (
            isDarkTheme()
        ) {

            val invert =
                toolbarButton(
                    "◐",
                    18f
                )


            invert.contentDescription =
                "Invert chart"


            updateToggleButton(
                invert,
                invertChart
            )


            invert.setOnClickListener {

                invertChart =
                    !invertChart


                chartView.setInverted(
                    invertChart
                )


                updateToggleButton(
                    invert,
                    invertChart
                )
            }


            topToolbar.addView(
                invert,
                toolbarButtonParams(
                    42.dp
                )
            )
        }


        root.addView(
            topToolbar,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                58.dp
            ).apply {

                gravity =
                    Gravity.TOP
            }
        )
    }


    private fun buildToolToolbar() {

        toolScroll =
            HorizontalScrollView(
                this
            ).apply {

                isHorizontalScrollBarEnabled =
                    false

                setBackgroundColor(
                    Color.rgb(
                        5,
                        24,
                        52
                    )
                )
            }


        val tools =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.HORIZONTAL

                gravity =
                    Gravity.CENTER_VERTICAL

                setPadding(
                    4.dp,
                    3.dp,
                    4.dp,
                    3.dp
                )
            }


        tools.addView(
            toolButton(
                "PEN",
                Tool.PEN,
                R.drawable.ic_pen
            ),
            toolButtonParams(
                72.dp
            )
        )


        tools.addView(
            toolButton(
                "HIGHLIGHT",
                Tool.HIGHLIGHT,
                R.drawable.ic_highlight
            ),
            toolButtonParams(
                108.dp
            )
        )


        tools.addView(
            toolButton(
                "TEXT",
                Tool.TEXT,
                R.drawable.ic_text
            ),
            toolButtonParams(
                72.dp
            )
        )


        tools.addView(
            toolButton(
                "ERASER",
                Tool.ERASER,
                R.drawable.ic_eraser
            ),
            toolButtonParams(
                88.dp
            )
        )


        val clear =
            toolbarButton(
                "",
                11f
            ).apply {

                contentDescription =
                    "Clear all annotations"

                setCompoundDrawablesWithIntrinsicBounds(
                    R.drawable.ic_clear,
                    0,
                    0,
                    0
                )

                setOnClickListener {
                    showClearAllDialog()
                }
            }


        tools.addView(
            clear,
            toolButtonParams(
                50.dp
            )
        )


        toolScroll.addView(
            tools,
            ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        )


        root.addView(
            toolScroll,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                48.dp
            ).apply {

                gravity =
                    Gravity.TOP

                topMargin =
                    58.dp
            }
        )


        eraserModeBar =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.HORIZONTAL

                gravity =
                    Gravity.CENTER

                setPadding(
                    8.dp,
                    4.dp,
                    8.dp,
                    4.dp
                )

                setBackgroundColor(
                    Color.rgb(
                        3,
                        18,
                        42
                    )
                )

                visibility =
                    View.GONE
            }


        eraserModeBar.addView(
            eraserModeButton(
                "OBJECT ERASER",
                EraserMode.OBJECT
            ),
            LinearLayout.LayoutParams(
                148.dp,
                LinearLayout.LayoutParams.MATCH_PARENT
            ).apply {
                setMargins(
                    4.dp,
                    0,
                    4.dp,
                    0
                )
            }
        )


        eraserModeBar.addView(
            eraserModeButton(
                "PIXEL ERASER",
                EraserMode.PIXEL
            ),
            LinearLayout.LayoutParams(
                148.dp,
                LinearLayout.LayoutParams.MATCH_PARENT
            ).apply {
                setMargins(
                    4.dp,
                    0,
                    4.dp,
                    0
                )
            }
        )


        root.addView(
            eraserModeBar,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                44.dp
            ).apply {

                gravity =
                    Gravity.TOP

                topMargin =
                    106.dp
            }
        )


        annotationContextBar =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.VERTICAL

                gravity =
                    Gravity.CENTER_VERTICAL

                setPadding(
                    8.dp,
                    4.dp,
                    8.dp,
                    4.dp
                )

                setBackgroundColor(
                    Color.rgb(
                        3,
                        18,
                        42
                    )
                )

                visibility =
                    View.GONE
            }


        root.addView(
            annotationContextBar,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                92.dp
            ).apply {

                gravity =
                    Gravity.TOP

                topMargin =
                    106.dp
            }
        )


        updateToolButtonStates()
    }


    private fun buildChartTreePanel() {

        chartTreePanel =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.VERTICAL

                setBackgroundColor(
                    Color.argb(
                        245,
                        3,
                        17,
                        38
                    )
                )

                elevation =
                    10.dp.toFloat()

                visibility =
                    View.GONE
            }


        chartTreePanel.addView(
            TextView(
                this
            ).apply {

                text =
                    "CHARTS • " +
                        currentIcao

                textSize =
                    13f

                typeface =
                    Typeface.DEFAULT_BOLD

                setTextColor(
                    Color.WHITE
                )

                gravity =
                    Gravity.CENTER_VERTICAL

                setPadding(
                    12.dp,
                    0,
                    10.dp,
                    0
                )
            },
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                38.dp
            )
        )


        chartTreeScroll =
            ScrollView(
                this
            ).apply {

                isFillViewport =
                    true
            }


        chartTreeContent =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.VERTICAL

                setPadding(
                    6.dp,
                    4.dp,
                    6.dp,
                    8.dp
                )
            }


        chartTreeScroll.addView(
            chartTreeContent,
            ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
        )


        chartTreePanel.addView(
            chartTreeScroll,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1f
            )
        )


        root.addView(
            chartTreePanel
        )


        if (
            expandedChartCategories.isEmpty()
        ) {

            expandedChartCategories.add(
                category.ifBlank {
                    "Airport"
                }
            )
        }


        refreshChartTree()

        updateChartTreeLayout()
    }


    private fun refreshChartTree() {

        if (
            !::chartTreeContent.isInitialized
        ) {
            return
        }


        chartTreeContent.removeAllViews()


        listOf(
            "Airport",
            "STAR",
            "SID",
            "Approach",
            "Other"
        )
            .forEach {
                group ->

                val items =
                    airportCharts
                        .withIndex()
                        .filter {
                            indexed ->

                            indexed.value.category ==
                                group
                        }


                if (
                    items.isEmpty()
                ) {
                    return@forEach
                }


                val expanded =
                    group in
                        expandedChartCategories


                chartTreeContent.addView(
                    TextView(
                        this
                    ).apply {

                        text =
                            (
                                if (
                                    expanded
                                ) {

                                    "▼ "

                                } else {

                                    "▶ "
                                }
                                ) +
                                (if (group == "Approach") "APP" else group) +
                                "  (" +
                                items.size +
                                ")"

                        textSize =
                            12f

                        typeface =
                            Typeface.DEFAULT_BOLD

                        setTextColor(
                            Color.rgb(
                                220,
                                228,
                                235
                            )
                        )

                        setPadding(
                            10.dp,
                            9.dp,
                            8.dp,
                            9.dp
                        )

                        setOnClickListener {

                            if (
                                group in
                                expandedChartCategories
                            ) {

                                expandedChartCategories
                                    .remove(
                                        group
                                    )

                            } else {

                                expandedChartCategories
                                    .add(
                                        group
                                    )
                            }


                            refreshChartTree()
                        }
                    }
                )


                if (
                    !expanded
                ) {
                    return@forEach
                }


                items.forEach {
                    indexed ->

                    val chart =
                        indexed.value


                    val selected =
                        indexed.index ==
                            currentChartIndex


                    val row =
                        TextView(
                            this
                        ).apply {

                            text =
                                listOf(
                                    chart.chartNumber,
                                    chart.name.ifBlank {
                                        "Chart " +
                                            chart.page
                                    }
                                )
                                    .filter {
                                        value ->

                                        value.isNotBlank()
                                    }
                                    .joinToString(
                                        "  •  "
                                    )

                            textSize =
                                12f

                            maxLines =
                                2

                            setTextColor(
                                if (
                                    selected
                                ) {

                                    Color.WHITE

                                } else {

                                    Color.rgb(
                                        201,
                                        211,
                                        219
                                    )
                                }
                            )

                            setPadding(
                                18.dp,
                                8.dp,
                                8.dp,
                                8.dp
                            )

                            background =
                                roundedBackground(
                                    if (
                                        selected
                                    ) {

                                        Color.rgb(
                                            8,
                                            89,
                                            154
                                        )

                                    } else {

                                        Color.TRANSPARENT
                                    },
                                    if (
                                        selected
                                    ) {

                                        Color.rgb(
                                            47,
                                            217,
                                            255
                                        )

                                    } else {

                                        Color.TRANSPARENT
                                    },
                                    8
                                )

                            setOnClickListener {

                                if (
                                    indexed.index !=
                                    currentChartIndex
                                ) {

                                    currentChartIndex =
                                        indexed.index

                                    chartView.resetView()

                                    showCurrentChart(
                                        false
                                    )
                                }
                            }
                        }


                    chartTreeContent.addView(
                        row,
                        LinearLayout.LayoutParams(
                            LinearLayout.LayoutParams.MATCH_PARENT,
                            LinearLayout.LayoutParams.WRAP_CONTENT
                        ).apply {

                            setMargins(
                                3.dp,
                                2.dp,
                                3.dp,
                                2.dp
                            )
                        }
                    )
                }
            }
    }


    private fun toggleChartTree() {

        if (
            !controlsVisible
        ) {
            return
        }

        chartTreeOpen =
            !chartTreeOpen

        if (
            chartTreeOpen
        ) {

            setViewerChromeVisible(
                chartTreePanel,
                true
            )

        } else {

            setViewerChromeVisible(
                chartTreePanel,
                false
            )
        }

        chartTreeButton.background =
            roundedBackground(
                if (
                    chartTreeOpen
                ) {

                    Color.rgb(
                        8,
                        89,
                        154
                    )

                } else {

                    Color.TRANSPARENT
                },
                Color.rgb(
                    47,
                    217,
                    255
                ),
                18
            )

        updateOverlayInsets()
    }


    private fun updateChartTreeLayout() {

        if (
            !::chartTreePanel.isInitialized
        ) {
            return
        }


        val landscapeDevice =
            resources.configuration.orientation ==
                Configuration.ORIENTATION_LANDSCAPE


        chartTreePanel.layoutParams =
            FrameLayout.LayoutParams(
                if (
                    landscapeDevice
                ) {

                    270.dp

                } else {

                    FrameLayout.LayoutParams.MATCH_PARENT
                },
                if (
                    landscapeDevice
                ) {

                    FrameLayout.LayoutParams.MATCH_PARENT

                } else {

                    245.dp
                }
            ).apply {

                gravity =
                    if (
                        landscapeDevice
                    ) {

                        Gravity.START or
                            Gravity.TOP

                    } else {

                        Gravity.BOTTOM
                    }
            }


        if (
            ::chartView.isInitialized
        ) {

            chartView.setLandscapeMode(
                landscapeDevice
            )
        }


        updateOverlayInsets()
    }


    private fun buildMetarBanner() {

        metarBanner =
            TextView(
                this
            ).apply {

                textSize =
                    12f

                typeface =
                    Typeface.DEFAULT_BOLD

                setTextColor(
                    Color.WHITE
                )

                gravity =
                    Gravity.CENTER_VERTICAL

                setPadding(
                    14.dp,
                    9.dp,
                    14.dp,
                    9.dp
                )

                background =
                    roundedBackground(
                        Color.rgb(
                            5,
                            38,
                            68
                        ),
                        Color.rgb(
                            47,
                            217,
                            255
                        ),
                        14
                    )

                visibility =
                    View.GONE


                setOnTouchListener {
                        _, event ->

                    when (
                        event.actionMasked
                    ) {

                        MotionEvent.ACTION_DOWN ->
                            true

                        MotionEvent.ACTION_MOVE ->
                            true

                        MotionEvent.ACTION_UP -> {

                            hideMetarBanner(
                                true
                            )

                            true
                        }

                        else ->
                            true
                    }
                }
            }


        root.addView(
            metarBanner,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
            ).apply {

                gravity =
                    Gravity.TOP

                leftMargin =
                    10.dp

                rightMargin =
                    10.dp

                topMargin =
                    114.dp
            }
        )
    }


    private fun applyInsets() {

        ViewCompat.setOnApplyWindowInsetsListener(
            root
        ) { _, insets ->

            val bars =
                insets.getInsets(
                    WindowInsetsCompat.Type.systemBars()
                )


            insetLeft =
                bars.left

            insetTop =
                bars.top

            insetRight =
                bars.right

            insetBottom =
                bars.bottom


            val topParams =
                topToolbar.layoutParams
                    as FrameLayout.LayoutParams


            topParams.topMargin =
                insetTop

            topParams.leftMargin =
                insetLeft

            topParams.rightMargin =
                insetRight


            topToolbar.layoutParams =
                topParams


            val toolsParams =
                toolScroll.layoutParams
                    as FrameLayout.LayoutParams


            toolsParams.topMargin =
                insetTop +
                    58.dp

            toolsParams.leftMargin =
                insetLeft

            toolsParams.rightMargin =
                insetRight


            toolScroll.layoutParams =
                toolsParams


            val eraserParams =
                eraserModeBar.layoutParams
                    as FrameLayout.LayoutParams


            eraserParams.topMargin =
                insetTop +
                    106.dp

            eraserParams.leftMargin =
                insetLeft

            eraserParams.rightMargin =
                insetRight


            eraserModeBar.layoutParams =
                eraserParams


            updateOverlayInsets()


            insets
        }


        ViewCompat.requestApplyInsets(
            root
        )
    }


    private fun updateOverlayInsets() {

        if (
            !::chartView.isInitialized
        ) {
            return
        }

        if (
            viewerChromeTransitioning
        ) {
            return
        }


        if (
            !controlsVisible
        ) {

            chartView.setContentInsets(
                0,
                0,
                0,
                0
            )

            return
        }


        val eraserVisible =
            ::eraserModeBar.isInitialized &&
                eraserModeBar.visibility ==
                    View.VISIBLE


        val annotationOptionsVisible =
            ::annotationContextBar.isInitialized &&
                annotationContextBar.visibility ==
                    View.VISIBLE


        val optionsHeight =
            when {

                annotationOptionsVisible ->
                    92.dp

                eraserVisible ->
                    44.dp

                else ->
                    0
            }


        val topInset =
            insetTop +
                106.dp +
                optionsHeight


        if (
            ::metarBanner.isInitialized
        ) {

            val metarParams =
                metarBanner.layoutParams
                    as FrameLayout.LayoutParams


            metarParams.topMargin =
                topInset +
                    8.dp

            metarParams.leftMargin =
                insetLeft +
                    10.dp

            metarParams.rightMargin =
                insetRight +
                    10.dp


            metarBanner.layoutParams =
                metarParams
        }


        val landscapeDevice =
            resources.configuration.orientation ==
                Configuration.ORIENTATION_LANDSCAPE


        val treeLeft =
            if (
                landscapeDevice &&
                ::chartTreePanel.isInitialized &&
                chartTreePanel.visibility ==
                    View.VISIBLE
            ) {

                270.dp

            } else {

                0
            }


        val treeBottom =
            if (
                !landscapeDevice &&
                ::chartTreePanel.isInitialized &&
                chartTreePanel.visibility ==
                    View.VISIBLE
            ) {

                245.dp

            } else {

                0
            }


        chartView.setContentInsets(
            insetLeft +
                treeLeft,
            topInset,
            insetRight,
            insetBottom +
                treeBottom
        )


        if (
            ::chartTreePanel.isInitialized
        ) {

            val params =
                chartTreePanel.layoutParams
                    as FrameLayout.LayoutParams


            if (
                landscapeDevice
            ) {

                params.topMargin =
                    topInset

                params.bottomMargin =
                    insetBottom

                params.leftMargin =
                    insetLeft

            } else {

                params.bottomMargin =
                    insetBottom

                params.leftMargin =
                    insetLeft

                params.rightMargin =
                    insetRight
            }


            chartTreePanel.layoutParams =
                params
        }
    }


    private fun openPdf(
        file: File
    ) {

        try {

            renderer?.close()

            renderer =
                null


            descriptor?.close()

            descriptor =
                null


            descriptor =
                ParcelFileDescriptor.open(
                    file,
                    ParcelFileDescriptor.MODE_READ_ONLY
                )


            renderer =
                PdfRenderer(
                    descriptor!!
                )


            totalPdfPages =
                renderer!!.pageCount


            if (
                airportCharts.isEmpty()
            ) {

                showError(
                    "No charts were found for $currentIcao."
                )

                return
            }


            currentChartIndex =
                currentChartIndex.coerceIn(
                    0,
                    airportCharts.size - 1
                )


            currentIcao =
                airportCharts[
                    currentChartIndex
                ].icao


            showCurrentChart(
                false
            )

        } catch (
            error: Exception
        ) {

            showError(
                "Unable to open $currentIcao PDF:\n${error.message}"
            )
        }
    }


    private fun showCurrentChart(
        preserveSearchState: Boolean
    ) {

        if (
            airportCharts.isEmpty()
        ) {
            return
        }


        val chart =
            airportCharts[
                currentChartIndex
            ]


        chartTitle =
            chart.name


        category =
            chart.category


        airportName =
            chart.airportName


        city =
            chart.city


        val localPage =
            (
                chart.pdfPage - 1
            )


        if (
            localPage < 0 ||
            localPage >=
                totalPdfPages
        ) {

            showError(
                "Invalid local PDF page for ${chart.icao}."
            )

            return
        }


        setRequestedOrientationForPage(
            localPage
        )


        val bitmap =
            renderPageBitmap(
                localPage,
                ACTIVE_RENDER_QUALITY
            )


        if (
            bitmap == null
        ) {

            showError(
                "Unable to render chart page."
            )

            return
        }


        chartView.setBitmap(
            bitmap
        )


        titleText.text =
            chartTitle.ifBlank {
                "JeppIran Chart"
            }


        pageText.text =
            buildPageText()


        loadAnnotationsForCurrentChart()


        prepareNeighborBitmaps()


        if (
            !preserveSearchState
        ) {

            requestMetarIfAirportChanged()
        }


        updateGpsLabel()

        expandedChartCategories.add(
            category
        )

        refreshChartTree()
    }


    private fun setRequestedOrientationForPage(
        localPage: Int
    ) {

        requestedOrientation =
            ActivityInfo
                .SCREEN_ORIENTATION_UNSPECIFIED


        if (
            ::chartView.isInitialized
        ) {

            chartView.setLandscapeMode(
                resources.configuration.orientation ==
                    Configuration.ORIENTATION_LANDSCAPE
            )
        }
    }


    override fun onConfigurationChanged(
        newConfig: Configuration
    ) {

        super.onConfigurationChanged(
            newConfig
        )


        if (
            ::chartTreePanel.isInitialized
        ) {

            updateChartTreeLayout()
        }


        if (
            ::chartView.isInitialized
        ) {

            chartView.setLandscapeMode(
                newConfig.orientation ==
                    Configuration.ORIENTATION_LANDSCAPE
            )

            chartView.invalidate()
        }


        if (
            ::root.isInitialized
        ) {

            ViewCompat.requestApplyInsets(
                root
            )
        }
    }


    private fun renderPageBitmap(
        pageIndex: Int,
        quality: Float
    ):
        Bitmap? {

        val pdf =
            renderer
                ?: return null


        return try {

            synchronized(
                pdf
            ) {

                if (
                    pageIndex < 0 ||
                    pageIndex >=
                        pdf.pageCount
                ) {

                    return null
                }


                val page =
                    pdf.openPage(
                        pageIndex
                    )


                val scaleBase =
                    if (
                        page.width >
                        page.height
                    ) {

                        1.55f

                    } else {

                        1.75f
                    }


                val renderScale =
                    scaleBase *
                        quality


                val width =
                    (
                        page.width *
                            renderScale
                        )
                        .toInt()
                        .coerceAtLeast(
                            1
                        )


                val height =
                    (
                        page.height *
                            renderScale
                        )
                        .toInt()
                        .coerceAtLeast(
                            1
                        )


                val bitmap =
                    Bitmap.createBitmap(
                        width,
                        height,
                        Bitmap.Config.ARGB_8888
                    )


                val renderGeometry = RenderedPageGeometry(page.width, page.height, width, height)
                bitmap.eraseColor(
                    Color.WHITE
                )


                page.render(
                    bitmap,
                    null,
                    null,
                    PdfRenderer.Page
                        .RENDER_MODE_FOR_DISPLAY
                )


                page.close()


                val crop =
                    (
                        bitmap.height *
                            TOP_CROP_PERCENT
                        )
                        .toInt()
                        .coerceIn(
                            0,
                            max(
                                0,
                                bitmap.height - 1
                            )
                        )


                if (
                    crop <= 0
                ) {
                    renderGeometries[bitmap] = renderGeometry
                    bitmap

                } else {

                    val cropped =
                        Bitmap.createBitmap(
                            bitmap,
                            0,
                            crop,
                            bitmap.width,
                            bitmap.height - crop
                        )


                    bitmap.recycle()
                    renderGeometries[cropped] = renderGeometry.copy(cropTop = crop)
                    cropped
                }
            }

        } catch (
            _: Exception
        ) {

            null
        }
    }


    private fun prepareNeighborBitmaps() {

        if (
            airportCharts.isEmpty()
        ) {
            return
        }


        val previousChart =
            if (
                currentChartIndex > 0
            ) {

                airportCharts[
                    currentChartIndex - 1
                ]

            } else {

                null
            }


        val nextChart =
            if (
                currentChartIndex <
                airportCharts.size - 1
            ) {

                airportCharts[
                    currentChartIndex + 1
                ]

            } else {

                null
            }


        thread {

            val previous =
                previousChart?.let {

                    renderPageBitmap(
                        it.pdfPage - 1,
                        NEIGHBOR_RENDER_QUALITY
                    )
                }


            val next =
                nextChart?.let {

                    renderPageBitmap(
                        it.pdfPage - 1,
                        NEIGHBOR_RENDER_QUALITY
                    )
                }


            runOnUiThread {

                previousBitmap
                    ?.takeIf {
                        !it.isRecycled
                    }
                    ?.recycle()


                nextBitmap
                    ?.takeIf {
                        !it.isRecycled
                    }
                    ?.recycle()


                previousBitmap =
                    previous


                nextBitmap =
                    next


                if (
                    ::chartView
                        .isInitialized
                ) {

                    chartView.setNeighborBitmaps(
                        previous,
                        next
                    )
                }
            }
        }
    }


    private fun navigateWithinAirport(
        direction: Int
    ) {

        val target =
            currentChartIndex +
                direction


        if (
            target < 0 ||
            target >=
                airportCharts.size
        ) {

            return
        }


        currentChartIndex =
            target


        chartView.resetView()


        showCurrentChart(
            false
        )
    }


    private fun currentChartGlobalPage():
        Int {

        return airportCharts
            .getOrNull(
                currentChartIndex
            )
            ?.page
            ?: -1
    }


    private fun buildPageText():
        String {

        val chartPosition =
            "${currentChartIndex + 1}/${airportCharts.size}"


        val globalPage =
            currentChartGlobalPage()


        val localPage =
            airportCharts
                .getOrNull(
                    currentChartIndex
                )
                ?.pdfPage
                ?: -1


        return "$chartPosition  •  $category"
    }


    private fun showSearchDialog() {

        val rootBox =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.VERTICAL

                setPadding(
                    10.dp,
                    4.dp,
                    10.dp,
                    8.dp
                )
            }


        val input =
            EditText(
                this
            ).apply {

                hint =
                    "ICAO / Airport / City / Chart / Number"

                isSingleLine =
                    true

                textSize =
                    16f
            }


        val scroll =
            ScrollView(
                this
            )


        val resultBox =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.VERTICAL
            }


        scroll.addView(
            resultBox
        )


        rootBox.addView(
            input,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                58.dp
            )
        )


        rootBox.addView(
            scroll,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                420.dp
            )
        )


        val dialog =
            AlertDialog.Builder(
                this
            )
                .setTitle(
                    "SEARCH CHARTS"
                )
                .setView(
                    rootBox
                )
                .setNegativeButton(
                    "Close",
                    null
                )
                .create()


        fun renderResults(
            query: String
        ) {

            resultBox.removeAllViews()


            val q =
                query.trim()


            if (
                q.isBlank()
            ) {

                val hint =
                    TextView(
                        this
                    ).apply {

                        text =
                            "Search ICAO, airport name, city, chart name, chart type or chart number."

                        textSize =
                            13f

                        setTextColor(
                            secondaryTextColor()
                        )

                        setPadding(
                            10.dp,
                            18.dp,
                            10.dp,
                            18.dp
                        )
                    }


                resultBox.addView(
                    hint
                )

                return
            }


            val results =
                repository
                    .search(
                        q
                    )
                    .take(
                        100
                    )


            if (
                results.isEmpty()
            ) {

                val empty =
                    TextView(
                        this
                    ).apply {

                        text =
                            "No charts found."

                        textSize =
                            15f

                        setTextColor(
                            primaryTextColor()
                        )

                        setPadding(
                            10.dp,
                            18.dp,
                            10.dp,
                            18.dp
                        )
                    }


                resultBox.addView(
                    empty
                )

                return
            }


            results.forEach {
                result ->

                val row =
                    LinearLayout(
                        this
                    ).apply {

                        orientation =
                            LinearLayout.VERTICAL

                        background =
                            roundedBackground(
                                surfaceColor(),
                                dividerColor(),
                                12
                            )

                        setPadding(
                            12.dp,
                            10.dp,
                            12.dp,
                            10.dp
                        )

                        isClickable =
                            true

                        isFocusable =
                            true


                        setOnClickListener {

                            dialog.dismiss()

                            openSearchResult(
                                result
                            )
                        }
                    }


                val title =
                    TextView(
                        this
                    ).apply {

                        text =
                            result.name

                        textSize =
                            15f

                        maxLines =
                            3

                        typeface =
                            Typeface.DEFAULT_BOLD

                        setTextColor(
                            primaryTextColor()
                        )
                    }


                val details =
                    TextView(
                        this
                    ).apply {

                        text =
                            buildSearchResultText(
                                result
                            )

                        textSize =
                            12f

                        setTextColor(
                            secondaryTextColor()
                        )

                        setPadding(
                            0,
                            5.dp,
                            0,
                            0
                        )
                    }


                row.addView(
                    title
                )


                row.addView(
                    details
                )


                resultBox.addView(
                    row,
                    LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                    ).apply {

                        setMargins(
                            2.dp,
                            4.dp,
                            2.dp,
                            4.dp
                        )
                    }
                )
            }
        }


        input.setOnEditorActionListener {
                _, _, _ ->

            renderResults(
                input.text
                    .toString()
            )

            false
        }


        input.addTextChangedListener(
            object :
                android.text.TextWatcher {

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

                    renderResults(
                        s?.toString()
                            .orEmpty()
                    )
                }


                override fun afterTextChanged(
                    s:
                        android.text.Editable?
                ) {
                }
            }
        )


        dialog.setOnShowListener {

            input.requestFocus()

            dialog.window
                ?.setSoftInputMode(
                    WindowManager.LayoutParams
                        .SOFT_INPUT_STATE_ALWAYS_VISIBLE
                )
        }


        renderResults("")


        dialog.show()
    }


    private fun buildSearchResultText(
        result:
            ChartRepository.SearchResult
    ):
        String {

        val first =
            listOf(
                result.icao,
                result.airportName,
                result.city
            )
                .filter {
                    it.isNotBlank()
                }
                .joinToString(
                    "  •  "
                )


        val second =
            listOf(
                result.category,
                result.chartNumber,
                "Page ${result.page}"
            )
                .filter {
                    it.isNotBlank()
                }
                .joinToString(
                    "  •  "
                )


        return "$first\n$second"
    }


    private fun openSearchResult(
        result:
            ChartRepository.SearchResult
    ) {

        val airportChanged =
            currentIcao !=
                result.icao


        if (
            airportChanged
        ) {

            currentIcao =
                result.icao
                    .trim()
                    .uppercase(
                        Locale.US
                    )


            airportName =
                result.airportName


            city =
                result.city


            category =
                result.category


            chartTitle =
                result.name


            currentChartIndex =
                0


            lastMetarIcao =
                ""


            loadAirportCharts()


            val target =
                airportCharts
                    .indexOfFirst {

                        it.page ==
                            result.page
                    }


            currentChartIndex =
                if (
                    target >= 0
                ) {

                    target

                } else {

                    0
                }


            closePdf()


            chartView.releaseBitmap()


            buildLoadingUi(
                "Downloading $currentIcao charts..."
            )


            openCurrentAirport()


            return
        }


        val target =
            airportCharts
                .indexOfFirst {

                    it.page ==
                        result.page
                }


        if (
            target >= 0
        ) {

            currentChartIndex =
                target


            chartView.resetView()


            showCurrentChart(
                false
            )
        }
    }


    private fun closePdf() {

        previousBitmap
            ?.takeIf {
                !it.isRecycled
            }
            ?.recycle()


        nextBitmap
            ?.takeIf {
                !it.isRecycled
            }
            ?.recycle()


        previousBitmap =
            null


        nextBitmap =
            null


        renderer?.close()

        renderer =
            null


        descriptor?.close()

        descriptor =
            null
    }


    private fun updateEraserModeBar() {

        if (
            !::eraserModeBar.isInitialized
        ) {
            return
        }


        val shouldShow =
            controlsVisible &&
                annotationTool ==
                    Tool.ERASER


        eraserModeBar.visibility =
            if (
                shouldShow
            ) {

                View.VISIBLE

            } else {

                View.GONE
            }


        for (
            i in
                0 until
                eraserModeBar.childCount
        ) {

            val button =
                eraserModeBar.getChildAt(
                    i
                ) as? TextView
                    ?: continue


            val mode =
                button.tag as? EraserMode
                    ?: continue


            val selected =
                mode ==
                    eraserMode


            button.setTextColor(
                if (
                    selected
                ) {

                    Color.WHITE

                } else {

                    Color.rgb(
                        205,
                        214,
                        222
                    )
                }
            )


            button.background =
                roundedBackground(
                    if (
                        selected
                    ) {

                        Color.rgb(
                            117,
                            28,
                            82
                        )

                    } else {

                        Color.rgb(
                            31,
                            41,
                            51
                        )
                    },
                    if (
                        selected
                    ) {

                        Color.rgb(
                            245,
                            55,
                            159
                        )

                    } else {

                        Color.rgb(
                            76,
                            91,
                            105
                        )
                    },
                    12
                )
        }
    }


    private fun updateAnnotationContextBar() {

        if (
            !::annotationContextBar.isInitialized
        ) {
            return
        }


        val tool =
            annotationTool


        val show =
            controlsVisible &&
                (
                    tool ==
                        Tool.PEN ||
                    tool ==
                        Tool.HIGHLIGHT ||
                    tool ==
                        Tool.TEXT
                    )


        annotationContextBar.visibility =
            if (
                show
            ) {

                View.VISIBLE

            } else {

                View.GONE
            }


        annotationContextBar.removeAllViews()


        if (
            !show ||
            tool ==
                null
        ) {

            updateOverlayInsets()

            return
        }


        val colors =
            intArrayOf(
                Color.rgb(
                    245,
                    51,
                    156
                ),
                Color.rgb(
                    255,
                    215,
                    0
                ),
                Color.rgb(
                    60,
                    160,
                    255
                ),
                Color.rgb(
                    80,
                    225,
                    135
                ),
                Color.WHITE
            )


        val currentColor =
            when (
                tool
            ) {

                Tool.PEN ->
                    penColor

                Tool.HIGHLIGHT ->
                    Color.rgb(
                        Color.red(
                            highlightColor
                        ),
                        Color.green(
                            highlightColor
                        ),
                        Color.blue(
                            highlightColor
                        )
                    )

                Tool.TEXT ->
                    textColor

                else ->
                    Color.WHITE
            }


        val colorRow =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.HORIZONTAL

                gravity =
                    Gravity.CENTER_VERTICAL
            }


        colorRow.addView(
            TextView(
                this
            ).apply {

                text =
                    "COLOR"

                textSize =
                    10f

                typeface =
                    Typeface.DEFAULT_BOLD

                setTextColor(
                    Color.rgb(
                        180,
                        192,
                        202
                    )
                )

                gravity =
                    Gravity.CENTER_VERTICAL
            },
            LinearLayout.LayoutParams(
                56.dp,
                36.dp
            )
        )


        colors.forEach {
            color ->

            val selected =
                currentColor ==
                    color


            colorRow.addView(
                View(
                    this
                ).apply {

                    contentDescription =
                        "Annotation color"

                    background =
                        android.graphics.drawable
                            .GradientDrawable()
                            .apply {

                                shape =
                                    android.graphics.drawable
                                        .GradientDrawable
                                        .OVAL

                                setColor(
                                    color
                                )

                                setStroke(
                                    if (
                                        selected
                                    ) {

                                        3.dp

                                    } else {

                                        1.dp
                                    },
                                    if (
                                        selected
                                    ) {

                                        Color.rgb(
                                            245,
                                            51,
                                            156
                                        )

                                    } else {

                                        Color.rgb(
                                            110,
                                            123,
                                            134
                                        )
                                    }
                                )
                            }


                    setOnClickListener {

                        when (
                            tool
                        ) {

                            Tool.PEN ->
                                penColor =
                                    color

                            Tool.HIGHLIGHT ->
                                highlightColor =
                                    Color.argb(
                                        105,
                                        Color.red(
                                            color
                                        ),
                                        Color.green(
                                            color
                                        ),
                                        Color.blue(
                                            color
                                        )
                                    )

                            Tool.TEXT ->
                                textColor =
                                    color

                            else ->
                                Unit
                        }


                        updateAnnotationContextBar()

                        chartView.invalidate()
                    }
                },
                LinearLayout.LayoutParams(
                    28.dp,
                    28.dp
                ).apply {

                    setMargins(
                        5.dp,
                        3.dp,
                        5.dp,
                        3.dp
                    )
                }
            )
        }


        annotationContextBar.addView(
            colorRow,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                40.dp
            )
        )


        val sizeRow =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.HORIZONTAL

                gravity =
                    Gravity.CENTER_VERTICAL
            }


        sizeRow.addView(
            TextView(
                this
            ).apply {

                text =
                    if (
                        tool ==
                        Tool.TEXT
                    ) {

                        "SIZE"

                    } else {

                        "WIDTH"
                    }

                textSize =
                    10f

                typeface =
                    Typeface.DEFAULT_BOLD

                setTextColor(
                    Color.rgb(
                        180,
                        192,
                        202
                    )
                )

                gravity =
                    Gravity.CENTER_VERTICAL
            },
            LinearLayout.LayoutParams(
                56.dp,
                36.dp
            )
        )


        val sizes =
            when (
                tool
            ) {

                Tool.PEN ->
                    floatArrayOf(
                        3f,
                        5f,
                        8f,
                        12f,
                        18f
                    )

                Tool.HIGHLIGHT ->
                    floatArrayOf(
                        12f,
                        18f,
                        24f,
                        32f,
                        44f
                    )

                Tool.TEXT ->
                    floatArrayOf(
                        14f,
                        18f,
                        24f,
                        32f,
                        44f
                    )

                else ->
                    floatArrayOf()
            }


        val selectedSize =
            when (
                tool
            ) {

                Tool.PEN ->
                    penWidth

                Tool.HIGHLIGHT ->
                    highlightWidth

                Tool.TEXT ->
                    textDefaultSize

                else ->
                    0f
            }


        sizes.forEachIndexed {
            index,
            value ->

            val selected =
                abs(
                    selectedSize -
                        value
                ) <
                    0.1f


            sizeRow.addView(
                TextView(
                    this
                ).apply {

                    text =
                        "●"

                    textSize =
                        (
                            8f +
                                index *
                                3f
                            )

                    gravity =
                        Gravity.CENTER

                    setTextColor(
                        if (
                            selected
                        ) {

                            Color.rgb(
                                245,
                                51,
                                156
                            )

                        } else {

                            Color.WHITE
                        }
                    )

                    background =
                        roundedBackground(
                            if (
                                selected
                            ) {

                                Color.rgb(
                                    70,
                                    34,
                                    60
                                )

                            } else {

                                Color.TRANSPARENT
                            },
                            if (
                                selected
                            ) {

                                Color.rgb(
                                    245,
                                    51,
                                    156
                                )

                            } else {

                                Color.TRANSPARENT
                            },
                            10
                        )


                    setOnClickListener {

                        when (
                            tool
                        ) {

                            Tool.PEN ->
                                penWidth =
                                    value

                            Tool.HIGHLIGHT ->
                                highlightWidth =
                                    value

                            Tool.TEXT ->
                                textDefaultSize =
                                    value

                            else ->
                                Unit
                        }


                        updateAnnotationContextBar()
                    }
                },
                LinearLayout.LayoutParams(
                    45.dp,
                    36.dp
                ).apply {

                    setMargins(
                        3.dp,
                        0,
                        3.dp,
                        0
                    )
                }
            )
        }


        annotationContextBar.addView(
            sizeRow,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                40.dp
            )
        )


        updateOverlayInsets()
    }


    private fun updateToolOptions() {

        updateEraserModeBar()

        updateAnnotationContextBar()

        updateOverlayInsets()
    }


    private fun eraserModeButton(
        label: String,
        mode: EraserMode
    ):
        TextView {

        return TextView(
            this
        ).apply {

            text =
                label

            textSize =
                11f

            typeface =
                Typeface.DEFAULT_BOLD

            gravity =
                Gravity.CENTER

            tag =
                mode

            isClickable =
                true

            isFocusable =
                true

            setOnClickListener {

                eraserMode =
                    mode

                annotationTool =
                    Tool.ERASER

                annotationMode =
                    true

                updateEraserModeBar()

                updateToolButtonStates()

                chartView.invalidate()
            }
        }
    }


    private fun showClearAllDialog() {

        AlertDialog.Builder(
            this
        )
            .setTitle(
                "Clear all annotations"
            )
            .setMessage(
                "Delete every annotation on this chart?"
            )
            .setNegativeButton(
                "Cancel",
                null
            )
            .setPositiveButton(
                "Clear all"
            ) { _, _ ->

                clearCurrentChartAnnotations()
            }
            .show()
    }


    private fun showTextDialog(
        x: Float,
        y: Float
    ) {

        val input =
            EditText(
                this
            ).apply {

                hint =
                    "Enter text"

                minLines =
                    5

                gravity =
                    Gravity.TOP or
                        Gravity.START

                textSize =
                    16f

                inputType =
                    InputType.TYPE_CLASS_TEXT or
                        InputType
                            .TYPE_TEXT_FLAG_MULTI_LINE or
                        InputType
                            .TYPE_TEXT_FLAG_CAP_SENTENCES
            }


        AlertDialog.Builder(
            this
        )
            .setTitle(
                "Text annotation"
            )
            .setView(
                input
            )
            .setNegativeButton(
                "Cancel"
            ) { _, _ ->

                annotationMode =
                    false

                annotationTool = null

                updateToolButtonStates()
            }
            .setPositiveButton(
                "Add"
            ) { _, _ ->

                val value =
                    input.text
                        .toString()


                if (
                    value.isNotBlank()
                ) {

                    val safe =
                        chartView
                            .clampTextAnchor(
                                value,
                                x,
                                y,
                                1f,
                                0f,
                                TextAlign.LEFT,
                                textDefaultSize
                            )


                    chartView.addTextAnnotation(
                        value,
                        safe.x,
                        safe.y,
                        TextAlign.LEFT
                    )


                    chartView.selectLastText()


                    saveAnnotationsForCurrentChart()
                }


                annotationMode =
                    false

                annotationTool = null

                updateToolButtonStates()

                chartView.invalidate()
            }
            .show()
    }


    private fun showTextEditDialog(
        index: Int
    ) {

        val item =
            chartView.getTextAt(
                index
            )
                ?: return


        val input =
            EditText(
                this
            ).apply {

                setText(
                    item.text
                )

                minLines =
                    5

                gravity =
                    Gravity.TOP or
                        Gravity.START

                inputType =
                    InputType.TYPE_CLASS_TEXT or
                        InputType
                            .TYPE_TEXT_FLAG_MULTI_LINE

                setSelection(
                    text.length
                )
            }


        AlertDialog.Builder(
            this
        )
            .setTitle(
                "Edit text"
            )
            .setView(
                input
            )
            .setNegativeButton(
                "Cancel",
                null
            )
            .setNeutralButton(
                "Copy"
            ) { _, _ ->

                val clipboard =
                    getSystemService(
                        ClipboardManager::class.java
                    )


                clipboard.setPrimaryClip(
                    ClipData.newPlainText(
                        "JeppIran annotation",
                        item.text
                    )
                )
            }
            .setPositiveButton(
                "Save"
            ) { _, _ ->

                item.text =
                    input.text
                        .toString()


                val safe =
                    chartView
                        .clampTextAnchor(
                            item.text,
                            item.x,
                            item.y,
                            item.scale,
                            item.rotation,
                            item.align,
                            item.size
                        )


                item.x =
                    safe.x

                item.y =
                    safe.y


                saveAnnotationsForCurrentChart()

                chartView.invalidate()
            }
            .show()
    }


    private fun saveAnnotationsForCurrentChart() {

        if (
            !::chartView
                .isInitialized
        ) {
            return
        }


        val page =
            currentChartGlobalPage()


        if (
            page <= 0
        ) {
            return
        }


        val rootObject =
            JSONObject()


        val strokes =
            JSONArray()


        chartView
            .getStrokes()
            .forEach {
                stroke ->

                val points =
                    JSONArray()


                stroke.points
                    .forEach {
                        point ->

                        points.put(
                            JSONObject()
                                .put(
                                    "x",
                                    point.x
                                )
                                .put(
                                    "y",
                                    point.y
                                )
                        )
                    }


                strokes.put(
                    JSONObject()
                        .put(
                            "highlight",
                            stroke.highlight
                        )
                        .put(
                            "color",
                            stroke.color
                        )
                        .put(
                            "width",
                            stroke.width
                        )
                        .put(
                            "points",
                            points
                        )
                )
            }


        val texts =
            JSONArray()


        chartView
            .getTexts()
            .forEach {
                item ->

                texts.put(
                    JSONObject()
                        .put(
                            "text",
                            item.text
                        )
                        .put(
                            "x",
                            item.x
                        )
                        .put(
                            "y",
                            item.y
                        )
                        .put(
                            "scale",
                            item.scale
                        )
                        .put(
                            "rotation",
                            item.rotation
                        )
                        .put(
                            "align",
                            item.align.name
                        )
                        .put(
                            "size",
                            item.size
                        )
                        .put(
                            "color",
                            item.color
                        )
                )
            }


        rootObject.put(
            "strokes",
            strokes
        )


        rootObject.put(
            "texts",
            texts
        )


        annotationPreferences()
            .edit()
            .putString(
                annotationPageKey(
                    page
                ),
                rootObject.toString()
            )
            .putString(
                "data_version",
                repository.getDataVersion()
            )
            .apply()
    }


    private fun loadAnnotationsForCurrentChart() {

        val page =
            currentChartGlobalPage()


        chartView.clearAnnotationsInternal()


        if (
            page <= 0
        ) {

            return
        }


        val preferences =
            annotationPreferences()


        val storedVersion =
            preferences
                .getString(
                    "data_version",
                    ""
                )
                .orEmpty()


        if (
            storedVersion !=
            repository.getDataVersion()
        ) {

            preferences
                .edit()
                .clear()
                .putString(
                    "data_version",
                    repository.getDataVersion()
                )
                .apply()


            return
        }


        val raw =
            preferences
                .getString(
                    annotationPageKey(
                        page
                    ),
                    ""
                )
                .orEmpty()


        if (
            raw.isBlank()
        ) {
            return
        }


        try {

            val rootObject =
                JSONObject(
                    raw
                )


            val strokes =
                rootObject.optJSONArray(
                    "strokes"
                )


            if (
                strokes != null
            ) {

                for (
                    i in
                        0 until
                        strokes.length()
                ) {

                    val strokeObject =
                        strokes.optJSONObject(
                            i
                        )
                            ?: continue


                    val points =
                        mutableListOf<PointF>()


                    val array =
                        strokeObject.optJSONArray(
                            "points"
                        )


                    if (
                        array != null
                    ) {

                        for (
                            j in
                                0 until
                                array.length()
                        ) {

                            val item =
                                array.optJSONObject(
                                    j
                                )
                                    ?: continue


                            points.add(
                                PointF(
                                    item.optDouble(
                                        "x",
                                        0.0
                                    ).toFloat(),
                                    item.optDouble(
                                        "y",
                                        0.0
                                    ).toFloat()
                                )
                            )
                        }
                    }


                    if (
                        points.size >=
                        2
                    ) {

                        val highlight =
                            strokeObject
                                .optBoolean(
                                    "highlight",
                                    false
                                )


                        chartView.addStoredStroke(
                            points,
                            highlight,
                            strokeObject
                                .optInt(
                                    "color",
                                    if (
                                        highlight
                                    ) {

                                        Color.argb(
                                            105,
                                            255,
                                            220,
                                            0
                                        )

                                    } else {

                                        Color.rgb(
                                            255,
                                            60,
                                            130
                                        )
                                    }
                                ),
                            strokeObject
                                .optDouble(
                                    "width",
                                    if (
                                        highlight
                                    ) {

                                        22.0

                                    } else {

                                        5.0
                                    }
                                )
                                .toFloat()
                        )
                    }
                }
            }


            val texts =
                rootObject.optJSONArray(
                    "texts"
                )


            if (
                texts != null
            ) {

                for (
                    i in
                        0 until
                        texts.length()
                ) {

                    val item =
                        texts.optJSONObject(
                            i
                        )
                            ?: continue


                    val align =
                        runCatching {

                            TextAlign.valueOf(
                                item.optString(
                                    "align",
                                    "LEFT"
                                )
                            )

                        }.getOrDefault(
                            TextAlign.LEFT
                        )


                    val text =
                        item.optString(
                            "text",
                            ""
                        )


                    if (
                        text.isBlank()
                    ) {
                        continue
                    }


                    val scale =
                        item.optDouble(
                            "scale",
                            1.0
                        )
                            .toFloat()
                            .coerceIn(
                                0.35f,
                                MAX_ZOOM
                            )


                    val rotation =
                        item.optDouble(
                            "rotation",
                            0.0
                        )
                            .toFloat()


                    val size =
                        item.optDouble(
                            "size",
                            20.0
                        )
                            .toFloat()
                            .coerceIn(
                                10f,
                                100f
                            )


                    val safe =
                        chartView
                            .clampTextAnchor(
                                text,
                                item.optDouble(
                                    "x",
                                    0.0
                                ).toFloat(),
                                item.optDouble(
                                    "y",
                                    0.0
                                ).toFloat(),
                                scale,
                                rotation,
                                align,
                                size
                            )


                    chartView.addStoredText(
                        text,
                        safe.x,
                        safe.y,
                        scale,
                        rotation,
                        align,
                        size,
                        item.optInt(
                            "color",
                            Color.rgb(
                                255,
                                60,
                                130
                            )
                        )
                    )
                }
            }

        } catch (
            _: Exception
        ) {
        }


        chartView.invalidate()
    }


    private fun clearCurrentChartAnnotations() {

        val page =
            currentChartGlobalPage()


        if (
            page <= 0
        ) {
            return
        }


        annotationPreferences()
            .edit()
            .remove(
                annotationPageKey(
                    page
                )
            )
            .putString(
                "data_version",
                repository.getDataVersion()
            )
            .apply()


        chartView.clearAnnotationsInternal()

        chartView.invalidate()
    }


    private fun annotationPreferences() =
        getSharedPreferences(
            ANNOTATION_PREFS,
            Context.MODE_PRIVATE
        )


    private fun annotationPageKey(
        page: Int
    ):
        String {

        return "page_$page"
    }


    private fun setViewerChromeVisible(
        view: View,
        visible: Boolean
    ) {

        view.animate()
            .cancel()

        if (
            visible
        ) {

            if (
                view.visibility !=
                View.VISIBLE
            ) {

                view.alpha =
                    0f

                view.visibility =
                    View.VISIBLE
            }

            view.animate()
                .alpha(
                    1f
                )
                .setDuration(
                    140L
                )
                .start()

        } else {

            if (
                view.visibility ==
                View.VISIBLE
            ) {

                view.animate()
                    .alpha(
                        0f
                    )
                    .setDuration(
                        120L
                    )
                    .withEndAction {

                        if (
                            !controlsVisible
                        ) {

                            view.visibility =
                                View.GONE

                            view.alpha =
                                1f
                        }
                    }
                    .start()

            } else {

                view.visibility =
                    View.GONE

                view.alpha =
                    1f
            }
        }
    }


    private fun hideViewerControls() {

        setViewerChromeVisible(
            topToolbar,
            false
        )

        setViewerChromeVisible(
            toolScroll,
            false
        )


        if (
            ::eraserModeBar.isInitialized
        ) {

            eraserModeBar.visibility =
                View.GONE
        }


        if (
            ::annotationContextBar.isInitialized
        ) {

            annotationContextBar.visibility =
                View.GONE
        }


        if (
            ::chartTreePanel.isInitialized
        ) {

            setViewerChromeVisible(
                chartTreePanel,
                false
            )
        }


        if (
            ::metarBanner.isInitialized
        ) {

            metarBanner.visibility =
                View.GONE
        }


        chartView.setContentInsets(
            0,
            0,
            0,
            0
        )


        WindowInsetsControllerCompat(
            window,
            window.decorView
        ).apply {

            hide(
                WindowInsetsCompat.Type.systemBars()
            )

            systemBarsBehavior =
                WindowInsetsControllerCompat
                    .BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }


    private fun showViewerControls() {

        setViewerChromeVisible(
            topToolbar,
            true
        )

        setViewerChromeVisible(
            toolScroll,
            true
        )


        if (
            ::chartTreePanel.isInitialized
        ) {

            if (
                chartTreeOpen
            ) {

                setViewerChromeVisible(
                    chartTreePanel,
                    true
                )

            } else {

                chartTreePanel.visibility =
                    View.GONE
            }
        }


        updateToolOptions()

        updateChartTreeLayout()


        WindowInsetsControllerCompat(
            window,
            window.decorView
        )
            .show(
                WindowInsetsCompat.Type.systemBars()
            )


        ViewCompat.requestApplyInsets(
            root
        )
    }


    private fun toggleViewerControls() {

        controlsVisible =
            !controlsVisible


        if (
            controlsVisible
        ) {

            showViewerControls()

        } else {

            hideViewerControls()
        }
    }


    private fun startMetarPolling() {
        metarPollRunnable?.let {
            handler.removeCallbacks(it)
        }

        metarPollRunnable =
            object : Runnable {
                override fun run() {
                    if (!isFinishing && !isDestroyed && currentIcao.isNotBlank()) {
                        requestMetar(
                            currentIcao,
                            false
                        )
                        handler.postDelayed(
                            this,
                            METAR_POLL_INTERVAL
                        )
                    }
                }
            }

        handler.postDelayed(
            metarPollRunnable!!,
            METAR_POLL_INTERVAL
        )
    }


    private fun requestMetarIfAirportChanged() {

        if (
            currentIcao.isBlank()
        ) {
            return
        }


        if (
            lastMetarIcao ==
            currentIcao
        ) {
            return
        }


        lastMetarIcao =
            currentIcao

        lastMetarValue =
            ""


        requestMetar(
            currentIcao,
            false
        )
    }


    private fun requestMetar(
        airportIcao: String,
        showLoading: Boolean = true
    ) {

        val requestId =
            ++metarRequestId


        if (showLoading) {
            showMetarBanner(
                "$airportIcao METAR: loading..."
            )
        }


        thread {

            var connection:
                HttpURLConnection? =
                null


            try {

                connection =
                    URL(
                        "https://aviationweather.gov/api/data/metar" +
                            "?ids=" +
                            airportIcao +
                            "&format=json"
                    )
                        .openConnection()
                        as HttpURLConnection


                connection.connectTimeout =
                    METAR_TIMEOUT

                connection.readTimeout =
                    METAR_TIMEOUT

                connection.requestMethod =
                    "GET"


                connection.setRequestProperty(
                    "Accept",
                    "application/json"
                )


                connection.setRequestProperty(
                    "User-Agent",
                    "JeppIran/1.0"
                )


                connection.connect()


                if (
                    connection.responseCode !in
                    200..299
                ) {

                    throw Exception(
                        "HTTP ${connection.responseCode}"
                    )
                }


                val body =
                    connection
                        .inputStream
                        .bufferedReader()
                        .use {
                            it.readText()
                        }


                val parsed =
                    parseMetar(
                        body,
                        airportIcao
                    )


                runOnUiThread {

                    if (
                        requestId !=
                        metarRequestId
                    ) {
                        return@runOnUiThread
                    }


                    if (
                        parsed != null
                    ) {

                        lastMetarValue =
                            parsed

                        if (
                            showLoading ||
                            (
                                ::metarBanner.isInitialized &&
                                metarBanner.visibility ==
                                    View.VISIBLE
                            )
                        ) {

                            showMetarBanner(
                                parsed
                            )
                        }

                    } else if (
                        showLoading
                    ) {

                        showMetarBanner(
                            "$airportIcao METAR • no report available"
                        )
                    }
                }

            } catch (
                _: Exception
            ) {

                runOnUiThread {

                    if (
                        requestId ==
                        metarRequestId &&
                        showLoading
                    ) {

                        hideMetarBanner(
                            false
                        )
                    }
                }

            } finally {

                connection?.disconnect()
            }
        }
    }


    private fun parseMetar(
        response: String,
        airportIcao: String
    ):
        String? {

        if (
            response.isBlank()
        ) {
            return null
        }


        return try {

            val array =
                JSONArray(
                    response
                )


            if (
                array.length() <=
                0
            ) {

                return null
            }


            val item =
                array.optJSONObject(
                    0
                )
                    ?: return null


            val raw =
                item.optString(
                    "rawOb",
                    ""
                ).trim()


            val flightCategory =
                item.optString(
                    "fltCat",
                    ""
                ).trim()


            if (
                raw.isBlank()
            ) {

                return "$airportIcao METAR: data available"
            }


            listOf(
                "$airportIcao METAR",
                flightCategory,
                raw
            )
                .filter {
                    it.isNotBlank()
                }
                .joinToString(
                    "  •  "
                )

        } catch (
            _: Exception
        ) {

            null
        }
    }


    private fun toggleCachedMetarBanner() {

        if (
            !::metarBanner.isInitialized
        ) {
            return
        }


        if (
            metarBanner.visibility ==
            View.VISIBLE
        ) {

            hideMetarBanner(
                true
            )

            return
        }


        val cached =
            lastMetarValue


        showMetarBanner(
            if (
                cached.isBlank()
            ) {

                "$currentIcao METAR • no cached report yet"

            } else {

                cached
            }
        )
    }


    private fun showMetarBanner(
        value: String
    ) {

        if (
            !::metarBanner
                .isInitialized
        ) {
            return
        }


        metarRemoveRunnable?.let {
            handler.removeCallbacks(
                it
            )
        }


        metarBanner.text = value
        metarBanner.visibility =
            View.VISIBLE


        metarBanner.alpha =
            1f


        metarRemoveRunnable =
            Runnable {

                hideMetarBanner(
                    true
                )
            }


        handler.postDelayed(
            metarRemoveRunnable!!,
            METAR_DISPLAY_DURATION
        )
    }


    private fun hideMetarBanner(
        animated: Boolean
    ) {

        if (
            !::metarBanner
                .isInitialized
        ) {
            return
        }


        metarRemoveRunnable?.let {
            handler.removeCallbacks(
                it
            )
        }


        if (
            animated
        ) {

            metarBanner
                .animate()
                .alpha(
                    0f
                )
                .translationY(
                    -20.dp.toFloat()
                )
                .setDuration(
                    160L
                )
                .withEndAction {

                    metarBanner.visibility =
                        View.GONE

                    metarBanner.alpha =
                        1f

                    metarBanner.translationY = 0f
                }
                .start()

        } else {

            metarBanner.visibility = View.GONE
        }
    }


    private val simulatorUpdateRunnable =
        object : Runnable {
            override fun run() {
                if (!positionResumed || !AircraftPositionStore.isEnabled(this@PdfViewerActivity)) {
                    return
                }
                updateSimulatorLabel()

                if (
                    SimulatorLocationStore.isConnected()
                ) {
                    handler.postDelayed(
                        this,
                        500L
                    )
                }
            }
        }


    private fun startGps() {
        if (!positionResumed) return

        if (
            !AircraftPositionStore.isEnabled(this)
        ) {
            stopGps()
            handler.removeCallbacks(simulatorUpdateRunnable)
            updateGpsText("Aircraft position OFF")
            return
        }

        if (
            SimulatorLocationStore.isConnected()
        ) {
            stopGps()

            handler.removeCallbacks(
                simulatorUpdateRunnable
            )

            handler.post(
                simulatorUpdateRunnable
            )

            return
        }

        handler.removeCallbacks(
            simulatorUpdateRunnable
        )

        // Remove any previous listener before registering a new one.
        stopGps()

        locationManager =
            getSystemService(
                Context.LOCATION_SERVICE
            ) as? LocationManager


        val manager =
            locationManager
                ?: return


        val fine =
            ActivityCompat
                .checkSelfPermission(
                    this,
                    Manifest.permission
                        .ACCESS_FINE_LOCATION
                ) ==
                PackageManager
                    .PERMISSION_GRANTED


        val coarse =
            ActivityCompat
                .checkSelfPermission(
                    this,
                    Manifest.permission
                        .ACCESS_COARSE_LOCATION
                ) ==
                PackageManager
                    .PERMISSION_GRANTED


        if (
            !fine &&
            !coarse
        ) {

            updateGpsText(
                "GPS: permission required"
            )
            if (!locationPermissionRequested) {
                locationPermissionRequested = true
                locationPermissionLauncher.launch(
                    arrayOf(
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION
                    )
                )
            }
    


            return
        }


        val providers =
            mutableListOf<String>()


        if (
            manager.isProviderEnabled(
                LocationManager.GPS_PROVIDER
            )
        ) {

            providers.add(
                LocationManager.GPS_PROVIDER
            )
        }


        if (
            manager.isProviderEnabled(
                LocationManager.NETWORK_PROVIDER
            )
        ) {

            providers.add(
                LocationManager.NETWORK_PROVIDER
            )
        }


        if (
            providers.isEmpty()
        ) {

            updateGpsText(
                "GPS • LOCATION OFF"
            )

            return
        }


        val generation = gpsGeneration
        locationListener =
            object :
                LocationListener {

                override fun onLocationChanged(
                    location: Location
                ) {

                    if (!positionResumed ||
                        generation != gpsGeneration ||
                        !AircraftPositionStore.isEnabled(this@PdfViewerActivity) ||
                        SimulatorLocationStore.isConnected()
                    ) return

                    lastGpsLocation =
                        location

                    updateGpsLabel()
                }
            }


        providers.forEach {
            provider ->

            try {

                manager.requestLocationUpdates(
                    provider,
                    2000L,
                    5f,
                    locationListener!!,
                    Looper.getMainLooper()
                )


            } catch (
                _: SecurityException
            ) {
            }
        }


        updateGpsLabel()
    }


    private fun stopGps() {
        // Invalidate queued callbacks even when no listener was registered.
        gpsGeneration++
        val manager = locationManager
        val listener = locationListener
        locationListener = null
        locationManager = null
        lastGpsLocation = null

        if (manager != null && listener != null) {
            try {
                manager.removeUpdates(listener)
            } catch (_: SecurityException) {
            }
        }
        if (::chartView.isInitialized) chartView.invalidate()
    }

    private fun updateGpsLabel() {

        if (
            !positionResumed ||
            !AircraftPositionStore.isEnabled(
                this
            )
        ) {
            return
        }


        if (
            SimulatorLocationStore.isConnected()
        ) {

            updateSimulatorLabel()

            return
        }


        if (
            lastGpsLocation == null
        ) {

            updateGpsText(
                "GPS • WAITING"
            )

            return
        }


        updateGpsText(
            "GPS • ACTIVE"
        )


        if (
            ::chartView.isInitialized
        ) {

            chartView.invalidate()
        }
    }


    private fun updateSimulatorLabel() {

        if (
            !positionResumed ||
            !AircraftPositionStore.isEnabled(
                this
            )
        ) {
            return
        }


        val position =
            SimulatorLocationStore.getPosition()


        if (
            position == null
        ) {

            updateGpsText(
                "SIM • WAITING"
            )

            return
        }


        updateGpsText(
            "SIM • ACTIVE"
        )


        if (
            ::chartView.isInitialized
        ) {

            chartView.invalidate()
        }
    }


    private fun updateGpsText(
        value: String
    ) {

        if (
            ::gpsText
                .isInitialized
        ) {

            gpsText.text =
                value
        }
    }


    private fun updateToolButtonStates() {

        if (
            !::toolScroll.isInitialized
        ) {
            return
        }


        val box =
            toolScroll.getChildAt(
                0
            ) as? LinearLayout
                ?: return


        for (
            i in
                0 until
                box.childCount
        ) {

            val view =
                box.getChildAt(
                    i
                ) as? TextView
                    ?: continue


            val tool =
                view.tag as? Tool
                    ?: continue


            val active =
                annotationTool ==
                    tool


            val tint =
                if (
                    active
                ) {

                    Color.rgb(
                        80,
                        225,
                        135
                    )

                } else {

                    Color.WHITE
                }


            view.setTextColor(
                tint
            )

            view.compoundDrawableTintList =
                android.content.res.ColorStateList
                    .valueOf(
                        tint
                    )
        }


        updateToolOptions()
    }


    private fun updateToggleButton(
        button: TextView,
        active: Boolean
    ) {

        button.setTextColor(
            if (
                active
            ) {

                Color.rgb(
                    80,
                    225,
                    135
                )

            } else {

                Color.WHITE
            }
        )
    }


    private fun showAnnotationColorDialog() {
        val labels = arrayOf("Pen", "Highlight", "Text")
        val names = arrayOf("Pink", "Yellow", "Blue", "Green", "White", "Black")
        val colors = intArrayOf(
            Color.rgb(255, 60, 130),
            Color.rgb(255, 220, 0),
            Color.rgb(60, 160, 255),
            Color.rgb(80, 225, 135),
            Color.WHITE,
            Color.BLACK
        )
        AlertDialog.Builder(this)
            .setTitle("Annotation color")
            .setItems(labels) { _, toolIndex ->
                AlertDialog.Builder(this)
                    .setTitle(labels[toolIndex])
                    .setItems(names) { _, colorIndex ->
                        when (toolIndex) {
                            0 -> penColor = colors[colorIndex]
                            1 -> highlightColor = Color.argb(
                                105,
                                Color.red(colors[colorIndex]),
                                Color.green(colors[colorIndex]),
                                Color.blue(colors[colorIndex])
                            )
                            2 -> textColor = colors[colorIndex]
                        }
                        chartView.invalidate()
                    }
                    .show()
            }
            .show()
    }


    private fun toolbarButton(
        text: String,
        size: Float
    ):
        TextView {

        return TextView(
            this
        ).apply {

            this.text =
                text

            textSize =
                size

            gravity =
                Gravity.CENTER

            setTextColor(
                Color.WHITE
            )

            isClickable =
                true

            isFocusable =
                true
        }
    }


    private fun toolButton(
        label: String,
        tool: Tool,
        iconRes: Int
    ):
        TextView {

        return TextView(
            this
        ).apply {

            text =
                label

            textSize =
                10f

            gravity =
                Gravity.CENTER

            setTextColor(
                Color.WHITE
            )

            setCompoundDrawablesWithIntrinsicBounds(
                iconRes,
                0,
                0,
                0
            )

            compoundDrawablePadding =
                4.dp

            tag =
                tool

            isClickable =
                true

            isFocusable =
                true


            setOnClickListener {

                if (
                    annotationTool ==
                    tool
                ) {

                    annotationTool =
                        null

                    annotationMode =
                        false

                } else {

                    annotationTool =
                        tool

                    annotationMode =
                        true

                    if (
                        tool ==
                        Tool.ERASER
                    ) {

                        eraserMode =
                            EraserMode.OBJECT
                    }
                }


                updateToolButtonStates()

                chartView.invalidate()
            }
        }
    }


    private fun toolbarButtonParams(
        width: Int
    ):
        LinearLayout.LayoutParams {

        return LinearLayout.LayoutParams(
            width,
            LinearLayout.LayoutParams.MATCH_PARENT
        )
    }


    private fun toolButtonParams(
        width: Int
    ):
        LinearLayout.LayoutParams {

        return LinearLayout.LayoutParams(
            width,
            LinearLayout.LayoutParams.MATCH_PARENT
        )
    }


    private fun roundedBackground(
        fill: Int,
        stroke: Int,
        radius: Int
    ):
        android.graphics.drawable
            .GradientDrawable {

        return android.graphics.drawable
            .GradientDrawable()
            .apply {

                shape =
                    android.graphics.drawable
                        .GradientDrawable
                        .RECTANGLE

                cornerRadius =
                    radius.dp.toFloat()

                setColor(
                    fill
                )

                setStroke(
                    1.dp,
                    stroke
                )
            }
    }


    private fun primaryTextColor():
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


    private fun surfaceColor():
        Int {

        return if (
            isDarkTheme()
        ) {

            Color.rgb(
                25,
                35,
                45
            )

        } else {

            Color.WHITE
        }
    }


    private fun dividerColor():
        Int {

        return if (
            isDarkTheme()
        ) {

            Color.rgb(
                55,
                70,
                84
            )

        } else {

            Color.rgb(
                224,
                230,
                236
            )
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


    private inner class ChartView(
        context: Context
    ) :
        View(
            context
        ) {

        private val touchSlop =
            ViewConfiguration
                .get(this@PdfViewerActivity)
                .scaledTouchSlop
                .toFloat()


        private var bitmap:
            Bitmap? =
            null

        private var previous:
            Bitmap? =
            null

        private var next:
            Bitmap? =
            null


        private var scale =
            1f

        private var offsetX =
            0f

        private var offsetY =
            0f


        private var swipeOffset =
            0f

        private var swiping =
            false


        private var contentLeft =
            0

        private var contentTop =
            0

        private var contentRight =
            0

        private var contentBottom =
            0


        private var inverted =
            false


        private var landscape =
            false


        private var downX =
            0f

        private var downY =
            0f

        private var lastX =
            0f

        private var lastY =
            0f

        private var swipeStartX =
            0f


        private var moved =
            false


        private var pinchDistance =
            0f


        private var selectedTextIndex =
            -1

        private var textDragActive =
            false

        private var textGestureStartCenter:
            PointF? =
            null


        private var textStartScale =
            1f

        private var textStartRotation =
            0f

        private var textStartX =
            0f

        private var textStartY =
            0f

        private var textStartDistance =
            0f

        private var textStartAngle =
            0f


        private var activePoints:
            MutableList<PointF>? =
            null


        private val strokes =
            mutableListOf<
                StoredStroke
            >()


        private val texts =
            mutableListOf<
                StoredText
            >()


        private val bitmapPaint =
            Paint(
                Paint.ANTI_ALIAS_FLAG or
                    Paint.FILTER_BITMAP_FLAG
            )


        private val strokePaint =
            Paint(
                Paint.ANTI_ALIAS_FLAG
            ).apply {

                style =
                    Paint.Style.STROKE

                strokeCap =
                    Paint.Cap.ROUND

                strokeJoin =
                    Paint.Join.ROUND
            }


        private val textPaint =
            Paint(
                Paint.ANTI_ALIAS_FLAG
            ).apply {

                color =
                    Color.rgb(
                        255,
                        60,
                        130
                    )

                typeface =
                    Typeface.DEFAULT_BOLD
            }


        private val selectionPaint =
            Paint(
                Paint.ANTI_ALIAS_FLAG
            ).apply {

                style =
                    Paint.Style.STROKE

                color =
                    Color.rgb(
                        80,
                        225,
                        135
                    )

                strokeWidth =
                    2.5f
            }


        fun releaseBitmap() {

            bitmap
                ?.takeIf {
                    !it.isRecycled
                }
                ?.recycle()


            previous
                ?.takeIf {
                    !it.isRecycled
                }
                ?.recycle()


            next
                ?.takeIf {
                    !it.isRecycled
                }
                ?.recycle()


            bitmap =
                null

            previous =
                null

            next =
                null


            invalidate()
        }


        fun setBitmap(
            value: Bitmap
        ) {

            bitmap
                ?.takeIf {
                    !it.isRecycled
                }
                ?.recycle()


            bitmap =
                value


            scale =
                1f

            offsetX =
                0f

            offsetY =
                0f

            swipeOffset =
                0f

            swiping =
                false


            selectedTextIndex =
                -1


            invalidate()
        }


        fun setNeighborBitmaps(
            previousBitmap: Bitmap?,
            nextBitmap: Bitmap?
        ) {

            previous =
                previousBitmap

            next =
                nextBitmap

            invalidate()
        }


        fun setInverted(
            value: Boolean
        ) {

            inverted =
                value


            bitmapPaint.colorFilter =
                if (
                    value
                ) {

                    ColorMatrixColorFilter(
                        ColorMatrix(
                            floatArrayOf(
                                -1f, 0f, 0f, 0f, 255f,
                                0f, -1f, 0f, 0f, 255f,
                                0f, 0f, -1f, 0f, 255f,
                                0f, 0f, 0f, 1f, 0f
                            )
                        )
                    )

                } else {

                    null
                }


            invalidate()
        }


        fun setContentInsets(
            left: Int,
            top: Int,
            right: Int,
            bottom: Int
        ) {

            contentLeft =
                left

            contentTop =
                top

            contentRight =
                right

            contentBottom =
                bottom


            invalidate()
        }


        fun setLandscapeMode(
            value: Boolean
        ) {

            landscape =
                value

            invalidate()
        }


        fun resetView() {

            scale =
                1f

            offsetX =
                0f

            offsetY =
                0f

            swipeOffset =
                0f

            swiping =
                false

            selectedTextIndex =
                -1

            invalidate()
        }


        fun getStrokes():
            List<StoredStroke> {

            return strokes.toList()
        }


        fun getTexts():
            List<StoredText> {

            return texts.toList()
        }


        fun clearAnnotationsInternal() {

            strokes.clear()

            texts.clear()

            activePoints =
                null

            selectedTextIndex =
                -1


            invalidate()
        }


        fun addStoredStroke(
            points:
                List<PointF>,
            highlight:
                Boolean,
            color:
                Int,
            width:
                Float
        ) {

            if (
                points.size >=
                2
            ) {

                strokes.add(
                    StoredStroke(
                        points
                            .map {
                                clampPointToImage(
                                    it
                                )
                            }
                            .toMutableList(),
                        highlight,
                        color,
                        width.coerceIn(
                            1f,
                            64f
                        )
                    )
                )
            }
        }


        fun addStoredText(
            text: String,
            x: Float,
            y: Float,
            scale: Float,
            rotation: Float,
            align: TextAlign,
            size: Float,
            color: Int
        ) {

            if (
                text.isBlank()
            ) {
                return
            }


            val safe =
                clampTextAnchor(
                    text,
                    x,
                    y,
                    scale,
                    rotation,
                    align,
                    size
                )


            texts.add(
                StoredText(
                    text,
                    safe.x,
                    safe.y,
                    scale.coerceIn(
                        0.25f,
                        8f
                    ),
                    rotation,
                    align,
                    size.coerceIn(
                        10f,
                        100f
                    ),
                    color
                )
            )
        }


        fun addTextAnnotation(
            text: String,
            x: Float,
            y: Float,
            align: TextAlign
        ) {

            addStoredText(
                text,
                x,
                y,
                1f,
                0f,
                align,
                textDefaultSize,
                textColor
            )
        }


        fun selectLastText() {

            selectedTextIndex =
                texts.lastIndex

            invalidate()
        }


        fun getTextAt(
            index: Int
        ):
            StoredText? {

            return texts.getOrNull(
                index
            )
        }


        override fun onDraw(
            canvas: Canvas
        ) {

            super.onDraw(
                canvas
            )


            canvas.drawColor(
                if (
                    inverted
                ) {

                    Color.WHITE

                } else {

                    Color.rgb(
                        14,
                        18,
                        23
                    )
                }
            )


            val image =
                bitmap
                    ?: return


            val viewport =
                viewportRect()


            if (
                viewport.width() <=
                0f ||
                viewport.height() <=
                0f
            ) {
                return
            }


            val baseScale =
                min(
                    viewport.width() /
                        image.width.toFloat(),
                    viewport.height() /
                        image.height.toFloat()
                )


            val finalScale =
                baseScale *
                    scale


            val width =
                image.width *
                    finalScale


            val height =
                image.height *
                    finalScale


            val left =
                viewport.centerX() -
                    width / 2f +
                    offsetX +
                    swipeOffset


            val top =
                viewport.centerY() -
                    height / 2f +
                    offsetY


            canvas.save()


            canvas.clipRect(
                viewport
            )


            if (
                swiping
            ) {

                previous?.let {

                    drawBitmapAt(
                        canvas,
                        it,
                        left -
                            viewport.width(),
                        top,
                        finalScale
                    )
                }


                next?.let {

                    drawBitmapAt(
                        canvas,
                        it,
                        left +
                            viewport.width(),
                        top,
                        finalScale
                    )
                }
            }


            canvas.drawBitmap(
                image,
                null,
                RectF(
                    left,
                    top,
                    left + width,
                    top + height
                ),
                bitmapPaint
            )


            canvas.save()


            canvas.translate(
                left,
                top
            )


            canvas.scale(
                finalScale,
                finalScale
            )


            drawAnnotations(
                canvas
            )


            activePoints?.let {

                drawPoints(
                    canvas,
                    it,
                    if (
                        annotationTool ==
                        Tool.HIGHLIGHT
                    ) {

                        highlightColor

                    } else {

                        penColor
                    },
                    if (
                        annotationTool ==
                        Tool.HIGHLIGHT
                    ) {

                        highlightWidth

                    } else {

                        penWidth
                    }
                )
            }


            drawAircraftPosition(
                canvas,
                image,
                finalScale
            )

            canvas.restore()

            canvas.restore()
        }


        private fun drawAircraftPosition(
            canvas: Canvas,
            image: Bitmap,
            displayScale: Float
        ) {

            if (
                !positionResumed ||
                !AircraftPositionStore.isEnabled(
                    this@PdfViewerActivity
                )
            ) {
                return
            }


            val position =
                if (
                    SimulatorLocationStore.isConnected()
                ) {

                    SimulatorLocationStore
                        .getPosition()
                        ?.let {

                            Triple(
                                it.latitude,
                                it.longitude,
                                it.headingDegrees
                            )
                        }

                } else {

                    lastGpsLocation
                        ?.let {

                            Triple(
                                it.latitude,
                                it.longitude,
                                it.bearing.toDouble()
                            )
                        }
                }
                    ?: return


            val geometry =
                renderGeometries[image]
                    ?: return


            val point =
                ChartGeoreferenceStore
                    .renderedPoint(
                        this@PdfViewerActivity,
                        currentChartGlobalPage(),
                        position.first,
                        position.second,
                        position.third
                            ?: 0.0,
                        repository.getDataVersion(),
                        geometry.pdfWidth,
                        geometry.pdfHeight,
                        geometry.fullWidth,
                        geometry.fullHeight,
                        geometry.cropTop,
                        image.width,
                        image.height
                    )
                    ?: return


            val safeScale =
                displayScale
                    .coerceAtLeast(
                        0.01f
                    )


            /*
             * Keep the marker a nearly constant on-screen size.
             * This prevents it from covering critical chart data
             * when the user zooms deeply into an approach plate.
             */
            val markerHalf =
                10.5f *
                    resources
                        .displayMetrics
                        .density /
                    safeScale


            val outlineWidth =
                1.35f *
                    resources
                        .displayMetrics
                        .density /
                    safeScale


            val phase =
                (
                    SystemClock.uptimeMillis() %
                        1800L
                    )
                    .toFloat() /
                    1800f


            val pulseProgress =
                (
                    0.5f -
                        0.5f *
                        kotlin.math.cos(
                            phase *
                                2f *
                                Math.PI
                                    .toFloat()
                        )
                    )


            val pulseRadius =
                markerHalf *
                    (
                        1.28f +
                            0.42f *
                            pulseProgress
                        )


            val pulsePaint =
                Paint(
                    Paint.ANTI_ALIAS_FLAG
                ).apply {

                    color =
                        Color.argb(
                            (
                                54 -
                                    28 *
                                    pulseProgress
                                )
                                .toInt()
                                .coerceIn(
                                    18,
                                    54
                                ),
                            255,
                            47,
                            157
                        )

                    style =
                        Paint.Style.FILL
                }


            val pulseStroke =
                Paint(
                    Paint.ANTI_ALIAS_FLAG
                ).apply {

                    color =
                        Color.argb(
                            (
                                145 -
                                    85 *
                                    pulseProgress
                                )
                                .toInt()
                                .coerceIn(
                                    45,
                                    145
                                ),
                            255,
                            54,
                            166
                        )

                    style =
                        Paint.Style.STROKE

                    strokeWidth =
                        outlineWidth
                }


            canvas.drawCircle(
                point.x,
                point.y,
                pulseRadius,
                pulsePaint
            )


            canvas.drawCircle(
                point.x,
                point.y,
                pulseRadius,
                pulseStroke
            )


            val markerPath =
                Path().apply {

                    moveTo(
                        0f,
                        -markerHalf
                    )

                    lineTo(
                        markerHalf *
                            0.62f,
                        markerHalf *
                            0.82f
                    )

                    lineTo(
                        0f,
                        markerHalf *
                            0.40f
                    )

                    lineTo(
                        -markerHalf *
                            0.62f,
                        markerHalf *
                            0.82f
                    )

                    close()
                }


            val shadowPaint =
                Paint(
                    Paint.ANTI_ALIAS_FLAG
                ).apply {

                    color =
                        Color.argb(
                            120,
                            5,
                            16,
                            26
                        )

                    style =
                        Paint.Style.FILL
                }


            val markerPaint =
                Paint(
                    Paint.ANTI_ALIAS_FLAG
                ).apply {

                    color =
                        Color.rgb(
                            244,
                            39,
                            151
                        )

                    style =
                        Paint.Style.FILL
                }


            val whiteOutline =
                Paint(
                    Paint.ANTI_ALIAS_FLAG
                ).apply {

                    color =
                        Color.argb(
                            245,
                            255,
                            255,
                            255
                        )

                    style =
                        Paint.Style.STROKE

                    strokeWidth =
                        outlineWidth

                    strokeJoin =
                        Paint.Join.ROUND
                }


            canvas.save()

            canvas.translate(
                point.x,
                point.y
            )

            canvas.rotate(
                point.headingDegrees
            )


            canvas.save()

            canvas.translate(
                markerHalf *
                    0.10f,
                markerHalf *
                    0.12f
            )

            canvas.drawPath(
                markerPath,
                shadowPaint
            )

            canvas.restore()


            canvas.drawPath(
                markerPath,
                markerPaint
            )

            canvas.drawPath(
                markerPath,
                whiteOutline
            )


            canvas.restore()


            /*
             * A gentle 12.5 fps pulse is enough to communicate live
             * position without burning battery or making the chart
             * feel visually busy.
             */
            postInvalidateDelayed(
                80L
            )
        }


        private fun drawBitmapAt (
            canvas: Canvas,
            image: Bitmap,
            left: Float,
            top: Float,
            scale: Float
        ) {

            if (
                image.isRecycled
            ) {
                return
            }


            val width =
                image.width *
                    scale


            val height =
                image.height *
                    scale


            canvas.drawBitmap(
                image,
                null,
                RectF(
                    left,
                    top,
                    left + width,
                    top + height
                ),
                bitmapPaint
            )
        }


        private fun drawAnnotations(
            canvas: Canvas
        ) {

            strokes.forEach {
                stroke ->

                drawPoints(
                    canvas,
                    stroke.points,
                    stroke.color,
                    stroke.width
                )
            }


            texts.forEachIndexed {
                index,
                item ->

                canvas.save()


                canvas.translate(
                    item.x,
                    item.y
                )


                canvas.rotate(
                    item.rotation
                )


                canvas.scale(
                    item.scale,
                    item.scale
                )


                textPaint.color = item.color
                textPaint.textSize = item.size


                textPaint.textAlign =
                    when (
                        item.align
                    ) {

                        TextAlign.LEFT ->
                            Paint.Align.LEFT

                        TextAlign.CENTER ->
                            Paint.Align.CENTER

                        TextAlign.RIGHT ->
                            Paint.Align.RIGHT
                    }


                val lines =
                    item.text.split(
                        "\n"
                    )


                val lineHeight =
                    item.size *
                        1.25f


                lines.forEachIndexed {
                    lineIndex,
                    line ->

                    canvas.drawText(
                        line,
                        0f,
                        lineHeight *
                            (lineIndex + 1),
                        textPaint
                    )
                }


                if (
                    index ==
                    selectedTextIndex
                ) {

                    canvas.drawRect(
                        measureTextBounds(
                            item
                        ),
                        selectionPaint
                    )
                }


                canvas.restore()
            }
        }


        private fun drawPoints(
            canvas: Canvas,
            points: List<PointF>,
            color: Int,
            width: Float
        ) {

            if (
                points.size <
                2
            ) {
                return
            }


            strokePaint.color =
                color

            strokePaint.strokeWidth =
                width


            val path =
                Path()


            path.moveTo(
                points.first().x,
                points.first().y
            )


            for (
                i in
                    1 until
                    points.size
            ) {

                path.lineTo(
                    points[i].x,
                    points[i].y
                )
            }


            canvas.drawPath(
                path,
                strokePaint
            )
        }


        private fun measureTextBounds(
            item: StoredText
        ):
            RectF {

            textPaint.textSize =
                item.size


            val lines =
                item.text.split(
                    "\n"
                )


            var width =
                1f


            lines.forEach {

                width =
                    max(
                        width,
                        textPaint.measureText(
                            it
                        )
                    )
            }


            val height =
                item.size *
                    1.25f *
                    lines.size


            return when (
                item.align
            ) {

                TextAlign.LEFT ->
                    RectF(
                        -10f,
                        -4f,
                        width + 10f,
                        height + 8f
                    )


                TextAlign.CENTER ->
                    RectF(
                        -width / 2f - 10f,
                        -4f,
                        width / 2f + 10f,
                        height + 8f
                    )


                TextAlign.RIGHT ->
                    RectF(
                        -width - 10f,
                        -4f,
                        10f,
                        height + 8f
                    )
            }
        }


        private fun viewportRect():
            RectF {

            return RectF(
                contentLeft.toFloat(),
                contentTop.toFloat(),
                (
                    width -
                        contentRight
                ).toFloat(),
                (
                    height -
                        contentBottom
                ).toFloat()
            )
        }


        fun screenToImage(
            x: Float,
            y: Float
        ):
            PointF? {

            val image =
                bitmap
                    ?: return null


            val viewport =
                viewportRect()


            val baseScale =
                min(
                    viewport.width() /
                        image.width.toFloat(),
                    viewport.height() /
                        image.height.toFloat()
                )


            val finalScale =
                baseScale *
                    scale


            if (
                finalScale <=
                0f
            ) {
                return null
            }


            val imageWidth =
                image.width *
                    finalScale


            val imageHeight =
                image.height *
                    finalScale


            val left =
                viewport.centerX() -
                    imageWidth / 2f +
                    offsetX +
                    swipeOffset


            val top =
                viewport.centerY() -
                    imageHeight / 2f +
                    offsetY


            return PointF(
                (
                    x - left
                ) / finalScale,
                (
                    y - top
                ) / finalScale
            )
        }


        fun isInsideImage(
            point: PointF?
        ):
            Boolean {

            val image =
                bitmap
                    ?: return false


            point
                ?: return false


            return point.x >=
                0f &&
                point.y >=
                0f &&
                point.x <=
                image.width &&
                point.y <=
                image.height
        }


        private fun clampPointToImage(
            point: PointF
        ):
            PointF {

            val image =
                bitmap


            if (
                image == null
            ) {

                return PointF(
                    point.x,
                    point.y
                )
            }


            return PointF(
                point.x.coerceIn(
                    0f,
                    image.width.toFloat()
                ),
                point.y.coerceIn(
                    0f,
                    image.height.toFloat()
                )
            )
        }


        fun clampTextAnchor(
            text: String,
            x: Float,
            y: Float,
            scale: Float,
            rotation: Float,
            align: TextAlign,
            size: Float
        ):
            PointF {

            val image =
                bitmap
                    ?: return PointF(
                        x,
                        y
                    )


            textPaint.textSize =
                size


            val lines =
                text.split(
                    "\n"
                )


            var maxWidth =
                1f


            lines.forEach {

                maxWidth =
                    max(
                        maxWidth,
                        textPaint.measureText(
                            it
                        )
                    )
            }


            val height =
                size *
                    1.25f *
                    lines.size


            val safeX =
                x.coerceIn(
                    maxWidth *
                        scale /
                        2f +
                        16f,
                    image.width -
                        maxWidth *
                        scale /
                        2f -
                        16f
                )


            val safeY =
                y.coerceIn(
                    height *
                        scale /
                        2f +
                        16f,
                    image.height -
                        height *
                        scale /
                        2f -
                        16f
                )


            return PointF(
                safeX,
                safeY
            )
        }


        private fun findTextAt(
            screenX: Float,
            screenY: Float
        ):
            Int {

            val imagePoint =
                screenToImage(
                    screenX,
                    screenY
                )
                    ?: return -1


            if (
                !isInsideImage(
                    imagePoint
                )
            ) {
                return -1
            }


            for (
                i in
                    texts.indices
                        .reversed()
            ) {

                val item =
                    texts[i]


                val dx =
                    imagePoint.x -
                        item.x


                val dy =
                    imagePoint.y -
                        item.y


                val angle =
                    Math.toRadians(
                        (-item.rotation)
                            .toDouble()
                    )


                val localX =
                    (
                        dx *
                            cos(angle) -
                            dy *
                            sin(angle)
                        ) /
                        item.scale


                val localY =
                    (
                        dx *
                            sin(angle) +
                            dy *
                            cos(angle)
                        ) /
                        item.scale


                if (
                    measureTextBounds(
                        item
                    ).contains(
                        localX.toFloat(),
                            localY.toFloat()
                    )
                ) {

                    return i
                }
            }


            return -1
        }


        private fun findStrokeAt(
            screenX: Float,
            screenY: Float
        ):
            Int {

            val point =
                screenToImage(
                    screenX,
                    screenY
                )
                    ?: return -1


            if (
                !isInsideImage(
                    point
                )
            ) {
                return -1
            }


            val radius =
                32f /
                    scale.coerceAtLeast(
                        1f
                    )


            for (
                i in
                    strokes.indices
                        .reversed()
            ) {

                if (
                    strokes[i]
                        .points
                        .any {

                            val dx =
                                it.x -
                                    point.x


                            val dy =
                                it.y -
                                    point.y


                            dx * dx +
                                dy * dy <=
                                radius *
                                radius
                        }
                ) {

                    return i
                }
            }


            return -1
        }


        private fun eraseObjectAt(
            x: Float,
            y: Float
        ) {

            val textIndex =
                findTextAt(
                    x,
                    y
                )


            if (
                textIndex >=
                0
            ) {

                texts.removeAt(
                    textIndex
                )


                selectedTextIndex =
                    -1


                saveAnnotationsForCurrentChart()

                invalidate()

                return
            }


            val strokeIndex =
                findStrokeAt(
                    x,
                    y
                )


            if (
                strokeIndex >=
                0
            ) {

                strokes.removeAt(
                    strokeIndex
                )


                saveAnnotationsForCurrentChart()

                invalidate()
            }
        }


        private fun erasePixelAt(
            x: Float,
            y: Float
        ) {

            val point =
                screenToImage(
                    x,
                    y
                )
                    ?: return


            val radius =
                34f /
                    scale.coerceAtLeast(
                        1f
                    )


            val rebuilt =
                mutableListOf<
                    StoredStroke
                >()


            strokes.forEach {
                stroke ->

                var segment =
                    mutableListOf<
                        PointF
                    >()


                stroke.points.forEach {

                    val dx =
                        it.x -
                            point.x


                    val dy =
                        it.y -
                            point.y


                    val erased =
                        dx * dx +
                            dy * dy <=
                            radius *
                            radius


                    if (
                        erased
                    ) {

                        if (
                            segment.size >=
                            2
                        ) {

                            rebuilt.add(
                                StoredStroke(
                                    segment,
                                    stroke.highlight,
                                    stroke.color,
                                    stroke.width
                                )
                            )
                        }


                        segment =
                            mutableListOf()

                    } else {

                        segment.add(
                            PointF(
                                it.x,
                                it.y
                            )
                        )
                    }
                }


                if (
                    segment.size >=
                    2
                ) {

                    rebuilt.add(
                        StoredStroke(
                            segment,
                            stroke.highlight,
                            stroke.color,
                            stroke.width
                        )
                    )
                }
            }


            strokes.clear()

            strokes.addAll(
                rebuilt
            )


            saveAnnotationsForCurrentChart()

            invalidate()
        }


        private fun pointerDistance(
            event: MotionEvent
        ):
            Float {

            if (
                event.pointerCount <
                2
            ) {

                return 0f
            }


            val dx =
                event.getX(0) -
                    event.getX(1)


            val dy =
                event.getY(0) -
                    event.getY(1)


            return sqrt(
                dx * dx +
                    dy * dy
            )
        }


        private fun pointerAngle(
            event: MotionEvent
        ):
            Float {

            if (
                event.pointerCount <
                2
            ) {

                return 0f
            }


            val dx =
                event.getX(1) -
                    event.getX(0)


            val dy =
                event.getY(1) -
                    event.getY(0)


            return Math.toDegrees(
                atan2(
                    dy.toDouble(),
                    dx.toDouble()
                )
            ).toFloat()
        }


        private fun pointerCenter(
            event: MotionEvent
        ):
            PointF {

            if (
                event.pointerCount <
                2
            ) {

                return PointF(
                    event.x,
                    event.y
                )
            }


            return PointF(
                (
                    event.getX(0) +
                        event.getX(1)
                    ) / 2f,
                (
                    event.getY(0) +
                        event.getY(1)
                    ) / 2f
            )
        }


        private fun constrainPan() {

            val image =
                bitmap
                    ?: return


            if (
                scale <=
                1.02f
            ) {

                scale =
                    1f

                offsetX =
                    0f

                offsetY =
                    0f

                return
            }


            val viewport =
                viewportRect()


            val baseScale =
                min(
                    viewport.width() /
                        image.width.toFloat(),
                    viewport.height() /
                        image.height.toFloat()
                )


            val finalScale =
                baseScale *
                    scale


            val imageWidth =
                image.width *
                    finalScale


            val imageHeight =
                image.height *
                    finalScale


            val maxX =
                max(
                    0f,
                    (
                        imageWidth -
                            viewport.width()
                        ) / 2f
                )


            val maxY =
                max(
                    0f,
                    (
                        imageHeight -
                            viewport.height()
                        ) / 2f
                )


            offsetX =
                offsetX.coerceIn(
                    -maxX,
                    maxX
                )


            offsetY =
                offsetY.coerceIn(
                    -maxY,
                    maxY
                )
        }


        override fun onTouchEvent(
            event: MotionEvent
        ):
            Boolean {

            when (
                event.actionMasked
            ) {

                MotionEvent.ACTION_DOWN -> {

                    downX =
                        event.x

                    downY =
                        event.y

                    lastX =
                        event.x

                    lastY =
                        event.y

                    swipeStartX =
                        event.x

                    moved =
                        false

                    swiping =
                        false

                    swipeOffset =
                        0f


                    if (
                        annotationTool ==
                        null
                    ) {

                        val hit =
                            findTextAt(
                                event.x,
                                event.y
                            )


                        if (
                            hit >=
                            0
                        ) {

                            selectedTextIndex =
                                hit

                            textDragActive =
                                true

                        } else {

                            textDragActive =
                                false
                        }

                    } else {

                        textDragActive =
                            false
                    }


                    when (
                        annotationTool
                    ) {

                        Tool.TEXT -> {

                            val point =
                                screenToImage(
                                    event.x,
                                    event.y
                                )


                            if (
                                isInsideImage(
                                    point
                                )
                            ) {

                                showTextDialog(
                                    point!!.x,
                                    point.y
                                )
                            }


                            return true
                        }


                        Tool.PEN,
                        Tool.HIGHLIGHT -> {

                            val point =
                                screenToImage(
                                    event.x,
                                    event.y
                                )


                            activePoints =
                                if (
                                    isInsideImage(
                                        point
                                    )
                                ) {

                                    mutableListOf(
                                        clampPointToImage(
                                            point!!
                                        )
                                    )

                                } else {

                                    null
                                }


                            return true
                        }


                        Tool.ERASER -> {

                            if (
                                eraserMode ==
                                EraserMode.OBJECT
                            ) {

                                eraseObjectAt(
                                    event.x,
                                    event.y
                                )

                            } else {

                                erasePixelAt(
                                    event.x,
                                    event.y
                                )
                            }


                            return true
                        }


                        null -> {

                            return true
                        }
                    }
                }


                MotionEvent.ACTION_POINTER_DOWN -> {

                    if (
                        event.pointerCount >=
                        2 &&
                        annotationTool == null &&
                        selectedTextIndex >=
                        0
                    ) {

                        val item =
                            texts[
                                selectedTextIndex
                            ]


                        textStartDistance =
                            pointerDistance(
                                event
                            )


                        textStartAngle =
                            pointerAngle(
                                event
                            )


                        textStartScale =
                            item.scale


                        textStartRotation =
                            item.rotation


                        textStartX =
                            item.x


                        textStartY =
                            item.y


                        val gestureCenter =
                            pointerCenter(
                                event
                            )


                        textGestureStartCenter =
                            screenToImage(
                                gestureCenter.x,
                                gestureCenter.y
                            )
                    }


                    pinchDistance =
                        pointerDistance(
                            event
                        )


                    activePoints =
                        null


                    return true
                }


                MotionEvent.ACTION_MOVE -> {

                    if (
                        event.pointerCount >=
                        2
                    ) {

                        if (
                            annotationTool == null &&
                            selectedTextIndex >=
                            0
                        ) {

                            val item =
                                texts[
                                    selectedTextIndex
                                ]


                            val distance =
                                pointerDistance(
                                    event
                                )


                            if (
                                textStartDistance >
                                0f
                            ) {

                                item.scale =
                                    (
                                        textStartScale *
                                            distance /
                                            textStartDistance
                                        )
                                        .coerceIn(
                                            0.25f,
                                            8f
                                        )
                            }


                            item.rotation =
                                textStartRotation +
                                    (
                                        pointerAngle(
                                            event
                                        ) -
                                            textStartAngle
                                        )


                            val center =
                                pointerCenter(
                                    event
                                )


                            val start =
                                textGestureStartCenter


                            val current =
                                screenToImage(
                                    center.x,
                                    center.y
                                )


                            if (
                                start !=
                                    null &&
                                current !=
                                    null
                            ) {

                                val safe =
                                    clampTextAnchor(
                                        item.text,
                                        textStartX +
                                            current.x -
                                            start.x,
                                        textStartY +
                                            current.y -
                                            start.y,
                                        item.scale,
                                        item.rotation,
                                        item.align,
                                        item.size
                                    )


                                item.x =
                                    safe.x

                                item.y =
                                    safe.y


                                saveAnnotationsForCurrentChart()
                            }


                            invalidate()

                            return true
                        }


                        val currentDistance =
                            pointerDistance(
                                event
                            )


                        if (
                            pinchDistance >
                            0f
                        ) {

                            scale =
                                (
                                    scale *
                                        currentDistance /
                                        pinchDistance
                                    )
                                    .coerceIn(
                                        1f,
                                        MAX_ZOOM
                                    )


                            pinchDistance =
                                currentDistance


                            constrainPan()


                            invalidate()
                        }


                        return true
                    }


                    val dx =
                        event.x -
                            lastX


                    val dy =
                        event.y -
                            lastY


                    if (
                        !moved &&
                        (
                            abs(
                                event.x -
                                    downX
                            ) > touchSlop ||
                            abs(
                                event.y -
                                    downY
                            ) > touchSlop
                        )
                    ) {

                        moved =
                            true
                    }


                    when (
                        annotationTool
                    ) {

                        Tool.PEN,
                        Tool.HIGHLIGHT -> {

                            val point =
                                screenToImage(
                                    event.x,
                                    event.y
                                )


                            if (
                                point !=
                                null
                            ) {

                                activePoints
                                    ?.add(
                                        clampPointToImage(
                                            point
                                        )
                                    )
                            }


                            invalidate()
                        }


                        null -> {

                            if (
                                selectedTextIndex >=
                                0 &&
                                textDragActive &&
                                moved
                            ) {

                                val current =
                                    screenToImage(
                                        event.x,
                                        event.y
                                    )


                                val previousPoint =
                                    screenToImage(
                                        lastX,
                                        lastY
                                    )


                                if (
                                    current !=
                                        null &&
                                    previousPoint !=
                                        null
                                ) {

                                    val item =
                                        texts[
                                            selectedTextIndex
                                        ]


                                    val safe =
                                        clampTextAnchor(
                                            item.text,
                                            item.x +
                                                current.x -
                                                previousPoint.x,
                                            item.y +
                                                current.y -
                                                previousPoint.y,
                                            item.scale,
                                            item.rotation,
                                            item.align,
                                            item.size
                                        )


                                    item.x =
                                        safe.x

                                    item.y =
                                        safe.y


                                    saveAnnotationsForCurrentChart()
                                }

                            } else if (
                                !moved
                            ) {

                                // Ignore tiny finger jitter during a tap.
                                // A tap must not move the chart even by one pixel.

                            } else if (
                                scale >
                                1.02f
                            ) {

                                offsetX +=
                                    dx

                                offsetY +=
                                    dy


                                constrainPan()

                            } else {

                                val canGoPrevious =
                                    currentChartIndex >
                                        0


                                val canGoNext =
                                    currentChartIndex <
                                        airportCharts.size - 1


                                if (
                                    canGoPrevious ||
                                    canGoNext
                                ) {

                                    swiping =
                                        true


                                    swipeOffset =
                                        (
                                            event.x -
                                                swipeStartX
                                            )
                                            .coerceIn(
                                                -width.toFloat(),
                                                width.toFloat()
                                            )
                                }
                            }


                            invalidate()
                        }


                        Tool.ERASER -> {

                            if (
                                eraserMode ==
                                EraserMode.OBJECT
                            ) {

                                eraseObjectAt(
                                    event.x,
                                    event.y
                                )

                            } else {

                                erasePixelAt(
                                    event.x,
                                    event.y
                                )
                            }
                        }


                        Tool.TEXT -> {
                        }
                    }


                    lastX =
                        event.x

                    lastY =
                        event.y


                    return true
                }


                MotionEvent.ACTION_UP -> {

                    when (
                        annotationTool
                    ) {

                        Tool.PEN,
                        Tool.HIGHLIGHT -> {

                            val points =
                                activePoints


                            if (
                                points !=
                                    null &&
                                points.size >=
                                    2
                            ) {

                                strokes.add(
                                    StoredStroke(
                                        points
                                            .map {
                                                clampPointToImage(
                                                    it
                                                )
                                            }
                                            .toMutableList(),
                                        annotationTool ==
                                            Tool.HIGHLIGHT,
                                        if (
                                            annotationTool ==
                                            Tool.HIGHLIGHT
                                        ) {

                                            highlightColor

                                        } else {

                                            penColor
                                        },
                                        if (
                                            annotationTool ==
                                            Tool.HIGHLIGHT
                                        ) {

                                            highlightWidth

                                        } else {

                                            penWidth
                                        }
                                    )
                                )


                                saveAnnotationsForCurrentChart()
                            }


                            activePoints =
                                null


                            invalidate()


                            return true
                        }


                        null -> {

                            if (
                                selectedTextIndex >=
                                0 &&
                                textDragActive &&
                                !moved
                            ) {

                                showTextEditDialog(
                                    selectedTextIndex
                                )


                                return true
                            }


                            if (
                                selectedTextIndex >=
                                0 &&
                                !textDragActive &&
                                !moved
                            ) {

                                selectedTextIndex =
                                    -1

                                invalidate()

                                return true
                            }


                            if (
                                !moved
                            ) {

                                swiping =
                                    false

                                swipeOffset =
                                    0f

                                performClick()

                            } else if (
                                scale <=
                                1.02f &&
                                swiping
                            ) {

                                val distance =
                                    event.x -
                                        swipeStartX


                                val threshold =
                                    width *
                                        SWIPE_THRESHOLD


                                if (
                                    distance <
                                    -threshold &&
                                    currentChartIndex <
                                    airportCharts.size - 1
                                ) {

                                    animateSwipe(
                                        1
                                    )

                                } else if (
                                    distance >
                                    threshold &&
                                    currentChartIndex >
                                    0
                                ) {

                                    animateSwipe(
                                        -1
                                    )

                                } else {

                                    returnToCenter()
                                }

                            } else {

                                swiping =
                                    false

                                swipeOffset =
                                    0f

                                invalidate()
                            }


                            return true
                        }


                        else -> {

                            return true
                        }
                    }
                }


                MotionEvent.ACTION_CANCEL -> {

                    activePoints =
                        null

                    returnToCenter()

                    return true
                }
            }


            return true
        }


        private fun animateSwipe(
            direction: Int
        ) {

            val target =
                if (
                    direction > 0
                ) {

                    -width.toFloat()

                } else {

                    width.toFloat()
                }


            ValueAnimator
                .ofFloat(
                    swipeOffset,
                    target
                )
                .apply {

                    duration =
                        180L

                    interpolator =
                        DecelerateInterpolator()


                    addUpdateListener {
                        value ->

                        swipeOffset =
                            value
                                .animatedValue
                                as Float


                        invalidate()
                    }


                    addListener(
                        object :
                            AnimatorListenerAdapter() {

                            override fun onAnimationEnd(
                                animation:
                                    Animator
                            ) {

                                swiping =
                                    false

                                swipeOffset =
                                    0f


                                navigateWithinAirport(
                                    direction
                                )
                            }


                            override fun onAnimationCancel(
                                animation:
                                    Animator
                            ) {

                                swiping =
                                    false

                                swipeOffset =
                                    0f

                                invalidate()
                            }
                        }
                    )


                    start()
                }
        }


        private fun returnToCenter() {

            ValueAnimator
                .ofFloat(
                    swipeOffset,
                    0f
                )
                .apply {

                    duration =
                        150L

                    interpolator =
                        DecelerateInterpolator()


                    addUpdateListener {
                        value ->

                        swipeOffset =
                            value
                                .animatedValue
                                as Float


                        invalidate()
                    }


                    addListener(
                        object :
                            AnimatorListenerAdapter() {

                            override fun onAnimationEnd(
                                animation:
                                    Animator
                            ) {

                                swiping =
                                    false

                                swipeOffset =
                                    0f

                                invalidate()
                            }


                            override fun onAnimationCancel(
                                animation:
                                    Animator
                            ) {

                                swiping =
                                    false

                                swipeOffset =
                                    0f

                                invalidate()
                            }
                        }
                    )


                    start()
                }
        }


        override fun performClick():
            Boolean {

            super.performClick()


            if (
                annotationTool == null
            ) {

                toggleViewerControls()
            }


            return true
        }
    }


    private fun showError(
        message: String
    ) {

        AlertDialog.Builder(
            this
        )
            .setTitle(
                "JeppIran"
            )
            .setMessage(
                message
            )
            .setPositiveButton(
                "OK",
                null
            )
            .show()
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
