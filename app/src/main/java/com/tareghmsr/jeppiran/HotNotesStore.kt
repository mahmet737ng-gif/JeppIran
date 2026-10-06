package com.tareghmsr.jeppiran

import android.content.Context

object HotNotesStore {
    private const val PREFS = "jeppiran_hot_notes"

    fun airportNote(context: Context, icao: String): String =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString("airport_" + icao.uppercase(), "").orEmpty()

    fun setAirportNote(context: Context, icao: String, note: String) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putString("airport_" + icao.uppercase(), note.trim()).apply()
    }

    fun chartNote(context: Context, page: Int): String =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString("chart_" + page, "").orEmpty()

    fun setChartNote(context: Context, page: Int, note: String) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putString("chart_" + page, note.trim()).apply()
    }
}
