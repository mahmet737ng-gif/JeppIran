package com.tareghmsr.jeppiran

import android.content.Context
import android.location.Location
import org.json.JSONArray
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.abs

object EfbIntelligenceStore {

    data class RunwayCondition(
        val runway: String,
        val severity: String,
        val text: String
    )

    data class MetarTrend(
        val timeLabel: String,
        val raw: String,
        val wind: String,
        val visibility: String,
        val ceiling: String
    )

    data class Pirep(
        val timeLabel: String,
        val altitude: String,
        val summary: String,
        val raw: String
    )

    data class Alternate(
        val icao: String,
        val airportName: String,
        val distanceNm: Double,
        val metar: String,
        val approaches: Int,
        val runwayCount: Int,
        val notamCount: Int
    )

    data class ApproachCheck(
        val chart: ChartRepository.ChartInfo,
        val weatherLine: String,
        val minimaSource: String,
        val relatedNotams: List<NotamStore.Notam>,
        val assessment: String
    )

    data class ChangeInsight(
        val category: String,
        val title: String,
        val detail: String
    )

    fun runwayConditions(notams: List<NotamStore.Notam>): List<RunwayCondition> {
        val runwayRegex = Regex("""\b(?:RWY|RUNWAY)\s*(\d{2}[LRC]?)\b""", RegexOption.IGNORE_CASE)
        val conditionWords = listOf(
            "CLOSED", "CLSD", "RWYCC", "BRAKING", "BRAKE", "SNOW", "SLUSH",
            "ICE", "ICY", "WET", "CONTAM", "FROST", "WATER", "RUBBER", "FRICTION"
        )

        val result = mutableListOf<RunwayCondition>()
        notams.forEach { item ->
            val upper = item.text.uppercase(Locale.US)
            if (conditionWords.none { upper.contains(it) }) return@forEach
            val runways = runwayRegex.findAll(upper).map { it.groupValues[1] }.toList()
            if (runways.isEmpty()) return@forEach
            val severity = when {
                "CLOSED" in upper || "CLSD" in upper -> "CLOSED"
                "RWYCC" in upper || "BRAKING" in upper || "FRICTION" in upper -> "CONDITION"
                "SNOW" in upper || "SLUSH" in upper || "ICE" in upper || "ICY" in upper -> "CONTAMINATION"
                else -> "ADVISORY"
            }
            runways.distinct().forEach { runway ->
                result += RunwayCondition(runway, severity, item.text)
            }
        }
        return result.distinctBy { it.runway + "|" + it.text }
    }

    fun fetchMetarTrend(icao: String, hours: Int = 12): List<MetarTrend> {
        val key = URLEncoder.encode(icao.trim().uppercase(Locale.US), "UTF-8")
        val url = URL(
            "https://aviationweather.gov/api/data/metar?ids=" + key +
                "&format=json&hours=" + hours.coerceIn(1, 24)
        )
        val raw = request(url)
        if (raw.isBlank()) return emptyList()

        val array = JSONArray(raw)
        val rows = mutableListOf<MetarTrend>()
        for (i in 0 until array.length()) {
            val obj = array.optJSONObject(i) ?: continue
            val observation = listOf("rawOb", "raw", "metar", "text")
                .firstNotNullOfOrNull { k -> obj.optString(k, "").takeIf { it.isNotBlank() } }
                ?: continue
            val obsTime = when {
                obj.has("obsTime") -> {
                    val value = obj.opt("obsTime")
                    when (value) {
                        is Number -> formatEpoch(value.toLong())
                        else -> value?.toString().orEmpty()
                    }
                }
                obj.has("reportTime") -> obj.optString("reportTime", "")
                else -> ""
            }
            val wind = FlightDataStore.parseWind(observation)?.let {
                (it.direction?.let { d -> "%03d°".format(d) } ?: "VRB") +
                    " " + it.speedKt + "KT" +
                    (it.gustKt?.let { g -> " G$g" } ?: "")
            } ?: "—"
            val visibility = FlightDataStore.visibilityMeters(observation)?.let {
                if (it >= 10000) "10km+" else it.toString() + "m"
            } ?: "—"
            val ceiling = FlightDataStore.ceilingFeet(observation)?.let { it.toString() + "ft" } ?: "—"
            rows += MetarTrend(obsTime, observation, wind, visibility, ceiling)
        }
        return rows.sortedBy { it.timeLabel }
    }

