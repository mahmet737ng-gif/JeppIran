package com.tareghmsr.jeppiran

import android.graphics.Typeface
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class EnrouteActivity : AppCompatActivity() {
    private lateinit var map: EnrouteMapView
    private lateinit var status: TextView
    private val handler = Handler(Looper.getMainLooper())

    private val positionTick = object : Runnable {
        override fun run() {
            val sim = if (SimulatorLocationStore.isConnected()) SimulatorLocationStore.getPosition() else null
            map.setAircraftPosition(sim)
            handler.postDelayed(this, 500L)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        ThemeManager.apply(this)
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val data = EnrouteRepository.load(this)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(0xFF11171E.toInt())
        }

        val header = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(16.dp, 12.dp, 16.dp, 8.dp)
        }
        header.addView(TextView(this).apply {
            text = "EN-ROUTE"
            textSize = 24f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(0xFFF2F5F8.toInt())
        })

        status = TextView(this).apply {
            text = "${data.cycle}  •  ${data.airways.size} airway segments  •  ${data.fixes.size + data.navaids.size} nav points"
            textSize = 11f
            setTextColor(0xFFA9B6C5.toInt())
        }
        header.addView(status)

        val toolbar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(10.dp, 4.dp, 10.dp, 8.dp)
        }

        fun button(label: String, action: () -> Unit): Button =
            Button(this).apply {
                text = label
                textSize = 11f
                setOnClickListener { action() }
            }

        toolbar.addView(button("LOW") { map.setLevel(EnrouteMapView.Level.LOW) }, LinearLayout.LayoutParams(0, 48.dp, 1f))
        toolbar.addView(button("HIGH") { map.setLevel(EnrouteMapView.Level.HIGH) }, LinearLayout.LayoutParams(0, 48.dp, 1f))
        toolbar.addView(button("BOTH") { map.setLevel(EnrouteMapView.Level.BOTH) }, LinearLayout.LayoutParams(0, 48.dp, 1f))
        toolbar.addView(button("OWN SHIP") { map.centerOnAircraft() }, LinearLayout.LayoutParams(0, 48.dp, 1f))

        map = EnrouteMapView(this).apply {
            setDataset(data)
            setLevel(EnrouteMapView.Level.LOW)
        }

        root.addView(header)
        root.addView(toolbar)
        root.addView(map, LinearLayout.LayoutParams(-1, 0, 1f))
        setContentView(root)

        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(0, bars.top, 0, bars.bottom)
            insets
        }
    }

    override fun onResume() {
        super.onResume()
        handler.removeCallbacks(positionTick)
        handler.post(positionTick)
    }

    override fun onPause() {
        handler.removeCallbacks(positionTick)
        super.onPause()
    }

    private val Int.dp: Int get() = (this * resources.displayMetrics.density).toInt()
}
