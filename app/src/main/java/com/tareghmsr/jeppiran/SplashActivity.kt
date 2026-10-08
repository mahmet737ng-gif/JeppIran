package com.tareghmsr.jeppiran

import android.animation.ValueAnimator
import android.content.Intent
import android.graphics.*
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.WindowInsetsController
import android.view.animation.LinearInterpolator
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat
import kotlin.math.min

class SplashActivity : AppCompatActivity() {

    private val splashDuration = 3000L
    private val handler = Handler(Looper.getMainLooper())
    private lateinit var splashView: SplashView

    private val finishRunnable = Runnable {
        startActivity(Intent(this, MainActivity::class.java))
        overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
        finish()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        ThemeManager.apply(this)
        super.onCreate(savedInstanceState)

        /*
         * When the app task is already alive and the user returns from another
         * app (or taps the launcher icon again), do not replay the splash.
         * A real cold start still has SplashActivity as the task root.
         */
        if (!isTaskRoot) {
            finish()
            return
        }

        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT

        val controller = WindowInsetsControllerCompat(window, window.decorView)
        controller.isAppearanceLightStatusBars = false
        controller.isAppearanceLightNavigationBars = false

        if (android.os.Build.VERSION.SDK_INT >= 30) {
            window.insetsController?.systemBarsBehavior =
                WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }

        splashView = SplashView()
        setContentView(splashView)
        splashView.start()

        handler.postDelayed(finishRunnable, splashDuration)
    }

    override fun onDestroy() {
        handler.removeCallbacks(finishRunnable)
        if (::splashView.isInitialized) splashView.stop()
        super.onDestroy()
    }

