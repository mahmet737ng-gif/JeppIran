package com.tareghmsr.jeppiran

import android.app.AlertDialog
import android.content.Context
import android.content.pm.ActivityInfo
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
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

class PdfViewerActivity : ComponentActivity() {

    private var renderer: PdfRenderer? = null
    private var descriptor: ParcelFileDescriptor? = null

    private var currentPage = 0
    private var totalPages = 0

    private lateinit var root: FrameLayout
    private lateinit var chartView: ChartView
    private lateinit var toolbar: LinearLayout
    private lateinit var bookmarkBar: LinearLayout

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

    private var currentOrientationLandscape = false

    private enum class Tool {
        PEN,
        HIGHLIGHT,
        TEXT
    }

    private val pdfUrl =
        "https://media.githubusercontent.com/media/mahmet737ng-gif/JeppIran/main/Iran2620.pdf"

    private val pdfFileName = "Iran2620.pdf"

    /*
     * The JeppView print line is at the very top of the PDF.
     * We remove a small percentage of the rendered top edge.
     *
     * This does not modify the original PDF file.
     */
    private val topCropPercent = 0.045f

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        currentPage =
            savedInstanceState?.getInt("CURRENT_PAGE")
                ?: (
                    intent.getIntExtra("PAGE", 1) - 1
                ).coerceAtLeast(0)

        chartTitle =
            savedInstanceState?.getString("TITLE")
                ?: intent.getStringExtra("TITLE").orEmpty()

        icao =
            intent.getStringExtra("ICAO").orEmpty()

        city =
            intent.getStringExtra("CITY").orEmpty()

        category =
            intent.getStringExtra("CATEGORY").orEmpty()

