package com.tareghmsr.jeppiran

import android.content.Context
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.Locale
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.sin

object FlightDataStore {

    data class WeatherSnapshot(
        val icao: String,
        val metar: String,
        val taf: String,
        val fetchedAt: Long
    )

    data class Wind(
        val direction: Int?,
        val speedKt: Int,
        val gustKt: Int?
    )

    data class RunwayWind(
        val runway: String,
        val heading: Int,
        val headwindKt: Int,
        val crosswindKt: Int,
        val gustHeadwindKt: Int?,
        val gustCrosswindKt: Int?
    )

    private const val PREFS = "jeppiran_weather_cache"
    private const val USER_AGENT = "JEPPIRAN/1.0 Taregh Msr"

    fun cached(context: Context, icao: String): WeatherSnapshot? {
        val key = icao.trim().uppercase(Locale.US)
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val metar = prefs.getString(key + "_metar", "").orEmpty()
        val taf = prefs.getString(key + "_taf", "").orEmpty()
        val time = prefs.getLong(key + "_time", 0L)
        if (metar.isBlank() && taf.isBlank()) return null
        return WeatherSnapshot(key, metar, taf, time)
    }

    fun fetch(context: Context, icao: String): WeatherSnapshot {
        val key = icao.trim().uppercase(Locale.US)
        val metar = fetchRaw("metar", key)
        val taf = fetchRaw("taf", key)
        val snapshot = WeatherSnapshot(key, metar, taf, System.currentTimeMillis())
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(key + "_metar", metar)
            .putString(key + "_taf", taf)
            .putLong(key + "_time", snapshot.fetchedAt)
            .apply()
        return snapshot
    }

    private fun fetchRaw(product: String, icao: String): String {
        val id = URLEncoder.encode(icao, "UTF-8")
        val url = URL("https://aviationweather.gov/api/data/$product?ids=$id&format=raw")
        val connection = (url.openConnection() as HttpURLConnection)
        return try {
            connection.connectTimeout = 9000
            connection.readTimeout = 9000
            connection.requestMethod = "GET"
            connection.setRequestProperty("User-Agent", USER_AGENT)
            val code = connection.responseCode
            if (code == 204) return ""
            if (code !in 200..299) {
                throw IllegalStateException("Weather service returned HTTP $code")
            }
            connection.inputStream.bufferedReader().use { it.readText().trim() }
        } finally {
            connection.disconnect()
        }
    }

    fun parseWind(metar: String): Wind? {
        val match = Regex("""\b(VRB|\d{3})(\d{2,3})(?:G(\d{2,3}))?KT\b""")
            .find(metar.uppercase(Locale.US)) ?: return null
        return Wind(
            direction = match.groupValues[1].toIntOrNull(),
            speedKt = match.groupValues[2].toInt(),
            gustKt = match.groupValues[3].toIntOrNull()
        )
    }

    fun visibilityMeters(metar: String): Int? {
        val upper = metar.uppercase(Locale.US)
        if (Regex("""\b9999\b""").containsMatchIn(upper)) return 10000
        Regex("""\b(\d{4})\b""").findAll(upper).forEach {
            val value = it.groupValues[1].toIntOrNull() ?: return@forEach
            if (value in 50..9998) return value
        }
        val sm = Regex("""\b(\d+(?:\.\d+)?)SM\b""").find(upper)?.groupValues?.get(1)?.toDoubleOrNull()
        return sm?.let { (it * 1609.344).toInt() }
    }

    fun ceilingFeet(metar: String): Int? {
        val layers = Regex("""\b(BKN|OVC|VV)(\d{3})\b""")
            .findAll(metar.uppercase(Locale.US))
            .mapNotNull { it.groupValues[2].toIntOrNull()?.times(100) }
            .toList()
        return layers.minOrNull()
    }

    fun runwayDesignators(repository: ChartRepository, icao: String): List<String> {
        val regex = Regex("""\bRWY\s+(\d{2}[LRC]?)\b""")
        return repository.getChartsForAirport(icao)
            .flatMap { chart -> regex.findAll(chart.name.uppercase(Locale.US)).map { it.groupValues[1] }.toList() }
            .distinct()
            .sorted()
    }

    fun components(wind: Wind, runway: String): RunwayWind? {
        val number = Regex("""^(\d{2})""").find(runway)?.groupValues?.get(1)?.toIntOrNull() ?: return null
        if (wind.direction == null) {
            return RunwayWind(runway, number * 10, 0, wind.speedKt, null, wind.gustKt)
        }
        val heading = (number * 10) % 360
        var delta = abs(wind.direction - heading)
        if (delta > 180) delta = 360 - delta
        val radians = Math.toRadians(delta.toDouble())
        fun head(speed: Int) = (speed * cos(radians)).toInt()
        fun cross(speed: Int) = abs((speed * sin(radians)).toInt())
        return RunwayWind(
            runway = runway,
            heading = heading,
            headwindKt = head(wind.speedKt),
            crosswindKt = cross(wind.speedKt),
            gustHeadwindKt = wind.gustKt?.let(::head),
            gustCrosswindKt = wind.gustKt?.let(::cross)
        )
    }
}
