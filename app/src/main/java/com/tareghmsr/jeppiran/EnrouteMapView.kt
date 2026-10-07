package com.tareghmsr.jeppiran

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Typeface
import android.view.MotionEvent
import android.view.ScaleGestureDetector
import android.view.View
import kotlin.math.max

class EnrouteMapView(context: Context) : View(context) {
    enum class Level { LOW, HIGH, BOTH }

    private var dataset: EnrouteDataset = EnrouteDataset.empty()
    private var level: Level = Level.LOW
    private var centerLat = 32.0
    private var centerLon = 53.0
    private var degreesPerScreen = 18.0
    private var aircraft: SimulatorPosition? = null
    private var lastTouchX = 0f
    private var lastTouchY = 0f
    private var dragging = false

    private val scaleDetector = ScaleGestureDetector(
        context,
        object : ScaleGestureDetector.SimpleOnScaleGestureListener() {
            override fun onScale(detector: ScaleGestureDetector): Boolean {
                degreesPerScreen = (degreesPerScreen / detector.scaleFactor).coerceIn(0.15, 80.0)
                invalidate()
                return true
            }
        }
    )

    private val gridPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0x335E748B
        strokeWidth = 1f
        style = Paint.Style.STROKE
    }
    private val airwayPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0xFF5C8DFF.toInt()
        strokeWidth = 2.2f
        style = Paint.Style.STROKE
    }
    private val airwayHighPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0xFFB779FF.toInt()
        strokeWidth = 2.4f
        style = Paint.Style.STROKE
    }
    private val airspacePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0x887B8CA5.toInt()
        strokeWidth = 1.5f
        style = Paint.Style.STROKE
    }
    private val pointPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0xFFF2F5F8.toInt()
        strokeWidth = 2f
        style = Paint.Style.STROKE
    }
    private val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0xFFE7EDF4.toInt()
        textSize = 11f * resources.displayMetrics.scaledDensity
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    }
    private val secondaryTextPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0xFFA9B6C5.toInt()
        textSize = 9f * resources.displayMetrics.scaledDensity
    }
    private val aircraftPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0xFF41D98A.toInt()
        style = Paint.Style.FILL
    }

    fun setDataset(value: EnrouteDataset) { dataset = value; invalidate() }
    fun setLevel(value: Level) { level = value; invalidate() }
    fun setAircraftPosition(value: SimulatorPosition?) { aircraft = value; invalidate() }
    fun centerOnAircraft() {
        aircraft?.let {
            centerLat = it.latitude
            centerLon = it.longitude
            invalidate()
        }
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        canvas.drawColor(0xFF11171E.toInt())
        drawGrid(canvas)
        drawAirspaces(canvas)
        drawAirways(canvas)
        drawPoints(canvas)
        drawAircraft(canvas)
        if (dataset.airways.isEmpty() && dataset.fixes.isEmpty() && dataset.navaids.isEmpty()) {
            val p = Paint(textPaint).apply { textAlign = Paint.Align.CENTER }
            canvas.drawText("NO EN-ROUTE DATASET INSTALLED", width / 2f, height / 2f, p)
        }
    }

    private fun drawGrid(canvas: Canvas) {
        val latSpan = degreesPerScreen * height / max(width, 1).toDouble()
        val left = centerLon - degreesPerScreen / 2.0
        val right = centerLon + degreesPerScreen / 2.0
        val bottom = centerLat - latSpan / 2.0
        val top = centerLat + latSpan / 2.0
        val step = when {
            degreesPerScreen > 40 -> 10.0
            degreesPerScreen > 15 -> 5.0
            degreesPerScreen > 5 -> 2.0
            degreesPerScreen > 1.5 -> 0.5
            else -> 0.1
        }
        var lon = kotlin.math.floor(left / step) * step
        while (lon <= right) {
            val x = lonToX(lon)
            canvas.drawLine(x, 0f, x, height.toFloat(), gridPaint)
            lon += step
        }
        var lat = kotlin.math.floor(bottom / step) * step
        while (lat <= top) {
            val y = latToY(lat)
            canvas.drawLine(0f, y, width.toFloat(), y, gridPaint)
            lat += step
        }
    }

    private fun drawAirspaces(canvas: Canvas) {
        dataset.airspaces.forEach { airspace ->
            val first = airspace.boundary.firstOrNull() ?: return@forEach
            val path = Path().apply {
                moveTo(lonToX(first.longitude), latToY(first.latitude))
                airspace.boundary.drop(1).forEach {
                    lineTo(lonToX(it.longitude), latToY(it.latitude))
                }
                close()
            }
            canvas.drawPath(path, airspacePaint)
        }
    }

    private fun drawAirways(canvas: Canvas) {
        dataset.airways.forEach { segment ->
            val segmentLevel = segment.level.uppercase()
            val visible = when (level) {
                Level.LOW -> segmentLevel == "LOW" || segmentLevel == "BOTH"
                Level.HIGH -> segmentLevel == "HIGH" || segmentLevel == "BOTH"
                Level.BOTH -> true
            }
            if (!visible) return@forEach
            val paint = if (segmentLevel == "HIGH") airwayHighPaint else airwayPaint
            val x1 = lonToX(segment.from.longitude)
            val y1 = latToY(segment.from.latitude)
            val x2 = lonToX(segment.to.longitude)
            val y2 = latToY(segment.to.latitude)
            canvas.drawLine(x1, y1, x2, y2, paint)
            if (segment.airway.isNotBlank() && degreesPerScreen < 22.0) {
                canvas.drawText(segment.airway, (x1 + x2) / 2f + 4f, (y1 + y2) / 2f - 4f, secondaryTextPaint)
            }
        }
    }

    private fun drawPoints(canvas: Canvas) {
        val showLabels = degreesPerScreen < 12.0
        dataset.fixes.forEach { fix ->
            val x = lonToX(fix.position.longitude)
            val y = latToY(fix.position.latitude)
            val s = 5f
            val path = Path().apply {
                moveTo(x, y - s)
                lineTo(x + s, y + s)
                lineTo(x - s, y + s)
                close()
            }
            canvas.drawPath(path, pointPaint)
            if (showLabels && fix.ident.isNotBlank()) canvas.drawText(fix.ident, x + 7f, y - 6f, textPaint)
        }
        dataset.navaids.forEach { nav ->
            val x = lonToX(nav.position.longitude)
            val y = latToY(nav.position.latitude)
            canvas.drawCircle(x, y, 6f, pointPaint)
            canvas.drawCircle(x, y, 2f, pointPaint)
            if (showLabels && nav.ident.isNotBlank()) {
                canvas.drawText(nav.ident, x + 8f, y - 7f, textPaint)
                nav.frequency?.let { canvas.drawText(it, x + 8f, y + 7f, secondaryTextPaint) }
            }
        }
    }

    private fun drawAircraft(canvas: Canvas) {
        val p = aircraft ?: return
        val x = lonToX(p.longitude)
        val y = latToY(p.latitude)
        canvas.save()
        canvas.rotate((p.headingDegrees ?: 0.0).toFloat(), x, y)
        val path = Path().apply {
            moveTo(x, y - 13f)
            lineTo(x + 7f, y + 10f)
            lineTo(x, y + 6f)
            lineTo(x - 7f, y + 10f)
            close()
        }
        canvas.drawPath(path, aircraftPaint)
        canvas.restore()
    }

    private fun lonToX(lon: Double): Float =
        (((lon - centerLon) / degreesPerScreen) * width + width / 2.0).toFloat()

    private fun latToY(lat: Double): Float {
        if (height <= 0 || width <= 0) return 0f
        val latSpan = degreesPerScreen * height / width.toDouble()
        return (height / 2.0 - ((lat - centerLat) / latSpan) * height).toFloat()
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        scaleDetector.onTouchEvent(event)
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                lastTouchX = event.x; lastTouchY = event.y; dragging = true
                parent?.requestDisallowInterceptTouchEvent(true)
            }
            MotionEvent.ACTION_MOVE -> if (dragging && !scaleDetector.isInProgress) {
                val dx = event.x - lastTouchX
                val dy = event.y - lastTouchY
                val latSpan = degreesPerScreen * height / max(width, 1).toDouble()
                centerLon -= dx / max(width, 1).toDouble() * degreesPerScreen
                centerLat += dy / max(height, 1).toDouble() * latSpan
                centerLat = centerLat.coerceIn(-85.0, 85.0)
                centerLon = ((centerLon + 540.0) % 360.0) - 180.0
                lastTouchX = event.x; lastTouchY = event.y
                invalidate()
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                dragging = false
                parent?.requestDisallowInterceptTouchEvent(false)
            }
        }
        return true
    }
}