    fun fetchPireps(icao: String, distanceNm: Int = 150, ageHours: Int = 6): List<Pirep> {
        val id = URLEncoder.encode(icao.trim().uppercase(Locale.US), "UTF-8")
        val url = URL(
            "https://aviationweather.gov/api/data/pirep?id=" + id +
                "&distance=" + distanceNm.coerceIn(20, 500) +
                "&age=" + ageHours.coerceIn(1, 24) +
                "&format=json"
        )
        val raw = request(url, allowNoContent = true)
        if (raw.isBlank()) return emptyList()

        val array = JSONArray(raw)
        val rows = mutableListOf<Pirep>()
        for (i in 0 until array.length()) {
            val obj = array.optJSONObject(i) ?: continue
            val report = listOf("rawOb", "raw", "text", "report")
                .firstNotNullOfOrNull { k -> obj.optString(k, "").takeIf { it.isNotBlank() } }
                ?: obj.toString()
            val time = listOf("obsTime", "reportTime", "time")
                .firstNotNullOfOrNull { k ->
                    val value = obj.opt(k)
                    when (value) {
                        is Number -> formatEpoch(value.toLong())
                        else -> value?.toString()?.takeIf { it.isNotBlank() }
                    }
                }.orEmpty()
            val altitude = listOf("fltLvl", "flightLevel", "altitude")
                .firstNotNullOfOrNull { k -> obj.opt(k)?.toString()?.takeIf { it.isNotBlank() } }
                ?.let { "FL/ALT $it" } ?: "ALT —"

            val upper = report.uppercase(Locale.US)
            val tags = buildList {
                if ("/TB" in upper || "TURB" in upper) add("TURB")
                if ("/IC" in upper || "ICING" in upper) add("ICING")
                if ("/SK" in upper || "TOP" in upper) add("CLOUD")
                if ("UUA" in upper) add("URGENT")
            }
            rows += Pirep(
                timeLabel = time,
                altitude = altitude,
                summary = tags.ifEmpty { listOf("REPORT") }.joinToString(" • "),
                raw = report
            )
        }
        return rows
    }

    fun alternates(
        context: Context,
        icao: String,
        maxResults: Int = 6
    ): List<Alternate> {
        val repository = ChartRepository(context)
        val origin = AirportGeoStore.center(context, icao) ?: return emptyList()
        val candidates = repository.getAirports()
            .filterNot { it.icao.equals(icao, true) }
            .mapNotNull { airport ->
                val center = AirportGeoStore.center(context, airport.icao) ?: return@mapNotNull null
                val distance = AirportGeoStore.distanceNm(origin, center)
                if (distance > 600.0) return@mapNotNull null
                val charts = repository.getDisplayChartsForAirport(airport.icao)
                val approachCount = charts.count {
                    ChartRepository.normalizeCategory(it.category) == "Approach"
                }
                val runwayCount = FlightDataStore.runwayDesignators(repository, airport.icao).size
                val metar = FlightDataStore.cached(context, airport.icao)?.metar.orEmpty()
                val notamCount = NotamStore.cached(context, airport.icao)?.items?.size ?: 0
                Alternate(
                    airport.icao,
                    airport.airportName,
                    distance,
                    metar,
                    approachCount,
                    runwayCount,
                    notamCount
                )
            }
            .sortedWith(
                compareBy<Alternate> { it.distanceNm }
                    .thenByDescending { it.approaches }
            )
        return candidates.take(maxResults.coerceIn(1, 12))
    }

    fun approachChecks(
        context: Context,
        icao: String
    ): List<ApproachCheck> {
        val repository = ChartRepository(context)
        val weather = FlightDataStore.cached(context, icao)
        val ceiling = weather?.metar?.let(FlightDataStore::ceilingFeet)
        val visibility = weather?.metar?.let(FlightDataStore::visibilityMeters)
        val notams = NotamStore.cached(context, icao)?.items.orEmpty()

        return repository.getDisplayChartsForAirport(icao)
            .filter { ChartRepository.normalizeCategory(it.category) == "Approach" }
            .map { chart ->
                val brief = ApproachBriefStore.forPage(context, chart.page)
                val related = NotamStore.relevantToApproach(notams, chart.name)
                val weatherLine =
                    "Ceiling " + (ceiling?.let { "$it ft" } ?: "—") +
                        " • Visibility " + (visibility?.let {
                            if (it >= 10000) "10 km+" else "$it m"
                        } ?: "—")
                val assessment = when {
                    weather == null -> "WEATHER DATA NOT CACHED"
                    related.isNotEmpty() -> "CHECK RELATED NOTAM"
                    else -> "NO CONFLICT DETECTED IN AVAILABLE DATA"
                }
                ApproachCheck(
                    chart = chart,
                    weatherLine = weatherLine,
                    minimaSource = brief?.minimums.orEmpty(),
                    relatedNotams = related,
                    assessment = assessment
                )
            }
    }

