package com.tareghmsr.jeppiran

import android.content.Context

object AircraftPositionStore {
    private const val PREFS = "aircraft_position"
    private const val ENABLED = "enabled"
    private const val SOURCE = "source"

    enum class Source { AUTO, SIMULATOR, DEVICE }

    fun source(context: Context): Source {
        val saved = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(SOURCE, Source.AUTO.name)
        return Source.values().firstOrNull { it.name == saved } ?: Source.AUTO
    }

    fun setSource(context: Context, source: Source) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putString(SOURCE, source.name).apply()
    }

    fun usesSimulator(context: Context): Boolean = when (source(context)) {
        Source.SIMULATOR -> true
        Source.DEVICE -> false
        Source.AUTO -> SimulatorLocationStore.isConnected()
    }

    fun isEnabled(context: Context): Boolean =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getBoolean(ENABLED, true)

    fun setEnabled(context: Context, enabled: Boolean) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(ENABLED, enabled)
            .apply()
    }
}
