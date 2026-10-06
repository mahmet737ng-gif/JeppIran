package com.tareghmsr.jeppiran

import android.content.Context
import org.json.JSONArray

object ApproachBriefStore {

    data class Brief(
        val page: Int,
        val icao: String,
        val chartNumber: String,
        val name: String,
        val frequencies: List<String>,
        val course: String,
        val minimums: String,
        val missedApproach: String
    )

    @Volatile
    private var cache: List<Brief>? = null

    fun forAirport(context: Context, icao: String): List<Brief> {
        return all(context).filter { it.icao.equals(icao, true) }
    }

    fun forPage(context: Context, page: Int): Brief? =
        all(context).firstOrNull { it.page == page }

    private fun all(context: Context): List<Brief> {
        cache?.let { return it }
        val parsed = runCatching {
            val raw = context.assets.open("approach-briefings.json")
                .bufferedReader().use { it.readText() }
            val array = JSONArray(raw)
            buildList {
                for (i in 0 until array.length()) {
                    val obj = array.getJSONObject(i)
                    val freq = obj.optJSONArray("frequencies")
                    val frequencies = buildList {
                        if (freq != null) {
                            for (j in 0 until freq.length()) {
                                val item = freq.optString(j)
                                if (item.isNotBlank()) add(item)
                            }
                        }
                    }
                    add(
                        Brief(
                            page = obj.optInt("page"),
                            icao = obj.optString("airport"),
                            chartNumber = obj.optString("chart_number"),
                            name = obj.optString("name"),
                            frequencies = frequencies,
                            course = obj.optString("course"),
                            minimums = obj.optString("minimums"),
                            missedApproach = obj.optString("missed_approach")
                        )
                    )
                }
            }
        }.getOrElse { emptyList() }
        cache = parsed
        return parsed
    }
}
