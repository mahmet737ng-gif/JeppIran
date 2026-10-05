package com.tareghmsr.jeppiran

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

data class GeoReferencePoint(
    val x: Double,
    val y: Double,
    val latitude: Double,
    val longitude: Double
)

data class GeoReference(
    val page: Int,
    val coordinateSpace: String,
    val points: List<GeoReferencePoint>
) {
    fun project(latitude: Double, longitude: Double): Pair<Double, Double>? {
        if (points.size < 3 ||
            latitude !in -90.0..90.0 ||
            longitude !in -180.0..180.0
        ) return null

        // Local affine fit:
        // x = a*lon + b*lat + c
        // y = d*lon + e*lat + f
        val ata = Array(3) { DoubleArray(3) }
        val atx = DoubleArray(3)
        val aty = DoubleArray(3)

        points.forEach { p ->
            val v = doubleArrayOf(p.longitude, p.latitude, 1.0)
            for (r in 0..2) {
                for (c in 0..2) ata[r][c] += v[r] * v[c]
                atx[r] += v[r] * p.x
                aty[r] += v[r] * p.y
            }
        }

        val ax = solve3x3(ata, atx) ?: return null
        val ay = solve3x3(ata, aty) ?: return null

        return Pair(
            ax[0] * longitude + ax[1] * latitude + ax[2],
            ay[0] * longitude + ay[1] * latitude + ay[2]
        )
    }

    private fun solve3x3(matrix: Array<DoubleArray>, rhs: DoubleArray): DoubleArray? {
        val a = Array(3) { r -> DoubleArray(4) { c ->
            if (c < 3) matrix[r][c] else rhs[r]
        }}

        for (i in 0..2) {
            var pivot = i
            for (r in i + 1..2) {
                if (abs(a[r][i]) > abs(a[pivot][i])) pivot = r
            }
            if (abs(a[pivot][i]) < 1e-12) return null
            if (pivot != i) {
                val tmp = a[i]
                a[i] = a[pivot]
                a[pivot] = tmp
            }
            val divisor = a[i][i]
            for (c in i..3) a[i][c] /= divisor
            for (r in 0..2) {
                if (r == i) continue
                val factor = a[r][i]
                for (c in i..3) a[r][c] -= factor * a[i][c]
            }
        }
        return doubleArrayOf(a[0][3], a[1][3], a[2][3])
    }
}

object ChartGeoreferenceStore {
    private const val ASSET = "chart-georef.json"

    @Volatile private var loaded = false
    private val references = mutableMapOf<Int, GeoReference>()

    @Synchronized
    private fun load(context: Context) {
        if (loaded) return
        loaded = true
        try {
            val text = context.assets.open(ASSET).bufferedReader().use { it.readText() }
            val root = JSONObject(text)
            val charts = root.optJSONArray("charts") ?: JSONArray()
            for (i in 0 until charts.length()) {
                val item = charts.optJSONObject(i) ?: continue
                val page = item.optInt("page", -1)
                if (page <= 0) continue
                val pointsJson = item.optJSONArray("points") ?: continue
                val points = mutableListOf<GeoReferencePoint>()
                for (j in 0 until pointsJson.length()) {
                    val p = pointsJson.optJSONObject(j) ?: continue
                    val lat = p.optDouble("lat", Double.NaN)
                    val lon = p.optDouble("lon", Double.NaN)
                    val x = p.optDouble("x", Double.NaN)
                    val y = p.optDouble("y", Double.NaN)
                    if (!lat.isNaN() && !lon.isNaN() && !x.isNaN() && !y.isNaN()) {
                        points += GeoReferencePoint(x, y, lat, lon)
                    }
                }
                if (points.size >= 3) {
                    references[page] = GeoReference(
                        page,
                        item.optString("coordinateSpace", "normalized"),
                        points
                    )
                }
            }
        } catch (_: Exception) {
            // No metadata = no aircraft marker. Never fabricate coordinates.
        }
    }

    fun forPage(context: Context, page: Int): GeoReference? {
        load(context)
        return references[page]
    }

    fun normalizedPoint(
        context: Context,
        page: Int,
        latitude: Double,
        longitude: Double
    ): Pair<Float, Float>? {
        val ref = forPage(context, page) ?: return null
        val point = ref.project(latitude, longitude) ?: return null
        val normalized = if (ref.coordinateSpace.equals("pixels", true)) {
            // Pixel-space metadata must provide width/height in a future schema.
            // Refuse to guess without those dimensions.
            return null
        } else {
            point
        }
        return Pair(normalized.first.toFloat(), normalized.second.toFloat())
    }
}
