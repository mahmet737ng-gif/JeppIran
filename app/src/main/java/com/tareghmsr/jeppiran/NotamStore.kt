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
    private const val BASE = "https://notams.aim.faa.gov/notamSearch/search"

    // FAA NOTAM Search is a public search surface and does not require the old
    // ICAO Data Service key used by earlier JEPPIRAN builds.
    fun configured(context: Context): Boolean = true

    fun cached(context: Context, icao: String): Snapshot? {
        val key = icao.trim().uppercase(Locale.US)
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val raw = prefs.getString(key + "_raw", "").orEmpty()
        val time = prefs.getLong(key + "_time", 0L)
        if (raw.isBlank()) return null
        return Snapshot(key, parse(raw), time, "FAA NOTAM Search cache")
    }

    fun fetch(context: Context, icao: String): Snapshot {
        val key = icao.trim().uppercase(Locale.US)
        require(Regex("^[A-Z0-9]{4}$").matches(key)) {
            "Invalid ICAO location designator."
        }

        val body = formEncode(
            linkedMapOf(
                "searchType" to "0",
                "designatorsForLocation" to key,
                "offset" to "0",
                "notamsOnly" to "false"
            )
        )

        val connection = (URL(BASE).openConnection() as HttpURLConnection)
        val raw = try {
            connection.connectTimeout = 12000
            connection.readTimeout = 20000
            connection.requestMethod = "POST"
            connection.doOutput = true
            connection.setRequestProperty(
                "Content-Type",
                "application/x-www-form-urlencoded; charset=UTF-8"
            )
            connection.setRequestProperty(
                "Accept",
                "application/json, text/plain, */*"
            )
            connection.setRequestProperty("User-Agent", "JEPPIRAN/1.0 Taregh Msr")
            connection.outputStream.bufferedWriter(Charsets.UTF_8).use { it.write(body) }

            val code = connection.responseCode
            val response = (
                if (code in 200..299) connection.inputStream else connection.errorStream
                )?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()

            if (code !in 200..299) {
                throw IllegalStateException("FAA NOTAM Search returned HTTP " + code)
            }
            if (response.isBlank()) {
                throw IllegalStateException("FAA NOTAM Search returned an empty response.")
            }
            response
        } finally {
            connection.disconnect()
        }

        val now = System.currentTimeMillis()
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(key + "_raw", raw)
            .putLong(key + "_time", now)
            .apply()

        return Snapshot(key, parse(raw), now, "FAA NOTAM Search")
    }

    private fun formEncode(values: Map<String, String>): String =
        values.entries.joinToString("&") {
            URLEncoder.encode(it.key, "UTF-8") + "=" +
                URLEncoder.encode(it.value, "UTF-8")
        }

    private fun parse(raw: String): List<Notam> {
        val trimmed = raw.trim()
        if (trimmed.isBlank()) return emptyList()

        val array = when {
            trimmed.startsWith("[") -> JSONArray(trimmed)
            trimmed.startsWith("{") -> {
                val root = JSONObject(trimmed)
                root.optJSONArray("notamList")
                    ?: root.optJSONArray("data")
                    ?: root.optJSONArray("results")
                    ?: root.optJSONArray("notams")
                    ?: JSONArray()
            }
            else -> return emptyList()
        }

        val result = mutableListOf<Notam>()
        val seen = mutableSetOf<String>()

        for (i in 0 until array.length()) {
            val obj = array.optJSONObject(i) ?: continue
            val rawMessage = firstNonBlank(
                obj,
                "icaoMessage", "traditionalMessage", "notamText",
                "text", "message", "all", "raw"
            )
            val text = extractOperationalText(rawMessage)
            if (text.isBlank()) continue

            val id = firstNonBlank(
                obj,
                "notamNumber", "id", "notamId", "number", "Number"
            ).ifBlank { extractNotamId(rawMessage) }

            val begin = firstNonBlank(
                obj,
                "startDate", "startdate", "StartDate", "begin", "BeginDate", "validFrom"
            )
            val end = firstNonBlank(
                obj,
                "endDate", "enddate", "EndDate", "end", "validTo"
            )

            val signature = id + "|" + text
            if (!seen.add(signature)) continue

            result += Notam(
                id = id,
                category = categorize(text, obj),
                text = text.trim(),
                begin = begin,
                end = end
            )
        }

        return result.sortedWith(
            compareBy<Notam> { categoryOrder(it.category) }
                .thenBy { it.id }
        )
    }

    private fun extractOperationalText(raw: String): String {
        val value = raw.trim()
        if (value.isBlank()) return ""
        val e = Regex("""(?:^|\s)E\)\s*""").find(value) ?: return value
        val after = value.substring(e.range.last + 1)
        val stop = Regex("""\s[FG]\)\s*""").find(after)
        return if (stop == null) after.trim() else after.substring(0, stop.range.first).trim()
    }

    private fun extractNotamId(raw: String): String =
        Regex("""\b[A-Z]\d{4}/\d{2}\b""")
            .find(raw.uppercase(Locale.US))
            ?.value
            .orEmpty()

    private fun firstNonBlank(obj: JSONObject, vararg keys: String): String {
        for (key in keys) {
            val value = obj.optString(key, "").trim()
            if (value.isNotBlank() && !value.equals("null", true)) return value
        }
        return ""
    }

    private fun categorize(text: String, obj: JSONObject? = null): String {
        val t = buildString {
            append(text.uppercase(Locale.US))
            obj?.let {
                append(' ')
                append(it.optString("keyword", "").uppercase(Locale.US))
                append(' ')
                append(it.optString("featureName", "").uppercase(Locale.US))
            }
        }

        return when {
            listOf("RWY", "RUNWAY", "RVR").any(t::contains) ->
                "RUNWAY"
            listOf("TWY", "TAXIWAY", "APRON", "RAMP", "STAND", "GATE").any(t::contains) ->
                "TAXIWAY / APRON"
            listOf("ILS", "LOC", "GLIDE", "GP ", "VOR", "NDB", "DME", "NAVAID", "RNAV").any(t::contains) ->
                "APPROACH / NAVAID"
            listOf("LIGHT", "PAPI", "VASI", "ALS", "HIRL", "MIRL", "REIL").any(t::contains) ->
                "LIGHTING"
            listOf("FREQ", "COM", "ATIS", "TWR", "GND", "APP", "DEP", "RADIO").any(t::contains) ->
                "COMMUNICATIONS"
            listOf("OBST", "CRANE", "TOWER", "MAST").any(t::contains) ->
                "OBSTACLES"
            listOf("AIRSPACE", "FIR", "RESTRICTED", "DANGER", "PROHIBITED", "TFR").any(t::contains) ->
                "AIRSPACE"
            listOf("AD CLSD", "AERODROME", "AIRPORT", "AD ").any(t::contains) ->
                "AERODROME"
            else -> "OTHER"
        }
    }

    private fun categoryOrder(category: String): Int = when (category) {
        "RUNWAY" -> 0
        "TAXIWAY / APRON" -> 1
        "APPROACH / NAVAID" -> 2
        "LIGHTING" -> 3
        "COMMUNICATIONS" -> 4
        "OBSTACLES" -> 5
        "AIRSPACE" -> 6
        "AERODROME" -> 7
        else -> 8
    }

    fun relevantToApproach(items: List<Notam>, approachName: String): List<Notam> {
        val upper = approachName.uppercase(Locale.US)
        val runway = Regex("""RWY\s+(\d{2}[LRC]?)""").find(upper)?.groupValues?.get(1)
        val type = when {
            "ILS" in upper || "LOC" in upper -> listOf("ILS", "LOC", "GLIDE", "GP ")
            "VOR" in upper -> listOf("VOR")
            "NDB" in upper -> listOf("NDB")
            "RNAV" in upper || "RNP" in upper -> listOf("RNAV", "RNP")
            else -> emptyList()
        }
        return items.filter { item ->
            val t = item.text.uppercase(Locale.US)
            (runway != null && (t.contains("RWY " + runway) || t.contains(runway))) ||
                type.any(t::contains)
        }
    }
}
