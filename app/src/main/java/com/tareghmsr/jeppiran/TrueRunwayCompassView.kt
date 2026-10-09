package com.tareghmsr.jeppiran

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.DashPathEffect
import android.graphics.Paint
import android.graphics.Path
import android.view.View
import kotlin.math.min

/**
 * A runway points to TRUE bearing clockwise from north.
 * Screen-up is north; no magnetic variation is added.
 * Unavailable bearings never result in an invented runway vector.
 */
class TrueRunwayCompassView(context: Context) : View(context) {
    var runwayId = "—"
        set(value) { field = value; invalidate() }
    var headingTrue: Float? = null
        set(value) { field = value; invalidate() }

    private val ink = Paint(Paint.ANTI_ALIAS_FLAG)
    private val cyan = Color.rgb(59, 198, 255)
    private val light = Color.rgb(214, 236, 250)
    private val muted = Color.rgb(141, 182, 211)

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val scale = min(width / 320f, height / 210f)
        val cx = width / 2f
        val cy = height / 2f
        canvas.save()
        canvas.translate(cx, cy)
        canvas.scale(scale, scale)
        val centerX = 0f
        val centerY = 0f

        ink.style = Paint.Style.STROKE
        ink.strokeWidth = 1.5f
        ink.color = Color.rgb(36, 93, 143)
        canvas.drawCircle(centerX, centerY, 84f, ink)
        ink.color = cyan
        ink.strokeWidth = 2f
        canvas.drawLine(0f, -101f, 0f, -86f, ink)
        canvas.drawLine(0f, 86f, 0f, 101f, ink)
        canvas.drawLine(-101f, 0f, -86f, 0f, ink)
        canvas.drawLine(86f, 0f, 101f, 0f, ink)

        ink.style = Paint.Style.FILL
        ink.color = cyan
        ink.textSize = 15f
        ink.textAlign = Paint.Align.CENTER
        ink.typeface = android.graphics.Typeface.DEFAULT_BOLD
        canvas.drawText("N", 0f, -104f, ink)

        val h = headingTrue
        if (h == null || !h.isFinite()) {
            ink.color = muted
            ink.textSize = 12f
            canvas.drawText("TRUE heading unavailable", 0f, 4f, ink)
            canvas.restore()
            return
        }

        // Upward runway axis rotated clockwise through h degrees from TRUE north.
        canvas.save()
        canvas.rotate(((h % 360f) + 360f) % 360f)
        ink.color = Color.rgb(18, 51, 82)
        ink.style = Paint.Style.FILL
        canvas.drawRect(-17f, -62f, 17f, 62f, ink)
        ink.color = light
        ink.style = Paint.Style.STROKE
        ink.strokeWidth = 3f
        ink.pathEffect = null
        canvas.drawRect(-17f, -62f, 17f, 62f, ink)
        ink.strokeWidth = 2f
        ink.pathEffect = DashPathEffect(floatArrayOf(10f, 8f), 0f)
        canvas.drawLine(0f, -56f, 0f, 56f, ink)
        ink.pathEffect = null
        ink.color = cyan
        ink.style = Paint.Style.FILL
        val arrow = Path().apply {
            moveTo(0f, -83f)
            lineTo(-13f, -65f)
            lineTo(13f, -65f)
            close()
        }
        canvas.drawPath(arrow, ink)
        canvas.restore()

        ink.color = light
        ink.style = Paint.Style.FILL
        ink.textSize = 12f
        ink.typeface = android.graphics.Typeface.DEFAULT_BOLD
        canvas.drawText("RWY " + runwayId + " HDG · " + h.toInt() + "°",
            0f, 97f, ink)
        canvas.restore()
    }
}
