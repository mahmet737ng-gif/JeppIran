package com.tareghmsr.jeppiran

import android.content.Context
import java.util.Locale

object FlightPlanStore {
    private const val PREFS = "jeppiran_flight_plan"

    data class Plan(
        val origin: String,
        val destination: String,
        val alternate: String
    )

    fun load(context: Context): Plan {
        val p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        return Plan(
            p.getString("origin", "").orEmpty(),
            p.getString("destination", "").orEmpty(),
            p.getString("alternate", "").orEmpty()
        )
    }

    fun save(context: Context, origin: String, destination: String, alternate: String) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString("origin", normalize(origin))
            .putString("destination", normalize(destination))
            .putString("alternate", normalize(alternate))
            .apply()
    }

    private fun normalize(value: String): String =
        value.trim().uppercase(Locale.US)
}
