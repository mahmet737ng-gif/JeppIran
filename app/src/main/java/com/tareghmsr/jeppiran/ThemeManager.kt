package com.tareghmsr.jeppiran

import android.content.Context
import androidx.appcompat.app.AppCompatDelegate

object ThemeManager {

    private const val PREFS = "jeppiran_preferences"
    private const val KEY_THEME = "theme_mode"
    private const val KEY_AIRCRAFT_POSITION = "aircraft_position_enabled"

    const val SYSTEM = "system"
    const val LIGHT = "light"
    const val DARK = "dark"

    fun apply(context: Context) {
        val mode = context
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_THEME, SYSTEM)

        AppCompatDelegate.setDefaultNightMode(
            when (mode) {
                LIGHT -> AppCompatDelegate.MODE_NIGHT_NO
                DARK -> AppCompatDelegate.MODE_NIGHT_YES
                else -> AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM
            }
        )
    }

    fun setTheme(context: Context, mode: String) {
        context
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_THEME, mode)
            .apply()

        AppCompatDelegate.setDefaultNightMode(
            when (mode) {
                LIGHT -> AppCompatDelegate.MODE_NIGHT_NO
                DARK -> AppCompatDelegate.MODE_NIGHT_YES
                else -> AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM
            }
        )
    }

    fun getTheme(context: Context): String {
        return context
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_THEME, SYSTEM)
            ?: SYSTEM
    }

    fun isAircraftPositionEnabled(context: Context): Boolean {
        return context
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getBoolean(KEY_AIRCRAFT_POSITION, true)
    }

    fun setAircraftPositionEnabled(
        context: Context,
        enabled: Boolean
    ) {
        context
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_AIRCRAFT_POSITION, enabled)
            .apply()
    }
}
