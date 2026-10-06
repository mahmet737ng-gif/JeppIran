package com.tareghmsr.jeppiran

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.Locale

object NotamStore {

    data class Notam(
        val id: String,
        val category: String,
        val text: String,
        val begin: String,
        val end: String
    )

    data class Snapshot(
        val icao: String,
        val items: List<Notam>,
        val fetchedAt: Long,
        val source: String
    )

    private const val PREFS = "jeppiran_notam_cache"
    private const val BASE =
        "https://applications.icao.int/dataservices/api/notams-realtime-list"

    fun configured(context: Context): Boolean =
        PilotPreferences.notamApiKey(context).isNotBlank()

    fun cached(context: Context, icao: String): Snapshot? {
        val key = icao.trim().uppercase(Locale.US)
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val raw = prefs.getString(key + "_raw", "").orEmpty()
        val time = prefs.getLong(key + "_time", 0L)
        if (raw.isBlank()) return null
        return Snapshot(key, parse(raw), time, "ICAO API cache")
    }

    fun fetch(context: Context, icao: String): Snapshot {
        val apiKey = PilotPreferences.notamApiKey(context)
        require(apiKey.isNotBlank()) { "ICAO NOTAM API key is not configured." }

        val key = icao.trim().uppercase(Locale.US)
        val query =
            "?api_key=" + URLEncoder.encode(apiKey, "UTF-8") +
                "&format=json&criticality=true&locations=" +
                URLEncoder.encode(key, "UTF-8")
        val connection = (URL(BASE + query).openConnection() as HttpURLConnection)
        val raw = try {
            connection.connectTimeout = 10000
            connection.readTimeout = 12000
            connection.requestMethod = "GET"
            connection.setRequestProperty("User-Agent", "JEPPIRAN/1.0 Taregh Msr")
            val code = connection.responseCode
            val body = (if (code in 200..299) connection.inputStream else connection.errorStream)
                ?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (code !in 200..299) {
                throw IllegalStateException("ICAO NOTAM service returned HTTP " + code)
            }
            if (body.contains("limit", ignoreCase = true) &&
                body.contains("call", ignoreCase = true)) {
                throw IllegalStateException("ICAO NOTAM API call limit reached.")
            }
            body
        } finally {
            connection.disconnect()
        }

        val now = System.currentTimeMillis()
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(key + "_raw", raw)
            .putLong(key + "_time", now)
            .apply()
        return Snapshot(key, parse(raw), now, "ICAO Realtime NOTAMs")
    }

    private fun parse(raw: String): List<Notam> {
        val trimmed = raw.trim()
        if (trimmed.isBlank()) return emptyList()
        val array = when {
            trimmed.startsWith("[") -> JSONArray(trimmed)
            trimmed.startsWith("{") -> {
                val root = JSONObject(trimmed)
                root.optJSONArray("data")
                    ?: root.optJSONArray("results")
                    ?: root.optJSONArray("notams")
                    ?: JSONArray().apply { put(root) }
            }
            else -> return emptyList()
        }

        val result = mutableListOf<Notam>()
        for (i in 0 until array.length()) {
            val obj = array.optJSONObject(i) ?: continue
            val text = firstNonBlank(
                obj,
                "all", "text", "Text", "NOTAM", "message", "ItemE", "E",
                "notamText", "NotamText", "raw"
            )
            if (text.isBlank()) continue
            val id = firstNonBlank(obj, "id", "ID", "notamId", "Number", "number")
            val begin = firstNonBlank(obj, "startdate", "StartDate", "begin", "BeginDate", "validFrom")
            val end = firstNonBlank(obj, "enddate", "EndDate", "end", "EndDate", "validTo")
            result += Notam(
                id = id,
                category = categorize(text),
                text = text.trim(),
                begin = begin,
                end = end
            )
        }
        return result
    }

    private fun firstNonBlank(obj: JSONObject, vararg keys: String): String {
        for (key in keys) {
            val value = obj.optString(key, "").trim()
            if (value.isNotBlank() && !value.equals("null", true)) return value
        }
        return ""
    }

    private fun categorize(text: String): String {
        val t = text.uppercase(Locale.US)
        return when {
            listOf("RWY", "RUNWAY", "RVR").any(t::contains) -> "RUNWAY"
            listOf("TWY", "TAXIWAY", "APRON", "STAND").any(t::contains) -> "TAXI / APRON"
            listOf("ILS", "LOC", "GLIDE", "GP ", "VOR", "NDB", "DME").any(t::contains) -> "APPROACH / NAVAID"
            listOf("LIGHT", "PAPI", "ALS", "HIRL", "MIRL").any(t::contains) -> "LIGHTING"
            listOf("AIRSPACE", "FIR", "RESTRICTED", "DANGER", "PROHIBITED").any(t::contains) -> "AIRSPACE"
            else -> "OTHER"
        }
    }

    fun relevantToApproach(items: List<Notam>, approachName: String): List<Notam> {
        val upper = approachName.uppercase(Locale.US)
        val runway = Regex("""RWY\s+(\d{2}[LRC]?)""").find(upper)?.groupValues?.get(1)
        val type = when {
            "ILS" in upper || "LOC" in upper -> listOf("ILS", "LOC", "GLIDE", "GP ")
            "VOR" in upper -> listOf("VOR")
            "NDB" in upper -> listOf("NDB")
            else -> emptyList()
        }
        return items.filter { item ->
            val t = item.text.uppercase(Locale.US)
            (runway != null && (t.contains("RWY " + runway) || t.contains(runway))) ||
                type.any(t::contains)
        }
    }
}
