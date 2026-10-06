package com.tareghmsr.jeppiran

import android.content.Context

object ExperimentalFeatureStore {
    private const val PREFS = "jeppiran_efb_lab_flags"

    data class Feature(
        val key: String,
        val title: String,
        val description: String
    )

    val features = listOf(
        Feature("runway_condition", "Runway Condition Assistant", "Runway condition / braking / closure intelligence from current NOTAM text."),
        Feature("hotspot_watch", "Airport Hotspot Watch", "Hotspot and runway-crossing awareness sourced from chart text when available."),
        Feature("auto_phase", "Automatic Flight-Phase Mode", "Uses aircraft position, speed and destination distance to suggest the next chart group."),
        Feature("weather_trend", "Weather Trend Timeline", "Shows recent METAR trend for wind, visibility and ceiling."),
        Feature("pirep", "Nearby PIREP / AIREP", "Shows nearby pilot/aircraft weather reports when the public feed has coverage."),
        Feature("alternate", "Smart Alternate Assistant", "Compares nearby JEPPIRAN airports by distance, weather, approaches and NOTAM load."),
        Feature("approach_check", "Approach Compatibility Checker", "Cross-checks selected approach with current weather and related NOTAMs."),
        Feature("hot_notes", "Airport / Procedure Hot Notes", "Persistent personal notes attached to airports and individual procedures."),
        Feature("semantic_changes", "Chart Change Intelligence", "Summarizes cycle changes and routes revised charts to visual diff."),
        Feature("flight_pack", "One-Tap Flight Pack", "Prefetches origin, destination and alternate charts/weather/NOTAM cache for offline use.")
    )

    fun isEnabled(context: Context, key: String): Boolean =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getBoolean(key, true)

    fun setEnabled(context: Context, key: String, value: Boolean) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putBoolean(key, value).apply()
    }

    fun resetAll(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply()
    }
}
