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
            text = "Use simulator aircraft position in the chart viewer instead of the Android GPS."
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
            hint = "Simulator PC IP (X-Plane only)"
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
            SimulatorLocationStore.TYPE_MSFS,
            SimulatorLocationStore.TYPE_P3D
        )
        android.app.AlertDialog.Builder(this)
            .setTitle("Select simulator")
            .setItems(items) { _, which ->
                selectedType = items[which]
                typeText.text = selectedType

                when (selectedType) {
                    SimulatorLocationStore.TYPE_XPLANE -> {
                        portInput.setText("49000")
                        if (
                            hostInput.text.toString() == "PC bridge"
                        ) {
                            hostInput.setText("192.168.1.100")
                        }
                    }

                    SimulatorLocationStore.TYPE_MSFS -> {
                        portInput.setText("49010")
                        hostInput.setText("PC bridge")
                    }

                    SimulatorLocationStore.TYPE_P3D -> {
                        portInput.setText("49011")
                        hostInput.setText("PC bridge")
                    }
                }

                guideText.text = buildGuide()
                statusText.text = "Selected: $selectedType"
            }
            .show()
    }

    private fun toggleConnection() {
        if (SimulatorLocationStore.isConnected()) {
            SimulatorLocationStore.disconnect()
            return
        }

        val port = portInput.text.toString().toIntOrNull()

        if (
            port == null ||
            port !in 1..65535
        ) {
            statusText.text = "Enter a valid UDP port."
            return
        }

        if (
            selectedType ==
            SimulatorLocationStore.TYPE_XPLANE
        ) {
            val host = hostInput.text.toString().trim()
            if (host.isBlank() || host == "PC bridge") {
                statusText.text = "Enter the X-Plane PC IPv4 address."
                return
            }

            SimulatorLocationStore.connect(
                this,
                selectedType,
                host,
                port
            )
        } else {
            SimulatorLocationStore.connect(
                this,
                selectedType,
                "",
                port
            )
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
        return when (selectedType) {
            SimulatorLocationStore.TYPE_XPLANE ->
                "X-PLANE 11 / 12\n\n" +
                    "1. Connect the Android device and simulator PC to the same Wi-Fi/LAN.\n" +
                    "2. Enter the simulator PC IPv4 address above.\n" +
                    "3. Leave UDP port 49000 unless X-Plane uses another network port.\n" +
                    "4. Tap CONNECT. JEPPIRAN requests latitude, longitude, altitude and true heading directly through X-Plane RREF/UDP.\n\n" +
                    "While the simulator is connected, JEPPIRAN uses simulator position instead of phone GPS."

            SimulatorLocationStore.TYPE_MSFS ->
                "MICROSOFT FLIGHT SIMULATOR 2020 / 2024\n\n" +
                    "1. Build/run simulator-bridge/msfs on the Windows simulator PC.\n" +
                    "2. Start MSFS, then launch the bridge with this Android device IP and UDP port 49010.\n" +
                    "3. Leave JEPPIRAN on port 49010 unless you also change the bridge port.\n" +
                    "4. Tap CONNECT. The bridge sends latitude, longitude, altitude and true heading from SimConnect to JEPPIRAN.\n\n" +
                    "Android device IP: " + localIpAddress()

            SimulatorLocationStore.TYPE_P3D ->
                "PREPAR3D v4 / v5 / v6\n\n" +
                    "1. Build/run simulator-bridge/p3d on the Prepar3D Windows PC.\n" +
                    "2. Start Prepar3D, then launch the bridge with this Android device IP and UDP port 49011.\n" +
                    "3. Leave JEPPIRAN on port 49011 unless you also change the bridge port.\n" +
                    "4. Tap CONNECT. The bridge relays aircraft position and true heading through Prepar3D SimConnect.\n\n" +
                    "Android device IP: " + localIpAddress()

            else ->
                "Select a supported simulator."
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
        setColor(if (isDarkTheme()) getColor(R.color.jeppiran_surface) else Color.WHITE)
        setStroke(1.dp, if (isDarkTheme()) getColor(R.color.jeppiran_card_stroke) else getColor(R.color.jeppiran_card_stroke))
    }

    private fun lp(height: Int, l: Int = 0, t: Int = 4, r: Int = 0, b: Int = 4) =
        LinearLayout.LayoutParams(-1, height.dp).apply { setMargins(l.dp, t.dp, r.dp, b.dp) }

    private fun backgroundColor() =
        if (isDarkTheme()) getColor(R.color.jeppiran_background) else getColor(R.color.jeppiran_background)

    private fun textColor() =
        if (isDarkTheme()) getColor(R.color.jeppiran_text) else getColor(R.color.jeppiran_text)

    private fun secondaryTextColor() =
        if (isDarkTheme()) getColor(R.color.jeppiran_text_secondary) else getColor(R.color.jeppiran_text_secondary)

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
