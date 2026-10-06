package com.tareghmsr.jeppiran

import android.content.Context
import org.json.JSONArray

object HotspotStore {
    data class Hotspot(
        val icao: String,
        val page: Int,
        val chartName: String,
        val label: String,
        val snippet: String,
        val latitude: Double?,
        val longitude: Double?
    )

    fun forAirport(context: Context, icao: String): List<Hotspot> {
        val raw = runCatching {
            context.assets.open("airport-hotspots.json")
                .bufferedReader().use { it.readText() }
        }.getOrNull() ?: return emptyList()

        val array = runCatching { JSONArray(raw) }.getOrNull() ?: return emptyList()
        val result = mutableListOf<Hotspot>()
        for (i in 0 until array.length()) {
            val obj = array.optJSONObject(i) ?: continue
            if (!obj.optString("airport").equals(icao, true)) continue
            result += Hotspot(
                icao = obj.optString("airport"),
                page = obj.optInt("page"),
                chartName = obj.optString("chart_name"),
                label = obj.optString("label"),
                snippet = obj.optString("snippet"),
                latitude = obj.optDouble("lat", Double.NaN).takeIf { it.isFinite() },
                longitude = obj.optDouble("lon", Double.NaN).takeIf { it.isFinite() }
            )
        }
        return result
    }
}
