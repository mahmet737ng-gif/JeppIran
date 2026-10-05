package com.tareghmsr.jeppiran

import android.Manifest
import android.app.AlertDialog
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.pm.ActivityInfo
import android.content.pm.PackageManager
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
import android.text.InputType
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.view.animation.DecelerateInterpolator
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.ComponentActivity
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
    ComponentActivity() {

    companion object {

        private const val PDF_URL =
            "https://media.githubusercontent.com/media/mahmet737ng-gif/JeppIran/main/Iran2620.pdf"

        private const val PDF_FILE_NAME =
            "Iran2620.pdf"

        private const val CHART_DATA_VERSION =
            "v16"

        private const val ANNOTATION_PREFS =
            "jeppiran_annotations"

        private const val GPS_PERMISSION_REQUEST =
            7001

        private const val METAR_TIMEOUT =
            15000

        private const val TOP_CROP_PERCENT =
            0.014f
    }

    private var renderer:
        PdfRenderer? = null

    private var descriptor:
        ParcelFileDescriptor? = null

    private var currentPage =
        0

    private var totalPages =
        0

    private var chartTitle =
        ""

    private var icao =
        ""

    private var airportName =
        ""

    private var city =
        ""

    private var category =
        ""

    private val airportCharts =
        mutableListOf<ChartRepository.ChartInfo>()

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

    private lateinit var titleText:
        TextView

    private lateinit var pageText:
        TextView

    private lateinit var metarBanner:
        TextView

    private lateinit var gpsText:
        TextView

    private lateinit var loadingText:
        TextView

    private lateinit var progressBar:
        ProgressBar

    private var invertChart =
        false

    private var controlsVisible =
        true

    private var annotationMode =
        false

    private var annotationTool =
        Tool.SELECT

    private var eraserMode =
        EraserMode.OBJECT

    private var previousBitmap:
        Bitmap? = null

    private var nextBitmap:
        Bitmap? = null

    private var neighborsLoading =
        false

    private var metarRequestId =
        0

    private var metarRemoveRunnable:
        Runnable? = null

    private var locationManager:
        LocationManager? = null

    private var locationListener:
        LocationListener? = null

    private var lastGpsLocation:
        Location? = null

    private val handler =
        Handler(
            Looper.getMainLooper()
        )

    private enum class Tool {
        SELECT,
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
            Boolean
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
        val align:
            TextAlign,
        val size:
            Float = 20f
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

        repository =
            ChartRepository(
                this
            )

        currentPage =
            savedInstanceState?.getInt(
                "CURRENT_PAGE"
            )
                ?: (
                    intent.getIntExtra(
                        "PAGE",
                        1
                    ) - 1
                ).coerceAtLeast(
                    0
                )

        chartTitle =
            savedInstanceState?.getString(
                "TITLE"
            )
                ?: intent
                    .getStringExtra(
                        "TITLE"
                    )
                    .orEmpty()

        icao =
            intent
                .getStringExtra(
                    "ICAO"
                )
                .orEmpty()
                .trim()
                .uppercase(
                    Locale.US
                )

        airportName =
            savedInstanceState?.getString(
                "AIRPORT_NAME"
            )
                ?: intent
                    .getStringExtra(
                        "AIRPORT_NAME"
                    )
                    .orEmpty()

        city =
            intent
                .getStringExtra(
                    "CITY"
                )
                .orEmpty()

        category =
            intent
                .getStringExtra(
                    "CATEGORY"
                )
                .orEmpty()

        repository
            .airport(
                icao
            )
            ?.let { airport ->

                if (
                    airportName.isBlank()
                ) {
                    airportName =
                        airport.airportName
                }

                if (
                    city.isBlank()
                ) {
                    city =
                        airport.city
                }
            }

        loadAirportCharts()

        WindowCompat.setDecorFitsSystemWindows(
            window,
            false
        )

        window.statusBarColor =
            Color.TRANSPARENT

        window.navigationBarColor =
            Color.TRANSPARENT

        val file =
            File(
                filesDir,
                PDF_FILE_NAME
            )

        if (
            file.exists() &&
            file.length() > 0
        ) {

            buildViewerUi()

            openPdf(
                file
            )

        } else {

            buildDownloadUi()

            downloadPdf(
                file
            )
        }
    }

    override fun onSaveInstanceState(
        outState: Bundle
    ) {

        outState.putInt(
            "CURRENT_PAGE",
            currentPage
        )

        outState.putString(
            "TITLE",
            chartTitle
        )

        outState.putString(
            "AIRPORT_NAME",
            airportName
        )

        super.onSaveInstanceState(
            outState
        )
    }

    override fun onDestroy() {

        metarRemoveRunnable?.let {
            handler.removeCallbacks(
                it
            )
        }

        stopGps()

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

        super.onDestroy()
    }

    private fun buildDownloadUi() {

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
                    32.dp,
                    32.dp,
                    32.dp,
                    32.dp
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
            }

        loadingText =
            TextView(
                this
            ).apply {

                text =
                    "Downloading chart database..."

                textSize =
                    16f

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
                280.dp,
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

    private fun downloadPdf(
        file: File
    ) {

        thread {

            var connection:
                HttpURLConnection? =
                null

            try {

                connection =
                    URL(
                        PDF_URL
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

                val total =
                    connection.contentLengthLong

                val temporary =
                    File(
                        filesDir,
                        "$PDF_FILE_NAME.tmp"
                    )

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

                        while (true) {

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
                                            "Downloading PDF... $percent%"
                                    }
                                }
                            }
                        }
                    }
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

                    buildViewerUi()

                    openPdf(
                        file
                    )
                }

            } catch (
                error: Exception
            ) {

                runOnUiThread {

                    if (
                        ::loadingText
                            .isInitialized
                    ) {

                        loadingText.text =
                            "Download failed:\n${error.message}"

                        progressBar.visibility =
                            View.GONE
                    }
                }

            } finally {

                connection?.disconnect()
            }
        }
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

        buildMetarBanner()

        gpsText =
            TextView(
                this
            ).apply {

                textSize =
                    11f

                setTextColor(
                    Color.WHITE
                )

                setBackgroundColor(
                    Color.argb(
                        170,
                        12,
                        20,
                        28
                    )
                )

                setPadding(
                    10.dp,
                    6.dp,
                    10.dp,
                    6.dp
                )

                gravity =
                    Gravity.CENTER

                text =
                    "GPS: waiting..."
            }

        val gpsParams =
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
            ).apply {

                gravity =
                    Gravity.BOTTOM or
                        Gravity.END

                setMargins(
                    0,
                    0,
                    12.dp,
                    12.dp
                )
            }

        root.addView(
            gpsText,
            gpsParams
        )

        setContentView(
            root
        )

        applyInsets()

        startGps()
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

                setPadding(
                    4.dp,
                    0,
                    4.dp,
                    0
                )

                setBackgroundColor(
                    Color.rgb(
                        17,
                        25,
                        33
                    )
                )

                elevation =
                    9.dp.toFloat()
            }

        val back =
            toolbarButton(
                "‹",
                20f
            )

        back.contentDescription =
            "Back"

        back.setOnClickListener {
            finish()
        }

        topToolbar.addView(
            back,
            toolbarButtonParams(
                42.dp
            )
        )

        val search =
            toolbarButton(
                "⌕",
                22f
            )

        search.contentDescription =
            "Search charts"

        search.setOnClickListener {
            showSearchDialog()
        }

        topToolbar.addView(
            search,
            toolbarButtonParams(
                42.dp
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

                textSize =
                    14f

                maxLines =
                    2

                typeface =
                    Typeface.DEFAULT_BOLD

                gravity =
                    Gravity.CENTER_VERTICAL

                setTextColor(
                    Color.WHITE
                )

                setPadding(
                    6.dp,
                    0,
                    6.dp,
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

                setPadding(
                    4.dp,
                    0,
                    4.dp,
                    0
                )
            }

        topToolbar.addView(
            pageText,
            LinearLayout.LayoutParams(
                92.dp,
                LinearLayout.LayoutParams.MATCH_PARENT
            )
        )

        val previous =
            toolbarButton(
                "◀",
                16f
            )

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
            toolbarButton(
                "▶",
                16f
            )

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

                chartView
                    .setInverted(
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

                overScrollMode =
                    View.OVER_SCROLL_IF_CONTENT_SCROLLS

                setBackgroundColor(
                    Color.rgb(
                        21,
                        30,
                        39
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

        val select =
            toolButton(
                "SELECT",
                Tool.SELECT
            )

        val pen =
            toolButton(
                "PEN",
                Tool.PEN
            )

        val highlight =
            toolButton(
                "HIGHLIGHT",
                Tool.HIGHLIGHT
            )

        val text =
            toolButton(
                "TEXT",
                Tool.TEXT
            )

        val eraser =
            toolButton(
                "ERASER",
                Tool.ERASER
            )

        val clear =
            toolbarButton(
                "CLR",
                11f
            )

        clear.setOnClickListener {
            showClearAllDialog()
        }

        tools.addView(
            select,
            toolButtonParams()
        )

        tools.addView(
            pen,
            toolButtonParams()
        )

        tools.addView(
            highlight,
            toolButtonParams(
                90.dp
            )
        )

        tools.addView(
            text,
            toolButtonParams()
        )

        tools.addView(
            eraser,
            toolButtonParams(
                76.dp
            )
        )

        tools.addView(
            clear,
            toolbarButtonParams(
                50.dp
            )
        )

        toolScroll.addView(
            tools,
            HorizontalScrollView.LayoutParams(
                HorizontalScrollView.LayoutParams.WRAP_CONTENT,
                HorizontalScrollView.LayoutParams.MATCH_PARENT
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

        updateToolButtonStates()
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

                setPadding(
                    14.dp,
                    9.dp,
                    14.dp,
                    9.dp
                )

                gravity =
                    Gravity.CENTER_VERTICAL

                background =
                    roundedBackground(
                        Color.argb(
                            225,
                            22,
                            44,
                            56
                        ),
                        Color.rgb(
                            75,
                            205,
                            205
                        ),
                        14.dp
                    )

                visibility =
                    View.GONE

                setOnTouchListener(
                    object :
                        View.OnTouchListener {

                        override fun onTouch(
                            v: View?,
                            event: MotionEvent?
                        ): Boolean {

                            when (
                                event?.actionMasked
                            ) {

                                MotionEvent.ACTION_DOWN -> {
                                    return true
                                }

                                MotionEvent.ACTION_MOVE -> {
                                    return true
                                }

                                MotionEvent.ACTION_UP -> {

                                    hideMetarBanner(
                                        true
                                    )

                                    return true
                                }
                            }

                            return true
                        }
                    }
                )
            }

        val params =
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

        root.addView(
            metarBanner,
            params
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

            val topInset =
                bars.top

            val bottomInset =
                bars.bottom

            val topParams =
                topToolbar.layoutParams
                    as FrameLayout.LayoutParams

            topParams.topMargin =
                topInset

            topParams.leftMargin =
                bars.left

            topParams.rightMargin =
                bars.right

            topToolbar.layoutParams =
                topParams

            val toolParams =
                toolScroll.layoutParams
                    as FrameLayout.LayoutParams

            toolParams.topMargin =
                topInset +
                    58.dp

            toolParams.leftMargin =
                bars.left

            toolParams.rightMargin =
                bars.right

            toolScroll.layoutParams =
                toolParams

            val metarParams =
                metarBanner.layoutParams
                    as FrameLayout.LayoutParams

            metarParams.topMargin =
                topInset +
                    114.dp

            metarParams.leftMargin =
                bars.left +
                    10.dp

            metarParams.rightMargin =
                bars.right +
                    10.dp

            metarBanner.layoutParams =
                metarParams

            chartView.setContentInsets(
                bars.left,
                topInset +
                    106.dp,
                bars.right,
                bars.bottom
            )

            val gpsParams =
                gpsText.layoutParams
                    as FrameLayout.LayoutParams

            gpsParams.bottomMargin =
                bottomInset +
                    12.dp

            gpsParams.rightMargin =
                bars.right +
                    12.dp

            gpsText.layoutParams =
                gpsParams

            insets
        }

        ViewCompat.requestApplyInsets(
            root
        )
    }

    private fun toolbarButton(
        value: String,
        size: Float
    ):
        TextView {

        return TextView(
            this
        ).apply {

            text =
                value

            textSize =
                size

            gravity =
                Gravity.CENTER

            setTextColor(
                Color.WHITE
            )

            setPadding(
                4.dp,
                0,
                4.dp,
                0
            )

            isClickable =
                true

            isFocusable =
                true
        }
    }

    private fun toolButton(
        label: String,
        tool: Tool
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

            setPadding(
                8.dp,
                0,
                8.dp,
                0
            )

            isClickable =
                true

            isFocusable =
                true

            setOnClickListener {

                if (
                    tool ==
                    Tool.ERASER
                ) {

                    annotationTool =
                        Tool.ERASER

                    annotationMode =
                        true

                    updateToolButtonStates()

                    showEraserModeDialog()

                } else {

                    annotationTool =
                        tool

                    annotationMode =
                        tool !=
                            Tool.SELECT

                    updateToolButtonStates()

                    chartView.invalidate()
                }
            }
        }
    }

    private fun updateToolButtonStates() {

        if (
            !::toolScroll
                .isInitialized
        ) {
            return
        }

        val container =
            toolScroll.getChildAt(
                0
            ) as? LinearLayout
                ?: return

        for (
            index in
                0 until
                container.childCount
        ) {

            val child =
                container.getChildAt(
                    index
                )

            if (
                child !is TextView
            ) {
                continue
            }

            val value =
                child.text
                    .toString()
                    .uppercase(
                        Locale.US
                    )

            val active =
                when (
                    value
                ) {

                    "SELECT" ->
                        annotationTool ==
                            Tool.SELECT

                    "PEN" ->
                        annotationTool ==
                            Tool.PEN

                    "HIGHLIGHT" ->
                        annotationTool ==
                            Tool.HIGHLIGHT

                    "TEXT" ->
                        annotationTool ==
                            Tool.TEXT

                    "ERASER" ->
                        annotationTool ==
                            Tool.ERASER

                    else ->
                        false
                }

            child.setTextColor(
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
        width: Int = 68.dp
    ):
        LinearLayout.LayoutParams {

        return LinearLayout.LayoutParams(
            width,
            LinearLayout.LayoutParams.MATCH_PARENT
        )
    }

    private fun openPdf(
        file: File
    ) {

        try {

            descriptor =
                ParcelFileDescriptor.open(
                    file,
                    ParcelFileDescriptor.MODE_READ_ONLY
                )

            renderer =
                PdfRenderer(
                    descriptor!!
                )

            totalPages =
                renderer!!
                    .pageCount

            currentPage =
                currentPage.coerceIn(
                    0,
                    max(
                        0,
                        totalPages - 1
                    )
                )

            loadAirportCharts()

            repository
                .getChartForPage(
                    icao,
                    currentPage + 1
                )
                ?.let { info ->

                    chartTitle =
                        info.name

                    category =
                        info.category
                }

            showPage(
                currentPage
            )

        } catch (
            error: Exception
        ) {

            showError(
                "Unable to open PDF:\n${error.message}"
            )
        }
    }

    private fun showPage(
        index: Int
    ) {

        val pdf =
            renderer
                ?: return

        if (
            index < 0 ||
            index >= pdf.pageCount
        ) {
            return
        }

        currentPage =
            index

        val info =
            airportCharts
                .firstOrNull {
                    it.page ==
                        currentPage + 1
                }

        if (
            info != null
        ) {

            chartTitle =
                info.name

            category =
                info.category

            titleText.text =
                chartTitle.ifBlank {
                    "JeppIran Chart"
                }
        }

        val page =
            pdf.openPage(
                index
            )

        val pageWidth =
            page.width

        val pageHeight =
            page.height

        page.close()

        val isLandscape =
            pageWidth >
                pageHeight

        requestedOrientation =
            if (
                isLandscape
            ) {

                ActivityInfo
                    .SCREEN_ORIENTATION_LANDSCAPE

            } else {

                ActivityInfo
                    .SCREEN_ORIENTATION_PORTRAIT
            }

        chartView.setLandscapeMode(
            isLandscape
        )

        val bitmap =
            renderPageBitmap(
                index,
                3.0f
            )

        if (
            bitmap == null
        ) {

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

        loadAnnotationsForPage()

        prepareNeighborBitmaps()

        requestMetarForAirport()

        updateGpsLabel()
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
                    pageIndex >= pdf.pageCount
                ) {

                    return null
                }

                val page =
                    pdf.openPage(
                        pageIndex
                    )

                val baseScale =
                    if (
                        page.width >
                        page.height
                    ) {
                        1.55f
                    } else {
                        1.75f
                    }

                val renderScale =
                    baseScale *
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

                val cropTop =
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
                    cropTop <= 0
                ) {

                    bitmap

                } else {

                    val cropped =
                        Bitmap.createBitmap(
                            bitmap,
                            0,
                            cropTop,
                            bitmap.width,
                            bitmap.height -
                                cropTop
                        )

                    bitmap.recycle()

                    cropped
                }
            }

        } catch (
            _: Exception
        ) {

            null
        }
    }

    private fun navigateWithinAirport(
        direction: Int
    ) {

        val currentIndex =
            airportCharts
                .indexOfFirst {
                    it.page ==
                        currentPage + 1
                }

        if (
            currentIndex < 0
        ) {
            return
        }

        val target =
            currentIndex +
                direction

        if (
            target < 0 ||
            target >=
                airportCharts.size
        ) {

            return
        }

        val nextPage =
            airportCharts[
                target
            ].page - 1

        showPage(
            nextPage
        )
    }

    private fun buildPageText():
        String {

        val currentIndex =
            airportCharts
                .indexOfFirst {
                    it.page ==
                        currentPage + 1
                }

        val airportPart =
            if (
                currentIndex >= 0
            ) {
                "${currentIndex + 1}/${airportCharts.size}"
            } else {
                "-"
            }

        return "$airportPart  •  PDF ${currentPage + 1}/$totalPages"
    }

    private fun prepareNeighborBitmaps() {

        if (
            neighborsLoading
        ) {
            return
        }

        val currentIndex =
            airportCharts
                .indexOfFirst {
                    it.page ==
                        currentPage + 1
                }

        if (
            currentIndex < 0
        ) {
            return
        }

        val previousIndex =
            currentIndex - 1

        val nextIndex =
            currentIndex + 1

        neighborsLoading =
            true

        thread {

            val previous =
                if (
                    previousIndex >= 0
                ) {

                    renderPageBitmap(
                        airportCharts[
                            previousIndex
                        ].page - 1,
                        1.0f
                    )

                } else {
                    null
                }

            val next =
                if (
                    nextIndex <
                    airportCharts.size
                ) {

                    renderPageBitmap(
                        airportCharts[
                            nextIndex
                        ].page - 1,
                        1.0f
                    )

                } else {
                    null
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

                neighborsLoading =
                    false

                chartView.setNeighborBitmaps(
                    previous,
                    next
                )
            }
        }
    }

    private fun loadAirportCharts() {

        airportCharts.clear()

        airportCharts.addAll(
            repository
                .getChartsForAirport(
                    icao
                )
        )

        airportCharts.sortBy {
            it.page
        }
    }

    private fun showSearchDialog() {

        val dialogRoot =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.VERTICAL

                setPadding(
                    14.dp,
                    4.dp,
                    14.dp,
                    8.dp
                )
            }

        val input =
            EditText(
                this
            ).apply {

                hint =
                    "Search ICAO / Airport / City / Chart"

                isSingleLine =
                    true

                textSize =
                    16f

                inputType =
                    InputType.TYPE_CLASS_TEXT

                setPadding(
                    12.dp,
                    10.dp,
                    12.dp,
                    10.dp
                )
            }

        val resultsScroll =
            ScrollView(
                this
            ).apply {

                overScrollMode =
                    ScrollView.OVER_SCROLL_IF_CONTENT_SCROLLS
            }

        val resultsContainer =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.VERTICAL
            }

        resultsScroll.addView(
            resultsContainer,
            ScrollView.LayoutParams(
                ScrollView.LayoutParams.MATCH_PARENT,
                ScrollView.LayoutParams.WRAP_CONTENT
            )
        )

        dialogRoot.addView(
            input,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                58.dp
            )
        )

        dialogRoot.addView(
            resultsScroll,
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
                    dialogRoot
                )
                .setNegativeButton(
                    "Close",
                    null
                )
                .create()

        fun renderResults(
            query: String
        ) {

            resultsContainer
                .removeAllViews()

            val q =
                query.trim()

            if (
                q.isBlank()
            ) {

                val empty =
                    TextView(
                        this
                    ).apply {

                        text =
                            "Search for an ICAO, airport, city, chart name, chart type or chart number."

                        textSize =
                            13f

                        setTextColor(
                            secondaryTextColor()
                        )

                        setPadding(
                            10.dp,
                            20.dp,
                            10.dp,
                            20.dp
                        )
                    }

                resultsContainer.addView(
                    empty
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
                            20.dp,
                            10.dp,
                            20.dp
                        )
                    }

                resultsContainer.addView(
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
                                12.dp
                            )

                        setPadding(
                            12.dp,
                            10.dp,
                            12.dp,
                            10.dp
                        )

                        isClickable =
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

                        typeface =
                            Typeface.DEFAULT_BOLD

                        maxLines =
                            3

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

                resultsContainer.addView(
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
                    s: android.text.Editable?
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
    ): String {

        val firstLine =
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

        val secondLine =
            listOf(
                result.category,
                if (
                    result.chartNumber
                        .isNotBlank()
                ) {
                    result.chartNumber
                } else {
                    ""
                },
                "Page ${result.page}"
            )
                .filter {
                    it.isNotBlank()
                }
                .joinToString(
                    "  •  "
                )

        return "$firstLine\n$secondLine"
    }

    private fun openSearchResult(
        result:
            ChartRepository.SearchResult
    ) {

        icao =
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

        loadAirportCharts()

        val target =
            result.page - 1

        if (
            target < 0 ||
            target >= totalPages
        ) {

            return
        }

        showPage(
            target
        )
    }

    private fun showEraserModeDialog() {

        val options =
            arrayOf(
                "Object eraser",
                "Pixel eraser"
            )

        AlertDialog.Builder(
            this
        )
            .setTitle(
                "Eraser mode"
            )
            .setSingleChoiceItems(
                options,
                if (
                    eraserMode ==
                    EraserMode.OBJECT
                ) {
                    0
                } else {
                    1
                }
            ) { dialog, which ->

                eraserMode =
                    if (
                        which == 0
                    ) {
                        EraserMode.OBJECT
                    } else {
                        EraserMode.PIXEL
                    }

                annotationMode =
                    true

                annotationTool =
                    Tool.ERASER

                updateToolButtonStates()

                dialog.dismiss()

                chartView.invalidate()
            }
            .setNegativeButton(
                "Cancel",
                null
            )
            .show()
    }

    private fun showClearAllDialog() {

        AlertDialog.Builder(
            this
        )
            .setTitle(
                "Clear all annotations"
            )
            .setMessage(
                "Delete every annotation on this chart page?"
            )
            .setNegativeButton(
                "Cancel",
                null
            )
            .setPositiveButton(
                "Clear all"
            ) { _, _ ->

                clearCurrentPageAnnotations()
            }
            .show()
    }

    private fun showTextDialog(
        x: Float,
        y: Float
    ) {

        val container =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.VERTICAL

                setPadding(
                    10.dp,
                    4.dp,
                    10.dp,
                    4.dp
                )
            }

        val input =
            EditText(
                this
            ).apply {

                inputType =
                    InputType.TYPE_CLASS_TEXT or
                        InputType
                            .TYPE_TEXT_FLAG_MULTI_LINE or
                        InputType
                            .TYPE_TEXT_FLAG_CAP_SENTENCES

                minLines =
                    5

                gravity =
                    Gravity.TOP or
                        Gravity.START

                hint =
                    "Enter annotation text"

                textSize =
                    16f
            }

        container.addView(
            input,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                150.dp
            )
        )

        var alignment =
            TextAlign.LEFT

        val alignmentRow =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.HORIZONTAL

                gravity =
                    Gravity.CENTER

                setPadding(
                    0,
                    8.dp,
                    0,
                    0
                )
            }

        fun alignmentButton(
            label: String,
            value: TextAlign
        ):
            TextView {

            return TextView(
                this
            ).apply {

                text =
                    label

                textSize =
                    11f

                gravity =
                    Gravity.CENTER

                setPadding(
                    10.dp,
                    8.dp,
                    10.dp,
                    8.dp
                )

                setOnClickListener {

                    alignment =
                        value

                    input.textAlignment =
                        when (
                            value
                        ) {

                            TextAlign.LEFT ->
                                View.TEXT_ALIGNMENT_TEXT_START

                            TextAlign.CENTER ->
                                View.TEXT_ALIGNMENT_CENTER

                            TextAlign.RIGHT ->
                                View.TEXT_ALIGNMENT_TEXT_END
                        }
                }
            }
        }

        alignmentRow.addView(
            alignmentButton(
                "LEFT",
                TextAlign.LEFT
            ),
            LinearLayout.LayoutParams(
                0,
                46.dp,
                1f
            )
        )

        alignmentRow.addView(
            alignmentButton(
                "CENTER",
                TextAlign.CENTER
            ),
            LinearLayout.LayoutParams(
                0,
                46.dp,
                1f
            )
        )

        alignmentRow.addView(
            alignmentButton(
                "RIGHT",
                TextAlign.RIGHT
            ),
            LinearLayout.LayoutParams(
                0,
                46.dp,
                1f
            )
        )

        container.addView(
            alignmentRow
        )

        val dialog =
            AlertDialog.Builder(
                this
            )
                .setTitle(
                    "Text annotation"
                )
                .setView(
                    container
                )
                .setNegativeButton(
                    "Cancel"
                ) { _, _ ->

                    annotationTool =
                        Tool.SELECT

                    annotationMode =
                        false

                    updateToolButtonStates()
                }
                .setPositiveButton(
                    "Add"
                ) { _, _ ->

                    val text =
                        input.text
                            .toString()

                    if (
                        text.isNotBlank()
                    ) {

                        val safe =
                            chartView
                                .clampTextAnchor(
                                    text,
                                    x,
                                    y,
                                    1f,
                                    0f,
                                    alignment,
                                    20f
                                )

                        chartView.addTextAnnotation(
                            text,
                            safe.x,
                            safe.y,
                            alignment
                        )

                        saveAnnotationsForPage()
                    }

                    annotationTool =
                        Tool.SELECT

                    annotationMode =
                        false

                    updateToolButtonStates()

                    chartView.invalidate()
                }
                .create()

        dialog.show()

        input.requestFocus()

        dialog.window
            ?.setSoftInputMode(
                WindowManager.LayoutParams
                    .SOFT_INPUT_STATE_ALWAYS_VISIBLE
            )
    }

    private fun showTextEditDialog(
        index: Int
    ) {

        val item =
            chartView.getTextAt(
                index
            )
                ?: return

        val container =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.VERTICAL

                setPadding(
                    10.dp,
                    4.dp,
                    10.dp,
                    4.dp
                )
            }

        val input =
            EditText(
                this
            ).apply {

                setText(
                    item.text
                )

                inputType =
                    InputType.TYPE_CLASS_TEXT or
                        InputType
                            .TYPE_TEXT_FLAG_MULTI_LINE

                minLines =
                    5

                gravity =
                    Gravity.TOP or
                        Gravity.START

                setSelection(
                    text.length
                )
            }

        container.addView(
            input,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                150.dp
            )
        )

        var alignment =
            item.align

        val alignmentRow =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.HORIZONTAL

                gravity =
                    Gravity.CENTER

                setPadding(
                    0,
                    8.dp,
                    0,
                    0
                )
            }

        fun button(
            label: String,
            value: TextAlign
        ) =
            TextView(
                this
            ).apply {

                text =
                    label

                gravity =
                    Gravity.CENTER

                textSize =
                    11f

                setPadding(
                    8.dp,
                    8.dp,
                    8.dp,
                    8.dp
                )

                setOnClickListener {

                    alignment =
                        value

                    input.textAlignment =
                        when (
                            value
                        ) {

                            TextAlign.LEFT ->
                                View.TEXT_ALIGNMENT_TEXT_START

                            TextAlign.CENTER ->
                                View.TEXT_ALIGNMENT_CENTER

                            TextAlign.RIGHT ->
                                View.TEXT_ALIGNMENT_TEXT_END
                        }
                }
            }

        alignmentRow.addView(
            button(
                "LEFT",
                TextAlign.LEFT
            ),
            LinearLayout.LayoutParams(
                0,
                44.dp,
                1f
            )
        )

        alignmentRow.addView(
            button(
                "CENTER",
                TextAlign.CENTER
            ),
            LinearLayout.LayoutParams(
                0,
                44.dp,
                1f
            )
        )

        alignmentRow.addView(
            button(
                "RIGHT",
                TextAlign.RIGHT
            ),
            LinearLayout.LayoutParams(
                0,
                44.dp,
                1f
            )
        )

        container.addView(
            alignmentRow
        )

        AlertDialog.Builder(
            this
        )
            .setTitle(
                "Edit text"
            )
            .setView(
                container
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
                            alignment,
                            item.size
                        )

                item.x =
                    safe.x

                item.y =
                    safe.y

                item.align =
                    alignment

                saveAnnotationsForPage()

                chartView.invalidate()
            }
            .show()
    }

    private fun annotationPreferences() =
        getSharedPreferences(
            ANNOTATION_PREFS,
            Context.MODE_PRIVATE
        )

    private fun annotationVersionKey():
        String {

        return "data_version"
    }

    private fun annotationPageKey(
        page: Int
    ):
        String {

        return "page_$page"
    }

    private fun clearOldAnnotationsIfNeeded() {

        val preferences =
            annotationPreferences()

        val stored =
            preferences
                .getString(
                    annotationVersionKey(),
                    ""
                )
                .orEmpty()

        if (
            stored !=
            CHART_DATA_VERSION
        ) {

            preferences
                .edit()
                .clear()
                .putString(
                    annotationVersionKey(),
                    CHART_DATA_VERSION
                )
                .apply()
        }
    }

    private fun saveAnnotationsForPage() {

        if (
            !::chartView
                .isInitialized
        ) {
            return
        }

        clearOldAnnotationsIfNeeded()

        val rootObject =
            JSONObject()

        val strokes =
            JSONArray()

        chartView
            .getStrokes()
            .forEach {
                stroke ->

                val strokeObject =
                    JSONObject()

                strokeObject.put(
                    "highlight",
                    stroke.highlight
                )

                val points =
                    JSONArray()

                stroke.points
                    .forEach {
                        point ->

                        points.put(
                            JSONObject()
                                .put(
                                    "x",
                                    point.x.toDouble()
                                )
                                .put(
                                    "y",
                                    point.y.toDouble()
                                )
                        )
                    }

                strokeObject.put(
                    "points",
                    points
                )

                strokes.put(
                    strokeObject
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
                            item.x.toDouble()
                        )
                        .put(
                            "y",
                            item.y.toDouble()
                        )
                        .put(
                            "scale",
                            item.scale.toDouble()
                        )
                        .put(
                            "rotation",
                            item.rotation.toDouble()
                        )
                        .put(
                            "align",
                            item.align.name
                        )
                        .put(
                            "size",
                            item.size.toDouble()
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
                    currentPage
                ),
                rootObject.toString()
            )
            .putString(
                annotationVersionKey(),
                CHART_DATA_VERSION
            )
            .apply()
    }

    private fun loadAnnotationsForPage() {

        clearOldAnnotationsIfNeeded()

        chartView
            .clearAnnotationsInternal()

        val value =
            annotationPreferences()
                .getString(
                    annotationPageKey(
                        currentPage
                    ),
                    ""
                )
                .orEmpty()

        if (
            value.isBlank()
        ) {

            chartView.invalidate()

            return
        }

        try {

            val rootObject =
                JSONObject(
                    value
                )

            val strokes =
                rootObject
                    .optJSONArray(
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

                    val item =
                        strokes
                            .optJSONObject(
                                i
                            )
                            ?: continue

                    val highlight =
                        item.optBoolean(
                            "highlight",
                            false
                        )

                    val points =
                        mutableListOf<PointF>()

                    val array =
                        item.optJSONArray(
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

                            val point =
                                array
                                    .optJSONObject(
                                        j
                                    )
                                    ?: continue

                            points.add(
                                PointF(
                                    point.optDouble(
                                        "x",
                                        0.0
                                    ).toFloat(),
                                    point.optDouble(
                                        "y",
                                        0.0
                                    ).toFloat()
                                )
                            )
                        }
                    }

                    val safePoints =
                        points
                            .filter {
                                chartView
                                    .isInsideImage(
                                        it
                                    )
                            }

                    if (
                        safePoints
                            .size >= 2
                    ) {

                        chartView
                            .addStoredStroke(
                                safePoints,
                                highlight
                            )
                    }
                }
            }

            val texts =
                rootObject
                    .optJSONArray(
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
                        texts
                            .optJSONObject(
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
                        ).toFloat()
                            .coerceIn(
                                0.35f,
                                chartView.maxZoom
                            )

                    val rotation =
                        item.optDouble(
                            "rotation",
                            0.0
                        ).toFloat()

                    val size =
                        item.optDouble(
                            "size",
                            20.0
                        ).toFloat()
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

                    chartView
                        .addStoredText(
                            text,
                            safe.x,
                            safe.y,
                            scale,
                            rotation,
                            align,
                            size
                        )
                }
            }

        } catch (
            _: Exception
        ) {
        }

        chartView.invalidate()
    }

    private fun clearCurrentPageAnnotations() {

        annotationPreferences()
            .edit()
            .remove(
                annotationPageKey(
                    currentPage
                )
            )
            .apply()

        chartView
            .clearAnnotationsInternal()

        chartView.invalidate()
    }

    private fun hideViewerControls() {

        topToolbar.visibility =
            View.GONE

        toolScroll.visibility =
            View.GONE

        metarBanner.visibility =
            View.GONE

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

        topToolbar.visibility =
            View.VISIBLE

        toolScroll.visibility =
            View.VISIBLE

        if (
            metarBanner.text
                .toString()
                .isNotBlank()
        ) {

            val currentlyHidden =
                metarBanner.visibility ==
                    View.GONE

            if (
                !currentlyHidden
            ) {
                metarBanner.visibility =
                    View.VISIBLE
            }
        }

        WindowInsetsControllerCompat(
            window,
            window.decorView
        ).show(
            WindowInsetsCompat.Type.systemBars()
        )

        ViewCompat.requestApplyInsets(
            root
        )
    }

    private fun toggleViewerControls() {

        if (
            annotationMode &&
            annotationTool !=
            Tool.SELECT
        ) {
            return
        }

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

    private fun requestMetarForAirport() {

        val currentRequest =
            ++metarRequestId

        if (
            icao.isBlank()
        ) {
            return
        }

        showMetarBanner(
            "METAR $icao: loading..."
        )

        thread {

            try {

                val url =
                    URL(
                        "https://aviationweather.gov/api/data/metar" +
                            "?ids=" +
                            icao +
                            "&format=json"
                    )

                val connection =
                    url.openConnection()
                        as HttpURLConnection

                connection.connectTimeout =
                    METAR_TIMEOUT

                connection.readTimeout =
                    METAR_TIMEOUT

                connection.requestMethod =
                    "GET"

                connection.setRequestProperty(
                    "User-Agent",
                    "JeppIran/1.0"
                )

                connection.setRequestProperty(
                    "Accept",
                    "application/json"
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

                val response =
                    connection.inputStream
                        .bufferedReader()
                        .use {
                            it.readText()
                        }

                connection.disconnect()

                val text =
                    parseMetarResponse(
                        response
                    )

                runOnUiThread {

                    if (
                        currentRequest !=
                        metarRequestId
                    ) {
                        return@runOnUiThread
                    }

                    showMetarBanner(
                        text
                    )
                }

            } catch (
                _: Exception
            ) {

                runOnUiThread {

                    if (
                        currentRequest ==
                        metarRequestId
                    ) {

                        hideMetarBanner(
                            false
                        )
                    }
                }
            }
        }
    }

    private fun parseMetarResponse(
        response: String
    ):
        String {

        if (
            response.isBlank()
        ) {

            return "METAR $icao: no data"
        }

        return try {

            val array =
                JSONArray(
                    response
                )

            if (
                array.length() <= 0
            ) {

                return "METAR $icao: no current observation"
            }

            val item =
                array.optJSONObject(
                    0
                )
                    ?: return "METAR $icao: no current observation"

            val raw =
                item
                    .optString(
                        "rawOb",
                        ""
                    )
                    .trim()

            val flightCategory =
                item.optString(
                    "fltCat",
                    ""
                )
                    .trim()

            val observed =
                item.optString(
                    "obsTime",
                    ""
                )
                    .trim()

            if (
                raw.isBlank()
            ) {

                return "METAR $icao: data available"
            }

            val pieces =
                mutableListOf<String>()

            pieces.add(
                "$icao METAR"
            )

            if (
                flightCategory.isNotBlank()
            ) {

                pieces.add(
                    flightCategory
                )
            }

            pieces.add(
                raw
            )

            if (
                observed.isNotBlank()
            ) {

                pieces.add(
                    observed
                )
            }

            pieces.joinToString(
                "  •  "
            )

        } catch (
            _: Exception
        ) {

            "METAR $icao: $response"
        }
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

        metarBanner.text =
            value

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
            30000L
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

                    metarBanner.translationY =
                        0f
                }
                .start()

        } else {

            metarBanner.visibility =
                View.GONE

            metarBanner.alpha =
                1f

            metarBanner.translationY =
                0f
        }
    }

    private fun startGps() {

        locationManager =
            getSystemService(
                Context.LOCATION_SERVICE
            ) as? LocationManager

        if (
            locationManager == null
        ) {

            updateGpsText(
                "GPS: unavailable"
            )

            return
        }

        if (
            ActivityCompat.checkSelfPermission(
                this,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) !=
            PackageManager.PERMISSION_GRANTED &&
            ActivityCompat.checkSelfPermission(
                this,
                Manifest.permission.ACCESS_COARSE_LOCATION
            ) !=
            PackageManager.PERMISSION_GRANTED
        ) {

            updateGpsText(
                "GPS: permission required"
            )

            ActivityCompat.requestPermissions(
                this,
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                ),
                GPS_PERMISSION_REQUEST
            )

            return
        }

        val manager =
            locationManager
                ?: return

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
                "GPS: location services are off"
            )

            return
        }

        locationListener =
            object :
                LocationListener {

                override fun onLocationChanged(
                    location: Location
                ) {

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

                val last =
                    manager.getLastKnownLocation(
                        provider
                    )

                if (
                    last != null
                ) {

                    lastGpsLocation =
                        last
                }

            } catch (
                _: SecurityException
            ) {
            }
        }

        updateGpsLabel()
    }

    private fun stopGps() {

        val manager =
            locationManager
                ?: return

        val listener =
            locationListener
                ?: return

        try {

            manager.removeUpdates(
                listener
            )

        } catch (
            _: SecurityException
        ) {
        }

        locationListener =
            null

        locationManager =
            null
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {

        super.onRequestPermissionsResult(
            requestCode,
            permissions,
            grantResults
        )

        if (
            requestCode ==
            GPS_PERMISSION_REQUEST
        ) {

            if (
                grantResults.any {
                    it ==
                        PackageManager.PERMISSION_GRANTED
                }
            ) {

                startGps()

            } else {

                updateGpsText(
                    "GPS: permission denied"
                )
            }
        }
    }

    private fun updateGpsLabel() {

        val location =
            lastGpsLocation

        if (
            location == null
        ) {

            updateGpsText(
                "GPS: waiting..."
            )

            return
        }

        val lat =
            String.format(
                Locale.US,
                "%.6f",
                location.latitude
            )

        val lon =
            String.format(
                Locale.US,
                "%.6f",
                location.longitude
            )

        updateGpsText(
            "GPS  $lat, $lon"
        )
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

    private fun roundedBackground(
        fillColor: Int,
        strokeColor: Int,
        radiusDp: Int
    ):
        android.graphics.drawable.GradientDrawable {

        return android.graphics.drawable
            .GradientDrawable()
            .apply {

                shape =
                    android.graphics
                        .drawable
                        .GradientDrawable
                        .RECTANGLE

                cornerRadius =
                    radiusDp.dp.toFloat()

                setColor(
                    fillColor
                )

                setStroke(
                    1.dp,
                    strokeColor
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

    private fun toolbarColor():
        Int {

        return Color.rgb(
            17,
            25,
            33
        )
    }

    private inner class ChartView(
        context: Context
    ) : View(
        context
    ) {

        private var bitmap:
            Bitmap? = null

        private var previous:
            Bitmap? = null

        private var next:
            Bitmap? = null

        private var scale =
            1f

        private var offsetX =
            0f

        private var offsetY =
            0f

        private var swipeOffset =
            0f

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

        private var pinchDistance =
            0f

        private var moved =
            false

        private var swiping =
            false

        private var activePoints:
            MutableList<PointF>? =
            null

        private var selectedTextIndex =
            -1

        private var textGestureStartDistance =
            0f

        private var textGestureStartAngle =
            0f

        private var textGestureStartScale =
            1f

        private var textGestureStartRotation =
            0f

        private var textGestureStartX =
            0f

        private var textGestureStartY =
            0f

        private val strokes =
            mutableListOf<StoredStroke>()

        private val texts =
            mutableListOf<StoredText>()

        val maxZoom =
            3.0f

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
                    inverted
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
            points: List<PointF>,
            highlight: Boolean
        ) {

            val safe =
                points
                    .filter {
                        isInsideImage(
                            it
                        )
                    }
                    .map {
                        PointF(
                            it.x,
                            it.y
                        )
                    }

            if (
                safe.size >= 2
            ) {

                strokes.add(
                    StoredStroke(
                        safe.toMutableList(),
                        highlight
                    )
                )
            }
        }

        fun addStoredText(
            value: String,
            x: Float,
            y: Float,
            scaleValue: Float,
            rotationValue: Float,
            alignValue: TextAlign,
            sizeValue: Float
        ) {

            if (
                value.isBlank()
            ) {
                return
            }

            val safe =
                clampTextAnchor(
                    value,
                    x,
                    y,
                    scaleValue,
                    rotationValue,
                    alignValue,
                    sizeValue
                )

            texts.add(
                StoredText(
                    value,
                    safe.x,
                    safe.y,
                    scaleValue,
                    rotationValue,
                    alignValue,
                    sizeValue
                )
            )
        }

        fun addTextAnnotation(
            value: String,
            x: Float,
            y: Float,
            alignment: TextAlign
        ) {

            if (
                value.isBlank()
            ) {
                return
            }

            val safe =
                clampTextAnchor(
                    value,
                    x,
                    y,
                    1f,
                    0f,
                    alignment,
                    20f
                )

            texts.add(
                StoredText(
                    value,
                    safe.x,
                    safe.y,
                    1f,
                    0f,
                    alignment,
                    20f
                )
            )
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

            val drawWidth =
                image.width *
                    finalScale

            val drawHeight =
                image.height *
                    finalScale

            val centerX =
                viewport.centerX()

            val centerY =
                viewport.centerY()

            val left =
                centerX -
                    drawWidth / 2f +
                    offsetX +
                    swipeOffset

            val top =
                centerY -
                    drawHeight / 2f +
                    offsetY

            canvas.save()

            canvas.clipRect(
                viewport
            )

            if (
                swiping
            ) {

                val previousLeft =
                    left -
                        width

                val nextLeft =
                    left +
                        width

                drawNeighbor(
                    canvas,
                    previous,
                    previousLeft,
                    top,
                    finalScale
                )

                drawNeighbor(
                    canvas,
                    next,
                    nextLeft,
                    top,
                    finalScale
                )
            }

            canvas.drawBitmap(
                image,
                null,
                RectF(
                    left,
                    top,
                    left + drawWidth,
                    top + drawHeight
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

            activePoints
                ?.takeIf {
                    it.isNotEmpty()
                }
                ?.let {
                    points ->

                    drawPoints(
                        canvas,
                        points,
                        annotationTool ==
                            Tool.HIGHLIGHT
                    )
                }

            canvas.restore()

            canvas.restore()

            if (
                lastGpsLocation != null
            ) {

                drawGpsOverlay(
                    canvas,
                    viewport
                )
            }
        }

        private fun drawNeighbor(
            canvas: Canvas,
            image: Bitmap?,
            left: Float,
            top: Float,
            scaleValue: Float
        ) {

            if (
                image == null ||
                image.isRecycled
            ) {
                return
            }

            val drawWidth =
                image.width *
                    scaleValue

            val drawHeight =
                image.height *
                    scaleValue

            canvas.drawBitmap(
                image,
                null,
                RectF(
                    left,
                    top,
                    left + drawWidth,
                    top + drawHeight
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
                    stroke.highlight
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

                textPaint.textSize =
                    item.size

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
                            (
                                lineIndex + 1
                            ),
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

                    val bounds =
                        measureTextBounds(
                            item
                        )

                    selectionPaint.style =
                        Paint.Style.FILL

                    canvas.drawCircle(
                        bounds.centerX(),
                        bounds.top,
                        6f,
                        selectionPaint
                    )

                    selectionPaint.style =
                        Paint.Style.STROKE
                }

                canvas.restore()
            }
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

            var maxWidth =
                1f

            lines.forEach {
                line ->

                maxWidth =
                    max(
                        maxWidth,
                        textPaint.measureText(
                            line
                        )
                    )
            }

            val height =
                item.size *
                    1.25f *
                    lines.size

            val horizontalPadding =
                12f

            return when (
                item.align
            ) {

                TextAlign.LEFT ->
                    RectF(
                        -horizontalPadding,
                        -4f,
                        maxWidth +
                            horizontalPadding,
                        height +
                            8f
                    )

                TextAlign.CENTER ->
                    RectF(
                        -maxWidth / 2f -
                            horizontalPadding,
                        -4f,
                        maxWidth / 2f +
                            horizontalPadding,
                        height +
                            8f
                    )

                TextAlign.RIGHT ->
                    RectF(
                        -maxWidth -
                            horizontalPadding,
                        -4f,
                        horizontalPadding,
                        height +
                            8f
                    )
            }
        }

        private fun drawPoints(
            canvas: Canvas,
            points: List<PointF>,
            highlight: Boolean
        ) {

            if (
                points.isEmpty()
            ) {
                return
            }

            strokePaint.color =
                if (
                    highlight
                ) {

                    Color.argb(
                        110,
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

            strokePaint.strokeWidth =
                if (
                    highlight
                ) {
                    22f
                } else {
                    5f
                }

            val path =
                Path()

            path.moveTo(
                points.first().x,
                points.first().y
            )

            for (
                index in
                    1 until
                    points.size
            ) {

                path.lineTo(
                    points[index].x,
                    points[index].y
                )
            }

            canvas.drawPath(
                path,
                strokePaint
            )
        }

        private fun drawGpsOverlay(
            canvas: Canvas,
            viewport: RectF
        ) {

            val location =
                lastGpsLocation
                    ?: return

            val markerX =
                viewport.centerX()

            val markerY =
                viewport.centerY()

            val marker =
                Paint(
                    Paint.ANTI_ALIAS_FLAG
                ).apply {

                    style =
                        Paint.Style.FILL

                    color =
                        Color.rgb(
                            40,
                            230,
                            125
                        )
                }

            canvas.drawCircle(
                markerX,
                markerY,
                7f,
                marker
            )
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

            val drawWidth =
                image.width *
                    finalScale

            val drawHeight =
                image.height *
                    finalScale

            val left =
                viewport.centerX() -
                    drawWidth / 2f +
                    offsetX +
                    swipeOffset

            val top =
                viewport.centerY() -
                    drawHeight / 2f +
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
                image.width.toFloat() &&
                point.y <=
                image.height.toFloat()
        }

        private fun imageBounds():
            RectF {

            val image =
                bitmap
                    ?: return RectF()

            return RectF(
                0f,
                0f,
                image.width.toFloat(),
                image.height.toFloat()
            )
        }

        fun clampTextAnchor(
            text: String,
            x: Float,
            y: Float,
            scaleValue: Float,
            rotationValue: Float,
            align: TextAlign,
            sizeValue: Float
        ):
            PointF {

            val bounds =
                imageBounds()

            if (
                bounds.isEmpty
            ) {
                return PointF(
                    x,
                    y
                )
            }

            textPaint.textSize =
                sizeValue

            val lines =
                text.split(
                    "\n"
                )

            var maxWidth =
                1f

            lines.forEach {
                line ->

                maxWidth =
                    max(
                        maxWidth,
                        textPaint.measureText(
                            line
                        )
                    )
            }

            val textHeight =
                sizeValue *
                    1.25f *
                    lines.size

            val halfWidth =
                (
                    maxWidth *
                        scaleValue
                    ) / 2f +
                    18f

            val halfHeight =
                (
                    textHeight *
                        scaleValue
                    ) / 2f +
                    18f

            return PointF(
                x.coerceIn(
                    bounds.left +
                        halfWidth,
                    bounds.right -
                        halfWidth
                ),
                y.coerceIn(
                    bounds.top +
                        halfHeight,
                    bounds.bottom -
                        halfHeight
                )
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

            if (
                !isInsideImage(
                    imagePoint
                )
            ) {

                return -1
            }

            val point =
                imagePoint
                    ?: return -1

            for (
                index in
                    texts.indices
                        .reversed()
            ) {

                val item =
                    texts[index]

                val dx =
                    point.x -
                        item.x

                val dy =
                    point.y -
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
                        localX,
                        localY
                    )
                ) {

                    return index
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

            if (
                !isInsideImage(
                    point
                )
            ) {
                return -1
            }

            val imagePoint =
                point
                    ?: return -1

            val radius =
                32f /
                    scale.coerceAtLeast(
                        1f
                    )

            for (
                index in
                    strokes.indices
                        .reversed()
            ) {

                val stroke =
                    strokes[index]

                if (
                    stroke.points.any {
                        sample ->

                        val dx =
                            sample.x -
                                imagePoint.x

                        val dy =
                            sample.y -
                                imagePoint.y

                        (
                            dx * dx +
                                dy * dy
                            ) <=
                            radius *
                            radius
                    }
                ) {

                    return index
                }
            }

            return -1
        }

        private fun objectEraseAt(
            x: Float,
            y: Float
        ) {

            val point =
                screenToImage(
                    x,
                    y
                )

            if (
                !isInsideImage(
                    point
                )
            ) {
                return
            }

            val textIndex =
                findTextAt(
                    x,
                    y
                )

            if (
                textIndex >= 0
            ) {

                texts.removeAt(
                    textIndex
                )

                selectedTextIndex =
                    -1

                saveAnnotationsForPage()

                invalidate()

                return
            }

            val strokeIndex =
                findStrokeAt(
                    x,
                    y
                )

            if (
                strokeIndex >= 0
            ) {

                strokes.removeAt(
                    strokeIndex
                )

                saveAnnotationsForPage()

                invalidate()
            }
        }

        private fun pixelEraseAt(
            x: Float,
            y: Float
        ) {

            val point =
                screenToImage(
                    x,
                    y
                )

            if (
                !isInsideImage(
                    point
                )
            ) {
                return
            }

            val imagePoint =
                point
                    ?: return

            val textIndex =
                findTextAt(
                    x,
                    y
                )

            if (
                textIndex >= 0
            ) {

                texts.removeAt(
                    textIndex
                )

                selectedTextIndex =
                    -1

                saveAnnotationsForPage()

                invalidate()

                return
            }

            val radius =
                34f /
                    scale.coerceAtLeast(
                        1f
                    )

            val rebuilt =
                mutableListOf<StoredStroke>()

            strokes.forEach {
                stroke ->

                var segment =
                    mutableListOf<PointF>()

                stroke.points.forEach {
                    sample ->

                    val dx =
                        sample.x -
                            imagePoint.x

                    val dy =
                        sample.y -
                            imagePoint.y

                    val erased =
                        dx * dx +
                            dy * dy <=
                            radius *
                            radius

                    if (
                        erased
                    ) {

                        if (
                            segment.size >= 2
                        ) {

                            rebuilt.add(
                                StoredStroke(
                                    segment,
                                    stroke.highlight
                                )
                            )
                        }

                        segment =
                            mutableListOf()

                    } else {

                        segment.add(
                            PointF(
                                sample.x,
                                sample.y
                            )
                        )
                    }
                }

                if (
                    segment.size >= 2
                ) {

                    rebuilt.add(
                        StoredStroke(
                            segment,
                            stroke.highlight
                        )
                    )
                }
            }

            strokes.clear()

            strokes.addAll(
                rebuilt
            )

            saveAnnotationsForPage()

            invalidate()
        }

        private fun pointerDistance(
            event: MotionEvent
        ): Float {

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
        ): Float {

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

        private fun updateSelectedTextFromGesture(
            event: MotionEvent
        ) {

            if (
                selectedTextIndex !in
                texts.indices
            ) {
                return
            }

            if (
                event.pointerCount <
                2
            ) {
                return
            }

            val item =
                texts[
                    selectedTextIndex
                ]

            val distance =
                pointerDistance(
                    event
                )

            if (
                textGestureStartDistance >
                0f
            ) {

                item.scale =
                    (
                        textGestureStartScale *
                            distance /
                            textGestureStartDistance
                        )
                        .coerceIn(
                            0.35f,
                            maxZoom
                        )
            }

            item.rotation =
                textGestureStartRotation +
                    (
                        pointerAngle(
                            event
                        ) -
                            textGestureStartAngle
                        )

            val center =
                pointerCenter(
                    event
                )

            val startImage =
                screenToImage(
                    downX,
                    downY
                )

            val centerImage =
                screenToImage(
                    center.x,
                    center.y
                )

            if (
                startImage != null &&
                centerImage != null
            ) {

                val newX =
                    textGestureStartX +
                        centerImage.x -
                        startImage.x

                val newY =
                    textGestureStartY +
                        centerImage.y -
                        startImage.y

                val safe =
                    clampTextAnchor(
                        item.text,
                        newX,
                        newY,
                        item.scale,
                        item.rotation,
                        item.align,
                        item.size
                    )

                item.x =
                    safe.x

                item.y =
                    safe.y

                saveAnnotationsForPage()
            }

            invalidate()
        }

        override fun onTouchEvent(
            event: MotionEvent
        ): Boolean {

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

                    swipeOffset =
                        0f

                    moved =
                        false

                    swiping =
                        false

                    selectedTextIndex =
                        if (
                            annotationTool ==
                            Tool.SELECT
                        ) {
                            findTextAt(
                                event.x,
                                event.y
                            )
                        } else {
                            -1
                        }

                    when (
                        annotationTool
                    ) {

                        Tool.ERASER -> {

                            if (
                                eraserMode ==
                                EraserMode.OBJECT
                            ) {

                                objectEraseAt(
                                    event.x,
                                    event.y
                                )

                            } else {

                                pixelEraseAt(
                                    event.x,
                                    event.y
                                )
                            }

                            return true
                        }

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

                                val safe =
                                    point
                                        ?: return true

                                showTextDialog(
                                    safe.x,
                                    safe.y
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
                                        PointF(
                                            point!!.x,
                                            point.y
                                        )
                                    )

                                } else {

                                    null
                                }

                            return true
                        }

                        Tool.SELECT -> {
                            return true
                        }
                    }
                }

                MotionEvent.ACTION_POINTER_DOWN -> {

                    if (
                        event.pointerCount >=
                        2
                    ) {

                        pinchDistance =
                            pointerDistance(
                                event
                            )

                        if (
                            annotationTool ==
                            Tool.SELECT &&
                            selectedTextIndex >=
                            0
                        ) {

                            textGestureStartDistance =
                                pointerDistance(
                                    event
                                )

                            textGestureStartAngle =
                                pointerAngle(
                                    event
                                )

                            val item =
                                texts[
                                    selectedTextIndex
                                ]

                            textGestureStartScale =
                                item.scale

                            textGestureStartRotation =
                                item.rotation

                            textGestureStartX =
                                item.x

                            textGestureStartY =
                                item.y

                        } else {

                            selectedTextIndex =
                                -1
                        }

                        activePoints =
                            null
                    }

                    return true
                }

                MotionEvent.ACTION_MOVE -> {

                    if (
                        event.pointerCount >=
                        2
                    ) {

                        if (
                            annotationTool ==
                            Tool.SELECT &&
                            selectedTextIndex >=
                            0
                        ) {

                            updateSelectedTextFromGesture(
                                event
                            )

                        } else {

                            val currentDistance =
                                pointerDistance(
                                    event
                                )

                            if (
                                pinchDistance >
                                0f
                            ) {

                                val factor =
                                    currentDistance /
                                        pinchDistance

                                scale =
                                    (
                                        scale *
                                            factor
                                        )
                                        .coerceIn(
                                            1f,
                                            maxZoom
                                        )

                                pinchDistance =
                                    currentDistance

                                constrainPan()
                            }
                        }

                        invalidate()

                        return true
                    }

                    val dx =
                        event.x -
                            lastX

                    val dy =
                        event.y -
                            lastY

                    if (
                        abs(
                            event.x -
                                downX
                        ) > 10f ||
                        abs(
                            event.y -
                                downY
                        ) > 10f
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
                                isInsideImage(
                                    point
                                )
                            ) {

                                activePoints
                                    ?.add(
                                        PointF(
                                            point!!.x,
                                            point.y
                                        )
                                    )
                            }

                            invalidate()
                        }

                        Tool.SELECT -> {

                            if (
                                selectedTextIndex >=
                                0
                            ) {

                                val point =
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
                                    point != null &&
                                    previousPoint !=
                                    null
                                ) {

                                    val item =
                                        texts[
                                            selectedTextIndex
                                        ]

                                    val newX =
                                        item.x +
                                            point.x -
                                            previousPoint.x

                                    val newY =
                                        item.y +
                                            point.y -
                                            previousPoint.y

                                    val safe =
                                        clampTextAnchor(
                                            item.text,
                                            newX,
                                            newY,
                                            item.scale,
                                            item.rotation,
                                            item.align,
                                            item.size
                                        )

                                    item.x =
                                        safe.x

                                    item.y =
                                        safe.y

                                    saveAnnotationsForPage()
                                }

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

                                val currentIndex =
                                    airportCharts
                                        .indexOfFirst {
                                            it.page ==
                                                currentPage + 1
                                        }

                                val canSwipe =
                                    (
                                        currentIndex >
                                            0
                                    ) ||
                                        (
                                            currentIndex >=
                                                0 &&
                                                currentIndex <
                                                airportCharts.size -
                                                1
                                        )

                                if (
                                    canSwipe
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

                                objectEraseAt(
                                    event.x,
                                    event.y
                                )

                            } else {

                                pixelEraseAt(
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
                                points != null &&
                                points.size >=
                                2
                            ) {

                                val safe =
                                    points
                                        .filter {
                                            isInsideImage(
                                                it
                                            )
                                        }
                                        .map {
                                            PointF(
                                                it.x,
                                                it.y
                                            )
                                        }

                                if (
                                    safe.size >=
                                    2
                                ) {

                                    strokes.add(
                                        StoredStroke(
                                            safe.toMutableList(),
                                            annotationTool ==
                                                Tool.HIGHLIGHT
                                        )
                                    )

                                    saveAnnotationsForPage()
                                }
                            }

                            activePoints =
                                null

                            invalidate()

                            return true
                        }

                        Tool.SELECT -> {

                            if (
                                selectedTextIndex >=
                                0 &&
                                !moved
                            ) {

                                showTextEditDialog(
                                    selectedTextIndex
                                )

                                return true
                            }

                            if (
                                !moved &&
                                scale <=
                                1.02f
                            ) {

                                performClick()

                                return true
                            }

                            if (
                                scale <=
                                1.02f &&
                                swiping
                            ) {

                                val distance =
                                    event.x -
                                        swipeStartX

                                val threshold =
                                    width *
                                        0.22f

                                val currentIndex =
                                    airportCharts
                                        .indexOfFirst {
                                            it.page ==
                                                currentPage + 1
                                        }

                                if (
                                    distance <
                                    -threshold &&
                                    currentIndex >=
                                    0 &&
                                    currentIndex <
                                    airportCharts.size - 1
                                ) {

                                    completeSwipe(
                                        1
                                    )

                                } else if (
                                    distance >
                                    threshold &&
                                    currentIndex >
                                    0
                                ) {

                                    completeSwipe(
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

            val excessX =
                max(
                    0f,
                    (
                        imageWidth -
                            viewport.width()
                        ) / 2f
                )

            val excessY =
                max(
                    0f,
                    (
                        imageHeight -
                            viewport.height()
                        ) / 2f
                )

            offsetX =
                offsetX.coerceIn(
                    -excessX,
                    excessX
                )

            offsetY =
                offsetY.coerceIn(
                    -excessY,
                    excessY
                )
        }

        private fun completeSwipe(
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

            android.animation.ValueAnimator
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
                            android.animation
                                .Animator
                                .AnimatorListener {

                            override fun onAnimationStart(
                                animation:
                                    android.animation
                                        .Animator
                            ) {
                            }

                            override fun onAnimationEnd(
                                animation:
                                    android.animation
                                        .Animator
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
                                    android.animation
                                        .Animator
                            ) {
                            }

                            override fun onAnimationRepeat(
                                animation:
                                    android.animation
                                        .Animator
                            ) {
                            }
                        }
                    )

                    start()
                }
        }

        private fun returnToCenter() {

            android.animation.ValueAnimator
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
                            android.animation
                                .Animator
                                .AnimatorListener {

                            override fun onAnimationStart(
                                animation:
                                    android.animation
                                        .Animator
                            ) {
                            }

                            override fun onAnimationEnd(
                                animation:
                                    android.animation
                                        .Animator
                                        .Animator
                                        .AnimatorListener
                                        .Animator
                            ) {
                            }

                            override fun onAnimationCancel(
                                animation:
                                    android.animation
                                        .Animator
                            ) {
                            }

                            override fun onAnimationRepeat(
                                animation:
                                    android.animation
                                        .Animator
                            ) {
                            }
                        }
                    )
                }
                .start()
        }

        override fun performClick():
            Boolean {

            super.performClick()

            if (
                annotationTool ==
                Tool.SELECT
            ) {

                toggleViewerControls()
            }

            return true
        }
    }

    private fun firstNonEmpty(
        vararg values: String
    ):
        String {

        return values
            .firstOrNull {
                it.trim().isNotEmpty()
            }
            ?.trim()
            ?: ""
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
