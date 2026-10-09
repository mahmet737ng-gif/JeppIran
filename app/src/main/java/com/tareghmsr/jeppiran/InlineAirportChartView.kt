package com.tareghmsr.jeppiran

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.graphics.drawable.GradientDrawable
import android.os.ParcelFileDescriptor
import android.view.Gravity
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.ScaleGestureDetector
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.Locale
import kotlin.concurrent.thread
import kotlin.math.max
import kotlin.math.min

/**
 * Task 6 — real inline PDF preview, keeping the native airport rail mounted.
 * The independent advanced PDF viewer remains the only source for georef,
 * pen/erase, GPS, and simulator-position overlays.
 */
class InlineAirportChartView(
    private val owner: AppCompatActivity,
    private val repository: ChartRepository,
    private val exit: () -> Unit,
    private val advanced: (ChartRepository.ChartInfo) -> Unit
) : LinearLayout(owner) {
    private val cyan = Color.rgb(66, 197, 255)
    private val dark = Color.rgb(3, 17, 34)
    private val surface = Color.rgb(8, 34, 61)
    private var current: ChartRepository.ChartInfo? = null
    private var request = 0
    private var zoom = 1f
    private var oldX = 0f
    private var oldY = 0f
    private var rendered: Bitmap? = null
    private val title = TextView(owner)
    private val status = TextView(owner)
    private val pageImage = ImageView(owner)
    private val scrollFrame = FrameLayout(owner)
    private val metaNote = TextView(owner)
    private val Int.dp: Int get() = (this * owner.resources.displayMetrics.density).toInt()

    private fun back(color: Int, border: Int = Color.rgb(20,80,132)): GradientDrawable =
        GradientDrawable().apply {
            cornerRadius = 10.dp.toFloat()
            setColor(color)
            setStroke(1.dp, border)
        }

    private fun text(value: String, size: Float, color: Int = Color.WHITE): TextView =
        TextView(owner).apply {
            this.text = value
            textSize = size
            setTextColor(color)
            gravity = Gravity.CENTER_VERTICAL
        }

    private fun button(value: String, action: () -> Unit): TextView =
        text(value, 12f, cyan).apply {
            gravity = Gravity.CENTER
            setPadding(12.dp, 9.dp, 12.dp, 9.dp)
            background = back(surface)
            setOnClickListener { action() }
        }

    init {
        orientation = VERTICAL
        setBackgroundColor(dark)
        val toolbar = LinearLayout(owner).apply {
            orientation = HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(7.dp, 6.dp, 7.dp, 6.dp)
            setBackgroundColor(surface)
        }
        toolbar.addView(button("‹ Profile") { exit() })
        val center = LinearLayout(owner).apply {
            orientation = VERTICAL
            setPadding(9.dp, 0, 7.dp, 0)
        }
        title.apply { textSize = 14f; setTextColor(Color.WHITE); maxLines = 2 }
        status.apply { textSize = 10f; setTextColor(Color.rgb(161,199,224)) }
        center.addView(title)
        center.addView(status)
        toolbar.addView(center, LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        toolbar.addView(button("⛶ Full") { current?.let { advanced(it) } })
        addView(toolbar, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT))

        scrollFrame.setBackgroundColor(Color.rgb(8, 21, 35))
        pageImage.apply {
            scaleType = ImageView.ScaleType.FIT_CENTER
            setBackgroundColor(Color.rgb(14,28,44))
            contentDescription = "Selected chart PDF"
        }
        scrollFrame.addView(pageImage, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ))
        addView(scrollFrame, LayoutParams(LayoutParams.MATCH_PARENT, 0, 1f))

        val nav = LinearLayout(owner).apply {
            orientation = HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(8.dp, 6.dp, 8.dp, 6.dp)
        }
        nav.addView(button("‹ Prev") { shift(-1) })
        nav.addView(button("−") { setZoom(zoom / 1.5f) })
        nav.addView(button("100%") { setZoom(1f) })
        nav.addView(button("+") { setZoom(zoom * 1.5f) })
        nav.addView(button("Next ›") { shift(1) })
        addView(nav, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT))

        metaNote.apply {
            text = "Inline PDF · for aircraft position, annotations and full controls use ⛶ Full Viewer"
            textSize = 10f
            setTextColor(Color.rgb(166,195,218))
            setPadding(9.dp, 2.dp, 9.dp, 7.dp)
        }
        addView(metaNote)

        val scaleDetector = ScaleGestureDetector(owner, object: ScaleGestureDetector.SimpleOnScaleGestureListener() {
            override fun onScale(detector: ScaleGestureDetector): Boolean {
                setZoom(zoom * detector.scaleFactor)
                return true
            }
        })
        val tapDetector = GestureDetector(owner, object: GestureDetector.SimpleOnGestureListener() {
            override fun onDoubleTap(e: MotionEvent): Boolean {
                setZoom(if (zoom > 1.05f) 1f else 2f)
                return true
            }
            override fun onDown(e: MotionEvent): Boolean = true
        })
        scrollFrame.setOnTouchListener { _, event ->
            scaleDetector.onTouchEvent(event)
            tapDetector.onTouchEvent(event)
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    oldX = event.x; oldY = event.y
                }
                MotionEvent.ACTION_MOVE -> {
                    if (event.pointerCount == 1 && zoom > 1f && !scaleDetector.isInProgress) {
                        pageImage.translationX += event.x - oldX
                        pageImage.translationY += event.y - oldY
                    }
                    oldX = event.x; oldY = event.y
                }
            }
            true
        }
    }

    private fun setZoom(value: Float) {
        zoom = value.coerceIn(1f, 5f)
        pageImage.scaleX = zoom
        pageImage.scaleY = zoom
        if (zoom == 1f) {
            pageImage.translationX = 0f
            pageImage.translationY = 0f
        }
    }

    private fun shift(step: Int) {
        val c = current ?: return
        val charts = repository.getDisplayChartsForAirport(c.icao)
            .sortedBy { it.pdfPage }
        val i = charts.indexOfFirst { it.page == c.page }
        if (i >= 0 && (i + step) in charts.indices) open(charts[i + step])
    }

    fun open(chart: ChartRepository.ChartInfo) {
        current = chart
        val nonce = ++request
        title.text = (if (chart.chartNumber.isBlank()) "" else chart.chartNumber + " · ") + chart.name
        status.text = chart.icao + " · Loading chart PDF…"
        setZoom(1f)
        // Never render or download on the main/UI thread.
        thread(name = "JeppIran-inline-pdf", isDaemon = true) {
            try {
                val info = repository.getAirportPdfInfo(chart.icao)
                val tag = repository.getReleaseTag()
                val file = File(owner.filesDir, "airport_" + chart.icao + "_" + tag + ".pdf")
                if (!file.exists() || file.length() == 0L) downloadPdf(info, file)
                if (nonce != request) return@thread
                val bitmap = render(file, chart.pdfPage - 1)
                owner.runOnUiThread {
                    if (nonce != request || owner.isFinishing || owner.isDestroyed) {
                        bitmap.recycle()
                        return@runOnUiThread
                    }
                    pageImage.setImageDrawable(null)
                    rendered?.recycle()
                    rendered = bitmap
                    pageImage.setImageBitmap(bitmap)
                    status.text = chart.icao + " · PDF page " + chart.pdfPage.toString() + " · Preview"
                    setZoom(1f)
                }
            } catch (error: Exception) {
                owner.runOnUiThread {
                    if (nonce == request && !owner.isFinishing && !owner.isDestroyed) {
                        status.text = "Chart not available: " + (error.message ?: "unable to load PDF")
                    }
                }
            }
        }
    }

    private fun downloadPdf(info: ChartRepository.AirportPdfInfo, destination: File) {
        if (!info.url.startsWith("https://")) throw IllegalStateException("HTTPS PDF required")
        val tmp = File(owner.filesDir, destination.name + ".inline.tmp")
        var connection: HttpURLConnection? = null
        try {
            connection = (URL(info.url).openConnection() as HttpURLConnection).apply {
                connectTimeout = 20000
                readTimeout = 60000
                requestMethod = "GET"
                setRequestProperty("User-Agent", "JeppIran-Android-InlineChart")
            }
            if (connection.responseCode !in 200..299) throw IllegalStateException("HTTP " + connection.responseCode)
            connection.inputStream.use { input ->
                FileOutputStream(tmp).use { output -> input.copyTo(output, 65536) }
            }
            if (tmp.length() < 1024) throw IllegalStateException("PDF download incomplete")
            if (info.size > 0 && tmp.length() != info.size) throw IllegalStateException("PDF size mismatch")
            if (info.sha256.isNotBlank()) {
                val digest = MessageDigest.getInstance("SHA-256")
                tmp.inputStream().use { input ->
                    val buffer = ByteArray(65536)
                    while (true) {
                        val bytes = input.read(buffer)
                        if (bytes < 0) break
                        digest.update(buffer, 0, bytes)
                    }
                }
                val actual = digest.digest().joinToString("") { "%02x".format(Locale.US, it.toInt() and 0xff) }
                if (!actual.equals(info.sha256, ignoreCase = true)) throw IllegalStateException("PDF checksum mismatch")
            }
            if (!tmp.renameTo(destination)) {
                tmp.copyTo(destination, overwrite = true)
                tmp.delete()
            }
        } finally {
            connection?.disconnect()
            if (tmp.exists()) tmp.delete()
        }
    }

    private fun render(file: File, index: Int): Bitmap {
        val fd = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
        try {
            val renderer = PdfRenderer(fd)
            try {
                if (index < 0 || index >= renderer.pageCount) throw IllegalArgumentException("PDF page out of range")
                val page = renderer.openPage(index)
                try {
                    val desiredWidth = min(2400, max(1300, owner.resources.displayMetrics.widthPixels * 2))
                    val desiredHeight = (desiredWidth.toDouble() * page.height / max(1, page.width)).toInt()
                        .coerceIn(500, 3900)
                    val bitmap = Bitmap.createBitmap(desiredWidth, desiredHeight, Bitmap.Config.ARGB_8888)
                    bitmap.eraseColor(Color.WHITE)
                    page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                    return bitmap
                } finally { page.close() }
            } finally { renderer.close() }
        } finally { fd.close() }
    }

    override fun onDetachedFromWindow() {
        request++
        pageImage.setImageDrawable(null)
        rendered?.recycle()
        rendered = null
        super.onDetachedFromWindow()
    }
}