        WindowCompat.setDecorFitsSystemWindows(
            window,
            false
        )

        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT

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
            openPdf(file)
        } else {
            buildDownloadUi()
            downloadPdf(file)
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

        super.onSaveInstanceState(outState)
    }

    override fun onDestroy() {
        renderer?.close()
        descriptor?.close()
        super.onDestroy()
    }

    private fun buildDownloadUi() {

        root =
            FrameLayout(this).apply {
                setBackgroundColor(
                    Color.rgb(15, 18, 22)
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

        progressBar.max = 100
        progressBar.progress = 0

        loadingText =
            TextView(this).apply {
                text =
                    "Downloading chart database..."

                textSize = 16f
                gravity = Gravity.CENTER

                setTextColor(Color.WHITE)

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

        box.addView(loadingText)

        root.addView(
            box,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        )

        setContentView(root)

        ViewCompat.setOnApplyWindowInsetsListener(
            root
        ) { _, insets ->
            insets
        }
    }

    private fun downloadPdf(
        file: File
    ) {

        thread {

            try {

                val connection =
                    URL(pdfUrl)
                        .openConnection()
                            as HttpURLConnection

                connection.connectTimeout = 30000
                connection.readTimeout = 60000
                connection.requestMethod = "GET"

                connection.connect()

                if (
                    connection.responseCode !in 200..299
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
                            ByteArray(64 * 1024)

                        var downloaded = 0L

                        while (true) {

                            val count =
                                input.read(buffer)

                            if (count <= 0) {
                                break
                            }

                            output.write(
                                buffer,
                                0,
                                count
                            )

                            downloaded += count

                            if (total > 0) {

                                val percent =
                                    (
                                        downloaded * 100L /
                                            total
                                        ).toInt()
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

                if (!temporary.renameTo(file)) {

                    temporary.copyTo(
                        file,
                        overwrite = true
                    )

                    temporary.delete()
                }

                connection.disconnect()

                runOnUiThread {

                    buildViewerUi()
                    openPdf(file)
                }

            } catch (e: Exception) {

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
                    Color.rgb(15, 18, 22)
                )
            }

        chartView =
            ChartView(this)

        root.addView(
            chartView,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        )

        buildToolbar()
        buildBookmarkBar()

        setContentView(root)

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
                    Color.rgb(17, 24, 32)
                )

                elevation =
                    8.dp.toFloat()
            }

        val back =
            makeButton("‹")

        back.setOnClickListener {
            finish()
        }

        val previous =
            makeButton("◀")

        previous.setOnClickListener {
            showPage(
                currentPage - 1
            )
        }

        val next =
            makeButton("▶")

        next.setOnClickListener {
            showPage(
                currentPage + 1
            )
        }

        titleText =
            TextView(this).apply {

                text =
                    chartTitle.ifBlank {
                        "JeppIran Chart"
                    }

                textSize = 15f

                typeface =
                    Typeface.DEFAULT_BOLD

                setTextColor(Color.WHITE)

                gravity =
                    Gravity.CENTER_VERTICAL

                maxLines = 2
            }

        pageText =
            TextView(this).apply {

                textSize = 12f

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

        val infoBox =
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

        val bookmark =
            makeButton("★")

        bookmark.setOnClickListener {
            toggleBookmark(currentPage)
        }

        val tools =
            makeButton("✎")

        tools.setOnClickListener {
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
            infoBox,
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

        toolbar.addView(
            bookmark,
            buttonParams()
        )

        toolbar.addView(
            tools,
            buttonParams()
        )

        root.addView(
            toolbar,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                64.dp
            ).apply {
                gravity = Gravity.TOP
            }
        )
    }

    private fun buildBookmarkBar() {

        bookmarkBar =
            LinearLayout(this).apply {

                orientation =
                    LinearLayout.HORIZONTAL

                gravity =
                    Gravity.CENTER_VERTICAL

                setBackgroundColor(
                    Color.rgb(20, 27, 36)
                )

                elevation =
                    10.dp.toFloat()

                setPadding(
                    8.dp,
                    6.dp,
                    8.dp,
                    6.dp
                )
            }

        root.addView(
            bookmarkBar
        )

        updateBookmarkBar()
    }

    private fun updateBookmarkBar() {

        if (!::bookmarkBar.isInitialized) {
            return
        }

        bookmarkBar.removeAllViews()

        val bookmarks =
            getBookmarks().sorted()

        if (bookmarks.isEmpty()) {

            val empty =
                TextView(this).apply {

                    text =
                        "No bookmarks"

                    textSize = 12f

                    setTextColor(
                        Color.rgb(
                            150,
                            160,
                            170
                        )
                    )

                    gravity =
                        Gravity.CENTER
                }

            bookmarkBar.addView(
                empty,
                LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.MATCH_PARENT
                )
            )

            updateLayoutForOrientation()
            return
        }

        bookmarks.forEach { page ->

            val button =
                TextView(this).apply {

                    text =
                        "★ ${page + 1}"

                    textSize = 12f

                    setTextColor(
                        if (page == currentPage) {
                            Color.rgb(
                                255,
                                80,
                                150
                            )
                        } else {
                            Color.WHITE
                        }
                    )

                    gravity =
                        Gravity.CENTER

                    setPadding(
                        14.dp,
                        4.dp,
                        14.dp,
                        4.dp
                    )

                    setOnClickListener {
                        showPage(page)
                    }
                }

            if (currentOrientationLandscape) {

                bookmarkBar.addView(
                    button,
                    LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        48.dp
                    )
                )

            } else {

                bookmarkBar.addView(
                    button,
                    LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                        LinearLayout.LayoutParams.MATCH_PARENT
                    )
                )
            }
        }

        updateLayoutForOrientation()
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

        ViewCompat.requestApplyInsets(root)
    }

    private fun updateSystemBarLayout(
        top: Int,
        bottom: Int,
        left: Int,
        right: Int
    ) {

        if (!::toolbar.isInitialized) {
            return
        }

        if (!controlsVisible) {
            return
        }

        if (currentOrientationLandscape) {

            val toolbarParams =
                toolbar.layoutParams
                    as FrameLayout.LayoutParams

            toolbarParams.topMargin = top
            toolbarParams.leftMargin = left
            toolbarParams.rightMargin = right

            toolbar.layoutParams =
                toolbarParams

            val bookmarkParams =
                bookmarkBar.layoutParams
                    as FrameLayout.LayoutParams

            bookmarkParams.leftMargin = left
            bookmarkParams.topMargin = top + 64.dp
            bookmarkParams.bottomMargin = bottom

            bookmarkBar.layoutParams =
                bookmarkParams

        } else {

            val toolbarParams =
                toolbar.layoutParams
                    as FrameLayout.LayoutParams

            toolbarParams.topMargin = top
            toolbarParams.leftMargin = left
            toolbarParams.rightMargin = right

            toolbar.layoutParams =
                toolbarParams

            val bookmarkParams =
                bookmarkBar.layoutParams
                    as FrameLayout.LayoutParams

            bookmarkParams.leftMargin = left
            bookmarkParams.rightMargin = right
            bookmarkParams.bottomMargin = bottom

            bookmarkBar.layoutParams =
                bookmarkParams
        }

        updateChartContentInsets(
            top,
            bottom,
            left,
            right
        )
    }

    private fun updateChartContentInsets(
        top: Int,
        bottom: Int,
        left: Int,
        right: Int
    ) {

        if (!::chartView.isInitialized) {
            return
        }

        if (!controlsVisible) {

            chartView.setContentInsets(
                0,
                0,
                0,
                0
            )

            return
        }

        if (currentOrientationLandscape) {

            chartView.setContentInsets(
                left + 64.dp,
                top,
                right,
                bottom
            )

        } else {

            chartView.setContentInsets(
                left,
                top,
                right,
                bottom + 52.dp
            )
        }
    }

    private fun updateLayoutForOrientation() {

        if (!::bookmarkBar.isInitialized) {
            return
        }

        val landscape =
            currentOrientationLandscape

        if (landscape) {

            bookmarkBar.orientation =
                LinearLayout.VERTICAL

            val params =
                bookmarkBar.layoutParams
                    as FrameLayout.LayoutParams

            params.width = 76.dp
            params.height =
                FrameLayout.LayoutParams.MATCH_PARENT

            params.gravity =
                Gravity.START

            params.topMargin =
                64.dp

            params.bottomMargin = 0

            params.leftMargin = 0
            params.rightMargin = 0

            bookmarkBar.layoutParams =
                params

        } else {

            bookmarkBar.orientation =
                LinearLayout.HORIZONTAL

            val params =
                bookmarkBar.layoutParams
                    as FrameLayout.LayoutParams

            params.width =
                FrameLayout.LayoutParams.MATCH_PARENT

            params.height = 52.dp

            params.gravity =
                Gravity.BOTTOM

            params.topMargin = 0
            params.leftMargin = 0
            params.rightMargin = 0

            bookmarkBar.layoutParams =
                params
        }
    }

    private fun makeButton(
        text: String
    ): TextView {

        return TextView(this).apply {

            this.text = text

            textSize = 22f

            setTextColor(Color.WHITE)

            gravity =
                Gravity.CENTER

            isClickable = true
            isFocusable = true

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
                PdfRenderer(descriptor!!)

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

            showPage(currentPage)

        } catch (e: Exception) {

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

        currentPage = index

        val page =
            pdf.openPage(index)

        val pageWidth =
            page.width

        val pageHeight =
            page.height

        val landscape =
            pageWidth > pageHeight

        currentOrientationLandscape =
            landscape

        updateOrientation(
            pageWidth,
            pageHeight
        )

        /*
         * Render at a good readable resolution.
         */
        val scale =
            if (landscape) {
                1.55f
            } else {
                1.75f
            }

        val fullWidth =
            (
                pageWidth * scale
            ).toInt().coerceAtLeast(1)

        val fullHeight =
            (
                pageHeight * scale
            ).toInt().coerceAtLeast(1)

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

        /*
         * Remove the top JeppView print line.
         * The original PDF remains untouched.
         */
        val cropTop =
            (
                fullBitmap.height *
                    topCropPercent
                ).toInt().coerceAtLeast(1)

        val croppedHeight =
            (
                fullBitmap.height -
                    cropTop
            ).coerceAtLeast(1)

        val croppedBitmap =
            Bitmap.createBitmap(
                fullBitmap,
                0,
                cropTop,
                fullBitmap.width,
                croppedHeight
            )

        if (croppedBitmap !== fullBitmap) {
            fullBitmap.recycle()
        }

        chartView.setBitmap(
            croppedBitmap
        )

        pageText.text =
            "${currentPage + 1} / $totalPages"

        updateBookmarkBar()
        loadAnnotationsForPage()
    }

    private fun updateOrientation(
        width: Int,
        height: Int
    ) {

        val landscape =
            width > height

        currentOrientationLandscape =
            landscape

        requestedOrientation =
            if (landscape) {
                ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
            } else {
                ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
            }

        updateLayoutForOrientation()
    }

    private fun showError(
        message: String
    ) {

        AlertDialog.Builder(this)
            .setTitle("JeppIran")
            .setMessage(message)
            .setPositiveButton(
                "OK",
                null
            )
            .show()
    }

    private fun toggleViewerControls() {

        if (annotationMode) {
            return
        }

        controlsVisible =
            !controlsVisible

        if (controlsVisible) {
            showViewerControls()
        } else {
            hideViewerControls()
        }
    }

    private fun hideViewerControls() {

        toolbar.visibility =
            View.GONE

        bookmarkBar.visibility =
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

        bookmarkBar.visibility =
            View.VISIBLE

        WindowCompat.setDecorFitsSystemWindows(
            window,
            false
        )

        WindowInsetsControllerCompat(
            window,
            window.decorView
        ).apply {

            show(
                WindowInsetsCompat.Type.systemBars()
            )
        }

        ViewCompat.requestApplyInsets(root)

        updateLayoutForOrientation()
    }

    private fun toggleBookmark(
        page: Int
    ) {

        val preferences =
            getSharedPreferences(
                "jeppiran_bookmarks",
                Context.MODE_PRIVATE
            )

        val current =
            getBookmarks().toMutableSet()

        if (current.contains(page)) {
            current.remove(page)
        } else {
            current.add(page)
        }

        preferences.edit()
            .putString(
                "pages",
                current
                    .sorted()
                    .joinToString(",")
            )
            .apply()

        updateBookmarkBar()
    }

    private fun getBookmarks():
            Set<Int> {

        val preferences =
            getSharedPreferences(
                "jeppiran_bookmarks",
                Context.MODE_PRIVATE
            )

        val value =
            preferences.getString(
                "pages",
                ""
            ).orEmpty()

        if (value.isBlank()) {
            return emptySet()
        }

        return value
            .split(",")
            .mapNotNull {
                it.toIntOrNull()
            }
            .toSet()
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

        if (!::chartView.isInitialized) {
            return
        }

        val rootObject =
            JSONObject()

        val strokes =
            JSONArray()

        chartView.getStrokes().forEach { stroke ->

            val strokeObject =
                JSONObject()

            strokeObject.put(
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

                points.put(pointObject)
            }

            strokeObject.put(
                "points",
                points
            )

            strokes.put(strokeObject)
        }

        val texts =
            JSONArray()

        chartView.getTexts().forEach { item ->

            val textObject =
                JSONObject()

            textObject.put(
                "text",
                item.text
            )

            textObject.put(
                "x",
                item.x.toDouble()
            )

            textObject.put(
                "y",
                item.y.toDouble()
            )

            texts.put(textObject)
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
                annotationKey(currentPage),
                rootObject.toString()
            )
            .apply()
    }

    private fun loadAnnotationsForPage() {

        if (!::chartView.isInitialized) {
            return
        }

        val value =
            annotationPreferences()
                .getString(
                    annotationKey(currentPage),
                    ""
                )
                .orEmpty()

        chartView.clearAnnotationsInternal()

        if (value.isBlank()) {
            chartView.invalidate()
            return
        }

        try {

            val rootObject =
                JSONObject(value)

            val strokes =
                rootObject.optJSONArray(
                    "strokes"
                )

            if (strokes != null) {

                for (
                    i in 0 until strokes.length()
                ) {

                    val strokeObject =
                        strokes.optJSONObject(i)
                            ?: continue

                    val highlight =
                        strokeObject.optBoolean(
                            "highlight",
                            false
                        )

                    val points =
                        mutableListOf<PointF>()

                    val pointArray =
                        strokeObject.optJSONArray(
                            "points"
                        )

                    if (pointArray != null) {

                        for (
                            j in 0 until pointArray.length()
                        ) {

                            val pointObject =
                                pointArray.optJSONObject(
                                    j
                                )
                                    ?: continue

                            points.add(
                                PointF(
                                    pointObject
                                        .optDouble(
                                            "x",
                                            0.0
                                        )
                                        .toFloat(),

                                    pointObject
                                        .optDouble(
                                            "y",
                                            0.0
                                        )
                                        .toFloat()
                                )
                            )
                        }
                    }

                    if (points.isNotEmpty()) {

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

            if (texts != null) {

                for (
                    i in 0 until texts.length()
                ) {

                    val textObject =
                        texts.optJSONObject(i)
                            ?: continue

                    chartView.addStoredText(
                        textObject.optString(
                            "text",
                            ""
                        ),
                        textObject.optDouble(
                            "x",
                            0.0
                        ).toFloat(),
                        textObject.optDouble(
                            "y",
                            0.0
                        ).toFloat()
                    )
                }
            }

        } catch (_: Exception) {
        }

        chartView.invalidate()
    }

    private fun clearCurrentPageAnnotations() {

        annotationPreferences()
            .edit()
            .remove(
                annotationKey(currentPage)
            )
            .apply()

        chartView.clearAnnotationsInternal()
        chartView.invalidate()
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

        AlertDialog.Builder(this)
            .setTitle("Annotation")
            .setItems(options) { _, which ->

                when (which) {

                    0 -> {
                        annotationMode = true
                        annotationTool = Tool.PEN
                    }

                    1 -> {
                        annotationMode = true
                        annotationTool =
                            Tool.HIGHLIGHT
                    }

                    2 -> {
                        annotationMode = true
                        annotationTool = Tool.TEXT
                    }

                    3 -> {
                        clearCurrentPageAnnotations()
                    }

                    4 -> {
                        saveAnnotationsForPage()
                        annotationMode = false
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
                    InputType.TYPE_CLASS_TEXT

                hint =
                    "Enter annotation"
            }

        AlertDialog.Builder(this)
            .setTitle("Add text")
            .setView(input)
            .setNegativeButton(
                "Cancel"
            ) { _, _ ->
                annotationMode = false
            }
            .setPositiveButton(
                "Add"
            ) { _, _ ->

                val value =
                    input.text
                        .toString()
                        .trim()

                if (value.isNotEmpty()) {

                    chartView.addTextAnnotation(
                        value,
                        imageX,
                        imageY
                    )

                    saveAnnotationsForPage()
                }

                annotationMode = false
                chartView.invalidate()
            }
            .setOnCancelListener {
                annotationMode = false
            }
            .show()
    }

    private inner class ChartView(
        context: Context
    ) : View(context) {

        private var bitmap: Bitmap? = null

        private var scale = 1f
        private var offsetX = 0f
        private var offsetY = 0f

        private var downX = 0f
        private var downY = 0f

        private var lastX = 0f
        private var lastY = 0f

        private var moved = false
        private var swipeStartX = 0f

        private var pinchDistance = 0f

        private var activePoints:
            MutableList<PointF>? = null

        private var contentLeft = 0
        private var contentTop = 0
        private var contentRight = 0
        private var contentBottom = 0

        data class StoredStroke(
            val points: List<PointF>,
            val highlight: Boolean
        )

        data class StoredText(
            val text: String,
            val x: Float,
            val y: Float
        )

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

        fun setContentInsets(
            left: Int,
            top: Int,
            right: Int,
            bottom: Int
        ) {

            contentLeft = left
            contentTop = top
            contentRight = right
            contentBottom = bottom

            invalidate()
        }

        fun setBitmap(
            value: Bitmap
        ) {

            bitmap?.let {
                if (!it.isRecycled) {
                    it.recycle()
                }
            }

            bitmap = value

            scale = 1f
            offsetX = 0f
            offsetY = 0f

            invalidate()
        }

        override fun onDraw(
            canvas: Canvas
        ) {

            super.onDraw(canvas)

            canvas.drawColor(
                Color.rgb(
                    15,
                    18,
                    22
                )
            )

            val image =
                bitmap ?: return

            val leftInset =
                contentLeft.toFloat()

            val topInset =
                contentTop.toFloat()

            val rightInset =
                contentRight.toFloat()

            val bottomInset =
                contentBottom.toFloat()

            val availableWidth =
                (
                    width -
                        leftInset -
                        rightInset
                    ).coerceAtLeast(1f)

            val availableHeight =
                (
                    height -
                        topInset -
                        bottomInset
                    ).coerceAtLeast(1f)

            val baseScale =
                min(
                    availableWidth /
                        image.width,

                    availableHeight /
                        image.height
                )

            val finalScale =
                baseScale * scale

            val drawWidth =
                image.width *
                    finalScale

            val drawHeight =
                image.height *
                    finalScale

            val areaCenterX =
                leftInset +
                    availableWidth / 2f

            val areaCenterY =
                topInset +
                    availableHeight / 2f

            val left =
                areaCenterX -
                    drawWidth / 2f +
                    offsetX

            val top =
                areaCenterY -
                    drawHeight / 2f +
                    offsetY

            val destination =
                RectF(
                    left,
                    top,
                    left + drawWidth,
                    top + drawHeight
                )

            canvas.save()

            canvas.clipRect(
                leftInset,
                topInset,
                width - rightInset,
                height - bottomInset
            )

            canvas.drawBitmap(
                image,
                null,
                destination,
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

            drawAnnotations(canvas)

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

            texts.forEach { text ->

                canvas.drawText(
                    text.text,
                    text.x,
                    text.y,
                    textPaint
                )
            }
        }

        private fun drawPoints(
            canvas: Canvas,
            points: List<PointF>,
            highlight: Boolean
        ) {

            if (points.isEmpty()) {
                return
            }

            strokePaint.color =
                if (highlight) {
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
                if (highlight) {
                    22f
                } else {
                    5f
                }

            val path =
                Path()

            val first =
                points.first()

            path.moveTo(
                first.x,
                first.y
            )

            for (
                i in 1 until points.size
            ) {

                val point =
                    points[i]

                path.lineTo(
                    point.x,
                    point.y
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
            text: String,
            x: Float,
            y: Float
        ) {

            if (text.isBlank()) {
                return
            }

            texts.add(
                StoredText(
                    text,
                    x,
                    y
                )
            )
        }

        fun addTextAnnotation(
            text: String,
            imageX: Float,
            imageY: Float
        ) {

            texts.add(
                StoredText(
                    text,
                    imageX,
                    imageY
                )
            )
        }

        fun clearAnnotationsInternal() {

            strokes.clear()
            texts.clear()
            activePoints = null
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
                    ).coerceAtLeast(1)

            val availableHeight =
                (
                    height -
                        contentTop -
                        contentBottom
                    ).coerceAtLeast(1)

            val baseScale =
                min(
                    availableWidth.toFloat() /
                        image.width,

                    availableHeight.toFloat() /
                        image.height
                )

            val finalScale =
                baseScale * scale

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
                    offsetX

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

        override fun onTouchEvent(
            event: MotionEvent
        ): Boolean {

            when (event.actionMasked) {

                MotionEvent.ACTION_DOWN -> {

                    downX = event.x
                    downY = event.y

                    lastX = event.x
                    lastY = event.y

                    swipeStartX = event.x

                    moved = false

                    if (
                        annotationMode &&
                        annotationTool != Tool.TEXT
                    ) {

                        val point =
                            screenToImage(
                                event.x,
                                event.y
                            )

                        if (point != null) {

                            activePoints =
                                mutableListOf(point)
                        }
                    }

                    return true
                }

                MotionEvent.ACTION_POINTER_DOWN -> {

                    if (
                        event.pointerCount >= 2
                    ) {

                        pinchDistance =
                            distance(event)

                        activePoints = null
                    }

                    return true
                }

                MotionEvent.ACTION_MOVE -> {

                    if (
                        event.pointerCount >= 2
                    ) {

                        val current =
                            distance(event)

                        if (
                            pinchDistance > 0f
                        ) {

                            val factor =
                                current /
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
                                current

                            invalidate()
                        }

                        return true
                    }

                    val dx =
                        event.x - lastX

                    val dy =
                        event.y - lastY

                    if (
                        abs(
                            event.x - downX
                        ) > 12f ||
                        abs(
                            event.y - downY
                        ) > 12f
                    ) {

                        moved = true
                    }

                    if (annotationMode) {

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

                            if (point != null) {

                                activePoints
                                    ?.add(point)
                            }

                            invalidate()
                        }

                    } else {

                        if (scale > 1f) {

                            offsetX += dx
                            offsetY += dy

                            limitPan()

                            invalidate()
                        }
                    }

                    lastX = event.x
                    lastY = event.y

                    return true
                }

                MotionEvent.ACTION_UP -> {

                    if (annotationMode) {

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

                            if (point != null) {

                                showTextDialog(
                                    point.x,
                                    point.y
                                )
                            }

                        } else if (
                            activePoints != null &&
                            activePoints!!.isNotEmpty()
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

                            activePoints = null

                            saveAnnotationsForPage()

                            invalidate()
                        }

                        return true
                    }

                    if (!moved) {

                        performClick()

                        return true
                    }

                    val swipeDistance =
                        event.x -
                            swipeStartX

                    if (
                        scale <= 1.05f &&
                        abs(swipeDistance) > 120f
                    ) {

                        if (swipeDistance < 0) {

                            showPage(
                                currentPage + 1
                            )

                        } else {

                            showPage(
                                currentPage - 1
                            )
                        }
                    }

                    return true
                }

                MotionEvent.ACTION_CANCEL -> {

                    activePoints = null

                    return true
                }
            }

            return true
        }

        override fun performClick():
                Boolean {

            super.performClick()

            if (!annotationMode) {
                toggleViewerControls()
            }

            return true
        }

        private fun limitPan() {

            val limitX =
                width.toFloat() * 0.8f

            val limitY =
                height.toFloat() * 0.8f

            offsetX =
                offsetX.coerceIn(
                    -limitX,
                    limitX
                )

            offsetY =
                offsetY.coerceIn(
                    -limitY,
                    limitY
                )
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

            return kotlin.math.sqrt(
                dx * dx +
                    dy * dy
            )
        }
    }

    private val Int.dp: Int
        get() =
            (
                this *
                    resources.displayMetrics.density
                ).toInt()
}