    fun changeInsights(context: Context, icao: String): List<ChangeInsight> {
        val changes = ChartChangesStore.airport(context, icao)
        val result = mutableListOf<ChangeInsight>()

        changes.changes.forEach { change ->
            val source = (change.procedure + " " + change.index).uppercase(Locale.US)
            val category = when {
                listOf("FREQ", "ILS", "LOC", "VOR", "NDB", "DME").any(source::contains) -> "NAVAID / FREQUENCY"
                listOf("MINIMUM", "MDA", "DA", "DH").any(source::contains) -> "MINIMUMS"
                listOf("MISSED", "MAP").any(source::contains) -> "MISSED APPROACH"
                listOf("RWY", "RUNWAY").any(source::contains) -> "RUNWAY"
                listOf("TAXI", "TWY", "APRON", "STAND").any(source::contains) -> "GROUND"
                else -> "PROCEDURE / CHART"
            }
            result += ChangeInsight(
                category,
                change.action + " • " + change.procedure.ifBlank { change.index },
                listOf(change.revisionDate, change.effectiveDate)
                    .filter { it.isNotBlank() }
                    .joinToString(" • ")
            )
        }

        changes.notices.forEach { notice ->
            val source = notice.text.uppercase(Locale.US)
            val category = when {
                listOf("FREQ", "ILS", "LOC", "VOR", "NDB", "DME").any(source::contains) -> "NAVAID / FREQUENCY"
                listOf("MINIMUM", "MDA", "DA", "DH").any(source::contains) -> "MINIMUMS"
                listOf("MISSED", "MAP").any(source::contains) -> "MISSED APPROACH"
                listOf("RWY", "RUNWAY").any(source::contains) -> "RUNWAY"
                listOf("TAXI", "TWY", "APRON", "STAND").any(source::contains) -> "GROUND"
                else -> "OFFICIAL NOTICE"
            }
            result += ChangeInsight(
                category,
                (notice.type.ifBlank { "NOTICE" }) + " • " + notice.effectivity,
                notice.text
            )
        }
        return result
    }

    fun flightPhase(
        location: Location?,
        destination: AirportGeoStore.Point?
    ): Pair<String, String> {
        if (location == null) return "UNKNOWN" to "Aircraft position unavailable"

        val speedKt = if (location.hasSpeed()) location.speed * 1.943844f else 0f
        val distanceNm = destination?.let {
            AirportGeoStore.distanceNm(location.latitude, location.longitude, it)
        }

        return when {
            speedKt < 35f -> "GROUND" to "Suggest AIRPORT / TAXI"
            distanceNm != null && distanceNm < 12.0 -> "APPROACH" to "Suggest APP"
            distanceNm != null && distanceNm < 50.0 -> "ARRIVAL" to "Suggest STAR / APP"
            speedKt < 120f -> "DEPARTURE" to "Suggest SID"
            else -> "ENROUTE" to "Keep destination brief ready"
        }
    }

    private fun request(url: URL, allowNoContent: Boolean = false): String {
        val connection = url.openConnection() as HttpURLConnection
        return try {
            connection.connectTimeout = 10000
            connection.readTimeout = 12000
            connection.requestMethod = "GET"
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("User-Agent", "JEPPIRAN-EFB-Lab/1.0 Taregh Msr")
            val code = connection.responseCode
            if (allowNoContent && code == 204) return ""
            if (code !in 200..299) {
                val body = connection.errorStream?.bufferedReader()?.use { it.readText() }.orEmpty()
                throw IllegalStateException("HTTP $code" + if (body.isBlank()) "" else ": " + body.take(160))
            }
            connection.inputStream.bufferedReader().use { it.readText().trim() }
        } finally {
            connection.disconnect()
        }
    }

    private fun formatEpoch(value: Long): String {
        val millis = if (value < 10_000_000_000L) value * 1000L else value
        return SimpleDateFormat("HH:mm'Z'", Locale.US).format(Date(millis))
    }
}
