package com.tareghmsr.jeppiran

import android.content.Context
import android.os.Handler
import android.os.Looper
import org.json.JSONArray
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

/** A shared five minute METAR cache. Unknown weather is never represented as VFR. */
object AirportWeather {
    data class Report(val raw: String, val category: String?, val timestamp: Long)
    private val cache = mutableMapOf<String, Report>()
    private val listeners = mutableMapOf<String, MutableList<(Report?) -> Unit>>()
    private val inFlight = mutableSetOf<String>()
    private const val TTL = 300_000L

    @Synchronized
    fun cached(icao: String): Report? = cache[icao]

    fun get(context: Context, icao: String, callback: (Report?) -> Unit) {
        val key = icao.uppercase()
        synchronized(this) {
            val previous = cache[key]
            if (previous != null && System.currentTimeMillis() - previous.timestamp < TTL) {
                callback(previous)
                return
            }
            listeners.getOrPut(key) { mutableListOf() }.add(callback)
            if (!inFlight.add(key)) return
        }
        thread(name = "metar-$key") {
            var connection: HttpURLConnection? = null
            val report = try {
                connection = (URL("https://aviationweather.gov/api/data/metar?ids=$key&format=json")
                    .openConnection() as HttpURLConnection).apply {
                    connectTimeout = 7000
                    readTimeout = 7000
                    setRequestProperty("Accept", "application/json")
                    setRequestProperty("User-Agent", "JeppIran/1.0")
                }
                val entry = JSONArray(connection.inputStream.bufferedReader().use { it.readText() })
                    .optJSONObject(0)
                val raw = entry?.optString("rawOb").orEmpty()
                if (raw.isBlank()) null else Report(raw, entry?.optString("fltCat")
                    ?.uppercase()?.takeIf { it in setOf("VFR", "MVFR", "IFR", "LIFR") },
                    System.currentTimeMillis())
            } catch (_: Exception) { null } finally { connection?.disconnect() }
            Handler(Looper.getMainLooper()).post {
                val callbacks: List<(Report?) -> Unit>
                synchronized(this) {
                    if (report != null) cache[key] = report
                    callbacks = listeners.remove(key)?.toList().orEmpty()
                    inFlight.remove(key)
                }
                // A failed refresh keeps the last known report, including its timestamp.
                val current = report ?: cached(key)
                callbacks.forEach { it(current) }
            }
        }
    }
}
