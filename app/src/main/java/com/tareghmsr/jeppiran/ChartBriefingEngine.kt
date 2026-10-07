package com.tareghmsr.jeppiran

import android.content.Context
import java.util.Locale

object ChartBriefingEngine {

    enum class Phase { DEPARTURE, APPROACH, GENERAL }

    data class Row(
        val label: String,
        val value: String,
        val caution: Boolean = false
    )

    data class Section(
        val key: String,
        val title: String,
        val rows: List<Row>
    )

    data class Weather(
        val raw: String,
        val ceiling: String,
        val visibility: String?
    )

    data class Brief(
        val phase: Phase,
        val title: String,
        val subtitle: String,
        val weather: Weather?,
        val sections: List<Section>,
        val notams: List<NotamStore.Notam>
    )

    fun build(
        context: Context,
        icao: String,
        category: String,
        chartTitle: String,
        page: Int,
        metar: String = ""
    ): Brief {

        val upper = (category + " " + chartTitle).uppercase(Locale.US)

        val phase = when {
            "SID" in upper || "DEPART" in upper || "TAKEOFF" in upper ->
                Phase.DEPARTURE

            "APP" in upper || "ILS" in upper || "LOC" in upper ||
                "VOR" in upper || "NDB" in upper ||
                "RNAV" in upper || "RNP" in upper ->
                Phase.APPROACH

            else ->
                Phase.GENERAL
        }

        val cached = NotamStore.cached(context, icao)?.items.orEmpty()
        val approach = ApproachBriefStore.forPage(context, page)

        val relevant = when (phase) {
            Phase.APPROACH ->
                NotamStore.relevantToApproach(cached, chartTitle)
                    .filter {
                        it.category in setOf(
                            "RUNWAY",
                            "APPROACH / NAVAID",
                            "LIGHTING",
                            "COMMUNICATIONS",
                            "OBSTACLES",
                            "AERODROME"
                        )
                    }

            Phase.DEPARTURE ->
                cached.filter {
                    it.category in setOf(
                        "RUNWAY",
                        "TAXIWAY / APRON",
                        "COMMUNICATIONS",
                        "OBSTACLES",
                        "AIRSPACE",
                        "AERODROME",
                        "LIGHTING"
                    )
                }

            else ->
                emptyList()
        }

        val sections = mutableListOf<Section>()

        if (phase == Phase.APPROACH) {
            sections += Section(
                key = "overview",
                title = "APPROACH SUMMARY",
                rows = listOf(
                    Row(
                        "Approach",
                        approach?.name?.ifBlank { chartTitle } ?: chartTitle
                    ),
                    Row(
                        "Course",
                        approach?.course?.ifBlank {
                            "Verify final approach course on chart"
                        } ?: "Verify final approach course on chart"
                    ),
                    Row(
                        "Minimums",
                        approach?.minimums?.ifBlank {
                            "Verify published chart minima"
                        } ?: "Verify published chart minima"
                    ),
                    Row(
                        "Frequencies",
                        approach?.frequencies
                            ?.take(6)
                            ?.joinToString("  •  ")
                            ?.ifBlank { "Verify chart" }
                            ?: "Verify chart"
                    )
                )
            )

            sections += Section(
                key = "descent",
                title = "DESCENT & ALTITUDES",
                rows = listOf(
                    Row(
                        "Profile",
                        "Review applicable minimum altitudes and altitude constraints"
                    ),
                    Row(
                        "Stabilized",
                        "Confirm stabilized approach gate and required configuration"
                    ),
                    Row(
                        "MAPt / DA-MDA",
                        "Cross-check decision / missed-approach point against chart"
                    )
                )
            )

            sections += Section(
                key = "approach",
                title = "APPROACH SETUP",
                rows = listOf(
                    Row(
                        "Landing config",
                        "Flap and autobrake per SOP, runway condition and landing distance"
                    ),
                    Row(
                        "NAV setup",
                        "Set and cross-check required navigation equipment"
                    ),
                    Row(
                        "Runway",
                        "Confirm landing runway, condition and available distance"
                    )
                )
            )

            sections += Section(
                key = "missed",
                title = "MISSED APPROACH",
                rows = listOf(
                    Row(
                        "Procedure",
                        approach?.missedApproach?.ifBlank {
                            "Read and confirm published missed approach"
                        } ?: "Read and confirm published missed approach"
                    ),
                    Row(
                        "NAV / MCP",
                        "Preselect and cross-check missed-approach navigation setup"
                    )
                )
            )

        } else {
            sections += Section(
                key = "overview",
                title = "DEPARTURE SUMMARY",
                rows = listOf(
                    Row("Procedure", chartTitle),
                    Row(
                        "Runway",
                        extractRunway(chartTitle)
                            .ifBlank { "Confirm assigned runway" }
                    ),
                    Row(
                        "Clearance",
                        "Cross-check SID, runway and initial ATC clearance"
                    ),
                    Row(
                        "NAV / MCP",
                        "Verify FMS route, MCP and navigation setup before briefing"
                    )
                )
            )

            sections += Section(
                key = "route",
                title = "ROUTE & ALTITUDES",
                rows = listOf(
                    Row(
                        "Initial segment",
                        "Follow published SID and ATC clearance"
                    ),
                    Row(
                        "Restrictions",
                        "Review altitude and speed restrictions"
                    ),
                    Row(
                        "Terrain",
                        "Confirm transition altitude, MSA and engine-out considerations"
                    )
                )
            )

            sections += Section(
                key = "climb",
                title = "CLIMB & SPEED",
                rows = listOf(
                    Row(
                        "Initial climb",
                        "Verify initial track / heading and first cleared altitude"
                    ),
                    Row(
                        "Speed",
                        "Apply SID / ATC / SOP speed restrictions"
                    ),
                    Row(
                        "Acceleration",
                        "Set acceleration / flap retraction strategy per SOP"
                    )
                )
            )

            sections += Section(
                key = "restrictions",
                title = "OPERATIONAL ITEMS",
                rows = listOf(
                    Row(
                        "Takeoff setup",
                        "Flaps, thrust, V-speeds and performance per SOP"
                    ),
                    Row(
                        "Aircraft status",
                        "Review MEL/CDL and operational limitations"
                    ),
                    Row(
                        "Threats",
                        "Weather, runway condition, NOTAM and taxi routing"
                    )
                )
            )
        }

        if (relevant.isNotEmpty()) {
            sections += Section(
                key = "airport",
                title = "OPERATIONAL NOTAMS",
                rows = relevant
                    .take(4)
                    .map {
                        Row(
                            label = it.category,
                            value = compactNotam(it),
                            caution = true
                        )
                    }
            )
        }

        return Brief(
            phase = phase,
            title = if (phase == Phase.APPROACH) {
                "APPROACH BRIEFING"
            } else {
                "DEPARTURE BRIEFING"
            },
            subtitle = "$icao  •  $chartTitle",
            weather = parseWeather(metar),
            sections = sections,
            notams = relevant
        )
    }

