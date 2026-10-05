package com.tareghmsr.jeppiran

import android.graphics.Color
import android.graphics.Typeface
import android.os.Bundle
import android.view.Gravity
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class SimulatorConnectionActivity : AppCompatActivity() {
    private lateinit var simulatorValue: TextView
    private lateinit var statusValue: TextView
    private lateinit var hostInput: EditText
    private lateinit var portInput: EditText

    private var selectedSimulator = SimulatorManager.simulator(this)

    override fun onCreate(savedInstanceState: Bundle?) {
        ThemeManager.apply(this)
        super.onCreate(savedInstanceState)
        buildUi()
    }

    override fun onDestroy() {
        SimulatorManager.stop()
        super.onDestroy()
    }

    private fun buildUi() {
        val scroll = ScrollView(this)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(20.dp, 20.dp, 20.dp, 28.dp)
            setBackgroundColor(backgroundColor())
        }
        scroll.addView(root)

        root.addView(text("CONNECT TO SIMULATOR", 24f, true, textColor(), 0, 0, 0, 18))
        root.addView(text("Choose your simulator. JeppIran receives the aircraft position from the simulator instead of the phone GPS.", 15f, false, secondaryTextColor(), 0, 0, 0, 18))

        root.addView(text("SIMULATOR", 12f, true, secondaryTextColor(), 0, 8, 0, 8))
        addSimulator(root, SimulatorManager.XPLANE, "X-Plane 11 / 12", "Direct network data from X-Plane.", "XPLANE")
        addSimulator(root, SimulatorManager.MSFS2020, "Microsoft Flight Simulator 2020", "Requires a small Windows bridge using SimConnect.", "MSFS2020")
        addSimulator(root, SimulatorManager.MSFS2024, "Microsoft Flight Simulator 2024", "Requires a small Windows bridge using SimConnect.", "MSFS2024")
        addSimulator(root, SimulatorManager.PREPAR3D, "Prepar3D", "Requires a small Windows bridge using SimConnect.", "P3D")

        root.addView(text("CONNECTION", 12f, true, secondaryTextColor(), 0, 18, 0, 8))
        hostInput = EditText(this).apply {
            hint = "PC IP address, e.g. 192.168.1.50"
            setSingleLine(true)
            setText(SimulatorManager.host(this@SimulatorConnectionActivity))
            setTextColor(textColor())
            setHintTextColor(secondaryTextColor())
        }
        root.addView(hostInput, fieldParams())

        portInput = EditText(this).apply {
            hint = "UDP port"
            inputType = android.text.InputType.TYPE_CLASS_NUMBER
            setSingleLine(true)
            setText(SimulatorManager.port(this@SimulatorConnectionActivity).toString())
            setTextColor(textColor())
            setHintTextColor(secondaryTextColor())
        }
        root.addView(portInput, fieldParams())

        val save = button("SAVE & CONNECT")
        save.setOnClickListener { saveAndConnect() }
        root.addView(save)

        statusValue = text("● Disconnected", 15f, true, Color.rgb(190, 80, 80), 0, 12, 0, 12)
        root.addView(statusValue)

        simulatorValue = text("", 14f, false, textColor(), 0, 0, 0, 10)
        root.addView(simulatorValue)

        root.addView(text("HOW IT WORKS", 12f, true, secondaryTextColor(), 0, 14, 0, 8))
        root.addView(text(
            "JeppIran listens on the UDP port above. The PC side sends a small JSON position packet over your local Wi-Fi. The phone and simulator PC must be on the same network.\n\n" +
            "X-Plane: enable the JeppIran X-Plane data output/bridge and enter this phone's IP and UDP port.\n\n" +
            "MSFS 2020 / 2024: SimConnect is available on the Windows simulator PC. The JeppIran bridge reads the aircraft state through SimConnect and forwards it to this app.\n\n" +
            "Prepar3D: use the same bridge concept through SimConnect.\n\n" +
            "The app accepts latitude, longitude, altitude, heading and ground speed. Once a valid chart georeference exists, the aircraft symbol can be placed on the chart. Simulator data takes priority over phone GPS while this connection is active.",
            14f, false, secondaryTextColor(), 0, 0, 0, 18
        ))

        root.addView(button("DISCONNECT").apply {
            setOnClickListener {
                SimulatorManager.stop()
                statusValue.text = "● Disconnected"
                statusValue.setTextColor(Color.rgb(190, 80, 80))
            }
        })

        setContentView(scroll)
        updateSelectedLabel()
    }

    private fun addSimulator(root: LinearLayout, id: String, title: String, subtitle: String, short: String) {
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(18.dp, 14.dp, 18.dp, 14.dp)
            setBackgroundColor(cardColor())
            setOnClickListener {
                selectedSimulator = id
                updateSelectedLabel()
            }
        }
        box.addView(text(title, 17f, true, textColor(), 0, 0, 0, 4))
        box.addView(text(subtitle, 13f, false, secondaryTextColor(), 0, 0, 0, 0))
        root.addView(box, LinearLayout.LayoutParams(-1, -2).apply { setMargins(0, 4.dp, 0, 4.dp) })
    }

    private fun updateSelectedLabel() {
        val label = when (selectedSimulator) {
            SimulatorManager.XPLANE -> "Selected: X-Plane 11 / 12"
            SimulatorManager.MSFS2020 -> "Selected: Microsoft Flight Simulator 2020"
            SimulatorManager.MSFS2024 -> "Selected: Microsoft Flight Simulator 2024"
            SimulatorManager.PREPAR3D -> "Selected: Prepar3D"
            else -> "No simulator selected"
        }
        simulatorValue.text = label
    }

    private fun saveAndConnect() {
        val host = hostInput.text.toString().trim()
        val port = portInput.text.toString().toIntOrNull() ?: 49731
        SimulatorManager.saveConfiguration(this, selectedSimulator, host, port)
        SimulatorManager.start(this, {}, { connected ->
            runOnUiThread {
                statusValue.text = if (connected) "● Connected" else "● Waiting for simulator data"
                statusValue.setTextColor(if (connected) Color.rgb(70, 170, 105) else Color.rgb(190, 150, 70))
            }
        })
    }

    private fun text(value: String, size: Float, bold: Boolean, color: Int, l: Int, t: Int, r: Int, b: Int) =
        TextView(this).apply {
            text = value
            textSize = size
            setTextColor(color)
            if (bold) typeface = Typeface.DEFAULT_BOLD
            setPadding(l.dp, t.dp, r.dp, b.dp)
        }

    private fun button(label: String) =
        TextView(this).apply {
            text = label
            textSize = 15f
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            setTextColor(textColor())
            setBackgroundColor(cardColor())
            setPadding(16.dp, 16.dp, 16.dp, 16.dp)
            layoutParams = LinearLayout.LayoutParams(-1, 54.dp).apply { setMargins(0, 6.dp, 0, 6.dp) }
        }

    private fun fieldParams() = LinearLayout.LayoutParams(-1, 58.dp).apply { setMargins(0, 4.dp, 0, 4.dp) }

    private fun backgroundColor() = if (isDarkTheme()) Color.rgb(14,22,30) else Color.rgb(244,247,250)
    private fun cardColor() = if (isDarkTheme()) Color.rgb(25,35,45) else Color.WHITE
    private fun textColor() = if (isDarkTheme()) Color.rgb(241,245,248) else Color.rgb(18,32,48)
    private fun secondaryTextColor() = if (isDarkTheme()) Color.rgb(158,174,187) else Color.rgb(91,107,122)
    private fun isDarkTheme() = (resources.configuration.uiMode and android.content.res.Configuration.UI_MODE_NIGHT_MASK) == android.content.res.Configuration.UI_MODE_NIGHT_YES
    private val Int.dp: Int get() = (this * resources.displayMetrics.density).toInt()
}
