package com.tareghmsr.jeppiran

import android.app.AlertDialog
import android.content.Context
import android.content.pm.ActivityInfo
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
import android.os.Bundle
import android.os.ParcelFileDescriptor
import android.text.InputType
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.view.animation.DecelerateInterpolator
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.activity.ComponentActivity
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
import kotlin.concurrent.thread
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt

class PdfViewerActivity : ComponentActivity() {

    private var renderer: PdfRenderer? = null
    private var descriptor: ParcelFileDescriptor? = null

    private var currentPage = 0
    private var totalPages = 0

    private var chartTitle = ""
    private var icao = ""
    private var airportName = ""
    private var city = ""
    private var category = ""

    private lateinit var root: FrameLayout
    private lateinit var chartView: ChartView
    private lateinit var toolbar: LinearLayout
    private lateinit var titleText: TextView
    private lateinit var pageText: TextView
    private lateinit var loadingText: TextView
    private lateinit var progressBar: ProgressBar

    private var invertChart = false
    private var controlsVisible = true

    private var annotationMode = false
    private var annotationTool = Tool.SELECT
    private var eraserMode = EraserMode.OBJECT

    private val airportCharts =
        mutableListOf<ChartInfo>()

    private var previousBitmap: Bitmap? = null
    private var nextBitmap: Bitmap? = null
    private var neighborsLoading = false

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

    private data class ChartInfo(
        val page: Int,
        val name: String,
        val category: String,
        val chartNumber: String
    )

    private data class StoredStroke(
        val points: MutableList<PointF>,
        val highlight: Boolean
    )

    private data class StoredText(
        var text: String,
        var x: Float,
        var y: Float,
        var scale: Float,
        var rotation: Float,
        val align: TextAlign,
        val size: Float = 20f
    )

    private val pdfUrl =
        "https://media.githubusercontent.com/media/mahmet737ng-gif/JeppIran/main/Iran2620.pdf"

    private val pdfFileName =
        "Iran2620.pdf"

    /*
     * The old viewer rendered at about 1.55x / 1.75x and then
     * enlarged that bitmap during zoom.
     *
     * We now render the active chart at a much higher raster
     * resolution and keep maximum zoom at the useful raster limit.
     */
    private val activeRenderQuality =
        2.5f

    private val neighborRenderQuality =
        1.0f

    private val maxZoom =
        activeRenderQuality

    private val topCropPercent =
        0.014f

    override fun onCreate(
        savedInstanceState: Bundle?
    ) {

        ThemeManager.apply(
            this
        )

        super.onCreate(
            savedInstanceState
        )

        currentPage =
            savedInstanceState?.getInt(
                "CURRENT_PAGE",
                0
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
                ?: intent.getStringExtra(
                    "TITLE"
                ).orEmpty()

        icao =
            intent.getStringExtra(
                "ICAO"
            ).orEmpty()

        airportName =
            savedInstanceState?.getString(
                "AIRPORT_NAME"
            )
                ?: intent.getStringExtra(
                    "AIRPORT_NAME"
                ).orEmpty()

        city =
            intent.getStringExtra(
                "CITY"
            ).orEmpty()

        category =
            intent.getStringExtra(
                "CATEGORY"
            ).orEmpty()

        loadAirportChartList()

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
                pdfFileName
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

        previousBitmap?.recycle()
        nextBitmap?.recycle()

        previousBitmap = null
        nextBitmap = null

        renderer?.close()
        renderer = null

        descriptor?.close()
        descriptor = null

        super.onDestroy()
    }

    private fun buildDownloadUi() {

        root =
            FrameLayout(this).apply {
                setBackgroundColor(
                    Color.rgb(
                        15,
                        18,
                        22
                    )
                )
            }

        val box =
            LinearLayout(this).apply {

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
                max = 100
            }

        loadingText =
            TextView(this).apply {

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
                    20.dp,
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
            loadingText
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

            try {

                val connection =
                    URL(
                        pdfUrl
                    ).openConnection()
                        as HttpURLConnection

                connection.connectTimeout =
                    30000

                connection.readTimeout =
                    60000

                connection.requestMethod =
                    "GET"

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
                        "$pdfFileName.tmp"
                    )

                connection.inputStream.use { input ->

                    FileOutputStream(
                        temporary
                    ).use { output ->

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

                                    progressBar.progress =
                                        percent

                                    loadingText.text =
                                        "Downloading PDF... $percent%"
                                }
                            }
                        }
                    }
                }

