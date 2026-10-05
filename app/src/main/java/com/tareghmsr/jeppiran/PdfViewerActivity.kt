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
import android.view.WindowInsets
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
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

class PdfViewerActivity : ComponentActivity() {

    private var renderer: PdfRenderer? = null
    private var descriptor: ParcelFileDescriptor? = null

    private var currentPage = 0
    private var totalPages = 0

    private lateinit var root: FrameLayout
    private lateinit var chartView: ChartView
    private lateinit var toolbar: LinearLayout

    private lateinit var titleText: TextView
    private lateinit var pageText: TextView
    private lateinit var loadingText: TextView
    private lateinit var progressBar: ProgressBar

    private var chartTitle = ""
    private var icao = ""
    private var city = ""
    private var category = ""

    private var controlsVisible = true
    private var annotationMode = false
    private var annotationTool = Tool.PEN
    private var invertChart = false

    private var currentOrientationLandscape = false

    private val airportCharts =
        mutableListOf<ChartInfo>()

    private var previousBitmap:
        Bitmap? = null

    private var nextBitmap:
        Bitmap? = null

    private var loadingNeighbors = false

    private enum class Tool {
        PEN,
        HIGHLIGHT,
        TEXT
    }

    private data class ChartInfo(
        val page: Int,
        val name: String,
        val category: String
    )

    private data class StoredStroke(
        val points: List<PointF>,
        val highlight: Boolean
    )

    private data class StoredText(
        val text: String,
        val x: Float,
        val y: Float
    )

    private val pdfUrl =
        "https://media.githubusercontent.com/media/mahmet737ng-gif/JeppIran/main/Iran2620.pdf"

    private val pdfFileName =
        "Iran2620.pdf"

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
                ?: intent.getStringExtra(
                    "TITLE"
                ).orEmpty()

        icao =
            intent.getStringExtra(
                "ICAO"
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

        super.onSaveInstanceState(
            outState
        )
    }

    override fun onDestroy() {

        previousBitmap?.recycle()
        nextBitmap?.recycle()

        previousBitmap =
            null

        nextBitmap =
            null

        renderer?.close()
        descriptor?.close()

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
            )

        progressBar.max =
            100

