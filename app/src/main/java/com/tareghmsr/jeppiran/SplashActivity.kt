package com.tareghmsr.jeppiran

import android.content.Intent
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import androidx.activity.ComponentActivity

class SplashActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        window.statusBarColor = Color.rgb(7, 18, 30)
        window.navigationBarColor = Color.rgb(7, 18, 30)

        setContentView(SplashView())

        Handler(Looper.getMainLooper()).postDelayed({

            startActivity(
                Intent(
                    this,
                    MainActivity::class.java
                )
            )

            finish()

        }, 1400)
    }

    private inner class SplashView : View(this) {

        private val paint = Paint(
            Paint.ANTI_ALIAS_FLAG
        )

        override fun onDraw(canvas: Canvas) {

            super.onDraw(canvas)

            val w = width.toFloat()
            val h = height.toFloat()

            canvas.drawColor(
                Color.rgb(7, 18, 30)
            )

            /*
             * ILS runway
             */

            paint.color = Color.rgb(
                210,
                220,
                225
            )

            paint.style = Paint.Style.FILL

            val runway = Path()

            runway.moveTo(
                w * 0.42f,
                h * 0.95f
            )

            runway.lineTo(
                w * 0.58f,
                h * 0.95f
            )

            runway.lineTo(
                w * 0.54f,
                h * 0.48f
            )

            runway.lineTo(
                w * 0.46f,
                h * 0.48f
            )

            runway.close()

            canvas.drawPath(
                runway,
                paint
            )

            /*
             * Runway centerline
             */

            paint.color = Color.rgb(
                70,
                80,
                85
            )

            for (i in 0..5) {

                val y =
                    h * 0.54f +
                            i * h * 0.065f

                canvas.drawRect(
                    w * 0.49f,
                    y,
                    w * 0.51f,
                    y + h * 0.035f,
                    paint
                )
            }

            /*
             * ILS approach lines
             */

            paint.color = Color.rgb(
                75,
                180,
                210
            )

            paint.strokeWidth = 4f
            paint.style = Paint.Style.STROKE

            canvas.drawLine(
                w * 0.20f,
                h * 0.12f,
                w * 0.47f,
                h * 0.50f,
                paint
            )

            canvas.drawLine(
                w * 0.80f,
                h * 0.12f,
                w * 0.53f,
                h * 0.50f,
                paint
            )

            /*
             * Aircraft
             */

            paint.color = Color.WHITE
            paint.style = Paint.Style.FILL

            val aircraft = Path()

            aircraft.moveTo(
                w * 0.50f,
                h * 0.22f
            )

            aircraft.lineTo(
                w * 0.525f,
                h * 0.34f
            )

            aircraft.lineTo(
                w * 0.62f,
                h * 0.39f
            )

            aircraft.lineTo(
                w * 0.525f,
                h * 0.40f
            )

            aircraft.lineTo(
                w * 0.50f,
                h * 0.48f
            )

            aircraft.lineTo(
                w * 0.475f,
                h * 0.40f
            )

            aircraft.lineTo(
                w * 0.38f,
                h * 0.39f
            )

            aircraft.lineTo(
                w * 0.475f,
                h * 0.34f
            )

            aircraft.close()

            canvas.drawPath(
                aircraft,
                paint
            )

            /*
             * App name
             */

            paint.color = Color.WHITE
            paint.textAlign = Paint.Align.CENTER
            paint.style = Paint.Style.FILL
            paint.textSize = 34f
            paint.typeface = android.graphics.Typeface.DEFAULT_BOLD

            canvas.drawText(
                "JEPPIRAN",
                w / 2f,
                h * 0.70f,
                paint
            )

            /*
             * Subtitle
             */

            paint.color = Color.rgb(
                145,
                180,
                195
            )

            paint.textSize = 15f
            paint.typeface = android.graphics.Typeface.DEFAULT

            canvas.drawText(
                "IRAN AIRPORT CHARTS",
                w / 2f,
                h * 0.75f,
                paint
            )

            /*
             * Ahvaz / OIAW
             */

            paint.color = Color.rgb(
                100,
                145,
                160
            )

            paint.textSize = 13f

            canvas.drawText(
                "OIAW • AHWAZ",
                w / 2f,
                h * 0.80f,
                paint
            )
        }
    }
}
