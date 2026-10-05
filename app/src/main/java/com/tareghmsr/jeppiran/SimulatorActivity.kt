package com.tareghmsr.jeppiran

import android.graphics.Color
import android.graphics.Typeface
import android.os.Bundle
import android.text.InputType
import android.view.Gravity
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import java.net.Inet4Address
import java.net.NetworkInterface
import java.util.Collections

class SimulatorActivity : AppCompatActivity() {
    private lateinit var root: LinearLayout
    private lateinit var typeText: TextView
    private lateinit var hostInput: EditText
    private lateinit var portInput: EditText
    private lateinit var statusText: TextView
    private lateinit var positionText: TextView
    private lateinit var connectButton: Button
    private lateinit var guideText: TextView

    private var selectedType = SimulatorLocationStore.TYPE_XPLANE
    private val handler = android.os.Handler(android.os.Looper.getMainLooper())
    private val refreshRunnable = object : Runnable {
        override fun run() {
            refreshStatus()
            handler.postDelayed(this, 500L)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        ThemeManager.apply(this)
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        buildUi()
        handler.post(refreshRunnable)
    }

    override fun onDestroy() {
        handler.removeCallbacks(refreshRunnable)
        super.onDestroy()
    }

    private fun buildUi() {
        selectedType = SimulatorLocationStore.savedType(this)

        root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(backgroundColor())
        }

        val scroll = ScrollView(this)
        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(20.dp, 18.dp, 20.dp, 28.dp)
        }

        content.addView(TextView(this).apply {
            text = "CONNECT TO SIMULATOR"
            textSize = 24f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(textColor())
        })

        content.addView(TextView(this).apply {
            text = "Use simulator aircraft position instead of the Android GPS."
            textSize = 13f
            setTextColor(secondaryTextColor())
            setPadding(0, 6.dp, 0, 18.dp)
        })

        content.addView(sectionTitle("SIMULATOR"))

        typeText = TextView(this).apply {
            text = selectedType
            textSize = 16f
            gravity = Gravity.CENTER_VERTICAL
            setTextColor(textColor())
            setPadding(16.dp, 15.dp, 16.dp, 15.dp)
            background = roundedSurface()
            setOnClickListener { chooseSimulator() }
        }
        content.addView(typeText, lp(58))

        content.addView(sectionTitle("CONNECTION"))

        hostInput = EditText(this).apply {
            hint = "Simulator PC IP address"
            setText(SimulatorLocationStore.savedHost(this@SimulatorActivity))
            textSize = 16f
            inputType = InputType.TYPE_CLASS_TEXT
            setSingleLine(true)
            setTextColor(textColor())
            setHintTextColor(secondaryTextColor())
            background = roundedSurface()
            setPadding(16.dp, 0, 16.dp, 0)
        }
        content.addView(hostInput, lp(58))

        portInput = EditText(this).apply {
            hint = "UDP port"
            setText(SimulatorLocationStore.savedPort(this@SimulatorActivity).toString())
            textSize = 16f
            inputType = InputType.TYPE_CLASS_NUMBER
            setSingleLine(true)
            setTextColor(textColor())
            setHintTextColor(secondaryTextColor())
            background = roundedSurface()
            setPadding(16.dp, 0, 16.dp, 0)
        }
        content.addView(portInput, lp(58, 0, 8, 0))

        connectButton = Button(this).apply {
            text = "CONNECT"
            setOnClickListener { toggleConnection() }
        }
        content.addView(connectButton, lp(52, 0, 8, 0))

        statusText = TextView(this).apply {
            textSize = 14f
            setTextColor(secondaryTextColor())
            setPadding(4.dp, 8.dp, 4.dp, 8.dp)
        }
        content.addView(statusText)

        positionText = TextView(this).apply {
            textSize = 15f
            typeface = Typeface.MONOSPACE
            setTextColor(textColor())
            setPadding(14.dp, 14.dp, 14.dp, 14.dp)
            background = roundedSurface()
        }
        content.addView(positionText, lp(0, 10, 0, 12))

        content.addView(sectionTitle("SETUP GUIDE"))
        guideText = TextView(this).apply {
            textSize = 14f
            setTextColor(textColor())
            setLineSpacing(4f, 1.05f)
            text = buildGuide()
        }
        content.addView(guideText)

        content.addView(TextView(this).apply {
            textSize = 13f
            setTextColor(secondaryTextColor())
            setPadding(0, 18.dp, 0, 0)
            text = "Android device IP: " + localIpAddress()
        })

