package com.tareghmsr.jeppiran

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.ColorFilter
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.drawable.Drawable

/** The exact owner-approved PNG board, shared with Web, with no tint applied. */
object ChartToolbarArtwork {
    enum class Icon(val x: Int, val y: Int, val height: Int) {
        BACK(52, 75, 270), NEXT(487, 75, 270),
        ZOOM_IN(918, 75, 270), ZOOM_OUT(1350, 75, 270),
        METAR(52, 437, 296), CDFA(487, 437, 296),
        FULLSCREEN(918, 437, 296), OFFLINE(1350, 437, 296)
    }

    private var bitmap: Bitmap? = null

    @Synchronized
    fun drawable(context: Context, icon: Icon): Drawable {
        val atlas = bitmap ?: BitmapFactory.decodeResource(
            context.resources, R.drawable.chart_toolbar_matte,
            BitmapFactory.Options().apply { inScaled = false }
        ).also { bitmap = it }
        return ArtworkDrawable(atlas, icon)
    }

    private class ArtworkDrawable(private val atlas: Bitmap, icon: Icon) : Drawable() {
        private val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
        private val source = Rect(icon.x, icon.y, icon.x + 380, icon.y + icon.height)
        private val target = RectF()

        override fun draw(canvas: Canvas) {
            // Preserve the proportions of both rows of the approved graphic.
            val scale = minOf(
                bounds.width().toFloat() / source.width(),
                bounds.height().toFloat() / source.height()
            )
            val width = source.width() * scale
            val height = source.height() * scale
            val left = bounds.exactCenterX() - width / 2f
            val top = bounds.exactCenterY() - height / 2f
            target.set(left, top, left + width, top + height)
            canvas.drawBitmap(atlas, source, target, paint)
        }

        override fun setAlpha(alpha: Int) { paint.alpha = alpha; invalidateSelf() }
        override fun setColorFilter(colorFilter: ColorFilter?) {
            // PNG materials remain full-color in both light and dark themes.
        }
        @Suppress("DEPRECATION")
        override fun getOpacity(): Int = PixelFormat.TRANSLUCENT
    }
}
