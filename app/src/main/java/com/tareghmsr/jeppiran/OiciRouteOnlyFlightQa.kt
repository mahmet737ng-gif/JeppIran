package com.tareghmsr.jeppiran

import android.content.Context
import org.json.JSONObject
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.sin

/**
 * V2621 OICI 207/209: simulator FLIGHT QA along ILM--ALTET centerline only.
 * Both Jeppesen charts say NOT TO SCALE: do not use a PDF-wide affine transform,
 * extrapolate past either route endpoint or map SID climb turns/holding patterns.
 * The 807 approved, source-bound models are not modified.
 */
object OiciRouteOnlyFlightQa {
    private const val SOURCE_SHA = "d86b5b5e262a775f8e91d28a403f4b163992dbdd1733ca28e1ba6e46ce8a7ab6"
    private const val ASSET = "oici-route-only-v2621.json"
    private val expectedKeys = mapOf(
        207 to "OICI|STAR|10-2|ALTET 1N, ALTET 1P",
        209 to "OICI|SID|10-3|ALTET 1A, ALTET 1B"
    )
    private data class Anchor(
        val id: String, val nm: Double, val x: Double, val y: Double,
        val lat: Double, val lon: Double
    )
    private data class Route(val page: Int, val anchors: List<Anchor>, val gate: Double) {
        val a: Anchor = anchors.first()
        val b: Anchor = anchors.last()
        val eastScale = 60.0 * cos(Math.toRadians((a.lat + b.lat) / 2.0))
        val dx = (b.lon - a.lon) * eastScale
        val dy = (b.lat - a.lat) * 60.0
        val norm2 = dx * dx + dy * dy

        fun project(lat: Double, lon: Double): Triple<Double, Double, Int>? {
            if (!lat.isFinite() || !lon.isFinite() || lat !in -90.0..90.0 ||
                lon !in -180.0..180.0 || norm2 < 100.0) return null
            val east = (lon - a.lon) * eastScale
            val north = (lat - a.lat) * 60.0
            val f = (east * dx + north * dy) / norm2
            val crossNm = abs(east * dy - north * dx) / kotlin.math.sqrt(norm2)
            if (!f.isFinite() || f < -0.00001 || f > 1.00001 || crossNm > gate) return null
            val nm = f.coerceIn(0.0, 1.0) * b.nm
            val i = (0 until anchors.size - 1)
                .firstOrNull { nm <= anchors[it + 1].nm + 0.000001 } ?: (anchors.size - 2)
            val p = anchors[i]
            val q = anchors[i + 1]
            val t = ((nm - p.nm) / (q.nm - p.nm)).coerceIn(0.0, 1.0)
            return Triple(p.x + (q.x - p.x) * t, p.y + (q.y - p.y) * t, i)
        }

        fun rendered(
            lat: Double, lon: Double, heading: Double,
            pdfWidth: Int, pdfHeight: Int, fullWidth: Int, fullHeight: Int,
            cropLeft: Int, cropTop: Int, width: Int, height: Int
        ): RenderedAircraftPosition? {
            if (pdfWidth != 612 || pdfHeight != 792 || fullWidth <= 0 ||
                fullHeight <= 0 || width <= 0 || height <= 0 ||
                cropLeft < 0 || cropTop < 0 ||
                cropLeft + width > fullWidth || cropTop + height > fullHeight ||
                !heading.isFinite()) return null
            val projected = project(lat, lon) ?: return null
            val x = projected.first / 612.0 * fullWidth - cropLeft
            val y = projected.second / 792.0 * fullHeight - cropTop
            if (x !in 0.0..width.toDouble() || y !in 0.0..height.toDouble()) return null
            val p = anchors[projected.third]
            val q = anchors[projected.third + 1]
            val mapDx = (q.x - p.x) / 612.0 * fullWidth
            val mapDy = (q.y - p.y) / 792.0 * fullHeight
            val mapBearing = Math.toDegrees(atan2(mapDx, -mapDy))
            val trueBearing = Math.toDegrees(atan2(dx, dy))
            val relativeHeading = ((mapBearing + heading - trueBearing + 540.0) % 360.0) - 180.0
            return RenderedAircraftPosition(x.toFloat(), y.toFloat(), relativeHeading.toFloat())
        }
    }