        scroll.addView(content)
        root.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))
        setContentView(root)

        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(0, bars.top, 0, bars.bottom)
            insets
        }
        ViewCompat.requestApplyInsets(root)
        refreshStatus()
    }

    private fun chooseSimulator() {
        val items = arrayOf(
            SimulatorLocationStore.TYPE_XPLANE,
            SimulatorLocationStore.TYPE_MSFS
        )
        android.app.AlertDialog.Builder(this)
            .setTitle("Select simulator")
            .setItems(items) { _, which ->
                selectedType = items[which]
                typeText.text = selectedType
                if (selectedType == SimulatorLocationStore.TYPE_MSFS) {
                    portInput.setText("49010")
                    hostInput.setText("MSFS bridge")
                } else {
                    portInput.setText("49000")
                    if (hostInput.text.toString() == "MSFS bridge") {
                        hostInput.setText("192.168.1.100")
                    }
                }
                guideText.text = buildGuide()
                statusText.text = "Selected: " + selectedType
            }
            .show()
    }

    private fun toggleConnection() {
        if (SimulatorLocationStore.isConnected()) {
            SimulatorLocationStore.disconnect()
            return
        }

        val port = portInput.text.toString().toIntOrNull()
        if (selectedType == SimulatorLocationStore.TYPE_XPLANE) {
            val host = hostInput.text.toString().trim()
            if (host.isBlank() || port == null || port !in 1..65535) {
                statusText.text = "Enter a valid X-Plane PC IP and UDP port."
                return
            }
            SimulatorLocationStore.connect(this, selectedType, host, port)
        } else {
            SimulatorLocationStore.connect(this, selectedType, "", 49010)
        }
    }

    private fun refreshStatus() {
        val connected = SimulatorLocationStore.isConnected()
        connectButton.text = if (connected) "DISCONNECT" else "CONNECT"
        statusText.text = SimulatorLocationStore.getStatus()

        val p = SimulatorLocationStore.getPosition()
        positionText.text = if (p == null) {
            "Position: waiting for simulator data..."
        } else {
            buildString {
                append("LAT  ")
                append(String.format(java.util.Locale.US, "%.6f", p.latitude))
                append("\nLON  ")
                append(String.format(java.util.Locale.US, "%.6f", p.longitude))
                p.altitudeMeters?.let {
                    append("\nALT  ")
                    append(String.format(java.util.Locale.US, "%.0f m", it))
                }
                p.headingDegrees?.let {
                    append("\nHDG  ")
                    append(String.format(java.util.Locale.US, "%.0f°", it))
                }
            }
        }
    }

    private fun buildGuide(): String {
        return if (selectedType == SimulatorLocationStore.TYPE_XPLANE) {
            "X-PLANE 11 / 12\n\n" +
                "1. Connect the Android device and the simulator PC to the same Wi-Fi/LAN.\n" +
                "2. Enter the simulator PC IPv4 address above.\n" +
                "3. Leave UDP port 49000 unless you changed X-Plane's network port.\n" +
                "4. Tap CONNECT and keep X-Plane running. JEPPIRAN requests latitude, longitude, altitude and heading through X-Plane's UDP dataref interface.\n\n" +
                "No GPS permission is used while the simulator connection is active."
        } else {
            "MICROSOFT FLIGHT SIMULATOR 2020 / 2024\n\n" +
                "MSFS uses SimConnect on the Windows PC. JEPPIRAN receives the simulator position through a small PC-side SimConnect bridge.\n\n" +
                "1. Install/run the bridge on the same PC as MSFS.\n" +
                "2. Configure the bridge to send JSON by UDP to the Android device on port 49010.\n" +
                "3. Use this format:\n" +
                "{\"lat\":35.6895,\"lon\":51.3130,\"alt\":4200,\"heading\":270}\n" +
                "4. Tap CONNECT in JEPPIRAN.\n\n" +
                "No GPS permission is used while the simulator connection is active."
        }
    }

    private fun sectionTitle(text: String): TextView =
        TextView(this).apply {
            this.text = text
            textSize = 12f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(secondaryTextColor())
            setPadding(2.dp, 18.dp, 2.dp, 8.dp)
        }

    private fun roundedSurface() = android.graphics.drawable.GradientDrawable().apply {
        cornerRadius = 14.dp.toFloat()
        setColor(if (isDarkTheme()) Color.rgb(25, 35, 45) else Color.WHITE)
        setStroke(1.dp, if (isDarkTheme()) Color.rgb(55, 70, 84) else Color.rgb(224, 230, 236))
    }

    private fun lp(height: Int, l: Int = 0, t: Int = 4, r: Int = 0, b: Int = 4) =
        LinearLayout.LayoutParams(-1, height.dp).apply { setMargins(l.dp, t.dp, r.dp, b.dp) }

    private fun backgroundColor() =
        if (isDarkTheme()) Color.rgb(14, 22, 30) else Color.rgb(244, 247, 250)

    private fun textColor() =
        if (isDarkTheme()) Color.rgb(241, 245, 248) else Color.rgb(18, 32, 48)

    private fun secondaryTextColor() =
        if (isDarkTheme()) Color.rgb(158, 174, 187) else Color.rgb(91, 107, 122)

    private fun isDarkTheme() =
        (resources.configuration.uiMode and android.content.res.Configuration.UI_MODE_NIGHT_MASK) ==
            android.content.res.Configuration.UI_MODE_NIGHT_YES

    private fun localIpAddress(): String {
        return try {
            Collections.list(NetworkInterface.getNetworkInterfaces())
                .flatMap { Collections.list(it.inetAddresses) }
                .firstOrNull { it is Inet4Address && !it.isLoopbackAddress }
                ?.hostAddress ?: "Unavailable"
        } catch (_: Throwable) {
            "Unavailable"
        }
    }

    private val Int.dp: Int
        get() = (this * resources.displayMetrics.density).toInt()
}
