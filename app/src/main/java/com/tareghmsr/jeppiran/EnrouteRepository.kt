package com.tareghmsr.jeppiran

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

object EnrouteRepository {
    private const val ASSET = "enroute/enroute-data.json"

    fun load(context: Context): EnrouteDataset {
        return try {
            val text = context.assets.open(ASSET).bufferedReader().use { it.readText() }
            parse(JSONObject(text))
        } catch (_: Throwable) {
            EnrouteDataset.empty()
        }
    }

    private fun parse(root: JSONObject): EnrouteDataset {
        require(root.optInt("schema", 0) == 1) { "Unsupported en-route schema" }

        return EnrouteDataset(
            cycle = root.optString("cycle", "UNSET"),
            source = root.optString("source", "Unknown"),
            fixes = parseFixes(root.optJSONArray("fixes")),
            navaids = parseNavaids(root.optJSONArray("navaids")),
            airways = parseAirways(root.optJSONArray("airways")),
            airspaces = parseAirspaces(root.optJSONArray("airspaces"))
        )
    }

    private fun parseFixes(items: JSONArray?): List<EnrouteFix> = buildList {
        if (items == null) return@buildList
        for (i in 0 until items.length()) {
            val o = items.optJSONObject(i) ?: continue
            point(o)?.let { add(EnrouteFix(o.optString("ident", ""), it)) }
        }
    }

    private fun parseNavaids(items: JSONArray?): List<EnrouteNavaid> = buildList {
        if (items == null) return@buildList
        for (i in 0 until items.length()) {
            val o = items.optJSONObject(i) ?: continue
            point(o)?.let {
                add(
                    EnrouteNavaid(
                        ident = o.optString("ident", ""),
                        type = o.optString("type", "NAVAID"),
                        frequency = o.optString("frequency").takeIf { value -> value.isNotBlank() },
                        position = it
                    )
                )
            }
        }
    }

    private fun parseAirways(items: JSONArray?): List<EnrouteAirwaySegment> = buildList {
        if (items == null) return@buildList
        for (i in 0 until items.length()) {
            val o = items.optJSONObject(i) ?: continue
            val from = point(o.optJSONObject("from")) ?: continue
            val to = point(o.optJSONObject("to")) ?: continue
            add(
                EnrouteAirwaySegment(
                    airway = o.optString("airway", ""),
                    level = o.optString("level", "BOTH").uppercase(),
                    from = from,
                    to = to,
                    minAltitudeFt = if (o.has("minAltitudeFt")) o.optInt("minAltitudeFt") else null
                )
            )
        }
    }

    private fun parseAirspaces(items: JSONArray?): List<EnrouteAirspace> = buildList {
        if (items == null) return@buildList
        for (i in 0 until items.length()) {
            val o = items.optJSONObject(i) ?: continue
            val boundaryArray = o.optJSONArray("boundary") ?: continue
            val boundary = buildList {
                for (j in 0 until boundaryArray.length()) {
                    point(boundaryArray.optJSONObject(j))?.let(::add)
                }
            }
            if (boundary.size >= 3) {
                add(
                    EnrouteAirspace(
                        name = o.optString("name", ""),
                        airspaceClass = o.optString("class").takeIf { it.isNotBlank() },
                        lower = o.optString("lower").takeIf { it.isNotBlank() },
                        upper = o.optString("upper").takeIf { it.isNotBlank() },
                        boundary = boundary
                    )
                )
            }
        }
    }

    private fun point(o: JSONObject?): GeoPoint? {
        o ?: return null
        val lat = o.optDouble("lat", Double.NaN)
        val lon = o.optDouble("lon", Double.NaN)
        if (!lat.isFinite() || !lon.isFinite() || lat !in -90.0..90.0 || lon !in -180.0..180.0) return null
        return GeoPoint(lat, lon)
    }
}
