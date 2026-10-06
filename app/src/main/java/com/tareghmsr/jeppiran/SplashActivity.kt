package com.tareghmsr.jeppiran

import android.animation.ValueAnimator
import android.content.Intent
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.WindowInsetsController
import android.view.animation.DecelerateInterpolator
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat
import kotlin.math.atan2
import kotlin.math.sin

class SplashActivity : AppCompatActivity() {

    private val splashDuration = 4000L

    override fun onCreate(
        savedInstanceState: Bundle?
    ) {

        ThemeManager.apply(
            this
        )
        super.onCreate(
            savedInstanceState
        )

        WindowCompat.setDecorFitsSystemWindows(
            window,
            false
        )

        window.statusBarColor =
            Color.TRANSPARENT

        window.navigationBarColor =
            Color.TRANSPARENT

        val controller =
            WindowInsetsControllerCompat(
                window,
                window.decorView
            )

        controller.isAppearanceLightStatusBars =
            false

        controller.isAppearanceLightNavigationBars =
            false

        if (
            android.os.Build.VERSION.SDK_INT >= 30
        ) {
            window.insetsController?.let {
                it.systemBarsBehavior =
                    WindowInsetsController
                        .BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        }

        val splashView =
            SplashView()

        setContentView(
            splashView
        )

        splashView.startAnimation()

        Handler(
            Looper.getMainLooper()
        ).postDelayed({

            startActivity(
                Intent(
                    this,
                    MainActivity::class.java
                )
            )

            overridePendingTransition(
                android.R.anim.fade_in,
                android.R.anim.fade_out
            )

            finish()

        }, splashDuration)
    }

    private inner class SplashView :
        View(this) {

        private val backgroundPaint =
            Paint(
                Paint.ANTI_ALIAS_FLAG
            )

        private val cloudPaint =
            Paint(
                Paint.ANTI_ALIAS_FLAG
            )

        private val linePaint =
            Paint(
                Paint.ANTI_ALIAS_FLAG
            )

        private val textPaint =
            Paint(
                Paint.ANTI_ALIAS_FLAG
            )

        private val aircraftPaint =
            Paint(
                Paint.ANTI_ALIAS_FLAG
            )

        private var progress =
            0f

        private var sceneProgress =
            0f

        private var aircraftProgress =
            0f

        private var progressAnimator:
            ValueAnimator? = null

        private var sceneAnimator:
            ValueAnimator? = null

        private var aircraftAnimator:
            ValueAnimator? = null

        init {

            setLayerType(
                View.LAYER_TYPE_SOFTWARE,
                null
            )

            linePaint.style =
                Paint.Style.STROKE

            linePaint.strokeCap =
                Paint.Cap.ROUND

            aircraftPaint.style =
                Paint.Style.FILL

            textPaint.isAntiAlias =
                true
        }

        fun startAnimation() {

            progressAnimator =
                ValueAnimator.ofFloat(
                    0f,
                    1f
                ).apply {

                    duration =
                        3850L

                    interpolator =
                        DecelerateInterpolator(
                            1.15f
                        )

                    addUpdateListener {

                        progress =
                            it.animatedValue
                                as Float

                        invalidate()
                    }

                    start()
                }

            sceneAnimator =
                ValueAnimator.ofFloat(
                    0f,
                    1f
                ).apply {

                    duration =
                        14000L

                    repeatCount =
                        ValueAnimator.INFINITE

                    repeatMode =
                        ValueAnimator.REVERSE

                    interpolator =
                        DecelerateInterpolator()

                    addUpdateListener {

                        sceneProgress =
                            it.animatedValue
                                as Float

                        invalidate()
                    }

                    start()
                }

            aircraftAnimator =
                ValueAnimator.ofFloat(
                    0f,
                    1f
                ).apply {

                    duration =
                        2850L

                    interpolator =
                        DecelerateInterpolator(
                            1.3f
                        )

                    addUpdateListener {

                        aircraftProgress =
                            it.animatedValue
                                as Float

                        invalidate()
                    }

                    start()
                }
        }

        override fun onDraw(
            canvas: Canvas
        ) {

            super.onDraw(
                canvas
            )

            val width =
                width.toFloat()

            val height =
                height.toFloat()

            val landscape =
                width >= height

            drawSky(
                canvas,
                width,
                height
            )

            drawSun(
                canvas,
                width,
                height,
                landscape
            )

            drawClouds(
                canvas,
                width,
                height,
                landscape
            )

            drawAviationChart(
                canvas,
                width,
                height
            )

            drawRoute(
                canvas,
                width,
                height,
                landscape
            )

            drawAircraft(
                canvas,
                width,
                height,
                landscape
            )

            drawBrand(
                canvas,
                width,
                height,
                landscape
            )

            drawLoading(
                canvas,
                width,
                height,
                landscape
            )

            drawVersion(
                canvas,
                width,
                height
            )
        }

        private fun drawSky(
            canvas: Canvas,
            width: Float,
            height: Float
        ) {

            val gradient =
                LinearGradient(
                    0f,
                    0f,
                    0f,
                    height,
                    Color.rgb(
                        17,
                        46,
                        77
                    ),
                    Color.rgb(
                        89,
                        139,
                        174
                    ),
                    Shader.TileMode.CLAMP
                )

            backgroundPaint.shader =
                gradient

            canvas.drawRect(
                0f,
                0f,
                width,
                height,
                backgroundPaint
            )

            backgroundPaint.shader =
                null
        }

        private fun drawSun(
            canvas: Canvas,
            width: Float,
            height: Float,
            landscape: Boolean
        ) {

            val cx =
                if (landscape) {
                    width * 0.82f
                } else {
                    width * 0.78f
                }

            val cy =
                if (landscape) {
                    height * 0.25f
                } else {
                    height * 0.18f
                }

            val radius =
                if (landscape) {
                    height * 0.38f
                } else {
                    height * 0.30f
                }

            val glow =
                RadialGradient(
                    cx,
                    cy,
                    radius,
                    Color.argb(
                        170,
                        255,
                        242,
                        204
                    ),
                    Color.argb(
                        0,
                        255,
                        242,
                        204
                    ),
                    Shader.TileMode.CLAMP
                )

            backgroundPaint.shader =
                glow

            canvas.drawCircle(
                cx,
                cy,
                radius,
                backgroundPaint
            )

            backgroundPaint.shader =
                null

            backgroundPaint.color =
                Color.argb(
                    165,
                    255,
                    248,
                    220
                )

            canvas.drawCircle(
                cx,
                cy,
                if (landscape) {
                    32f
                } else {
                    25f
                },
                backgroundPaint
            )
        }

        private fun drawClouds(
            canvas: Canvas,
            width: Float,
            height: Float,
            landscape: Boolean
        ) {

            val firstY =
                if (landscape) {
                    height * 0.63f
                } else {
                    height * 0.59f
                }

            val secondY =
                if (landscape) {
                    height * 0.75f
                } else {
                    height * 0.73f
                }

            drawCloud(
                canvas,
                width * 0.02f,
                firstY,
                width * 0.45f,
                height * 0.16f,
                205
            )

            drawCloud(
                canvas,
                width * 0.48f,
                firstY + height * 0.04f,
                width * 0.48f,
                height * 0.18f,
                185
            )

            drawCloud(
                canvas,
                width * 0.16f,
                secondY,
                width * 0.70f,
                height * 0.14f,
                155
            )
        }

        private fun drawCloud(
            canvas: Canvas,
            x: Float,
            y: Float,
            width: Float,
            height: Float,
            alpha: Int
        ) {

            cloudPaint.color =
                Color.argb(
                    alpha,
                    239,
                    245,
                    249
                )

            cloudPaint.style =
                Paint.Style.FILL

            val cloud =
                Path()

            cloud.moveTo(
                x,
                y + height * 0.72f
            )

            cloud.cubicTo(
                x + width * 0.05f,
                y + height * 0.38f,
                x + width * 0.17f,
                y + height * 0.35f,
                x + width * 0.24f,
                y + height * 0.60f
            )

            cloud.cubicTo(
                x + width * 0.28f,
                y + height * 0.16f,
                x + width * 0.42f,
                y + height * 0.08f,
                x + width * 0.51f,
                y + height * 0.46f
            )

            cloud.cubicTo(
                x + width * 0.61f,
                y + height * 0.14f,
                x + width * 0.78f,
                y + height * 0.19f,
                x + width * 0.80f,
                y + height * 0.52f
            )

            cloud.cubicTo(
                x + width * 0.91f,
                y + height * 0.36f,
                x + width,
                y + height * 0.49f,
                x + width,
                y + height * 0.72f
            )

            cloud.close()

            canvas.drawPath(
                cloud,
                cloudPaint
            )
        }

        private fun drawAviationChart(
            canvas: Canvas,
            width: Float,
            height: Float
        ) {

            linePaint.color =
                Color.argb(
                    30,
                    255,
                    255,
                    255
                )

            linePaint.strokeWidth =
                1f

            val gridSize =
                if (width >= height) {
                    78f
                } else {
                    56f
                }

            var x =
                -gridSize +
                        sceneProgress *
                        gridSize

            while (
                x < width + gridSize
            ) {

                canvas.drawLine(
                    x,
                    height * 0.08f,
                    x,
                    height * 0.90f,
                    linePaint
                )

                x += gridSize
            }

            var y =
                height * 0.10f

            while (
                y < height * 0.90f
            ) {

                canvas.drawLine(
                    0f,
                    y,
                    width,
                    y,
                    linePaint
                )

                y += gridSize
            }

            linePaint.color =
                Color.argb(
                    40,
                    255,
                    255,
                    255
                )

            linePaint.strokeWidth =
                1.5f

            val arc =
                RectF(
                    width * 0.08f,
                    height * 0.18f,
                    width * 0.92f,
                    height * 0.88f
                )

            canvas.drawArc(
                arc,
                205f,
                105f,
                false,
                linePaint
            )

            linePaint.color =
                Color.argb(
                    38,
                    7,
                    52,
                    82
                )

            linePaint.strokeWidth =
                2f

            canvas.drawCircle(
                width * 0.52f,
                height * 0.46f,
                height * 0.18f,
                linePaint
            )

            canvas.drawCircle(
                width * 0.52f,
                height * 0.46f,
                height * 0.27f,
                linePaint
            )
        }

        private fun drawRoute(
            canvas: Canvas,
            width: Float,
            height: Float,
            landscape: Boolean
        ) {

            val startX =
                if (landscape) {
                    width * 0.12f
                } else {
                    width * 0.14f
                }

            val startY =
                if (landscape) {
                    height * 0.65f
                } else {
                    height * 0.56f
                }

            val endX =
                if (landscape) {
                    width * 0.80f
                } else {
                    width * 0.80f
                }

            val endY =
                if (landscape) {
                    height * 0.34f
                } else {
                    height * 0.31f
                }

            linePaint.color =
                Color.argb(
                    115,
                    255,
                    255,
                    255
                )

            linePaint.strokeWidth =
                2.5f

            val route =
                Path()

            route.moveTo(
                startX,
                startY
            )

            route.cubicTo(
                width * 0.26f,
                height * 0.78f,
                width * 0.34f,
                height * 0.30f,
                width * 0.53f,
                height * 0.49f
            )

            route.cubicTo(
                width * 0.65f,
                height * 0.61f,
                width * 0.71f,
                height * 0.41f,
                endX,
                endY
            )

            canvas.drawPath(
                route,
                linePaint
            )

            linePaint.color =
                Color.argb(
                    55,
                    255,
                    255,
                    255
                )

            linePaint.strokeWidth =
                1f

            canvas.drawLine(
                width * 0.50f,
                height * 0.10f,
                width * 0.50f,
                height * 0.86f,
                linePaint
            )

            canvas.drawLine(
                width * 0.08f,
                height * 0.46f,
                width * 0.92f,
                height * 0.46f,
                linePaint
            )

            paintNavigationPoint(
                canvas,
                startX,
                startY
            )

            paintNavigationPoint(
                canvas,
                endX,
                endY
            )
        }

        private fun paintNavigationPoint(
            canvas: Canvas,
            x: Float,
            y: Float
        ) {

            cloudPaint.color =
                Color.argb(
                    210,
                    255,
                    255,
                    255
                )

            canvas.drawCircle(
                x,
                y,
                3.5f,
                cloudPaint
            )
        }

        private fun drawAircraft(
            canvas: Canvas,
            width: Float,
            height: Float,
            landscape: Boolean
        ) {

            val startX =
                if (landscape) {
                    width * 0.18f
                } else {
                    width * 0.20f
                }

            val startY =
                if (landscape) {
                    height * 0.25f
                } else {
                    height * 0.21f
                }

            val endX =
                if (landscape) {
                    width * 0.59f
                } else {
                    width * 0.63f
                }

            val endY =
                if (landscape) {
                    height * 0.45f
                } else {
                    height * 0.40f
                }

            val t =
                aircraftProgress

            val x =
                startX +
                        (endX - startX) * t

            val y =
                startY +
                        (endY - startY) * t -
                        sin(
                            t *
                                Math.PI
                        ).toFloat() *
                        height *
                        0.035f

            val angle =
                Math.toDegrees(
                    atan2(
                        (
                            endY -
                                startY
                        ).toDouble(),
                        (
                            endX -
                                startX
                        ).toDouble()
                    )
                ).toFloat()

            canvas.save()

            canvas.translate(
                x,
                y
            )

            canvas.rotate(
                angle
            )

            aircraftPaint.color =
                Color.WHITE

            aircraftPaint.setShadowLayer(
                18f,
                0f,
                0f,
                Color.argb(
                    170,
                    255,
                    255,
                    255
                )
            )

            val aircraft =
                Path()

            aircraft.moveTo(
                28f,
                0f
            )

            aircraft.lineTo(
                -8f,
                -5f
            )

            aircraft.lineTo(
                -25f,
                -18f
            )

            aircraft.lineTo(
                -29f,
                -16f
            )

            aircraft.lineTo(
                -13f,
                -2f
            )

            aircraft.lineTo(
                -35f,
                8f
            )

            aircraft.lineTo(
                -32f,
                12f
            )

            aircraft.lineTo(
                -8f,
                6f
            )

            aircraft.lineTo(
                -2f,
                23f
            )

            aircraft.lineTo(
                4f,
                23f
            )

            aircraft.lineTo(
                6f,
                7f
            )

            aircraft.lineTo(
                28f,
                4f
            )

            aircraft.close()

            canvas.drawPath(
                aircraft,
                aircraftPaint
            )

            aircraftPaint.clearShadowLayer()

            canvas.restore()
        }

        private fun drawBrand(
            canvas: Canvas,
            width: Float,
            height: Float,
            landscape: Boolean
        ) {

            val centerX =
                width / 2f

            val brandY =
                if (landscape) {
                    height * 0.57f
                } else {
                    height * 0.53f
                }

            textPaint.textAlign =
                Paint.Align.CENTER

            textPaint.typeface =
                Typeface.create(
                    "sans-serif",
                    Typeface.BOLD
                )

            textPaint.textSize =
                if (landscape) {
                    46f
                } else {
                    38f
                }

            textPaint.color =
                Color.WHITE

            textPaint.setShadowLayer(
                20f,
                0f,
                4f,
                Color.argb(
                    100,
                    0,
                    0,
                    0
                )
            )

            canvas.drawText(
                "JEPPIRAN",
                centerX,
                brandY,
                textPaint
            )

            textPaint.clearShadowLayer()

            textPaint.typeface =
                Typeface.create(
                    "sans-serif",
                    Typeface.NORMAL
                )

            textPaint.textSize =
                if (landscape) {
                    13f
                } else {
                    11f
                }

            textPaint.color =
                Color.argb(
                    235,
                    244,
                    248,
                    251
                )

            canvas.drawText(
                "FLIGHT CHARTS  •  IRAN",
                centerX,
                brandY + 28f,
                textPaint
            )
        }

        private fun drawLoading(
            canvas: Canvas,
            width: Float,
            height: Float,
            landscape: Boolean
        ) {

            val barWidth =
                if (landscape) {
                    width * 0.38f
                } else {
                    width * 0.68f
                }

            val barHeight =
                5f

            val left =
                (width - barWidth) / 2f

            val y =
                if (landscape) {
                    height * 0.79f
                } else {
                    height * 0.78f
                }

            cloudPaint.color =
                Color.argb(
                    70,
                    255,
                    255,
                    255
                )

            canvas.drawRoundRect(
                left,
                y,
                left + barWidth,
                y + barHeight,
                4f,
                4f,
                cloudPaint
            )

            cloudPaint.color =
                Color.WHITE

            canvas.drawRoundRect(
                left,
                y,
                left +
                    barWidth *
                    progress,
                y + barHeight,
                4f,
                4f,
                cloudPaint
            )

            val percent =
                (
                    progress *
                        100f
                )
                    .toInt()
                    .coerceIn(
                        0,
                        100
                    )

            textPaint.textAlign =
                Paint.Align.CENTER

            textPaint.typeface =
                Typeface.create(
                    "sans-serif-medium",
                    Typeface.NORMAL
                )

            textPaint.textSize =
                12f

            textPaint.color =
                Color.WHITE

            canvas.drawText(
                "INITIALIZING  •  $percent%",
                width / 2f,
                y + 28f,
                textPaint
            )
        }

        private fun drawVersion(
            canvas: Canvas,
            width: Float,
            height: Float
        ) {

            textPaint.textAlign =
                Paint.Align.CENTER

            textPaint.typeface =
                Typeface.create(
                    "sans-serif",
                    Typeface.NORMAL
                )

            textPaint.textSize =
                10f

            textPaint.color =
                Color.argb(
                    190,
                    235,
                    241,
                    245
                )

            canvas.drawText(
                "VERSION 1.0.1",
                width / 2f,
                height - 30f,
                textPaint
            )
        }

        override fun onDetachedFromWindow() {

            progressAnimator?.cancel()
            sceneAnimator?.cancel()
            aircraftAnimator?.cancel()

            super.onDetachedFromWindow()
        }
    }
}