        progressBar.progress =
            0

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
                    )
                        .openConnection()
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

        updateLayoutForOrientation()
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
            }

        val back =
            makeButton(
                "‹"
            )

        back.setOnClickListener {

            finish()
        }

        val previous =
            makeButton(
                "◀"
            )

        previous.setOnClickListener {

            showPageByAirportIndex(
                airportIndexForPage(
                    currentPage
                ) - 1
            )
        }

        val next =
            makeButton(
                "▶"
            )

        next.setOnClickListener {

            showPageByAirportIndex(
                airportIndexForPage(
                    currentPage
                ) + 1
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

                typeface =
                    Typeface.DEFAULT_BOLD

                setTextColor(
                    Color.WHITE
                )

                gravity =
                    Gravity.CENTER_VERTICAL

                maxLines =
                    2
            }

        pageText =
            TextView(this).apply {

                textSize =
                    12f

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

        val info =
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

        val annotation =
            makeButton(
                "✎"
            )

        annotation.setOnClickListener {

            showAnnotationMenu()
        }

        toolbar.addView(
            back,
            buttonParams()
        )

        toolbar.addView(
            previous,
            buttonParams()
        )

        toolbar.addView(
            info,
            LinearLayout.LayoutParams(
                0,
                LinearLayout.LayoutParams.MATCH_PARENT,
                1f
            )
        )

        toolbar.addView(
            next,
            buttonParams()
        )

        if (
            isDarkTheme()
        ) {

            val invert =
                makeButton(
                    "◐"
                )

            invert.contentDescription =
                "Invert chart"

            invert.setTextColor(
                if (
                    invertChart
                ) {
                    Color.rgb(
                        80,
                        220,
                        135
                    )
                } else {
                    Color.WHITE
                }
            )

            invert.setOnClickListener {

                invertChart =
                    !invertChart

                chartView.setInverted(
                    invertChart
                )

                invert.setTextColor(
                    if (
                        invertChart
                    ) {
                        Color.rgb(
                            80,
                            220,
                            135
                        )
                    } else {
                        Color.WHITE
                    }
                )
            }

            toolbar.addView(
                invert,
                buttonParams()
            )
        }

        toolbar.addView(
            annotation,
            buttonParams()
        )

        root.addView(
            toolbar,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                64.dp
            ).apply {

                gravity =
                    Gravity.TOP
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

            updateSystemBarLayout(
                bars.top,
                bars.bottom,
                bars.left,
                bars.right
            )

            insets
        }

        ViewCompat.requestApplyInsets(
            root
        )
    }

    private fun updateSystemBarLayout(
        top: Int,
        bottom: Int,
        left: Int,
        right: Int
    ) {

        if (
            !::toolbar.isInitialized
        ) {
            return
        }

        if (
            !controlsVisible
        ) {
            return
        }

        val params =
            toolbar.layoutParams
                as FrameLayout.LayoutParams

        params.topMargin =
            top

        params.leftMargin =
            left

        params.rightMargin =
            right

        toolbar.layoutParams =
            params

        chartView.setContentInsets(
            left,
            top,
            right,
            bottom
        )
    }

    private fun updateLayoutForOrientation() {

        if (
            !::toolbar.isInitialized
        ) {
            return
        }

        chartView.setLandscapeMode(
            currentOrientationLandscape
        )
    }

    private fun makeButton(
        value: String
    ): TextView {

        return TextView(this).apply {

            text =
                value

            textSize =
                22f

            setTextColor(
                Color.WHITE
            )

            gravity =
                Gravity.CENTER

            isClickable =
                true

            isFocusable =
                true

            setPadding(
                8.dp,
                0,
                8.dp,
                0
            )
        }
    }

    private fun buttonParams():
        LinearLayout.LayoutParams {

        return LinearLayout.LayoutParams(
            52.dp,
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

            val airportIndex =
                airportIndexForPage(
                    currentPage
                )

            if (
                airportIndex >= 0
            ) {

                val info =
                    airportCharts[
                        airportIndex
                    ]

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

        currentOrientationLandscape =
            width > height

        requestedOrientation =
            if (
                currentOrientationLandscape
            ) {

                ActivityInfo
                    .SCREEN_ORIENTATION_LANDSCAPE

            } else {

                ActivityInfo
                    .SCREEN_ORIENTATION_PORTRAIT
            }

        updateLayoutForOrientation()

        val bitmap =
            renderPageBitmap(
                index
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

    private fun showPageByAirportIndex(
        index: Int
    ) {

        if (
            index < 0 ||
            index >= airportCharts.size
        ) {
            return
        }

        showPage(
            airportCharts[index].page - 1
        )
    }

    private fun airportIndexForPage(
        pageIndex: Int
    ): Int {

        val pageNumber =
            pageIndex + 1

        return airportCharts.indexOfFirst {
            it.page == pageNumber
        }
    }

    private fun airportChartInfo(
        pageIndex: Int
    ): ChartInfo? {

        val pageNumber =
            pageIndex + 1

        return airportCharts.firstOrNull {
            it.page == pageNumber
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
            loadingNeighbors ||
            airportCharts.isEmpty()
        ) {
            return
        }

        loadingNeighbors =
            true

        val current =
            airportIndexForPage(
                currentPage
            )

        val previousIndex =
            current - 1

        val nextIndex =
            current + 1

        thread {

            var previous:
                Bitmap? = null

            var next:
                Bitmap? = null

            if (
                previousIndex >= 0
            ) {

                previous =
                    renderPageBitmap(
                        airportCharts[
                            previousIndex
                        ].page - 1
                    )
            }

            if (
                nextIndex <
                airportCharts.size
            ) {

                next =
                    renderPageBitmap(
                        airportCharts[
                            nextIndex
                        ].page - 1
                    )
            }

            runOnUiThread {

                previousBitmap?.recycle()
                nextBitmap?.recycle()

                previousBitmap =
                    previous

                nextBitmap =
                    next

                loadingNeighbors =
                    false

                chartView.setNeighborBitmaps(
                    previousBitmap,
                    nextBitmap
                )
            }
        }
    }

    private fun renderPageBitmap(
        pageIndex: Int
    ): Bitmap? {

        val pdf =
            renderer ?: return null

        return try {

            synchronized(pdf) {

                val page =
                    pdf.openPage(
                        pageIndex
                    )

                val scale =
                    1.75f

                val fullWidth =
                    (
                        page.width *
                            scale
                        )
                        .toInt()
                        .coerceAtLeast(
                            1
                        )

                val fullHeight =
                    (
                        page.height *
                            scale
                        )
                        .toInt()
                        .coerceAtLeast(
                            1
                        )

                val fullBitmap =
                    Bitmap.createBitmap(
                        fullWidth,
                        fullHeight,
                        Bitmap.Config.ARGB_8888
                    )

                fullBitmap.eraseColor(
                    Color.WHITE
                )

                page.render(
                    fullBitmap,
                    null,
                    null,
                    PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY
                )

                page.close()

                val cropTop =
                    (
                        fullBitmap.height *
                            topCropPercent
                        )
                        .toInt()
                        .coerceIn(
                            0,
                            fullBitmap.height - 1
                        )

                if (
                    cropTop <= 0
                ) {

                    fullBitmap

                } else {

                    val cropped =
                        Bitmap.createBitmap(
                            fullBitmap,
                            0,
                            cropTop,
                            fullBitmap.width,
                            fullBitmap.height -
                                cropTop
                        )

                    fullBitmap.recycle()

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

            val text =
                assets
                    .open(
                        "charts-app-v16.json"
                    )
                    .bufferedReader()
                    .use {
                        it.readText()
                    }

            val root =
                text.trim()

            if (
                root.startsWith("[")
            ) {

                readChartArray(
                    JSONArray(root)
                )

            } else {

                val objectRoot =
                    JSONObject(root)

                val arrays =
                    listOf(
                        "charts",
                        "data",
                        "items",
                        "pages"
                    )

                var found =
                    false

                for (
                    key in arrays
                ) {

                    val value =
                        objectRoot.opt(
                            key
                        )

                    if (
                        value is JSONArray
                    ) {

                        readChartArray(
                            value
                        )

                        found =
                            true

                        break
                    }
                }

                if (
                    !found
                ) {

                    val keys =
                        objectRoot.keys()

                    while (
                        keys.hasNext()
                    ) {

                        val value =
                            objectRoot.opt(
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

            val value =
                array.opt(
                    i
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
            icao.isNotBlank() &&
            itemIcao.isNotBlank() &&
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

        val name =
            firstNonEmpty(
                item.optString(
                    "name"
                ),
                item.optString(
                    "title"
                ),
                item.optString(
                    "chart_name"
                ),
                "Chart page $page"
            )

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

        airportCharts.add(
            ChartInfo(
                page,
                name,
                chartCategory
            )
        )
    }

    private fun firstNonEmpty(
        vararg values: String
    ): String {

        return values
            .firstOrNull {
                it.trim().isNotEmpty()
            }
            ?.trim()
            ?: ""
    }

    private fun firstPositiveInt(
        vararg values: Int
    ): Int {

        return values
            .firstOrNull {
                it > 0
            }
            ?: -1
    }

    private fun showAnnotationMenu() {

        val options =
            arrayOf(
                "Pen",
                "Highlighter",
                "Text",
                "Clear current page",
                "Exit annotation mode"
            )

        AlertDialog.Builder(
            this
        )
            .setTitle(
                "Annotation"
            )
            .setItems(
                options
            ) { _, which ->

                when (
                    which
                ) {

                    0 -> {

                        annotationMode =
                            true

                        annotationTool =
                            Tool.PEN
                    }

                    1 -> {

                        annotationMode =
                            true

                        annotationTool =
                            Tool.HIGHLIGHT
                    }

                    2 -> {

                        annotationMode =
                            true

                        annotationTool =
                            Tool.TEXT
                    }

                    3 -> {

                        clearCurrentPageAnnotations()
                    }

                    4 -> {

                        saveAnnotationsForPage()

                        annotationMode =
                            false
                    }
                }

                chartView.invalidate()
            }
            .show()
    }

    private fun showTextDialog(
        imageX: Float,
        imageY: Float
    ) {

        val input =
            EditText(this).apply {

                inputType =
                    InputType.TYPE_CLASS_TEXT or
                            InputType.TYPE_TEXT_FLAG_MULTI_LINE

                minLines =
                    3

                gravity =
                    Gravity.TOP

                hint =
                    "Enter annotation"
            }

        AlertDialog.Builder(
            this
        )
            .setTitle(
                "Add text"
            )
            .setView(
                input
            )
            .setNegativeButton(
                "Cancel"
            ) { _, _ ->

                annotationMode =
                    false
            }
            .setPositiveButton(
                "Add"
            ) { _, _ ->

                val value =
                    input.text
                        .toString()
                        .trim()

                if (
                    value.isNotEmpty()
                ) {

                    chartView.addTextAnnotation(
                        value,
                        imageX,
                        imageY
                    )

                    saveAnnotationsForPage()
                }

                annotationMode =
                    false

                chartView.invalidate()
            }
            .setOnCancelListener {

                annotationMode =
                    false
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
    ): String {

        return "page_$page"
    }

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

        chartView
            .getStrokes()
            .forEach { stroke ->

                val objectStroke =
                    JSONObject()

                objectStroke.put(
                    "highlight",
                    stroke.highlight
                )

                val points =
                    JSONArray()

                stroke.points.forEach { point ->

                    val pointObject =
                        JSONObject()

                    pointObject.put(
                        "x",
                        point.x.toDouble()
                    )

                    pointObject.put(
                        "y",
                        point.y.toDouble()
                    )

                    points.put(
                        pointObject
                    )
                }

                objectStroke.put(
                    "points",
                    points
                )

                strokes.put(
                    objectStroke
                )
            }

        val texts =
            JSONArray()

        chartView
            .getTexts()
            .forEach { text ->

                val objectText =
                    JSONObject()

                objectText.put(
                    "text",
                    text.text
                )

                objectText.put(
                    "x",
                    text.x.toDouble()
                )

                objectText.put(
                    "y",
                    text.y.toDouble()
                )

                texts.put(
                    objectText
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

                    val pointArray =
                        stroke.optJSONArray(
                            "points"
                        )

                    val points =
                        mutableListOf<PointF>()

                    if (
                        pointArray != null
                    ) {

                        for (
                            j in 0 until
                                    pointArray.length()
                        ) {

                            val point =
                                pointArray.optJSONObject(
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

                    val text =
                        texts.optJSONObject(
                            i
                        )
                            ?: continue

                    chartView.addStoredText(
                        text.optString(
                            "text",
                            ""
                        ),
                        text.optDouble(
                            "x",
                            0.0
                        ).toFloat(),
                        text.optDouble(
                            "y",
                            0.0
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

    private fun toggleViewerControls() {

        if (
            annotationMode
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

    private fun hideViewerControls() {

        toolbar.visibility =
            View.GONE

        chartView.setContentInsets(
            0,
            0,
            0,
            0
        )

        WindowCompat.setDecorFitsSystemWindows(
            window,
            false
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

        WindowCompat.setDecorFitsSystemWindows(
            window,
            false
        )

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

    private fun getBookmarkSafePageText():
        String {

        return buildPageText()
    }

    private inner class ChartView(
        context: Context
    ) : View(context) {

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

        private var landscapeMode =
            false

        private var inverted =
            false

        private var activePoints:
            MutableList<PointF>? =
            null

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

                textSize =
                    18.dp.toFloat()

                typeface =
                    Typeface.DEFAULT_BOLD
            }

        fun setBitmap(
            value: Bitmap
        ) {

            bitmap?.let {

                if (
                    !it.isRecycled
                ) {
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

            if (
                inverted
            ) {

                val matrix =
                    ColorMatrix(
                        floatArrayOf(
                            -1f, 0f, 0f, 0f, 255f,
                            0f, -1f, 0f, 0f, 255f,
                            0f, 0f, -1f, 0f, 255f,
                            0f, 0f, 0f, 1f, 0f
                        )
                    )

                bitmapPaint.colorFilter =
                    ColorMatrixColorFilter(
                        matrix
                    )

            } else {

                bitmapPaint.colorFilter =
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

            landscapeMode =
                value

            invalidate()
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
                    ).coerceAtLeast(
                        1
                    )
                    .toFloat()

            val availableHeight =
                (
                    height -
                        contentTop -
                        contentBottom
                    ).coerceAtLeast(
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
                    availableWidth /
                    2f

            val centerY =
                contentTop +
                    availableHeight /
                    2f

            val currentLeft =
                centerX -
                    drawWidth /
                    2f +
                    offsetX

            val currentTop =
                centerY -
                    drawHeight /
                    2f +
                    offsetY

            canvas.save()

            canvas.clipRect(
                contentLeft.toFloat(),
                contentTop.toFloat(),
                width -
                    contentRight,
                height -
                    contentBottom
            )

            if (
                swiping
            ) {

                drawNeighbor(
                    canvas,
                    previous,
                    currentLeft -
                        width +
                        swipeOffset,
                    currentTop,
                    finalScale
                )

                drawNeighbor(
                    canvas,
                    next,
                    currentLeft +
                        width +
                        swipeOffset,
                    currentTop,
                    finalScale
                )
            }

            canvas.drawBitmap(
                image,
                null,
                RectF(
                    currentLeft +
                        swipeOffset,
                    currentTop,
                    currentLeft +
                        drawWidth +
                        swipeOffset,
                    currentTop +
                        drawHeight
                ),
                bitmapPaint
            )

            canvas.save()

            canvas.translate(
                currentLeft +
                    swipeOffset,
                currentTop
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

            val widthValue =
                image.width *
                    scaleValue

            val heightValue =
                image.height *
                    scaleValue

            canvas.drawBitmap(
                image,
                null,
                RectF(
                    left,
                    top,
                    left +
                        widthValue,
                    top +
                        heightValue
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

            texts.forEach { item ->

                canvas.drawText(
                    item.text,
                    item.x,
                    item.y,
                    textPaint
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

        fun getStrokes():
            List<StoredStroke> {

            return strokes.toList()
        }

        fun getTexts():
            List<StoredText> {

            return texts.toList()
        }

        fun addStoredStroke(
            points: List<PointF>,
            highlight: Boolean
        ) {

            strokes.add(
                StoredStroke(
                    points.map {
                        PointF(
                            it.x,
                            it.y
                        )
                    },
                    highlight
                )
            )
        }

        fun addStoredText(
            value: String,
            x: Float,
            y: Float
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
                    y
                )
            )
        }

        fun addTextAnnotation(
            value: String,
            x: Float,
            y: Float
        ) {

            texts.add(
                StoredText(
                    value,
                    x,
                    y
                )
            )
        }

        fun clearAnnotationsInternal() {

            strokes.clear()

            texts.clear()

            activePoints =
                null
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
                    ).coerceAtLeast(
                        1
                    )
                    .toFloat()

            val availableHeight =
                (
                    height -
                        contentTop -
                        contentBottom
                    ).coerceAtLeast(
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
                    availableWidth /
                    2f

            val centerY =
                contentTop +
                    availableHeight /
                    2f

            val left =
                centerX -
                    drawWidth /
                    2f +
                    offsetX

            val top =
                centerY -
                    drawHeight /
                    2f +
                    offsetY

            return PointF(
                (
                    x -
                        left
                    ) /
                        finalScale,

                (
                    y -
                        top
                    ) /
                        finalScale
            )
        }

        private fun constrainPan() {

            val image =
                bitmap ?: return

            val availableWidth =
                (
                    width -
                        contentLeft -
                        contentRight
                    ).coerceAtLeast(
                        1
                    )
                    .toFloat()

            val availableHeight =
                (
                    height -
                        contentTop -
                        contentBottom
                    ).coerceAtLeast(
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

            val drawWidth =
                image.width *
                    finalScale

            val drawHeight =
                image.height *
                    finalScale

            val excessX =
                max(
                    0f,
                    (
                        drawWidth -
                            availableWidth
                        ) /
                            2f
                )

            val excessY =
                max(
                    0f,
                    (
                        drawHeight -
                            availableHeight
                        ) /
                            2f
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

                    moved =
                        false

                    swiping =
                        false

                    swipeOffset =
                        0f

                    if (
                        annotationMode &&
                        annotationTool !=
                            Tool.TEXT
                    ) {

                        val point =
                            screenToImage(
                                event.x,
                                event.y
                            )

                        if (
                            point != null
                        ) {

                            activePoints =
                                mutableListOf(
                                    point
                                )
                        }
                    }

                    return true
                }

                MotionEvent.ACTION_POINTER_DOWN -> {

                    if (
                        event.pointerCount >= 2
                    ) {

                        pinchDistance =
                            distance(
                                event
                            )

                        activePoints =
                            null
                    }

                    return true
                }

                MotionEvent.ACTION_MOVE -> {

                    if (
                        event.pointerCount >= 2
                    ) {

                        val currentDistance =
                            distance(
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
                                        5f
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

                    if (
                        annotationMode
                    ) {

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

                            if (
                                point != null
                            ) {

                                activePoints
                                    ?.add(
                                        point
                                    )
                            }

                            invalidate()
                        }

                    } else {

                        if (
                            scale > 1.02f
                        ) {

                            offsetX +=
                                dx

                            offsetY +=
                                dy

                            constrainPan()

                        } else {

                            swiping =
                                true

                            swipeOffset =
                                event.x -
                                    swipeStartX

                            val limit =
                                width.toFloat()

                            swipeOffset =
                                swipeOffset
                                    .coerceIn(
                                        -limit,
                                        limit
                                    )
                        }

                        invalidate()
                    }

                    lastX =
                        event.x

                    lastY =
                        event.y

                    return true
                }

                MotionEvent.ACTION_UP -> {

                    if (
                        annotationMode
                    ) {

                        if (
                            annotationTool ==
                                Tool.TEXT &&
                            !moved
                        ) {

                            val point =
                                screenToImage(
                                    event.x,
                                    event.y
                                )

                            if (
                                point != null
                            ) {

                                showTextDialog(
                                    point.x,
                                    point.y
                                )
                            }

                        } else if (
                            activePoints != null &&
                            activePoints!!
                                .isNotEmpty()
                        ) {

                            strokes.add(
                                StoredStroke(
                                    activePoints!!
                                        .map {
                                            PointF(
                                                it.x,
                                                it.y
                                            )
                                        },
                                    annotationTool ==
                                        Tool.HIGHLIGHT
                                )
                            )

                            activePoints =
                                null

                            saveAnnotationsForPage()

                            invalidate()
                        }

                        return true
                    }

                    if (
                        !moved
                    ) {

                        performClick()

                        return true
                    }

                    if (
                        scale <= 1.02f &&
                        swiping
                    ) {

                        val distanceX =
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
                            distanceX < -threshold &&
                            currentIndex >= 0 &&
                            currentIndex <
                                airportCharts.size - 1
                        ) {

                            completeSwipe(
                                1
                            )

                        } else if (
                            distanceX > threshold &&
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

            val targetOffset =
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
                    targetOffset
                )

            animator.duration =
                180L

            animator.interpolator =
                DecelerateInterpolator()

            animator.addUpdateListener {

                swipeOffset =
                    it.animatedValue
                        as Float

                invalidate()
            }

            animator.doOnEnd {

                val newIndex =
                    airportIndexForPage(
                        currentPage
                    ) +
                            direction

                swiping =
                    false

                swipeOffset =
                    0f

                showPageByAirportIndex(
                    newIndex
                )
            }

            animator.start()
        }

        private fun returnToCenter() {

            val start =
                swipeOffset

            val animator =
                android.animation.ValueAnimator.ofFloat(
                    start,
                    0f
                )

            animator.duration =
                150L

            animator.interpolator =
                DecelerateInterpolator()

            animator.addUpdateListener {

                swipeOffset =
                    it.animatedValue
                        as Float

                invalidate()
            }

            animator.doOnEnd {

                swiping =
                    false

                swipeOffset =
                    0f

                invalidate()
            }

            animator.start()
        }

        private fun distance(
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

        override fun performClick():
            Boolean {

            super.performClick()

            if (
                !annotationMode
            ) {

                toggleViewerControls()
            }

            return true
        }
    }

    private fun androidx.activity.ComponentActivity.onConfigurationChanged(
        newConfig: android.content.res.Configuration
    ) {
    }

    private fun android.animation.ValueAnimator.doOnEnd(
        action: () -> Unit
    ) {

        addListener(
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

                    action()
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
