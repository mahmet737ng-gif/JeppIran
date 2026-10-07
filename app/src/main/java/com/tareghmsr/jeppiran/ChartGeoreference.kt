package com.tareghmsr.jeppiran

import android.content.Context
import org.json.JSONObject
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.sin

data class GeoReferencePoint(
    val x: Double,
    val y: Double,
    val latitude: Double,
    val longitude: Double
)

data class GeoReferenceBounds(
    val left: Double,
    val top: Double,
    val right: Double,
    val bottom: Double
) {
    fun contains(x: Double, y: Double): Boolean =
        x.isFinite() && y.isFinite() && x in left..right && y in top..bottom
}

data class RenderedAircraftPosition(val x: Float, val y: Float, val headingDegrees: Float)

data class ChartGeoCoverage(val page: Int, val area: Double)

data class GeoReference(
    val page: Int,
    val width: Double,
    val height: Double,
    val bounds: GeoReferenceBounds,
    val points: List<GeoReferencePoint>,
    val maxResidualPdfPoints: Double = 0.75,
    val excludedBounds: List<GeoReferenceBounds> = emptyList()
) {
    private data class Transform(
        val meanLon: Double, val meanLat: Double,
        val meanX: Double, val meanY: Double,
        val xLon: Double, val xLat: Double,
        val yLon: Double, val yLat: Double
    ) {
        fun project(lat: Double, lon: Double): Pair<Double, Double> = Pair(
            meanX + xLon * (lon - meanLon) + xLat * (lat - meanLat),
            meanY + yLon * (lon - meanLon) + yLat * (lat - meanLat)
        )
    }

    // Mean centering avoids the poorly conditioned raw lon/lat normal matrix.
    // Fit once, and use every measured GCP to check the residual.
    private val transform: Transform? by lazy { fit() }

    fun isValid(): Boolean = transform != null

    fun contains(latitude: Double, longitude: Double): Boolean =
        project(latitude, longitude) != null

    fun geographicArea(): Double {
        if (points.isEmpty()) return Double.POSITIVE_INFINITY
        val minLat = points.minOf { it.latitude }
        val maxLat = points.maxOf { it.latitude }
        val minLon = points.minOf { it.longitude }
        val maxLon = points.maxOf { it.longitude }
        val meanLat = points.map { it.latitude }.average()
        val lonScale = kotlin.math.abs(kotlin.math.cos(Math.toRadians(meanLat)))
            .coerceAtLeast(0.01)
        return kotlin.math.abs((maxLat - minLat) * (maxLon - minLon) * lonScale)
            .coerceAtLeast(1e-12)
    }

    fun project(latitude: Double, longitude: Double): Pair<Double, Double>? {
        if (!latitude.isFinite() || !longitude.isFinite() ||
            latitude !in -90.0..90.0 || longitude !in -180.0..180.0
        ) return null
        val projected = transform?.project(latitude, longitude) ?: return null
        return projected.takeIf {
            bounds.contains(it.first, it.second) && excludedBounds.none { area ->
                area.contains(it.first, it.second)
            }
        }
    }

    fun renderedHeading(latitude: Double, headingDegrees: Double,
                        bitmapWidth: Int, bitmapHeight: Int): Float? {
        if (!latitude.isFinite() || !headingDegrees.isFinite()) return null
        val t = transform ?: return null
        val angle = Math.toRadians(headingDegrees)
        val latitudeCosine = cos(Math.toRadians(latitude))
        if (abs(latitudeCosine) < 1e-8) return null
        val east = sin(angle) / latitudeCosine
        val north = cos(angle)
        val dx = (t.xLon * east + t.xLat * north) * bitmapWidth / width
        val dy = (t.yLon * east + t.yLat * north) * bitmapHeight / height
        if (!dx.isFinite() || !dy.isFinite() || hypot(dx, dy) < 1e-8) return null
        return Math.toDegrees(atan2(dx, -dy)).toFloat()
    }

    fun renderedPosition(latitude: Double, longitude: Double, headingDegrees: Double,
                         pdfWidth: Int, pdfHeight: Int, fullBitmapWidth: Int,
                         fullBitmapHeight: Int, cropTop: Int, bitmapWidth: Int,
                         bitmapHeight: Int): RenderedAircraftPosition? {
        if (fullBitmapWidth <= 0 || fullBitmapHeight <= 0 ||
            cropTop < 0 || cropTop >= fullBitmapHeight || bitmapWidth != fullBitmapWidth ||
            bitmapHeight != fullBitmapHeight - cropTop ||
            abs(width - pdfWidth) > 0.01 || abs(height - pdfHeight) > 0.01
        ) return null
        val point = project(latitude, longitude) ?: return null
        val x = point.first / width * fullBitmapWidth
        val y = point.second / height * fullBitmapHeight - cropTop
        if (!x.isFinite() || !y.isFinite() || x < 0 || y < 0 ||
            x > bitmapWidth || y > bitmapHeight
        ) return null
        val heading = renderedHeading(latitude, headingDegrees, fullBitmapWidth, fullBitmapHeight)
            ?: return null
        return RenderedAircraftPosition(x.toFloat(), y.toFloat(), heading)
    }

    private fun fit(): Transform? {
        if (points.size < 4 || !width.isFinite() || !height.isFinite() ||
            width <= 0 || height <= 0 || !maxResidualPdfPoints.isFinite() ||
            maxResidualPdfPoints !in 0.0..2.0 ||
            !bounds.left.isFinite() || !bounds.top.isFinite() ||
            !bounds.right.isFinite() || !bounds.bottom.isFinite() ||
            bounds.left < 0 || bounds.top < 0 || bounds.right > width || bounds.bottom > height ||
            bounds.left >= bounds.right || bounds.top >= bounds.bottom ||
            excludedBounds.any {
                !bounds.contains(it.left, it.top) || !bounds.contains(it.right, it.bottom) ||
                    it.left >= it.right || it.top >= it.bottom
            } || points.any {
                !bounds.contains(it.x, it.y) || !it.latitude.isFinite() || !it.longitude.isFinite() ||
                    it.latitude !in -90.0..90.0 || it.longitude !in -180.0..180.0
            }
        ) return null

        val meanLon = points.map { it.longitude }.average()
        val meanLat = points.map { it.latitude }.average()
        val meanX = points.map { it.x }.average()
        val meanY = points.map { it.y }.average()
        var ll = 0.0
        var bb = 0.0
        var lb = 0.0
        var lx = 0.0
        var bx = 0.0
        var ly = 0.0
        var latY = 0.0
        points.forEach {
            val lon = it.longitude - meanLon
            val lat = it.latitude - meanLat
            ll += lon * lon
            bb += lat * lat
            lb += lon * lat
            lx += lon * (it.x - meanX)
            bx += lat * (it.x - meanX)
            ly += lon * (it.y - meanY)
            latY += lat * (it.y - meanY)
        }
        val determinant = ll * bb - lb * lb
        if (ll <= 1e-16 || bb <= 1e-16 || determinant <= 1e-8 * ll * bb) return null
        val fitted = Transform(meanLon, meanLat, meanX, meanY,
            (bb * lx - lb * bx) / determinant, (ll * bx - lb * lx) / determinant,
            (bb * ly - lb * latY) / determinant, (ll * latY - lb * ly) / determinant)
        if (points.any {
                val p = fitted.project(it.latitude, it.longitude)
                !p.first.isFinite() || !p.second.isFinite() ||
                    hypot(p.first - it.x, p.second - it.y) > maxResidualPdfPoints
            }
        ) return null
        return fitted
    }
}