                connection.disconnect()

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
                e: Exception
            ) {

                runOnUiThread {

                    loadingText.text =
                        "Download failed:\n${e.message}"

                    progressBar.visibility =
                        View.GONE
                }
            }
        }
    }

    private fun buildViewerUi() {

        root =
            FrameLayout(this).apply {

                setBackgroundColor(
                    Color.rgb(
                        15,
                        18,
                        22
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

        buildToolbar()

        setContentView(
            root
        )

        applyInsets()
    }

    private fun buildToolbar() {

        toolbar =
            LinearLayout(this).apply {

                orientation =
                    LinearLayout.HORIZONTAL

                gravity =
                    Gravity.CENTER_VERTICAL

                setBackgroundColor(
                    Color.rgb(
                        17,
                        24,
                        32
                    )
                )

                elevation =
                    8.dp.toFloat()

                setPadding(
                    4.dp,
                    0,
                    4.dp,
                    0
                )
            }

        val back =
            makeToolbarButton(
                "‹"
            )

        back.setOnClickListener {
            finish()
        }

        val previous =
            makeToolbarButton(
                "◀"
            )

        previous.setOnClickListener {

            navigateWithinAirport(
                -1
            )
        }

        titleText =
            TextView(this).apply {

                text =
                    chartTitle.ifBlank {
                        "JeppIran Chart"
                    }

                textSize =
                    15f

                maxLines =
                    2

                typeface =
                    Typeface.DEFAULT_BOLD

                setTextColor(
                    Color.WHITE
                )

                gravity =
                    Gravity.CENTER_VERTICAL
            }

        pageText =
            TextView(this).apply {

                textSize =
                    11f

                setTextColor(
                    Color.rgb(
                        180,
                        190,
                        200
                    )
                )

                gravity =
                    Gravity.CENTER_VERTICAL
            }

        val titleBox =
            LinearLayout(this).apply {

                orientation =
                    LinearLayout.VERTICAL

                gravity =
                    Gravity.CENTER_VERTICAL

                addView(
                    titleText,
                    LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                    )
                )

                addView(
                    pageText,
                    LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                    )
                )
            }

        toolbar.addView(
            back,
            toolbarButtonParams()
        )

        toolbar.addView(
            previous,
            toolbarButtonParams()
        )

        toolbar.addView(
            titleBox,
            LinearLayout.LayoutParams(
                0,
                LinearLayout.LayoutParams.MATCH_PARENT,
                1f
            )
        )

        val next =
            makeToolbarButton(
                "▶"
            )

        next.setOnClickListener {

            navigateWithinAirport(
                1
            )
        }

        toolbar.addView(
            next,
            toolbarButtonParams()
        )

        if (
            isDarkTheme()
        ) {

            val invert =
                makeToolbarButton(
                    "◐"
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

            toolbar.addView(
                invert,
                toolbarButtonParams()
            )
        }

        val select =
            makeToolButton(
                "SELECT",
                Tool.SELECT
            )

        val pen =
            makeToolButton(
                "PEN",
                Tool.PEN
            )

        val highlighter =
            makeToolButton(
                "HIGHLIGHT",
                Tool.HIGHLIGHT
            )

        val text =
            makeToolButton(
                "TEXT",
                Tool.TEXT
            )

        val eraser =
            makeToolButton(
                "ERASER",
                Tool.ERASER
            )

        val clear =
            makeToolbarButton(
                "CLR"
            ).apply {
                textSize = 13f
            }

        clear.setOnClickListener {
            showClearAllDialog()
        }

        toolbar.addView(
            select,
            toolbarToolParams()
        )

        toolbar.addView(
            pen,
            toolbarToolParams()
        )

        toolbar.addView(
            highlighter,
            toolbarToolParams()
        )

        toolbar.addView(
            text,
            toolbarToolParams()
        )

        toolbar.addView(
            eraser,
            toolbarToolParams()
        )

        toolbar.addView(
            clear,
            toolbarButtonParams()
        )

        root.addView(
            toolbar,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                68.dp
            ).apply {
                gravity =
                    Gravity.TOP
            }
        )

        updateToolButtonStates()
    }

    private fun makeToolbarButton(
        value: String
    ): TextView {

        return TextView(this).apply {

            text =
                value

            textSize =
                20f

            gravity =
                Gravity.CENTER

            setTextColor(
                Color.WHITE
            )

            isClickable =
                true

            isFocusable =
                true

            setPadding(
                6.dp,
                0,
                6.dp,
                0
            )
        }
    }

    private fun makeToolButton(
        label: String,
        tool: Tool
    ): TextView {

        return TextView(this).apply {

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
                7.dp,
                0,
                7.dp,
                0
            )

            setOnClickListener {

                if (
                    tool == Tool.ERASER
                ) {

                    annotationMode =
                        true

                    annotationTool =
                        Tool.ERASER

                    showEraserModeDialog()

                } else {

                    annotationTool =
                        tool

                    annotationMode =
                        tool != Tool.SELECT
                }

                updateToolButtonStates()

                chartView.invalidate()
            }
        }
    }

    private fun updateToolButtonStates() {

        if (
            !::toolbar.isInitialized
        ) {
            return
        }

        for (
            i in 0 until toolbar.childCount
        ) {

            val child =
                toolbar.getChildAt(
                    i
                )

            if (
                child !is TextView
            ) {
                continue
            }

            val value =
                child.text
                    .toString()
                    .uppercase()

            val active =
                when (value) {

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
                if (active) {
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
            if (active) {
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

    private fun toolbarButtonParams():
        LinearLayout.LayoutParams {

        return LinearLayout.LayoutParams(
            42.dp,
            LinearLayout.LayoutParams.MATCH_PARENT
        )
    }

    private fun toolbarToolParams():
        LinearLayout.LayoutParams {

        return LinearLayout.LayoutParams(
            64.dp,
            LinearLayout.LayoutParams.MATCH_PARENT
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

            val params =
                toolbar.layoutParams
                    as FrameLayout.LayoutParams

            params.topMargin =
                bars.top

            params.leftMargin =
                bars.left

            params.rightMargin =
                bars.right

            toolbar.layoutParams =
                params

            chartView.setContentInsets(
                bars.left,
                bars.top + 68.dp,
                bars.right,
                bars.bottom
            )

            insets
        }

        ViewCompat.requestApplyInsets(
            root
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
                renderer!!.pageCount

            currentPage =
                currentPage.coerceIn(
                    0,
                    max(
                        0,
                        totalPages - 1
                    )
                )

            loadAirportChartList()

            val info =
                airportChartInfo(
                    currentPage
                )

            if (
                info != null
            ) {

                chartTitle =
                    info.name

                category =
                    info.category
            }

            showPage(
                currentPage
            )

        } catch (
            e: Exception
        ) {

            showError(
                "Unable to open PDF:\n${e.message}"
            )
        }
    }

    private fun showPage(
        index: Int
    ) {

        val pdf =
            renderer ?: return

        if (
            index < 0 ||
            index >= pdf.pageCount
        ) {
            return
        }

        currentPage =
            index

        val info =
            airportChartInfo(
                index
            )

        if (
            info != null
        ) {

            chartTitle =
                info.name

            category =
                info.category
        }

        val page =
            pdf.openPage(
                index
            )

        val width =
            page.width

        val height =
            page.height

        page.close()

        val landscape =
            width > height

        requestedOrientation =
            if (
                landscape
            ) {
                ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
            } else {
                ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
            }

        chartView.setLandscapeMode(
            landscape
        )

        val bitmap =
            renderPageBitmap(
                index,
                activeRenderQuality
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
    }

    private fun navigateWithinAirport(
        direction: Int
    ) {

        val currentIndex =
            airportIndexForPage(
                currentPage
            )

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
            target >= airportCharts.size
        ) {
            return
        }

        showPage(
            airportCharts[
                target
            ].page - 1
        )
    }

    private fun airportIndexForPage(
        pageIndex: Int
    ): Int {

        val number =
            pageIndex + 1

        return airportCharts.indexOfFirst {
            it.page == number
        }
    }

    private fun airportChartInfo(
        pageIndex: Int
    ): ChartInfo? {

        val number =
            pageIndex + 1

        return airportCharts.firstOrNull {
            it.page == number
        }
    }

    private fun buildPageText():
        String {

        val position =
            airportIndexForPage(
                currentPage
            )

        return if (
            position >= 0
        ) {

            "${position + 1} / ${airportCharts.size}  •  PDF ${currentPage + 1} / $totalPages"

        } else {

            "${currentPage + 1} / $totalPages"
        }
    }

    private fun prepareNeighborBitmaps() {

        if (
            neighborsLoading
        ) {
            return
        }

        val currentIndex =
            airportIndexForPage(
                currentPage
            )

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
                        neighborRenderQuality
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
                        neighborRenderQuality
                    )

                } else {
                    null
                }

            runOnUiThread {

                previousBitmap?.recycle()
                nextBitmap?.recycle()

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

    private fun renderPageBitmap(
        pageIndex: Int,
        quality: Float
    ): Bitmap? {

        val pdf =
            renderer ?: return null

        return try {

            synchronized(pdf) {

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

                val bitmapWidth =
                    (
                        page.width *
                            renderScale
                    )
                        .toInt()
                        .coerceAtLeast(
                            1
                        )

                val bitmapHeight =
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
                        bitmapWidth,
                        bitmapHeight,
                        Bitmap.Config.ARGB_8888
                    )

                bitmap.eraseColor(
                    Color.WHITE
                )

                page.render(
                    bitmap,
                    null,
                    null,
                    PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY
                )

                page.close()

                val cropTop =
                    (
                        bitmap.height *
                            topCropPercent
                    )
                        .toInt()
                        .coerceIn(
                            0,
                            bitmap.height - 1
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

    private fun loadAirportChartList() {

        airportCharts.clear()

        try {

            val raw =
                assets
                    .open(
                        "charts-app-v16.json"
                    )
                    .bufferedReader()
                    .use {
                        it.readText()
                    }
                    .trim()

            if (
                raw.startsWith("[")
            ) {

                readChartArray(
                    JSONArray(
                        raw
                    )
                )

            } else {

                val root =
                    JSONObject(
                        raw
                    )

                val possibleArrays =
                    listOf(
                        "charts",
                        "data",
                        "items",
                        "pages"
                    )

                var loaded =
                    false

                for (
                    key in possibleArrays
                ) {

                    val value =
                        root.opt(
                            key
                        )

                    if (
                        value is JSONArray
                    ) {

                        readChartArray(
                            value
                        )

                        loaded =
                            true

                        break
                    }
                }

                if (
                    !loaded
                ) {

                    val keys =
                        root.keys()

                    while (
                        keys.hasNext()
                    ) {

                        val value =
                            root.opt(
                                keys.next()
                            )

                        if (
                            value is JSONObject
                        ) {

                            readChartObject(
                                value
                            )
                        }
                    }
                }
            }

            airportCharts.sortBy {
                it.page
            }

        } catch (
            _: Exception
        ) {
        }
    }

    private fun readChartArray(
        array: JSONArray
    ) {

        for (
            i in 0 until array.length()
        ) {

            val item =
                array.optJSONObject(
                    i
                )
                    ?: continue

            readChartObject(
                item
            )
        }
    }

    private fun readChartObject(
        item: JSONObject
    ) {

        val itemIcao =
            firstNonEmpty(
                item.optString(
                    "icao"
                ),
                item.optString(
                    "airport"
                ),
                item.optString(
                    "airport_icao"
                )
            ).uppercase()

        if (
            itemIcao.isBlank()
        ) {
            return
        }

        if (
            icao.isNotBlank() &&
            itemIcao != icao.uppercase()
        ) {
            return
        }

        val page =
            firstPositiveInt(
                item.optInt(
                    "page",
                    -1
                ),
                item.optInt(
                    "pageNumber",
                    -1
                ),
                item.optInt(
                    "page_number",
                    -1
                )
            )

        if (
            page <= 0
        ) {
            return
        }

        val chartCategory =
            firstNonEmpty(
                item.optString(
                    "category"
                ),
                item.optString(
                    "type"
                ),
                item.optString(
                    "chart_type"
                ),
                "Other"
            )

        val chartNumber =
            firstNonEmpty(
                item.optString(
                    "chart_number"
                ),
                item.optString(
                    "chartNumber"
                )
            )

        val rawName =
            firstNonEmpty(
                item.optString(
                    "name"
                ),
                item.optString(
                    "title"
                ),
                item.optString(
                    "chart_name"
                )
            )

        val name =
            makeChartDisplayName(
                rawName,
                chartCategory,
                chartNumber,
                page
            )

        airportCharts.add(
            ChartInfo(
                page,
                name,
                chartCategory,
                chartNumber
            )
        )
    }

    private fun makeChartDisplayName(
        rawName: String,
        chartCategory: String,
        chartNumber: String,
        page: Int
    ): String {

        val clean =
            rawName.trim()

        val placeholder =
            clean.isBlank() ||
                clean.matches(
                    Regex(
                        "(?i)chart\\s*page\\s*\\d+"
                    )
                )

        if (
            !placeholder
        ) {
            return clean
        }

        if (
            chartNumber.isNotBlank()
        ) {

            return chartCategory.trim()
                .uppercase() +
                " " +
                chartNumber.trim()
        }

        return chartCategory.trim()
            .uppercase() +
            " CHART"
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
            }
            .setNegativeButton(
                "Cancel"
            ) { dialog, _ ->

                dialog.dismiss()
            }
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
        imageX: Float,
        imageY: Float
    ) {

        val container =
            LinearLayout(this).apply {

                orientation =
                    LinearLayout.VERTICAL

                setPadding(
                    12.dp,
                    4.dp,
                    12.dp,
                    4.dp
                )
            }

        val input =
            EditText(this).apply {

                inputType =
                    InputType.TYPE_CLASS_TEXT or
                        InputType.TYPE_TEXT_FLAG_MULTI_LINE or
                        InputType.TYPE_TEXT_FLAG_CAP_SENTENCES

                minLines =
                    5

                gravity =
                    Gravity.TOP or
                        Gravity.START

                hint =
                    "Enter annotation text"
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
            LinearLayout(this).apply {

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

        fun makeAlignButton(
            label: String,
            value: TextAlign
        ): TextView {

            return TextView(
                this
            ).apply {

                text =
                    label

                gravity =
                    Gravity.CENTER

                setPadding(
                    10.dp,
                    10.dp,
                    10.dp,
                    10.dp
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
            makeAlignButton(
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
            makeAlignButton(
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
            makeAlignButton(
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

                    annotationMode =
                        false

                    annotationTool =
                        Tool.SELECT

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

                        chartView.addTextAnnotation(
                            value,
                            imageX,
                            imageY,
                            alignment
                        )

                        saveAnnotationsForPage()
                    }

                    annotationMode =
                        false

                    annotationTool =
                        Tool.SELECT

                    updateToolButtonStates()

                    chartView.invalidate()
                }
                .create()

        dialog.window?.setSoftInputMode(
            WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
        )

        dialog.show()

        input.requestFocus()

        dialog.window?.setSoftInputMode(
            WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE or
                WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
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

        val input =
            EditText(
                this
            ).apply {

                setText(
                    item.text
                )

                inputType =
                    InputType.TYPE_CLASS_TEXT or
                        InputType.TYPE_TEXT_FLAG_MULTI_LINE

                minLines =
                    5

                gravity =
                    Gravity.TOP

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
            .setPositiveButton(
                "Save"
            ) { _, _ ->

                item.text =
                    input.text
                        .toString()

                saveAnnotationsForPage()

                chartView.invalidate()
            }
            .show()
    }

    private fun annotationPreferences() =
        getSharedPreferences(
            "jeppiran_annotations",
            Context.MODE_PRIVATE
        )

    private fun annotationKey(
        page: Int
    ) =
        "page_$page"

    private fun saveAnnotationsForPage() {

        if (
            !::chartView.isInitialized
        ) {
            return
        }

        val rootObject =
            JSONObject()

        val strokes =
            JSONArray()

        chartView.getStrokes()
            .forEach { stroke ->

                val strokeObject =
                    JSONObject()

                strokeObject.put(
                    "highlight",
                    stroke.highlight
                )

                val points =
                    JSONArray()

                stroke.points.forEach { point ->

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

        chartView.getTexts()
            .forEach { item ->

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
                annotationKey(
                    currentPage
                ),
                rootObject.toString()
            )
            .apply()
    }

    private fun loadAnnotationsForPage() {

        if (
            !::chartView.isInitialized
        ) {
            return
        }

        chartView.clearAnnotationsInternal()

        val value =
            annotationPreferences()
                .getString(
                    annotationKey(
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
                rootObject.optJSONArray(
                    "strokes"
                )

            if (
                strokes != null
            ) {

                for (
                    i in 0 until strokes.length()
                ) {

                    val stroke =
                        strokes.optJSONObject(
                            i
                        )
                            ?: continue

                    val highlight =
                        stroke.optBoolean(
                            "highlight",
                            false
                        )

                    val points =
                        mutableListOf<PointF>()

                    val array =
                        stroke.optJSONArray(
                            "points"
                        )

                    if (
                        array != null
                    ) {

                        for (
                            j in 0 until array.length()
                        ) {

                            val point =
                                array.optJSONObject(
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

                    if (
                        points.isNotEmpty()
                    ) {

                        chartView.addStoredStroke(
                            points,
                            highlight
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
                    i in 0 until texts.length()
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

                    chartView.addStoredText(
                        item.optString(
                            "text",
                            ""
                        ),
                        item.optDouble(
                            "x",
                            0.0
                        ).toFloat(),
                        item.optDouble(
                            "y",
                            0.0
                        ).toFloat(),
                        item.optDouble(
                            "scale",
                            1.0
                        ).toFloat(),
                        item.optDouble(
                            "rotation",
                            0.0
                        ).toFloat(),
                        align,
                        item.optDouble(
                            "size",
                            20.0
                        ).toFloat()
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
                annotationKey(
                    currentPage
                )
            )
            .apply()

        chartView.clearAnnotationsInternal()

        chartView.invalidate()
    }

    private fun hideViewerControls() {

        toolbar.visibility =
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

        toolbar.visibility =
            View.VISIBLE

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
            annotationTool != Tool.SELECT
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
    ) : View(context) {

        private var bitmap: Bitmap? = null
        private var previous: Bitmap? = null
        private var next: Bitmap? = null

        private var scale =
            1f

        private var offsetX =
            0f

        private var offsetY =
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

        private var swipeOffset =
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
                        50,
                        120
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

            bitmap?.let {
                if (!it.isRecycled) {
                    it.recycle()
                }
            }

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
            List<StoredStroke> =
            strokes.toList()

        fun getTexts():
            List<StoredText> =
            texts.toList()

        fun clearAnnotationsInternal() {

            strokes.clear()

            texts.clear()

            activePoints =
                null

            selectedTextIndex =
                -1
        }

        fun addStoredStroke(
            points: List<PointF>,
            highlight: Boolean
        ) {

            strokes.add(
                StoredStroke(
                    points
                        .map {
                            PointF(
                                it.x,
                                it.y
                            )
                        }
                        .toMutableList(),
                    highlight
                )
            )
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

            texts.add(
                StoredText(
                    value,
                    x,
                    y,
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

            texts.add(
                StoredText(
                    value,
                    x,
                    y,
                    1f,
                    0f,
                    alignment,
                    20f
                )
            )
        }

        fun getTextAt(
            index: Int
        ): StoredText? =
            texts.getOrNull(
                index
            )

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
                        15,
                        18,
                        22
                    )
                }
            )

            val image =
                bitmap ?: return

            val availableWidth =
                (
                    width -
                        contentLeft -
                        contentRight
                )
                    .coerceAtLeast(
                        1
                    )
                    .toFloat()

            val availableHeight =
                (
                    height -
                        contentTop -
                        contentBottom
                )
                    .coerceAtLeast(
                        1
                    )
                    .toFloat()

            val baseScale =
                min(
                    availableWidth /
                        image.width,
                    availableHeight /
                        image.height
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
                contentLeft +
                    availableWidth / 2f

            val centerY =
                contentTop +
                    availableHeight / 2f

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

            if (
                swiping
            ) {

                drawNeighbor(
                    canvas,
                    previous,
                    left - width,
                    top,
                    finalScale
                )

                drawNeighbor(
                    canvas,
                    next,
                    left + width,
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

            if (
                activePoints != null &&
                activePoints!!.isNotEmpty()
            ) {

                drawPoints(
                    canvas,
                    activePoints!!,
                    annotationTool ==
                        Tool.HIGHLIGHT
                )
            }

            canvas.restore()

            canvas.restore()
        }

        private fun drawNeighbor(
            canvas: Canvas,
            image: Bitmap?,
            left: Float,
            top: Float,
            scaleValue: Float
        ) {

            if (
                image == null
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

            strokes.forEach { stroke ->

                drawPoints(
                    canvas,
                    stroke.points,
                    stroke.highlight
                )
            }

            texts.forEachIndexed { index, item ->

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

                    val bounds =
                        measureTextBounds(
                            item
                        )

                    canvas.drawRect(
                        bounds,
                        selectionPaint
                    )

                    canvas.drawCircle(
                        bounds.centerX(),
                        bounds.top,
                        6f,
                        selectionPaint
                    )
                }

                canvas.restore()
            }
        }

        private fun measureTextBounds(
            item: StoredText
        ): RectF {

            textPaint.textSize =
                item.size

            val lines =
                item.text.split(
                    "\n"
                )

            var maxWidth =
                1f

            lines.forEach { line ->

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

            return RectF(
                -maxWidth / 2f - 12f,
                -4f,
                maxWidth / 2f + 12f,
                height + 8f
            )
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
                i in 1 until points.size
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

        private fun screenToImage(
            x: Float,
            y: Float
        ): PointF? {

            val image =
                bitmap ?: return null

            val availableWidth =
                (
                    width -
                        contentLeft -
                        contentRight
                )
                    .coerceAtLeast(
                        1
                    )
                    .toFloat()

            val availableHeight =
                (
                    height -
                        contentTop -
                        contentBottom
                )
                    .coerceAtLeast(
                        1
                    )
                    .toFloat()

            val baseScale =
                min(
                    availableWidth /
                        image.width,
                    availableHeight /
                        image.height
                )

            val finalScale =
                baseScale *
                    scale

            if (
                finalScale <= 0f
            ) {
                return null
            }

            val drawWidth =
                image.width *
                    finalScale

            val drawHeight =
                image.height *
                    finalScale

            val centerX =
                contentLeft +
                    availableWidth / 2f

            val centerY =
                contentTop +
                    availableHeight / 2f

            val left =
                centerX -
                    drawWidth / 2f +
                    offsetX +
                    swipeOffset

            val top =
                centerY -
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

        private fun isInsideImage(
            point: PointF?
        ): Boolean {

            val image =
                bitmap ?: return false

            if (
                point == null
            ) {
                return false
            }

            return point.x >= 0f &&
                point.y >= 0f &&
                point.x <= image.width.toFloat() &&
                point.y <= image.height.toFloat()
        }

        private fun imageToScreen(
            point: PointF
        ): PointF {

            val image =
                bitmap ?: return PointF()

            val availableWidth =
                (
                    width -
                        contentLeft -
                        contentRight
                )
                    .coerceAtLeast(
                        1
                    )
                    .toFloat()

            val availableHeight =
                (
                    height -
                        contentTop -
                        contentBottom
                )
                    .coerceAtLeast(
                        1
                    )
                    .toFloat()

            val baseScale =
                min(
                    availableWidth /
                        image.width,
                    availableHeight /
                        image.height
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
                contentLeft +
                    availableWidth / 2f

            val centerY =
                contentTop +
                    availableHeight / 2f

            val left =
                centerX -
                    drawWidth / 2f +
                    offsetX +
                    swipeOffset

            val top =
                centerY -
                    drawHeight / 2f +
                    offsetY

            return PointF(
                left +
                    point.x *
                    finalScale,
                top +
                    point.y *
                    finalScale
            )
        }

        private fun constrainPan() {

            val image =
                bitmap ?: return

            if (
                scale <= 1.02f
            ) {

                scale =
                    1f

                offsetX =
                    0f

                offsetY =
                    0f

                return
            }

            val availableWidth =
                (
                    width -
                        contentLeft -
                        contentRight
                )
                    .coerceAtLeast(
                        1
                    )
                    .toFloat()

            val availableHeight =
                (
                    height -
                        contentTop -
                        contentBottom
                )
                    .coerceAtLeast(
                        1
                    )
                    .toFloat()

            val baseScale =
                min(
                    availableWidth /
                        image.width,
                    availableHeight /
                        image.height
                )

            val finalScale =
                baseScale *
                    scale

            val excessX =
                max(
                    0f,
                    (
                        image.width *
                            finalScale -
                            availableWidth
                        ) / 2f
                )

            val excessY =
                max(
                    0f,
                    (
                        image.height *
                            finalScale -
                            availableHeight
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

        private fun findTextAt(
            screenX: Float,
            screenY: Float
        ): Int {

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

            for (
                index in texts.indices.reversed()
            ) {

                val item =
                    texts[index]

                val dx =
                    point!!.x -
                        item.x

                val dy =
                    point.y -
                        item.y

                val radians =
                    Math.toRadians(
                        (-item.rotation).toDouble()
                    )

                val localX =
                    (
                        dx *
                            cos(radians) -
                            dy *
                            sin(radians)
                    ) /
                        item.scale

                val localY =
                    (
                        dx *
                            sin(radians) +
                            dy *
                            cos(radians)
                    ) /
                        item.scale

                if (
                    measureTextBounds(
                        item
                    )
                        .contains(
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
        ): Int {

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

            val radius =
                30f /
                    scale.coerceAtLeast(
                        1f
                    )

            for (
                index in strokes.indices.reversed()
            ) {

                val stroke =
                    strokes[index]

                if (
                    stroke.points.any { sample ->

                        val dx =
                            sample.x -
                                point!!.x

                        val dy =
                            sample.y -
                                point.y

                        (
                            dx * dx +
                                dy * dy
                            ) <=
                            radius * radius
                    }
                ) {

                    return index
                }
            }

            return -1
        }

        private fun objectEraseAt(
            screenX: Float,
            screenY: Float
        ) {

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
                return
            }

            val textIndex =
                findTextAt(
                    screenX,
                    screenY
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
                    screenX,
                    screenY
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
            screenX: Float,
            screenY: Float
        ) {

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
                return
            }

            val textIndex =
                findTextAt(
                    screenX,
                    screenY
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
                32f /
                    scale.coerceAtLeast(
                        1f
                    )

            val rebuilt =
                mutableListOf<StoredStroke>()

            strokes.forEach { stroke ->

                var segment =
                    mutableListOf<PointF>()

                stroke.points.forEach { sample ->

                    val dx =
                        sample.x -
                            point!!.x

                    val dy =
                        sample.y -
                            point.y

                    val erased =
                        dx * dx +
                            dy * dy <=
                            radius * radius

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
                event.pointerCount < 2
            ) {
                return
            }

            val item =
                texts[
                    selectedTextIndex
                ]

            val currentDistance =
                pointerDistance(
                    event
                )

            if (
                textGestureStartDistance > 0f
            ) {

                item.scale =
                    (
                        textGestureStartScale *
                            currentDistance /
                            textGestureStartDistance
                    ).coerceIn(
                        0.35f,
                        maxZoom
                    )
            }

            item.rotation =
                textGestureStartRotation +
                    (
                        pointerAngle(event) -
                            textGestureStartAngle
                    )

            val center =
                pointerCenter(
                    event
                )

            val centerImage =
                screenToImage(
                    center.x,
                    center.y
                )

            val startImage =
                screenToImage(
                    downX,
                    downY
                )

            if (
                centerImage != null &&
                startImage != null &&
                isInsideImage(
                    centerImage
                )
            ) {

                item.x =
                    textGestureStartX +
                        centerImage.x -
                        startImage.x

                item.y =
                    textGestureStartY +
                        centerImage.y -
                        startImage.y

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

                            selectedTextIndex
                        }

                    if (
                        annotationTool ==
                            Tool.ERASER
                    ) {

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

                    if (
                        annotationTool ==
                            Tool.TEXT &&
                        annotationMode
                    ) {

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

                    if (
                        annotationTool ==
                            Tool.PEN ||
                        annotationTool ==
                            Tool.HIGHLIGHT
                    ) {

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
                                    point!!
                                )

                            } else {

                                null
                            }

                        return true
                    }

                    return true
                }

                MotionEvent.ACTION_POINTER_DOWN -> {

                    if (
                        event.pointerCount >= 2
                    ) {

                        pinchDistance =
                            pointerDistance(
                                event
                            )

                        if (
                            annotationTool ==
                                Tool.SELECT &&
                            selectedTextIndex >= 0
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
                        }

                        activePoints =
                            null
                    }

                    return true
                }

                MotionEvent.ACTION_MOVE -> {

                    if (
                        event.pointerCount >= 2
                    ) {

                        if (
                            annotationTool ==
                                Tool.SELECT &&
                            selectedTextIndex >= 0
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
                                pinchDistance > 0f
                            ) {

                                val factor =
                                    currentDistance /
                                        pinchDistance

                                scale =
                                    (
                                        scale *
                                            factor
                                    ).coerceIn(
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
                                        point!!
                                    )
                            }

                            invalidate()
                        }

                        Tool.SELECT -> {

                            if (
                                selectedTextIndex >= 0
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
                                    previousPoint != null &&
                                    isInsideImage(
                                        point
                                    )
                                ) {

                                    val item =
                                        texts[
                                            selectedTextIndex
                                        ]

                                    item.x +=
                                        point.x -
                                            previousPoint.x

                                    item.y +=
                                        point.y -
                                            previousPoint.y

                                    saveAnnotationsForPage()
                                }

                            } else if (
                                scale > 1.02f
                            ) {

                                offsetX +=
                                    dx

                                offsetY +=
                                    dy

                                constrainPan()

                            } else {

                                val currentIndex =
                                    airportIndexForPage(
                                        currentPage
                                    )

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

                        else -> {

                            if (
                                scale > 1.02f
                            ) {

                                offsetX +=
                                    dx

                                offsetY +=
                                    dy

                                constrainPan()

                                invalidate()
                            }
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
                                points.size >= 2
                            ) {

                                strokes.add(
                                    StoredStroke(
                                        points
                                            .map {
                                                PointF(
                                                    it.x,
                                                    it.y
                                                )
                                            }
                                            .toMutableList(),
                                        annotationTool ==
                                            Tool.HIGHLIGHT
                                    )
                                )

                                saveAnnotationsForPage()
                            }

                            activePoints =
                                null

                            invalidate()

                            return true
                        }

                        Tool.SELECT -> {

                            if (
                                selectedTextIndex >= 0 &&
                                !moved
                            ) {

                                showTextEditDialog(
                                    selectedTextIndex
                                )

                                return true
                            }

                            if (
                                !moved &&
                                scale <= 1.02f
                            ) {

                                performClick()

                                return true
                            }

                            if (
                                scale <= 1.02f &&
                                swiping
                            ) {

                                val distance =
                                    event.x -
                                        swipeStartX

                                val threshold =
                                    width *
                                        0.22f

                                val currentIndex =
                                    airportIndexForPage(
                                        currentPage
                                    )

                                if (
                                    distance < -threshold &&
                                    currentIndex >= 0 &&
                                    currentIndex <
                                        airportCharts.size - 1
                                ) {

                                    completeSwipe(
                                        1
                                    )

                                } else if (
                                    distance > threshold &&
                                    currentIndex > 0
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

            val animator =
                android.animation.ValueAnimator.ofFloat(
                    swipeOffset,
                    target
                )

            animator.duration =
                180L

            animator.interpolator =
                DecelerateInterpolator()

            animator.addUpdateListener {

                swipeOffset =
                    it.animatedValue as Float

                invalidate()
            }

            animator.addListener(
                object :
                    android.animation.Animator.AnimatorListener {

                    override fun onAnimationStart(
                        animation:
                            android.animation.Animator
                    ) {
                    }

                    override fun onAnimationEnd(
                        animation:
                            android.animation.Animator
                    ) {

                        val newIndex =
                            airportIndexForPage(
                                currentPage
                            ) +
                                direction

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
                            android.animation.Animator
                    ) {
                    }

                    override fun onAnimationRepeat(
                        animation:
                            android.animation.Animator
                    ) {
                    }
                }
            )

            animator.start()
        }

        private fun returnToCenter() {

            val animator =
                android.animation.ValueAnimator.ofFloat(
                    swipeOffset,
                    0f
                )

            animator.duration =
                150L

            animator.interpolator =
                DecelerateInterpolator()

            animator.addUpdateListener {

                swipeOffset =
                    it.animatedValue as Float

                invalidate()
            }

            animator.addListener(
                object :
                    android.animation.Animator.AnimatorListener {

                    override fun onAnimationStart(
                        animation:
                            android.animation.Animator
                    ) {
                    }

                    override fun onAnimationEnd(
                        animation:
                            android.animation.Animator
                    ) {

                        swiping =
                            false

                        swipeOffset =
                            0f

                        invalidate()
                    }

                    override fun onAnimationCancel(
                        animation:
                            android.animation.Animator
                    ) {
                    }

                    override fun onAnimationRepeat(
                        animation:
                            android.animation.Animator
                    ) {
                    }
                }
            )

            animator.start()
        }

        private fun pointerDistance(
            event: MotionEvent
        ): Float {

            if (
                event.pointerCount < 2
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
                event.pointerCount < 2
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
        ): PointF {

            if (
                event.pointerCount < 2
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
    ): String {

        return values.firstOrNull {
            it.trim().isNotEmpty()
        }
            ?.trim()
            ?: ""
    }

    private fun firstPositiveInt(
        vararg values: Int
    ): Int {

        return values.firstOrNull {
            it > 0
        }
            ?: -1
    }

    private fun resolveThemeColor(
        attribute: Int
    ): Int {

        val value =
            android.util.TypedValue()

        theme.resolveAttribute(
            attribute,
            value,
            true
        )

        return if (
            value.resourceId != 0
        ) {

            getColor(
                value.resourceId
            )

        } else {

            value.data
        }
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
