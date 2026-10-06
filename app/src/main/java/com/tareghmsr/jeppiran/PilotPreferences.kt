package com.tareghmsr.jeppiran

import android.content.Context

object PilotPreferences {
    private const val PREFS = "jeppiran_pilot_tools"
    private const val KEY_NOTAM_API = "icao_notam_api_key"
    private const val KEY_MAX_XWIND = "max_crosswind_kt"
    private const val KEY_MAX_TAILWIND = "max_tailwind_kt"

    fun notamApiKey(context: Context): String =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_NOTAM_API, "").orEmpty().trim()

    fun setNotamApiKey(context: Context, value: String) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putString(KEY_NOTAM_API, value.trim()).apply()
    }

    fun maxCrosswindKt(context: Context): Int =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getInt(KEY_MAX_XWIND, 0)

    fun setMaxCrosswindKt(context: Context, value: Int) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putInt(KEY_MAX_XWIND, value.coerceAtLeast(0)).apply()
    }

    fun maxTailwindKt(context: Context): Int =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getInt(KEY_MAX_TAILWIND, 0)

    fun setMaxTailwindKt(context: Context, value: Int) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putInt(KEY_MAX_TAILWIND, value.coerceAtLeast(0)).apply()
    }
}
