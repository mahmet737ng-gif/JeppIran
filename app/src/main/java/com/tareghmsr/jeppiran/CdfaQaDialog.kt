package com.tareghmsr.jeppiran

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AlertDialog
import org.json.JSONObject

/** Cycle 2621 CDFA engineering QA. Never used by PDF navigation or position logic. */
object CdfaQaDialog {
    private var records: Map<Int, JSONObject>? = null
    private var exclusions: Set<Int>? = null
    private val pendingReaudit = setOf(155, 705)

    private fun load(context: Context) {
        if (records != null && exclusions != null) return
        try {
            val raw = context.assets.open("cdfa-v2621-v17-qa.json").bufferedReader().use { it.readText() }
            val document = JSONObject(raw)
            require(document.optString("cycle") == "2621")
            val arr = document.getJSONArray("charts")
            val map = mutableMapOf<Int, JSONObject>()
            for (i in 0 until arr.length()) {
                val item = arr.getJSONObject(i)
                map[item.getInt("sourcePage")] = item
            }
            val exclusionRaw = context.assets.open("cdfa-exclusions-v2621.json").bufferedReader().use { it.readText() }
            val exclusionDoc = JSONObject(exclusionRaw)
            require(exclusionDoc.optString("cycle") == "2621")
            val excluded = mutableSetOf<Int>()
            val pages = exclusionDoc.getJSONArray("chart_pages_1_based")
            for (i in 0 until pages.length()) excluded.add(pages.getInt(i))
            records = map
            exclusions = excluded
        } catch (_: Exception) {
            records = emptyMap()
            exclusions = emptySet()
        }
    }

    private fun get(context: Context, page: Int, icao: String): JSONObject? {
        load(context)
        if (page <= 0 || pendingReaudit.contains(page) || exclusions?.contains(page) == true) return null
        val chart = records?.get(page) ?: return null
        if (chart.optString("icao") != icao || chart.optString("status").startsWith("WITHHELD")) return null
        if (chart.optJSONArray("table")?.length() ?: 0 == 0) return null
        return chart
    }

    fun available(context: Context, page: Int, icao: String): Boolean = get(context, page, icao) != null

    private fun dp(context: Context, x: Int): Int =
        (x * context.resources.displayMetrics.density + 0.5f).toInt()

    private fun view(context: Context, message: String, size: Float, color: Int, bold: Boolean = false): TextView =
        TextView(context).apply {
            text = message
            textSize = size
            setTextColor(color)
            if (bold) typeface = Typeface.DEFAULT_BOLD
            setPadding(dp(context, 8), dp(context, 7), dp(context, 8), dp(context, 7))
        }

    fun show(context: Context, page: Int, icao: String) {
        val chart = get(context, page, icao)
        if (chart == null) {
            AlertDialog.Builder(context).setTitle("CDFA")
                .setMessage("No released simulator QA CDFA data for this procedure.")
                .setPositiveButton("Close", null).show()
            return
        }
        val white = Color.rgb(230, 241, 250)
        val muted = Color.rgb(169, 193, 213)
        val red = Color.rgb(255, 178, 188)
        val bg = Color.rgb(18, 33, 48)
        val body = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(context, 12), dp(context, 10), dp(context, 12), dp(context, 15))
            setBackgroundColor(bg)
        }
        body.addView(view(context, "SIMULATOR / ENGINEERING QA ONLY — NOT FOR ACTUAL NAVIGATION", 13f, red, true))
        body.addView(view(context, chart.optString("icao") + " · " + chart.optString("title")
            + " · " + chart.optString("chartNumber"), 16f, white, true))
        val angle = if (chart.isNull("publishedAngleDeg")) "3.00° ASSUMED" else
            chart.optString("publishedAngleDeg") + "° published"
        val source = if (chart.optBoolean("usedAirportElevationFallback")) "airport elevation fallback" else "runway threshold input"
        body.addView(view(context, "PDF page " + page + "  •  DME " + chart.optString("referenceDmeId")
            + "  •  Angle " + angle + "\nTCH " + chart.optInt("tchFt") + " ft  •  " + source
            + "\nComputed MSL altitudes are not published Jeppesen clearances.", 12f, muted))
        val vdp = chart.optJSONObject("vdp")
        if (vdp?.optString("status") == "CALCULATED_MDA_INTERCEPT_QA_ONLY" &&
            !vdp.optString("dmeDisplay").isNullOrBlank()) {
            val mda = if (chart.isNull("mdaFt")) "unverified" else chart.optString("mdaFt") + " ft MSL"
            val pill = view(context, "VDP CALCULATED: " + vdp.optString("dmeDisplay")
                + "  •  MDA " + mda + "  •  NOT PUBLISHED", 14f, red, true)
            pill.background = GradientDrawable().apply {
                setColor(Color.rgb(84, 43, 53))
                cornerRadius = dp(context, 8).toFloat()
            }
            body.addView(pill)
        }
        body.addView(view(context, "REFERENCE DME       COMPUTED MSL       PUBLISHED FIX", 11f, muted, true))
        val rows = chart.getJSONArray("table")
        for (i in 0 until rows.length()) {
            val row = rows.getJSONObject(i)
            val fixes = mutableListOf<String>()
            val published = row.optJSONArray("published")
            if (published != null) {
                for (j in 0 until published.length()) {
                    val item = published.getJSONObject(j)
                    fixes.add(item.optString("type").uppercase() + " " + item.optInt("altitudeFt") + "ft")
                }
            }
            val marker = row.optString("vdpMarker")
            val content = "D" + row.optString("dme").padEnd(6) + "  " +
                row.optString("altitudeFt").padEnd(7) + " ft   " +
                (if (fixes.isEmpty()) "—" else fixes.joinToString("; ")) +
                (if (marker.isNotEmpty()) " · VDP near " + marker else "")
            val line = view(context, content, 12f, if (marker.isNotEmpty()) red else white)
            line.setBackgroundColor(if (i % 2 == 0) Color.rgb(35, 58, 77) else bg)
            body.addView(line)
        }
        body.addView(view(context,
            "All entries are geometric MODEL ONLY until verified. Values beyond published angle segments " +
                "are extrapolations; mandatory altitudes and DME fixes must retain their original chart values.",
            12f, muted))
        val scroll = ScrollView(context).apply {
            addView(body, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT))
        }
        AlertDialog.Builder(context).setTitle("CDFA · V2621 QA")
            .setView(scroll).setPositiveButton("Close", null).show()
    }
}
