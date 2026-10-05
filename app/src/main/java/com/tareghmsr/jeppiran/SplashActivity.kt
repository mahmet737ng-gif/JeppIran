package com.tareghmsr.jeppiran

import android.animation.ValueAnimator
import android.content.Intent
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Typeface
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.animation.LinearInterpolator
import androidx.activity.ComponentActivity
import kotlin.math.atan2
import kotlin.math.sin

class SplashActivity : ComponentActivity() {

    private val splashDuration = 3000L

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        window.statusBarColor = Color.rgb(8, 17, 28)
        window.navigationBarColor = Color.rgb(8, 17, 28)

        val splashView = SplashView()

        setContentView(splashView)

        splashView.startAnimation()

        Handler(Looper.getMainLooper()).postDelayed({

            startActivity(
                Intent(
                    this,
                    MainActivity::class.java
                )
            )

            finish()

        }, splashDuration)
    }

    private inner class SplashView : View(this) {

        private val paint =
            Paint(Paint.ANTI_ALIAS_FLAG)

        private val pathPaint =
            Paint(Paint.ANTI_ALIAS_FLAG)

        private var progress = 0f
        private var pulse = 0f
        private var chartPhase = 0f

        private var progressAnimator: ValueAnimator? = null
        private var pulseAnimator: ValueAnimator? = null
        private var chartAnimator: ValueAnimator? = null

        init {

            setLayerType(
                View.LAYER_TYPE_SOFTWARE,
                null
            )

            pathPaint.style =
                Paint.Style.STROKE

            pathPaint.strokeCap =
                Paint.Cap.ROUND
        }

        fun startAnimation() {

            progressAnimator =
                ValueAnimator.ofFloat(
                    0f,
                    1f
                ).apply {

                    duration = 2850L

                    interpolator =
                        LinearInterpolator()

                    addUpdateListener {

                        progress =
                            it.animatedValue as Float

                        invalidate()
                    }

                    start()
                }

            pulseAnimator =
                ValueAnimator.ofFloat(
                    0f,
                    1f
                ).apply {

                    duration = 1300L

                    repeatCount =
                        ValueAnimator.INFINITE

                    interpolator =
                        LinearInterpolator()

                    addUpdateListener {

                        pulse =
                            it.animatedValue as Float

                        invalidate()
                    }

                    start()
                }

            chartAnimator =
                ValueAnimator.ofFloat(
                    0f,
                    1f
                ).apply {

                    duration = 4200L

                    repeatCount =
                        ValueAnimator.INFINITE

                    interpolator =
                        LinearInterpolator()

                    addUpdateListener {

                        chartPhase =
                            it.animatedValue as Float

                        invalidate()
                    }

                    start()
                }
        }

        override fun onDraw(
            canvas: Canvas
        ) {

            super.onDraw(canvas)

            val w = width.toFloat()
            val h = height.toFloat()

            canvas.drawColor(
                Color.rgb(
                    8,
                    17,
                    28
                )
            )

            drawChartBackground(
                canvas,
                w,
                h
            )

            drawApproachGeometry(
                canvas,
                w,
                h
            )

            drawGpsPulse(
                canvas,
                w,
                h
            )

            drawAircraft(
                canvas,
                w,
                h
            )

            drawBrand(
                canvas,
                w,
                h
            )

            drawLoading(
                canvas,
                w,
                h
            )
        }

        private fun drawChartBackground(
            canvas: Canvas,
            w: Float,
            h: Float
        ) {

            paint.style =
                Paint.Style.STROKE

            paint.strokeWidth = 1f

            paint.color =
                Color.argb(
                    32,
                    160,
                    190,
                    205
                )

            val grid = 48f

            var x =
                -grid +
                        chartPhase * grid

            while (
                x < w + grid
            ) {

                canvas.drawLine(
                    x,
                    h * .08f,
                    x,
                    h * .88f,
                    paint
                )

                x += grid
            }

            var y = h * .08f

            while (
                y < h * .88f
            ) {

                canvas.drawLine(
                    0f,
                    y,
                    w,
                    y,
                    paint
                )

                y += grid
            }

            paint.color =
                Color.argb(
                    42,
                    95,
                    160,
                    180
                )

            paint.strokeWidth = 2f

            val route = Path()

            route.moveTo(
                w * .08f,
                h * .68f
            )

            route.cubicTo(
                w * .30f,
                h * .55f,
                w * .43f,
                h * .78f,
                w * .62f,
                h * .52f
            )

            route.cubicTo(
                w * .73f,
                h * .37f,
                w * .84f,
                h * .43f,
                w * .94f,
                h * .25f
            )

            canvas.drawPath(
                route,
                paint
            )

            paint.style =
                Paint.Style.FILL
        }

        private fun drawApproachGeometry(
            canvas: Canvas,
            w: Float,
            h: Float
        ) {

            val centerX =
                w / 2f

            val touchY =
                h * .54f

            pathPaint.color =
                Color.argb(
                    125,
                    74,
                    186,
                    211
                )

            pathPaint.strokeWidth = 3f

            canvas.drawLine(
                w * .12f,
                h * .18f,
                centerX,
                touchY,
                pathPaint
            )

            canvas.drawLine(
                w * .88f,
                h * .18f,
                centerX,
                touchY,
                pathPaint
            )

            pathPaint.color =
                Color.argb(
                    65,
                    210,
                    225,
                    232
                )

            pathPaint.strokeWidth = 1.5f

            canvas.drawLine(
                centerX,
                h * .10f,
                centerX,
                h * .88f,
                pathPaint
            )

            canvas.drawLine(
                w * .08f,
                touchY,
                w * .92f,
                touchY,
                pathPaint
            )

            paint.color =
                Color.argb(
                    115,
                    205,
                    216,
                    222
                )

            val runway = Path()

            runway.moveTo(
                w * .43f,
                h * .88f
            )

            runway.lineTo(
                w * .57f,
                h * .88f
            )

            runway.lineTo(
                w * .525f,
                touchY
            )

            runway.lineTo(
                w * .475f,
                touchY
            )

            runway.close()

            canvas.drawPath(
                runway,
                paint
            )
        }

        private fun drawGpsPulse(
            canvas: Canvas,
            w: Float,
            h: Float
        ) {

            val cx = w / 2f
            val cy = h * .54f

            val radius =
                12f +
                        pulse * 62f

            val alpha =
                (
                    145f *
                            (1f - pulse)
                    ).toInt()
                    .coerceIn(
                        0,
                        145
                    )

            paint.style =
                Paint.Style.STROKE

            paint.strokeWidth = 3f

            paint.color =
                Color.argb(
                    alpha,
                    255,
                    68,
                    151
                )

            canvas.drawCircle(
                cx,
                cy,
                radius,
                paint
            )

            paint.style =
                Paint.Style.FILL

            paint.color =
                Color.rgb(
                    255,
                    68,
                    151
                )

            paint.setShadowLayer(
                18f,
                0f,
                0f,
                Color.argb(
                    180,
                    255,
                    68,
                    151
                )
            )

            canvas.drawCircle(
                cx,
                cy,
                6f,
                paint
            )

            paint.clearShadowLayer()
        }

        private fun drawAircraft(
            canvas: Canvas,
            w: Float,
            h: Float
        ) {

            val t = progress

            val startX =
                w * .18f

            val startY =
                h * .20f

            val endX =
                w * .50f

            val endY =
                h * .54f

            val x =
                startX +
                        (endX - startX) * t

            val y =
                startY +
                        (endY - startY) * t +
                        sin(
                            t * Math.PI
                        ).toFloat() *
                        (-h * .045f)

            val dx =
                endX - startX

            val dy =
                endY - startY

            val angle =
                Math.toDegrees(
                    atan2(
                        dy.toDouble(),
                        dx.toDouble()
                    )
                ).toFloat() + 90f

            canvas.save()

            canvas.translate(
                x,
                y
            )

            canvas.rotate(
                angle
            )

            paint.color =
                Color.WHITE

            paint.setShadowLayer(
                14f,
                0f,
                0f,
                Color.argb(
                    150,
                    255,
                    255,
                    255
                )
            )

            val aircraft =
                Path()

            aircraft.moveTo(
                0f,
                -27f
            )

            aircraft.lineTo(
                5f,
                5f
            )

            aircraft.lineTo(
                25f,
                13f
            )

            aircraft.lineTo(
                5f,
                15f
            )

            aircraft.lineTo(
                0f,
                30f
            )

            aircraft.lineTo(
                -5f,
                15f
            )

            aircraft.lineTo(
                -25f,
                13f
            )

            aircraft.lineTo(
                -5f,
                5f
            )

            aircraft.close()

            canvas.drawPath(
                aircraft,
                paint
            )

            paint.clearShadowLayer()

            paint.color =
                Color.rgb(
                    255,
                    68,
                    151
                )

            canvas.drawCircle(
                0f,
                18f,
                3f,
                paint
            )

            canvas.restore()
        }

        private fun drawBrand(
            canvas: Canvas,
            w: Float,
            h: Float
        ) {

            paint.textAlign =
                Paint.Align.CENTER

            paint.typeface =
                Typeface.create(
                    Typeface.DEFAULT,
                    Typeface.BOLD
                )

            paint.textSize = 36f

            paint.color =
                Color.WHITE

            canvas.drawText(
                "JEPPIRAN",
                w / 2f,
                h * .70f,
                paint
            )

            paint.typeface =
                Typeface.DEFAULT

            paint.textSize = 12f

            paint.color =
                Color.rgb(
                    145,
                    175,
                    190
                )

            canvas.drawText(
                "FLIGHT CHARTS • IRAN",
                w / 2f,
                h * .75f,
                paint
            )
        }

        private fun drawLoading(
            canvas: Canvas,
            w: Float,
            h: Float
        ) {

            val percent =
                (progress * 100f)
                    .toInt()
                    .coerceIn(
                        0,
                        100
                    )

            val left =
                w * .15f

            val right =
                w * .85f

            val y =
                h * .84f

            paint.color =
                Color.argb(
                    55,
                    210,
                    225,
                    232
                )

            canvas.drawRoundRect(
                left,
                y,
                right,
                y + 5f,
                3f,
                3f,
                paint
            )

            paint.color =
                Color.rgb(
                    255,
                    68,
                    151
                )

            canvas.drawRoundRect(
                left,
                y,
                left +
                        (right - left) *
                        progress,
                y + 5f,
                3f,
                3f,
                paint
            )

            paint.textAlign =
                Paint.Align.CENTER

            paint.typeface =
                Typeface.create(
                    Typeface.DEFAULT,
                    Typeface.BOLD
                )

            paint.textSize = 13f

            paint.color =
                Color.WHITE

            canvas.drawText(
                "$percent%",
                w / 2f,
                y + 34f,
                paint
            )

            paint.typeface =
                Typeface.DEFAULT

            paint.textSize = 11f

            paint.color =
                Color.rgb(
                    125,
                    155,
                    170
                )

            canvas.drawText(
                if (percent >= 100)
                    "READY"
                else
                    "LOADING CHART SYSTEM",
                w / 2f,
                y + 54f,
                paint
            )
        }

        override fun onDetachedFromWindow() {

            progressAnimator?.cancel()
            pulseAnimator?.cancel()
            chartAnimator?.cancel()

            super.onDetachedFromWindow()
        }
    }
}
