package com.tareghmsr.jeppiran

import android.app.AlertDialog
import android.content.Context
import android.content.pm.ActivityInfo
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Typeface
import android.graphics.pdf.PdfRenderer
import android.os.Bundle
import android.os.ParcelFileDescriptor
import android.text.InputType
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.Window
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
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

    private var isPdfReady = false

    private enum class Tool {
        PEN,
        HIGHLIGHT,
        TEXT
    }

    private val pdfUrl =
        "https://media.githubusercontent.com/media/mahmet737ng-gif/JeppIran/main/Iran2620.pdf"

    private val pdfFileName = "Iran2620.pdf"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        currentPage =
            savedInstanceState?.getInt(
                "CURRENT_PAGE"
            )
                ?: (
                    intent.getIntExtra(
                        "PAGE",
                        1
                    ) - 1
                ).coerceAtLeast(0)

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

        WindowCompat.setDecorFitsSystemWindows(
            window,
            false
        )

        val file = File(
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

        super.onSaveInstanceState(
            outState
        )
    }

    override fun onDestroy() {

        renderer?.close()
        descriptor?.close()

        super.onDestroy()
    }

    private fun buildDownloadUi() {

        root = FrameLayout(this)

        val box = LinearLayout(this).apply {

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

                gravity =
                    Gravity.CENTER

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

        setContentView(root)
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
                            ByteArray(64 * 1024)

                        var downloaded = 0L

                        while (true) {

                            val count =
                                input.read(
                                    buffer
                                )

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
                                        downloaded * 100 /
                                            total
                                        ).toInt()

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

                runOnUiThread {

                    buildViewerUi()
                    openPdf(file)
                }

            } catch (e: Exception) {

                runOnUiThread {

                    loadingText.text =
                        "Download failed: ${e.message}"

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

                setTextColor(
                    Color.WHITE
                )

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
            toggleBookmark(
                currentPage
            )
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
                gravity =
                    Gravity.TOP
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
                    Color.rgb(
                        20,
                        27,
                        36
                    )
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

        updateBookmarkBar()

        root.addView(
            bookmarkBar,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                52.dp
            ).apply {

                gravity =
                    Gravity.BOTTOM
            }
        )
    }

    private fun updateBookmarkBar() {

        if (!::bookmarkBar.isInitialized) {
            return
        }

        bookmarkBar.removeAllViews()

        val bookmarks =
            getBookmarks()

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

            return
        }

        bookmarks
            .sorted()
            .forEach { page ->

                val button =
                    TextView(this).apply {

                        text =
                            "★ ${page + 1}"

                        textSize = 12f

                        setTextColor(
                            if (
                                page ==
                                currentPage
                            ) {
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

                            showPage(
                                page
                            )
                        }
                    }

                bookmarkBar.addView(
                    button,
                    LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                        LinearLayout.LayoutParams.MATCH_PARENT
                    )
                )
            }
    }

    private fun applyInsets() {

        ViewCompat.setOnApplyWindowInsetsListener(
            root
        ) { _, insets ->

            val bars =
                insets.getInsets(
                    WindowInsetsCompat.Type.systemBars()
                )

            if (controlsVisible) {

                toolbar.setPadding(
                    0,
                    bars.top,
                    0,
                    0
                )

                val toolbarParams =
                    toolbar.layoutParams
                        as FrameLayout.LayoutParams

                toolbarParams.height =
                    64.dp +
                            bars.top

                toolbar.layoutParams =
                    toolbarParams

                val bookmarkParams =
                    bookmarkBar.layoutParams
                        as FrameLayout.LayoutParams

                bookmarkParams.bottomMargin =
                    bars.bottom

                bookmarkBar.layoutParams =
                    bookmarkParams
            }

            insets
        }

        ViewCompat.requestApplyInsets(
            root
        )
    }

    private fun makeButton(
        text: String
    ): TextView {

        return TextView(this).apply {

            this.text = text

            textSize = 22f

            setTextColor(
                Color.WHITE
            )

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
                PdfRenderer(
                    descriptor!!
                )

            totalPages =
                renderer!!.pageCount

            isPdfReady = true

            currentPage =
                currentPage.coerceIn(
                    0,
                    totalPages - 1
                )

            showPage(
                currentPage
            )

        } catch (e: Exception) {

            showError(
                "Unable to open PDF: ${e.message}"
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

        currentPage = index

        val page =
            pdf.openPage(
                index
            )

        val pageWidth =
            page.width

        val pageHeight =
            page.height

        updateOrientation(
            pageWidth,
            pageHeight
        )

        val scale =
            if (
                pageWidth > pageHeight
            ) {
                1.65f
            } else {
                1.85f
            }

        val bitmapWidth =
            (
                pageWidth * scale
                ).toInt()
                .coerceAtLeast(1)

        val bitmapHeight =
            (
                pageHeight * scale
                ).toInt()
                .coerceAtLeast(1)

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

        chartView.setBitmap(
            bitmap
        )

        pageText.text =
            "${currentPage + 1} / $totalPages"

        updateBookmarkBar()
    }

    private fun updateOrientation(
        width: Int,
        height: Int
    ) {

        val landscape =
            width > height

        requestedOrientation =
            if (landscape) {

                ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE

            } else {

                ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
            }
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

        ViewCompat.requestApplyInsets(
            root
        )
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

        if (
            current.contains(page)
        ) {

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

    private fun showAnnotationMenu() {

        val options =
            arrayOf(
                "Pen",
                "Highlighter",
                "Text",
                "Clear current page"
            )

        AlertDialog.Builder(this)
            .setTitle("Annotation")
            .setItems(
                options
            ) { _, which ->

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

                        chartView.clearAnnotations()
                    }
                }

                chartView.invalidate()
            }
            .show()
    }

    private fun showTextDialog(
        x: Float,
        y: Float
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
                        x,
                        y
                    )
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

        private var activePath: Path? = null

        private data class Stroke(
            val path: Path,
            val highlight: Boolean
        )

        private data class TextAnnotation(
            val text: String,
            val x: Float,
            val y: Float
        )

        private val strokes =
            mutableListOf<Stroke>()

        private val texts =
            mutableListOf<TextAnnotation>()

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

                strokeWidth =
                    5.dp.toFloat()

                color =
                    Color.rgb(
                        255,
                        60,
                        130
                    )
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

        private var pinchDistance = 0f

        fun setBitmap(
            value: Bitmap
        ) {

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
                bitmap
                    ?: return

            val availableWidth =
                width.toFloat()

            val availableHeight =
                height.toFloat()

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

            val left =
                (
                    availableWidth -
                            drawWidth
                    ) / 2f +
                        offsetX

            val top =
                (
                    availableHeight -
                            drawHeight
                    ) / 2f +
                        offsetY

            val destination =
                android.graphics.RectF(
                    left,
                    top,
                    left + drawWidth,
                    top + drawHeight
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

            drawAnnotations(
                canvas
            )

            canvas.restore()
        }

        private fun drawAnnotations(
            canvas: Canvas
        ) {

            strokes.forEach { stroke ->

                strokePaint.color =
                    if (
                        stroke.highlight
                    ) {
                        Color.argb(
                            100,
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
                        stroke.highlight
                    ) {
                        20f
                    } else {
                        5f
                    }

                canvas.drawPath(
                    stroke.path,
                    strokePaint
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

        fun addTextAnnotation(
            text: String,
            x: Float,
            y: Float
        ) {

            val image =
                bitmap
                    ?: return

            val availableWidth =
                width.toFloat()

            val availableHeight =
                height.toFloat()

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

            val left =
                (
                    availableWidth -
                            drawWidth
                    ) / 2f +
                        offsetX

            val top =
                (
                    availableHeight -
                            drawHeight
                    ) / 2f +
                        offsetY

            val imageX =
                (
                    x - left
                    ) / finalScale

            val imageY =
                (
                    y - top
                    ) / finalScale

            texts.add(
                TextAnnotation(
                    text,
                    imageX,
                    imageY
                )
            )
        }

        fun clearAnnotations() {

            strokes.clear()
            texts.clear()

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

                    moved = false

                    if (
                        event.pointerCount >= 2
                    ) {

                        pinchDistance =
                            distance(
                                event
                            )
                    }

                    if (
                        annotationMode &&
                        annotationTool !=
                        Tool.TEXT
                    ) {

                        activePath =
                            Path()

                        activePath!!.moveTo(
                            event.x,
                            event.y
                        )
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
                    }

                    return true
                }

                MotionEvent.ACTION_MOVE -> {

                    if (
                        event.pointerCount >= 2
                    ) {

                        val current =
                            distance(
                                event
                            )

                        if (
                            pinchDistance > 0
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
                        event.x -
                                lastX

                    val dy =
                        event.y -
                                lastY

                    if (
                        abs(
                            event.x -
                                    downX
                        ) > 12 ||
                        abs(
                            event.y -
                                    downY
                        ) > 12
                    ) {

                        moved = true
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

                            activePath?.lineTo(
                                event.x,
                                event.y
                            )

                            invalidate()
                        }

                    } else {

                        if (
                            scale > 1f
                        ) {

                            offsetX += dx
                            offsetY += dy

                            limitPan()

                            invalidate()
                        }
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

                            showTextDialog(
                                event.x,
                                event.y
                            )

                        } else if (
                            activePath != null
                        ) {

                            strokes.add(
                                Stroke(
                                    activePath!!,
                                    annotationTool ==
                                            Tool.HIGHLIGHT
                                )
                            )

                            activePath =
                                null

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
                        abs(
                            swipeDistance
                        ) > 120f
                    ) {

                        if (
                            swipeDistance < 0
                        ) {

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

                    activePath =
                        null

                    return true
                }
            }

            return true
        }

        override fun performClick():
                Boolean {

            super.performClick()

            toggleViewerControls()

            return true
        }

        private fun limitPan() {

            offsetX =
                offsetX.coerceIn(
                    -width.toFloat(),
                    width.toFloat()
                )

            offsetY =
                offsetY.coerceIn(
                    -height.toFloat(),
                    height.toFloat()
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