object ChartGeoreferenceStore {
    private const val ASSET = "chart-georef.json"
    @Volatile private var loaded = false
    private var chartDataVersion = ""
    private val references = mutableMapOf<Int, GeoReference>()

    @Synchronized
    fun reset() {
        loaded = false
        chartDataVersion = ""
        references.clear()
    }

    @Synchronized
    private fun load(context: Context) {
        if (loaded) return
        try {
            val raw =
                ChartUpdateStore
                    .readGeoref(
                        context
                    )
                    ?: context.assets
                        .open(
                            ASSET
                        )
                        .bufferedReader()
                        .use {
                            it.readText()
                        }

            val root =
                JSONObject(
                    raw
                )
            if (root.optInt("version") != 2 || root.optString("coordinateSystem") != "WGS84" ||
                root.optString("coordinateSpace") != "pdf_points" ||
                root.optString("origin") != "top_left"
            ) return
            chartDataVersion = root.optJSONObject("source")?.optString("chartDataVersion") ?: ""
            if (chartDataVersion.isEmpty()) return
            val charts = root.optJSONArray("charts") ?: return
            val duplicatePages = mutableSetOf<Int>()
            for (i in 0 until charts.length()) {
                val item = charts.optJSONObject(i) ?: continue
                val page = item.optInt("page", -1)
                if (page <= 0 || item.optString("coordinateSpace") != "pdf_points" ||
                    item.optString("origin") != "top_left" ||
                    item.optJSONObject("validation")?.optString("method") != "paired_printed_graticule_vector_ticks"
                ) continue
                val area = item.optJSONObject("bounds") ?: continue
                val bounds = GeoReferenceBounds(area.optDouble("left", Double.NaN),
                    area.optDouble("top", Double.NaN), area.optDouble("right", Double.NaN),
                    area.optDouble("bottom", Double.NaN))
                val pointsJson = item.optJSONArray("points") ?: continue
                val excludedJson = item.optJSONArray("excludedBounds")
                val excludedBounds = (0 until (excludedJson?.length() ?: 0)).map { j ->
                    val area = excludedJson?.optJSONObject(j)
                    GeoReferenceBounds(area?.optDouble("left", Double.NaN) ?: Double.NaN,
                        area?.optDouble("top", Double.NaN) ?: Double.NaN,
                        area?.optDouble("right", Double.NaN) ?: Double.NaN,
                        area?.optDouble("bottom", Double.NaN) ?: Double.NaN)
                }
                val points = (0 until pointsJson.length()).map { j ->
                    val p = pointsJson.optJSONObject(j)
                    GeoReferencePoint(p?.optDouble("x", Double.NaN) ?: Double.NaN,
                        p?.optDouble("y", Double.NaN) ?: Double.NaN,
                        p?.optDouble("lat", Double.NaN) ?: Double.NaN,
                        p?.optDouble("lon", Double.NaN) ?: Double.NaN)
                }
                val ref = GeoReference(page, item.optDouble("width", Double.NaN),
                    item.optDouble("height", Double.NaN), bounds, points,
                    item.optDouble("maxResidualPdfPoints", 0.75), excludedBounds)
                // Duplicate page identifiers are ambiguous, so disable them.
                if (page in duplicatePages) continue
                if (references.containsKey(page)) {
                    references.remove(page)
                    duplicatePages.add(page)
                    continue
                }
                if (ref.isValid()) references[page] = ref
            }
        } catch (_: Exception) {
            references.clear()
        } finally {
            loaded = true
        }
    }

