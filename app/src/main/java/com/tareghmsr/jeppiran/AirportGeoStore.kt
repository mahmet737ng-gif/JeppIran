package com.tareghmsr.jeppiran

import android.content.Context
import org.json.JSONObject
import kotlin.math.*

object AirportGeoStore {

    data class Point(val latitude: Double, val longitude: Double)

    @Volatile private var cachedVersion: String = ""
    private var centers: Map<String, Point> = emptyMap()

    @Synchronized
    fun center(context: Context, icao: String): Point? {
        ensureLoaded(context)
        return centers[icao.trim().uppercase()]
    }

    @Synchronized
    fun all(context: Context): Map<String, Point> {
        ensureLoaded(context)
        return centers.toMap()
    }

    fun distanceNm(a: Point, b: Point): Double {
        val rNm = 3440.065
        val lat1 = Math.toRadians(a.latitude)
        val lat2 = Math.toRadians(b.latitude)
        val dLat = Math.toRadians(b.latitude - a.latitude)
        val dLon = Math.toRadians(b.longitude - a.longitude)
        val h = sin(dLat / 2).pow(2) +
            cos(lat1) * cos(lat2) * sin(dLon / 2).pow(2)
        return 2 * rNm * asin(sqrt(h.coerceIn(0.0, 1.0)))
    }

    fun distanceNm(latitude: Double, longitude: Double, target: Point): Double =
        distanceNm(Point(latitude, longitude), target)

    @Synchronized
    private fun ensureLoaded(context: Context) {
        val repository = ChartRepository(context)
        val version = repository.getDataVersion()
        if (centers.isNotEmpty() && cachedVersion == version) return

        val pageToAirport = repository.getAllCharts()
            .associate { it.page to it.icao }

        val raw = ChartUpdateStore.readGeoref(context)
            ?: runCatching {
                context.assets.open("chart-georef.json").bufferedReader().use { it.readText() }
            }.getOrNull()
            ?: return

        val root = runCatching { JSONObject(raw) }.getOrNull() ?: return
        val charts = root.optJSONArray("charts") ?: return
        val samples = linkedMapOf<String, MutableList<Point>>()

        for (i in 0 until charts.length()) {
            val item = charts.optJSONObject(i) ?: continue
            val page = item.optInt("page", -1)
            val icao = pageToAirport[page] ?: continue
            val points = item.optJSONArray("points") ?: continue
            for (j in 0 until points.length()) {
                val p = points.optJSONObject(j) ?: continue
                val lat = p.optDouble("lat", Double.NaN)
                val lon = p.optDouble("lon", Double.NaN)
                if (!lat.isFinite() || !lon.isFinite()) continue
                if (lat !in -90.0..90.0 || lon !in -180.0..180.0) continue
                samples.getOrPut(icao) { mutableListOf() }.add(Point(lat, lon))
            }
        }

        centers = samples.mapValues { (_, list) ->
            Point(
                list.map { it.latitude }.average(),
                list.map { it.longitude }.average()
            )
        }
        cachedVersion = version
    }
}