    private inner class SplashView : View(this) {

        private val bg = Paint(Paint.ANTI_ALIAS_FLAG)
        private val logoPaint = Paint(Paint.ANTI_ALIAS_FLAG)
        private val whitePaint = Paint(Paint.ANTI_ALIAS_FLAG)
        private val textPaint = Paint(Paint.ANTI_ALIAS_FLAG)
        private val subTextPaint = Paint(Paint.ANTI_ALIAS_FLAG)
        private val barPaint = Paint(Paint.ANTI_ALIAS_FLAG)
        private val barTrackPaint = Paint(Paint.ANTI_ALIAS_FLAG)

        private var progress = 0f
        private var animator: ValueAnimator? = null

        init {
            setLayerType(LAYER_TYPE_SOFTWARE, null)
            logoPaint.style = Paint.Style.FILL
            whitePaint.style = Paint.Style.FILL
            textPaint.color = Color.WHITE
            textPaint.typeface = Typeface.create("sans-serif", Typeface.BOLD)
            textPaint.textAlign = Paint.Align.CENTER
            subTextPaint.color = Color.rgb(145, 174, 205)
            subTextPaint.typeface = Typeface.create("sans-serif", Typeface.NORMAL)
            subTextPaint.textAlign = Paint.Align.CENTER
            barTrackPaint.color = Color.argb(120, 82, 112, 145)
            barPaint.color = Color.rgb(0, 212, 238)
        }

        fun start() {
            if (animator != null) return
            animator = ValueAnimator.ofFloat(0f, 1f).apply {
                duration = splashDuration
                interpolator = LinearInterpolator()
                addUpdateListener {
                    progress = it.animatedValue as Float
                    invalidate()
                }
                start()
            }
        }

        fun stop() {
            animator?.cancel()
            animator = null
        }

        override fun onDraw(canvas: Canvas) {
            super.onDraw(canvas)

            val w = width.toFloat().coerceAtLeast(1f)
            val h = height.toFloat().coerceAtLeast(1f)
            val landscape = w > h

            bg.shader = LinearGradient(
                0f, 0f, w, h,
                intArrayOf(
                    Color.rgb(4, 30, 70),
                    Color.rgb(1, 15, 38),
                    Color.rgb(0, 7, 20)
                ),
                floatArrayOf(0f, .58f, 1f),
                Shader.TileMode.CLAMP
            )
            canvas.drawRect(0f, 0f, w, h, bg)
            bg.shader = null

            val glowX = if (landscape) w * .52f else w * .50f
            val glowY = if (landscape) h * .36f else h * .37f
            bg.shader = RadialGradient(
                glowX, glowY, min(w, h) * .72f,
                Color.argb(75, 16, 78, 160),
                Color.TRANSPARENT,
                Shader.TileMode.CLAMP
            )
            canvas.drawRect(0f, 0f, w, h, bg)
            bg.shader = null

            val slide = (progress / .32f).coerceIn(0f, 1f)
            val alpha = (255f * slide).toInt()
            val logoSize = if (landscape) h * .42f else w * .56f
            val logoCenterX = w * .50f - (1f - slide) * w * .15f
            val logoCenterY = if (landscape) h * .39f else h * .40f

            canvas.save()
            canvas.translate(logoCenterX, logoCenterY)
            val s = logoSize / 512f
            canvas.scale(s, s)
            canvas.translate(-256f, -256f)
            drawLogo(canvas, alpha)
            canvas.restore()

            val brandY = if (landscape) h * .72f else h * .63f
            textPaint.textSize = if (landscape) h * .10f else w * .095f
            textPaint.alpha = alpha
            canvas.drawText("JEPPIRAN", w * .5f, brandY, textPaint)

            subTextPaint.textSize = if (landscape) h * .028f else w * .028f
            subTextPaint.alpha = (220f * slide).toInt()
            canvas.drawText(
                "AVIATION CHARTS & WEATHER",
                w * .5f,
                brandY + if (landscape) h * .055f else w * .065f,
                subTextPaint
            )

            val margin = if (landscape) w * .28f else w * .16f
            val barY = if (landscape) h * .87f else h * .82f
            val barH = (if (landscape) h else w) * .008f
            val r = barH * .5f

            canvas.drawRoundRect(margin, barY, w - margin, barY + barH, r, r, barTrackPaint)
            canvas.drawRoundRect(
                margin, barY,
                margin + (w - 2f * margin) * progress,
                barY + barH,
                r, r, barPaint
            )

            subTextPaint.textSize = if (landscape) h * .025f else w * .027f
            subTextPaint.textAlign = Paint.Align.RIGHT
            subTextPaint.alpha = 255
            canvas.drawText(
                "${(progress * 100f).toInt().coerceIn(0,100)}%",
                w - margin,
                barY - barH * 1.5f,
                subTextPaint
            )
            subTextPaint.textAlign = Paint.Align.CENTER

            subTextPaint.textSize = if (landscape) h * .022f else w * .024f
            canvas.drawText(
                AppVersion.name(this@SplashActivity),
                w * .5f,
                h - if (landscape) h * .055f else w * .08f,
                subTextPaint
            )
        }

        private fun drawLogo(canvas: Canvas, alpha: Int) {
            fun path(vararg pts: Pair<Float,Float>): Path =
                Path().apply {
                    if (pts.isNotEmpty()) {
                        moveTo(pts[0].first, pts[0].second)
                        for (i in 1 until pts.size) lineTo(pts[i].first, pts[i].second)
                        close()
                    }
                }

            whitePaint.alpha = alpha
            whitePaint.shader = LinearGradient(
                70f, 170f, 430f, 330f,
                Color.WHITE, Color.rgb(205, 242, 255),
                Shader.TileMode.CLAMP
            )
            canvas.drawPath(
                path(40f to 250f, 475f to 70f, 312f to 264f, 150f to 286f),
                whitePaint
            )
            whitePaint.shader = null

            logoPaint.alpha = alpha
            logoPaint.shader = LinearGradient(
                120f, 430f, 470f, 75f,
                intArrayOf(
                    Color.rgb(0, 229, 238),
                    Color.rgb(0, 145, 246),
                    Color.rgb(2, 68, 185)
                ),
                null,
                Shader.TileMode.CLAMP
            )
            canvas.drawPath(
                Path().apply {
                    moveTo(160f, 294f)
                    lineTo(475f, 70f)
                    lineTo(307f, 341f)
                    cubicTo(270f, 405f, 250f, 442f, 214f, 449f)
                    cubicTo(180f, 455f, 126f, 428f, 67f, 391f)
                    cubicTo(144f, 373f, 203f, 347f, 238f, 313f)
                    close()
                },
                logoPaint
            )
            logoPaint.shader = null

            logoPaint.color = Color.rgb(5, 54, 143)
            canvas.drawPath(path(154f to 286f, 475f to 70f, 210f to 302f), logoPaint)

            whitePaint.color = Color.rgb(216, 249, 255)
            whitePaint.alpha = (alpha * .95f).toInt()
            canvas.drawPath(
                path(174f to 294f, 339f to 229f, 273f to 384f, 238f to 313f),
                whitePaint
            )
        }
    }
}
