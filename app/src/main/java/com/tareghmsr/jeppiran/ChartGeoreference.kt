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
    fun contains(
        x: Double,
        y: Double,
        tolerance: Double = 0.0
    ): Boolean =
        x.isFinite() &&
            y.isFinite() &&
            tolerance.isFinite() &&
            tolerance >= 0.0 &&
            x in (left - tolerance)..(right + tolerance) &&
            y in (top - tolerance)..(bottom + tolerance)
}

data class RenderedAircraftPosition(val x: Float, val y: Float, val headingDegrees: Float)

data class GeoReference(
    val page: Int,
    val width: Double,
    val height: Double,
    val bounds: GeoReferenceBounds,
    val points: List<GeoReferencePoint>,
    val maxResidualPdfPoints: Double = 0.75,
    val excludedBounds: List<GeoReferenceBounds> = emptyList()
) {
    private companion object {
        const val OUTER_EDGE_TOLERANCE_PDF_POINTS = 6.0
    }

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

    fun project(latitude: Double, longitude: Double): Pair<Double, Double>? {
        if (!latitude.isFinite() || !longitude.isFinite() ||
            latitude !in -90.0..90.0 || longitude !in -180.0..180.0
        ) return null
        val projected = transform?.project(latitude, longitude) ?: return null
        return projected.takeIf {
            /*
             * Keep the aircraft visible while its centre crosses only the
             * outer edge of the printed plan view. This avoids a one-frame
             * disappearance at the border. Profile/minimums inset masks stay
             * strict and are never expanded.
             */
            bounds.contains(
                it.first,
                it.second,
                OUTER_EDGE_TOLERANCE_PDF_POINTS
            ) &&
                excludedBounds.none { area ->
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
                         fullBitmapHeight: Int, cropLeft: Int, cropTop: Int,
                         bitmapWidth: Int, bitmapHeight: Int): RenderedAircraftPosition? {
        if (fullBitmapWidth <= 0 || fullBitmapHeight <= 0 ||
            cropLeft < 0 || cropTop < 0 ||
            cropLeft >= fullBitmapWidth || cropTop >= fullBitmapHeight ||
            bitmapWidth <= 0 || bitmapHeight <= 0 ||
            cropLeft + bitmapWidth > fullBitmapWidth ||
            cropTop + bitmapHeight > fullBitmapHeight ||
            abs(width - pdfWidth) > 0.01 || abs(height - pdfHeight) > 0.01
        ) return null
        val point = project(latitude, longitude) ?: return null
        val x = point.first / width * fullBitmapWidth - cropLeft
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

        /*
         * PDF y coordinates increase downward. A valid, non-mirrored map
         * transform from geographic (east, north) to page (x, y) therefore
         * has a negative determinant. Reject mirrored calibration data before
         * it can place the aircraft on the wrong side of a latitude/longitude
         * line.
         */
        val orientationDeterminant =
            fitted.xLon * fitted.yLat -
                fitted.xLat * fitted.yLon

        if (
            !orientationDeterminant.isFinite() ||
            orientationDeterminant >= 0.0
        ) {
            return null
        }

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
    // Experimental-only V2621 OIMM ILS Z/Y/X. The base JSON stays unchanged.
    private const val OIMM_ILS_ASSET = "chart-georef-oimm-ils-experimental.json"
    private const val OIMM_ILS_SOURCE_SHA = "d86b5b5e262a775f8e91d28a403f4b163992dbdd1733ca28e1ba6e46ce8a7ab6"
    private val OIMM_ILS_PAGES = setOf(605,606,607)
    // OTHH flight-test accepted for simulator visualization only; stable 776 unchanged.
    private const val OTHH_FLIGHT_QA_ASSET = "othh-flight-qa-v2621.json"
    private val OTHH_FLIGHT_QA_PAGES = setOf(1536, 1549)
    private val SUPPORTED_METHODS =
        setOf(
            "paired_printed_graticule_vector_ticks",
            "single_axis_plus_conformal_scale"
        )

    private data class ParsedGeoreferences(
        val chartDataVersion: String,
        val sourceSha256: String,
        val references: Map<Int, GeoReference>
    )

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
            val active =
                ChartUpdateStore
                    .readGeoref(context)
                    ?.let { raw ->
                        runCatching { parse(raw) }
                            .getOrNull()
                    }

            val bundled =
                runCatching {
                    context.assets
                        .open(ASSET)
                        .bufferedReader()
                        .use { it.readText() }
                        .let(::parse)
                }
                    .getOrNull()

            val selected =
                when {
                    active == null -> bundled
                    bundled == null -> active
                    active.chartDataVersion == bundled.chartDataVersion -> {
                        /*
                         * A data-cycle download can persist an older georef
                         * file for the same JEPPIRAN data version. App updates
                         * may contain reviewed repairs for that same cycle, so
                         * the bundled records must remain authoritative even
                         * when the old persisted file reports a different
                         * source SHA. Active-only pages are preserved, while a
                         * bundled record replaces the same page.
                         */
                        ParsedGeoreferences(
                            chartDataVersion = bundled.chartDataVersion,
                            sourceSha256 = bundled.sourceSha256,
                            references = active.references + bundled.references
                        )
                    }
                    else -> active
                }
                    ?: return

            chartDataVersion = selected.chartDataVersion
            references.putAll(selected.references)
            if (selected.chartDataVersion == "V2621" &&
                selected.sourceSha256 == OIMM_ILS_SOURCE_SHA
            ) {
                val experimental = runCatching {
                    context.assets.open(OIMM_ILS_ASSET).bufferedReader()
                        .use { it.readText() }.let(::parse)
                }.getOrNull()
                if (experimental != null &&
                    experimental.chartDataVersion == selected.chartDataVersion &&
                    experimental.sourceSha256 == selected.sourceSha256 &&
                    OIMM_ILS_PAGES.all { experimental.references.containsKey(it) }
                ) {
                    OIMM_ILS_PAGES.forEach { page ->
                        references[page] = experimental.references.getValue(page)
                    }
                }
            }
            // Separate additive overlay: do not overwrite any production georeference.
            // OTHH user flight QA is for simulator visualization, never actual navigation.
            if (selected.chartDataVersion == "V2621" &&
                selected.sourceSha256 == OIMM_ILS_SOURCE_SHA
            ) {
                val othhFlightQa = runCatching {
                    context.assets.open(OTHH_FLIGHT_QA_ASSET).bufferedReader()
                        .use { it.readText() }.let(::parse)
                }.getOrNull()
                if (othhFlightQa != null &&
                    othhFlightQa.chartDataVersion == selected.chartDataVersion &&
                    othhFlightQa.sourceSha256 == selected.sourceSha256 &&
                    OTHH_FLIGHT_QA_PAGES.all { othhFlightQa.references.containsKey(it) } &&
                    OTHH_FLIGHT_QA_PAGES.none { references.containsKey(it) }
                ) {
                    OTHH_FLIGHT_QA_PAGES.forEach { page ->
                        references[page] = othhFlightQa.references.getValue(page)
                    }
                }
            }
        } catch (_: Exception) {
            references.clear()
        } finally {
            loaded = true
        }
    }

    private fun parse(raw: String): ParsedGeoreferences? {
        val root = JSONObject(raw)
        if (root.optInt("version") != 2 ||
            root.optString("coordinateSystem") != "WGS84" ||
            root.optString("coordinateSpace") != "pdf_points" ||
            root.optString("origin") != "top_left"
        ) return null

        val source = root.optJSONObject("source") ?: return null
        val dataVersion = source.optString("chartDataVersion")
        val sourceSha256 = source.optString("sha256")
        if (dataVersion.isBlank() ||
            !sourceSha256.matches(Regex("[0-9a-f]{64}"))
        ) return null

        val parsed = mutableMapOf<Int, GeoReference>()
        val duplicatePages = mutableSetOf<Int>()
        val charts = root.optJSONArray("charts") ?: return null

        for (i in 0 until charts.length()) {
            val item = charts.optJSONObject(i) ?: continue
            val page = item.optInt("page", -1)
            val method =
                item.optJSONObject("validation")
                    ?.optString("method")
                    .orEmpty()

            if (page <= 0 ||
                item.optString("coordinateSpace") != "pdf_points" ||
                item.optString("origin") != "top_left" ||
                method !in SUPPORTED_METHODS
            ) continue

            val area = item.optJSONObject("bounds") ?: continue
            val bounds =
                GeoReferenceBounds(
                    area.optDouble("left", Double.NaN),
                    area.optDouble("top", Double.NaN),
                    area.optDouble("right", Double.NaN),
                    area.optDouble("bottom", Double.NaN)
                )

            val pointsJson = item.optJSONArray("points") ?: continue
            val excludedJson = item.optJSONArray("excludedBounds")
            val excludedBounds =
                (0 until (excludedJson?.length() ?: 0)).map { j ->
                    val excluded = excludedJson?.optJSONObject(j)
                    GeoReferenceBounds(
                        excluded?.optDouble("left", Double.NaN) ?: Double.NaN,
                        excluded?.optDouble("top", Double.NaN) ?: Double.NaN,
                        excluded?.optDouble("right", Double.NaN) ?: Double.NaN,
                        excluded?.optDouble("bottom", Double.NaN) ?: Double.NaN
                    )
                }

            val points =
                (0 until pointsJson.length()).map { j ->
                    val point = pointsJson.optJSONObject(j)
                    GeoReferencePoint(
                        point?.optDouble("x", Double.NaN) ?: Double.NaN,
                        point?.optDouble("y", Double.NaN) ?: Double.NaN,
                        point?.optDouble("lat", Double.NaN) ?: Double.NaN,
                        point?.optDouble("lon", Double.NaN) ?: Double.NaN
                    )
                }

            /*
             * Defensive repair for legacy georef data: an excluded region
             * that contains every control point is the main plan-view frame,
             * not a real inset. Keeping it would make every valid aircraft
             * position disappear on that chart.
             */
            val safeExcludedBounds =
                excludedBounds.filterNot {
                    area ->

                    points.isNotEmpty() &&
                        points.all {
                            point ->

                            area.contains(
                                point.x,
                                point.y
                            )
                        }
                }

            val reference =
                GeoReference(
                    page,
                    item.optDouble("width", Double.NaN),
                    item.optDouble("height", Double.NaN),
                    bounds,
                    points,
                    item.optDouble("maxResidualPdfPoints", 0.75),
                    safeExcludedBounds
                )

            // Duplicate page identifiers are ambiguous within one source.
            if (page in duplicatePages) continue
            if (parsed.containsKey(page)) {
                parsed.remove(page)
                duplicatePages.add(page)
                continue
            }
            if (reference.isValid()) parsed[page] = reference
        }

        return ParsedGeoreferences(dataVersion, sourceSha256, parsed)
    }

    /** Convert PDF points to the actually rendered, cropped bitmap. */
    fun renderedPoint(
        context: Context, page: Int, latitude: Double, longitude: Double, headingDegrees: Double,
        dataVersion: String, pdfWidth: Int, pdfHeight: Int,
        fullBitmapWidth: Int, fullBitmapHeight: Int, cropLeft: Int, cropTop: Int,
        bitmapWidth: Int, bitmapHeight: Int
    ): RenderedAircraftPosition? {
        load(context)
        if (dataVersion != chartDataVersion) return null
        val ref = references[page] ?: return null
        return ref.renderedPosition(latitude, longitude, headingDegrees, pdfWidth, pdfHeight,
            fullBitmapWidth, fullBitmapHeight, cropLeft, cropTop, bitmapWidth, bitmapHeight)
    }
}
