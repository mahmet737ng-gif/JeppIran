package com.tareghmsr.jeppiran

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale

object PilotIntelligenceStore {
    private const val PREFS = "jeppiran_pilot_intelligence"
    private const val NOTES = "airport_notes"
    private const val PACKS = "flight_packs"

    data class AirportNote(val icao: String, val text: String, val updatedAt: Long)
    data class FlightPack(val origin: String, val destination: String, val alternate: String, val savedAt: Long)

    fun saveNote(context: Context, icao: String, text: String) {
        val prefs=context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val root=runCatching{JSONObject(prefs.getString(NOTES,"{}") ?: "{}")}.getOrElse{JSONObject()}
        val key=icao.trim().uppercase(Locale.US)
        if(text.isBlank()) root.remove(key) else root.put(key, JSONObject().put("text",text.trim()).put("time",System.currentTimeMillis()))
        prefs.edit().putString(NOTES,root.toString()).apply()
    }

    fun note(context: Context, icao: String): AirportNote? {
        val root=runCatching{JSONObject(context.getSharedPreferences(PREFS,Context.MODE_PRIVATE).getString(NOTES,"{}") ?: "{}")}.getOrNull() ?: return null
        val key=icao.trim().uppercase(Locale.US)
        val obj=root.optJSONObject(key) ?: return null
        val text=obj.optString("text").trim()
        if(text.isBlank()) return null
        return AirportNote(key,text,obj.optLong("time"))
    }

    fun savePack(context: Context, origin: String, destination: String, alternate: String) {
        val arr=runCatching{JSONArray(context.getSharedPreferences(PREFS,Context.MODE_PRIVATE).getString(PACKS,"[]") ?: "[]")}.getOrElse{JSONArray()}
        arr.put(JSONObject().put("origin",origin.uppercase()).put("destination",destination.uppercase()).put("alternate",alternate.uppercase()).put("time",System.currentTimeMillis()))
        context.getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit().putString(PACKS,arr.toString()).apply()
    }

    fun flightPhase(groundSpeedKt: Float?, altitudeM: Double?): String = when {
        groundSpeedKt == null -> "MANUAL"
        groundSpeedKt < 35f -> "GROUND / TAXI"
        altitudeM != null && altitudeM < 900.0 && groundSpeedKt > 70f -> "DEPARTURE / ARRIVAL"
        altitudeM != null && altitudeM > 6000.0 -> "ENROUTE"
        else -> "TERMINAL"
    }

    fun weatherTrend(current: FlightDataStore.WeatherSnapshot?): String {
        if(current == null) return "No weather history cached yet."
        val ceiling=FlightDataStore.ceilingFeet(current.metar)
        val visibility=FlightDataStore.visibilityMeters(current.metar)
        return "LATEST  •  VIS " + (visibility?.let{ if(it>=10000) "10KM+" else it.toString()+"M" } ?: "—") +
            "  •  CEILING " + (ceiling?.let{it.toString()+"FT"} ?: "—") +
            "\nTrend history will grow as scheduled METAR refreshes are cached."
    }

    fun runwayConditionSummary(notams: List<NotamStore.Notam>): String {
        val hits=notams.filter {
            val t=it.text.uppercase(Locale.US)
            listOf("RWYCC","BRAKING","SNOWTAM","CONTAMIN","WET RWY","RWY CLSD","RUNWAY CLOSED").any(t::contains)
        }
        return if(hits.isEmpty()) "No runway-condition NOTAM keywords in current cache."
        else hits.take(5).joinToString("\n\n"){"• "+it.text}
    }

    fun pirepSummary(): String =
        "PIREP / AIREP panel ready for a verified regional feed. No unverified turbulence or icing data is fabricated."

    fun hotspotSummary(icao: String): String =
        "Hotspot overlay framework active for $icao. Alerts are shown only when an authoritative hotspot dataset is available."

    fun compatibility(
        weather: FlightDataStore.WeatherSnapshot?,
        brief: ApproachBriefStore.Brief?,
        relevant: List<NotamStore.Notam>
    ): String = buildString {
        append("SOURCE CROSS-CHECK")
        if(weather != null) {
            append("\nWX: VIS ").append(FlightDataStore.visibilityMeters(weather.metar)?.toString() ?: "—")
            append(" m • CEILING ").append(FlightDataStore.ceilingFeet(weather.metar)?.toString() ?: "—").append(" ft")
        }
        if(brief != null) {
            if(brief.course.isNotBlank()) append("\nCOURSE: ").append(brief.course)
            if(brief.minimums.isNotBlank()) append("\nPRINTED MINIMA: ").append(brief.minimums.take(180))
        }
        append("\nRELATED NOTAMS: ").append(relevant.size)
        append("\nAdvisory cross-check only — chart and approved operational sources remain controlling.")
    }
}