    @Volatile private var loaded = false
    private var routes = emptyMap<Int, Route>()

    @Synchronized fun reset() {
        routes = emptyMap()
        loaded = false
    }

    @Synchronized private fun load(context: Context) {
        if (loaded) return
        loaded = true
        try {
            val root = JSONObject(context.assets.open(ASSET).bufferedReader().use { it.readText() })
            if (!root.optBoolean("activeInChartViewer", false)) return
            if (root.optInt("schemaVersion") != 1 ||
                root.optString("type") != "ROUTE_ONLY_NON_AFFINE_GEOREFERENCE" ||
                root.optString("cycle") != "V2621" ||
                root.optBoolean("safeForActualNavigation", true) ||
                root.getJSONObject("source").optString("sha256") != SOURCE_SHA ||
                root.getJSONObject("source").optInt("pageCount") != 1654) return
            val arr = root.getJSONArray("charts")
            if (arr.length() != 2) return
            val parsed = mutableMapOf<Int, Route>()
            for (index in 0 until arr.length()) {
                val obj = arr.getJSONObject(index)
                val page = obj.optInt("page")
                if (page !in expectedKeys || page in parsed ||
                    obj.optString("airport") != "OICI" ||
                    obj.optString("chartKey") != expectedKeys[page] ||
                    !obj.optBoolean("nonAffine") ||
                    obj.optString("sourceFingerprint").length != 64 ||
                    !obj.getJSONObject("validation").optBoolean("notToScale") ||
                    obj.getJSONObject("validation").optBoolean("fullPageGeoreferencingPermitted", true)) return
                val size = obj.getJSONObject("pdfSize")
                if (size.optInt("width") != 612 || size.optInt("height") != 792) return
                val gate = obj.optDouble("crossTrackRenderGateNm")
                if (!gate.isFinite() || gate <= 0.0 || gate > 0.5) return
                val a = obj.getJSONArray("waypoints")
                if (a.length() != if (page == 207) 3 else 2) return
                val anchors = (0 until a.length()).map { i ->
                    val p = a.getJSONObject(i)
                    Anchor(p.getString("id"), p.getDouble("nmFromILM"),
                        p.getDouble("pdfX"), p.getDouble("pdfY"),
                        p.getDouble("lat"), p.getDouble("lon"))
                }
                if (anchors.first().id != "ILM" || anchors.last().id != "ALTET" ||
                    (page == 207 && anchors[1].id != "D18.0_ILM") ||
                    anchors.first().nm != 0.0 || abs(anchors.last().nm - 30.0783829) > .001 ||
                    anchors.any { !it.nm.isFinite() || !it.x.isFinite() || !it.y.isFinite() ||
                        it.x !in 0.0..612.0 || it.y !in 0.0..792.0 ||
                        it.lat !in 33.0..34.0 || it.lon !in 46.0..48.0 } ||
                    anchors.zipWithNext().any { (p, q) -> q.nm <= p.nm }) return
                val route = Route(page, anchors, gate)
                if (!route.norm2.isFinite() || route.norm2 < 100.0) return
                parsed[page] = route
            }
            if (parsed.keys == expectedKeys.keys) routes = parsed
        } catch (_: Exception) {
            routes = emptyMap()
        }
    }

    fun renderedPoint(
        context: Context, page: Int, latitude: Double, longitude: Double, headingDegrees: Double,
        dataVersion: String, pdfWidth: Int, pdfHeight: Int,
        fullBitmapWidth: Int, fullBitmapHeight: Int, cropLeft: Int, cropTop: Int,
        bitmapWidth: Int, bitmapHeight: Int
    ): RenderedAircraftPosition? {
        // Both route-only pages have been disabled by the owner.
        if (dataVersion == "V2621" && page in expectedKeys) return null
        if (dataVersion != "V2621" || page !in expectedKeys) return null
        load(context)
        return routes[page]?.rendered(latitude, longitude, headingDegrees,
            pdfWidth, pdfHeight, fullBitmapWidth, fullBitmapHeight,
            cropLeft, cropTop, bitmapWidth, bitmapHeight)
    }
}
