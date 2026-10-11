package com.tareghmsr.jeppiran

import android.content.Context
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import org.json.JSONObject
import java.util.Locale

/**
 * CDFA_SIDE_TABLE_V1 — OWNER-LOCKED UI.
 * Fixed right-hand space, never drawn into ChartView or onto a source PDF.
 * Simulator engineering QA ONLY; numbers do not authorize navigation.
 */
object CdfaQaDialog {
    private var records: Map<Int, JSONObject>? = null
    private var exclusions: Set<Int>? = null
    private val pendingReaudit = setOf(155, 705)

    private fun load(context: Context) {
        if (records != null && exclusions != null) return
        try {
            val document = JSONObject(
                context.assets.open("cdfa-v2621-v17-qa.json").bufferedReader().use { it.readText() }
            )
            require(document.optString("cycle") == "2621")
            val arr = document.getJSONArray("charts")
            val map = mutableMapOf<Int, JSONObject>()
            for (i in 0 until arr.length()) {
                val item = arr.getJSONObject(i)
                map[item.getInt("sourcePage")] = item
            }
            val doc = JSONObject(
                context.assets.open("cdfa-exclusions-v2621.json").bufferedReader().use { it.readText() }
            )
            require(doc.optString("cycle") == "2621")
            val excluded = mutableSetOf<Int>()
            val pages = doc.getJSONArray("chart_pages_1_based")
            for (i in 0 until pages.length()) excluded.add(pages.getInt(i))
            records = map
            exclusions = excluded
        } catch (_: Exception) {
            records = emptyMap()
            exclusions = emptySet()
        }
    }

    private fun find(context: Context, page: Int, icao: String): JSONObject? {
        load(context)
        if (page <= 0 || page in pendingReaudit || exclusions?.contains(page) == true) return null
        val c = records?.get(page) ?: return null
        if (c.optString("icao") != icao || c.optString("status").startsWith("WITHHELD")) return null
        if ((c.optJSONArray("table")?.length() ?: 0) == 0) return null
        return c
    }

    fun available(context: Context, page: Int, icao: String): Boolean =
        find(context, page, icao) != null

    private data class CellRow(val dme: Double, val left: String, val right: String, val isVdp: Boolean = false)

    private fun calculatedRows(record: JSONObject): List<CellRow> {
        val result = mutableListOf<CellRow>()
        val arr = record.getJSONArray("table")
        for (i in 0 until arr.length()) {
            val row = arr.getJSONObject(i)
            val dme = row.optDouble("dme", Double.NaN)
            if (dme.isFinite()) {
                result.add(CellRow(dme, String.format(Locale.US, "%.1f", dme), row.optString("altitudeFt")))
            }
        }
        val vdp = record.optJSONObject("vdp")
        if (vdp != null && vdp.optString("status") == "CALCULATED_MDA_INTERCEPT_QA_ONLY"
            && !vdp.optBoolean("published")) {
            val dme = vdp.optDouble("dmeNm", Double.NaN)
            val label = vdp.optString("dmeDisplay").removePrefix("D")
            if (dme.isFinite() && dme >= 0 && label.isNotBlank()) {
                result.add(CellRow(dme, label, "VDP", true))
            }
        }
        return result.sortedWith(compareByDescending<CellRow> { it.dme }.thenByDescending { it.isVdp })
    }

    private fun dp(c: Context, n: Int): Int = (n * c.resources.displayMetrics.density + .5f).toInt()

    private fun label(context: Context, text: String, size: Float, fg: Int, bg: Int): TextView =
        TextView(context).apply {
            this.text = text
            textSize = size
            gravity = Gravity.CENTER
            setTextColor(fg)
            typeface = Typeface.create("sans-serif", Typeface.BOLD)
            setPadding(dp(context, 2), dp(context, 7), dp(context, 2), dp(context, 7))
            background = GradientDrawable().apply {
                setColor(bg)
                setStroke(dp(context, 1), fg)
            }
        }

    fun createPanel(context: Context, page: Int, icao: String): ScrollView? {
        val record = find(context, page, icao) ?: return null
        val dark = context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK ==
            Configuration.UI_MODE_NIGHT_YES
        val bg = if (dark) Color.BLACK else Color.WHITE
        val fg = if (dark) Color.WHITE else Color.BLACK
        val body = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(context, 5), dp(context, 12), dp(context, 5), dp(context, 12))
            setBackgroundColor(bg)
        }
        body.addView(label(context, "CDFA DATA", 19f, fg, bg),
            LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))

        fun addTwoColumns(left: String, right: String, fontSize: Float) {
            val line = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL }
            line.addView(label(context, left, fontSize, fg, bg),
                LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
            line.addView(label(context, right, fontSize, fg, bg),
                LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1.15f))
            body.addView(line, LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        }
        addTwoColumns("DME", "ALT (ft)", 14.5f)
        for (row in calculatedRows(record)) {
            // A computed VDP displays as "2.6 | VDP", never as a numeric altitude.
            addTwoColumns(row.left, row.right, 17.5f)
        }
        val notice = TextView(context).apply {
            text = "SIMULATOR QA ONLY\nNOT FOR ACTUAL NAVIGATION"
            textSize = 10f
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            setTextColor(fg)
            setPadding(dp(context, 2), dp(context, 10), dp(context, 2), dp(context, 4))
        }
        body.addView(notice)
        return ScrollView(context).apply {
            setBackgroundColor(bg)
            isFillViewport = false
            isVerticalScrollBarEnabled = true
            addView(body, ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        }
    }
}
