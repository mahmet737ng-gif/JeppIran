package com.tareghmsr.jeppiran

import android.content.Context
import android.graphics.PointF
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.abs

/**
 * Converts WGS84 latitude/longitude to PDF-image coordinates for charts that
 * have been independently georeferenced.
 *
 * The PDF itself is never modified. Ground-control points live in a separate
 * chart-georef.json asset.
 */
object ChartGeoreference {

    private const val ASSET_FILE = "chart-georef.json"
    private const val MIN_POINTS = 3
    private const val MAX_RESIDUAL_PX = 18.0

    data class GroundControlPoint(
        val x: Double,
        val y: Double,
        val lat: Double,
        val lon: Double
    )

    data class ChartReference(
        val icao: String,
        val page: Int,
        val pdfPage: Int?,
        val width: Double,
        val height: Double,
        val points: List<GroundControlPoint>
    )

    data class PixelPosition(
        val x: Float,
        val y: Float
    )

    private data class Affine(
        val ax: Double,
        val bx: Double,
        val cx: Double,
        val ay: Double,
        val by: Double,
        val cy: Double
    ) {
        fun project(lat: Double, lon: Double): PixelPosition {
            return PixelPosition(
                (ax * lon + bx * lat + cx).toFloat(),
                (ay * lon + by * lat + cy).toFloat()
            )
        }
    }

    private var loaded = false
    private val references = mutableMapOf<String, ChartReference>()
    private val transforms = mutableMapOf<String, Affine>()

    fun load(context: Context) {
        if (loaded) return
        loaded = true

        try {
            val text = context.assets.open(ASSET_FILE)
                .bufferedReader()
                .use { it.readText() }

            val root = JSONObject(text)
            val charts = root.optJSONArray("charts") ?: JSONArray()

            for (i in 0 until charts.length()) {
                val obj = charts.optJSONObject(i) ?: continue
                val icao = obj.optString("icao").trim().uppercase()
                val page = obj.optInt("page", -1)

                if (icao.isBlank() || page < 1) continue

                val pointsJson = obj.optJSONArray("points") ?: continue
                val points = mutableListOf<GroundControlPoint>()

                for (p in 0 until pointsJson.length()) {
                    val point = pointsJson.optJSONObject(p) ?: continue
                    val gcp = GroundControlPoint(
                        x = point.optDouble("x", Double.NaN),
                        y = point.optDouble("y", Double.NaN),
                        lat = point.optDouble("lat", Double.NaN),
                        lon = point.optDouble("lon", Double.NaN)
                    )

                    if (
                        gcp.x.isFinite() &&
                        gcp.y.isFinite() &&
                        gcp.lat.isFinite() &&
                        gcp.lon.isFinite()
                    ) {
                        points += gcp
                    }
                }

                if (points.size < MIN_POINTS) continue

                val reference = ChartReference(
                    icao = icao,
                    page = page,
                    pdfPage = obj.optInt("pdfPage", 0).takeIf { it > 0 },
                    width = obj.optDouble("width", 0.0),
                    height = obj.optDouble("height", 0.0),
                    points = points
                )

                val key = key(icao, page)
                val affine = fitAffine(points) ?: continue

                if (!validate(reference, affine)) continue

                references[key] = reference
                transforms[key] = affine
            }
        } catch (_: Exception) {
            references.clear()
            transforms.clear()
        }
    }

    fun hasReference(
        context: Context,
        icao: String,
        page: Int
    ): Boolean {
        load(context)
        return transforms.containsKey(key(icao, page))
    }

    fun project(
        context: Context,
        icao: String,
        page: Int,
        latitude: Double,
        longitude: Double
    ): PixelPosition? {
        load(context)

        if (!latitude.isFinite() || !longitude.isFinite()) return null
        if (latitude !in -90.0..90.0 || longitude !in -180.0..180.0) return null

        return transforms[key(icao, page)]?.project(latitude, longitude)
    }

    fun reference(
        context: Context,
        icao: String,
        page: Int
    ): ChartReference? {
        load(context)
        return references[key(icao, page)]
    }

    private fun key(icao: String, page: Int): String {
        return "${icao.trim().uppercase()}:$page"
    }

    private fun fitAffine(points: List<GroundControlPoint>): Affine? {
        if (points.size < MIN_POINTS) return null

        // x = a*lon + b*lat + c
        // y = d*lon + e*lat + f
        val normal = Array(3) { DoubleArray(3) }
        val rhsX = DoubleArray(3)
        val rhsY = DoubleArray(3)

        for (p in points) {
            val v = doubleArrayOf(p.lon, p.lat, 1.0)

            for (r in 0..2) {
                rhsX[r] += v[r] * p.x
                rhsY[r] += v[r] * p.y

                for (c in 0..2) {
                    normal[r][c] += v[r] * v[c]
                }
            }
        }

        val x = solve3x3(normal, rhsX) ?: return null
        val y = solve3x3(normal, rhsY) ?: return null

        return Affine(
            ax = x[0],
            bx = x[1],
            cx = x[2],
            ay = y[0],
            by = y[1],
            cy = y[2]
        )
    }

    private fun solve3x3(
        source: Array<DoubleArray>,
        rhs: DoubleArray
    ): DoubleArray? {
        val a = Array(3) { r ->
            doubleArrayOf(
                source[r][0],
                source[r][1],
                source[r][2],
                rhs[r]
            )
        }

        for (column in 0..2) {
            var pivot = column
            for (row in column + 1..2) {
                if (abs(a[row][column]) > abs(a[pivot][column])) {
                    pivot = row
                }
            }

            if (abs(a[pivot][column]) < 1e-12) return null

            if (pivot != column) {
                val tmp = a[column]
                a[column] = a[pivot]
                a[pivot] = tmp
            }

            val divisor = a[column][column]
            for (j in column..3) {
                a[column][j] /= divisor
            }

            for (row in 0..2) {
                if (row == column) continue

                val factor = a[row][column]
                for (j in column..3) {
                    a[row][j] -= factor * a[column][j]
                }
            }
        }

        return doubleArrayOf(
            a[0][3],
            a[1][3],
            a[2][3]
        )
    }

    private fun validate(
        reference: ChartReference,
        affine: Affine
    ): Boolean {
        var maxResidual = 0.0

        for (point in reference.points) {
            val projected = affine.project(point.lat, point.lon)
            val dx = projected.x - point.x
            val dy = projected.y - point.y
            val residual = kotlin.math.sqrt(dx * dx + dy * dy)
            maxResidual = maxOf(maxResidual, residual)
        }

        if (maxResidual > MAX_RESIDUAL_PX) return false

        if (reference.width > 0.0 && reference.height > 0.0) {
            for (point in reference.points) {
                if (
                    point.x !in 0.0..reference.width ||
                    point.y !in 0.0..reference.height
                ) {
                    return false
                }
            }
        }

        return true
    }
}