    private fun parseWeather(value: String): Weather? {
        if (value.isBlank() || "no cached report" in value.lowercase(Locale.US)) {
            return null
        }

        val raw = value
            .substringAfterLast("•")
            .trim()
            .ifBlank { value.trim() }

        val ceilingLayers =
            Regex("""\b(BKN|OVC|VV)(\d{3})\b""")
                .findAll(raw.uppercase(Locale.US))
                .mapNotNull { match ->
                    val feet = match.groupValues[2].toIntOrNull()?.times(100)
                    if (feet != null && feet < 20000) {
                        match.groupValues[1] to feet
                    } else {
                        null
                    }
                }
                .toList()

        val lowest = ceilingLayers.minByOrNull { it.second }

        val ceiling =
            if (lowest == null) {
                "No ceiling"
            } else {
                "${lowest.second} ft ${lowest.first}"
            }

        val visibility = parseVisibility(raw)

        return Weather(
            raw = raw,
            ceiling = ceiling,
            visibility = visibility
        )
    }

    private fun parseVisibility(raw: String): String? {
        val upper = raw.uppercase(Locale.US)

        if ("CAVOK" in upper) {
            return null
        }

        val tokens = upper.split(Regex("""\s+"""))
        val windIndex = tokens.indexOfFirst {
            Regex("""^\d{3}\d{2}(?:G\d{2})?KT$""").matches(it) ||
                Regex("""^VRB\d{2}(?:G\d{2})?KT$""").matches(it)
        }

        if (windIndex >= 0) {
            for (i in windIndex + 1 until minOf(tokens.size, windIndex + 5)) {
                val token = tokens[i]
                if (Regex("""^\d{4}$""").matches(token)) {
                    val metres = token.toIntOrNull() ?: continue
                    if (metres < 5000) {
                        return "$metres m"
                    }
                    return null
                }
            }
        }

        val sm = Regex("""\b(\d+(?:\.\d+)?)SM\b""").find(upper)
        val miles = sm?.groupValues?.getOrNull(1)?.toDoubleOrNull()
        if (miles != null && miles * 1609.344 < 5000.0) {
            return String.format(Locale.US, "%.1f SM", miles)
        }

        return null
    }

    private fun compactNotam(notam: NotamStore.Notam): String {
        val normalized = notam.text
            .replace(Regex("""\s+"""), " ")
            .trim()

        val compact =
            if (normalized.length <= 180) {
                normalized
            } else {
                normalized.take(177).trimEnd() + "…"
            }

        return if (notam.id.isBlank()) {
            compact
        } else {
            notam.id + "  " + compact
        }
    }

    private fun extractRunway(text: String): String =
        Regex(
            """(?:RWY|RUNWAY)\s*([0-9]{2}[LRC]?)""",
            RegexOption.IGNORE_CASE
        )
            .find(text)
            ?.groupValues
            ?.getOrNull(1)
            .orEmpty()
}