    fun coveringPages(
        context: Context,
        pages: Collection<Int>,
        latitude: Double,
        longitude: Double,
        dataVersion: String
    ): List<ChartGeoCoverage> {
        load(context)
        if (dataVersion != chartDataVersion) return emptyList()
        return pages
            .distinct()
            .mapNotNull { page ->
                references[page]
                    ?.takeIf { it.contains(latitude, longitude) }
                    ?.let { ChartGeoCoverage(page, it.geographicArea()) }
            }
            .sortedBy { it.area }
    }

    /** Convert PDF points to the actually rendered, cropped bitmap. */
    fun renderedPoint(
        context: Context, page: Int, latitude: Double, longitude: Double, headingDegrees: Double,
        dataVersion: String, pdfWidth: Int, pdfHeight: Int,
        fullBitmapWidth: Int, fullBitmapHeight: Int, cropTop: Int,
        bitmapWidth: Int, bitmapHeight: Int
    ): RenderedAircraftPosition? {
        load(context)
        if (dataVersion != chartDataVersion) return null
        val ref = references[page] ?: return null
        return ref.renderedPosition(latitude, longitude, headingDegrees, pdfWidth, pdfHeight,
            fullBitmapWidth, fullBitmapHeight, cropTop, bitmapWidth, bitmapHeight)
    }
}
