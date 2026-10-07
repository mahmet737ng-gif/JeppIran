package com.tareghmsr.jeppiran

import android.content.Context
import java.util.Locale

object ChartBriefingEngine {
    enum class Phase { DEPARTURE, APPROACH, GENERAL }
    data class Row(val label:String,val value:String,val caution:Boolean=false)
    data class Section(val title:String,val rows:List<Row>)
    data class Brief(val phase:Phase,val title:String,val subtitle:String,val sections:List<Section>,val notams:List<NotamStore.Notam>)

    fun build(context:Context, icao:String, category:String, chartTitle:String, page:Int):Brief {
        val u=(category+" "+chartTitle).uppercase(Locale.US)
        val phase=when {
            "SID" in u || "DEPART" in u || "TAKEOFF" in u -> Phase.DEPARTURE
            "APP" in u || "ILS" in u || "LOC" in u || "VOR" in u || "NDB" in u || "RNAV" in u || "RNP" in u -> Phase.APPROACH
            else -> Phase.GENERAL
        }
        val cached=NotamStore.cached(context,icao)?.items.orEmpty()
        val approach=ApproachBriefStore.forPage(context,page)
        val relevant=if(phase==Phase.APPROACH) NotamStore.relevantToApproach(cached,chartTitle) else {
            cached.filter { it.category in setOf("RUNWAY","TAXIWAY / APRON","COMMUNICATIONS","OBSTACLES","AIRSPACE","AERODROME","LIGHTING") }
        }
        val sections=mutableListOf<Section>()
        if(phase==Phase.APPROACH) {
            sections += Section("APPROACH SUMMARY", listOf(
                Row("Approach", approach?.name?.ifBlank { chartTitle } ?: chartTitle),
                Row("Course", approach?.course?.ifBlank { "Read from current chart" } ?: "Read from current chart"),
                Row("Minimums", approach?.minimums?.ifBlank { "Verify chart minima" } ?: "Verify chart minima"),
                Row("Frequencies", approach?.frequencies?.joinToString("  •  ")?.ifBlank { "Verify chart" } ?: "Verify chart")
            ))
            sections += Section("DESCENT & APPROACH", listOf(
                Row("Profile", "Review altitude constraints and stabilized approach gate"),
                Row("Landing config", "Set flap / autobrake per SOP and runway condition"),
                Row("Runway", "Confirm landing runway, condition and available distance")
            ))
            sections += Section("MISSED APPROACH", listOf(
                Row("Procedure", approach?.missedApproach?.ifBlank { "Read and confirm published missed approach" } ?: "Read and confirm published missed approach"),
                Row("NAV / MCP", "Preselect and cross-check required navigation setup")
            ))
        } else {
            sections += Section("DEPARTURE SUMMARY", listOf(
                Row("Procedure", chartTitle),
                Row("Runway", extractRunway(chartTitle).ifBlank { "Confirm assigned runway" }),
                Row("Clearance", "Cross-check SID / runway / initial clearance"),
                Row("NAV / MCP", "Verify FMS route, MCP and navigation setup")
            ))
            sections += Section("ROUTE & ALTITUDES", listOf(
                Row("Initial segment", "Follow current SID chart and ATC clearance"),
                Row("Restrictions", "Review altitude / speed constraints on chart"),
                Row("Terrain", "Confirm MSA and engine-out considerations")
            ))
            sections += Section("OPERATIONAL ITEMS", listOf(
                Row("Takeoff setup", "Flaps, thrust, V-speeds and performance per SOP"),
                Row("Aircraft status", "Review MEL/CDL and operational limitations"),
                Row("Threats", "Weather, runway condition, NOTAM and taxi routing")
            ))
        }
        if(relevant.isNotEmpty()) sections += Section("OPERATIONAL NOTAMS", relevant.take(6).map {
            Row(it.category, (if(it.id.isBlank()) "" else it.id+"  ")+it.text, true)
        })
        return Brief(phase, if(phase==Phase.APPROACH) "APPROACH BRIEFING" else "DEPARTURE BRIEFING",
            "$icao  •  $chartTitle",sections,relevant)
    }

    private fun extractRunway(text:String):String =
        Regex("""(?:RWY|RUNWAY)\s*([0-9]{2}[LRC]?)""",RegexOption.IGNORE_CASE).find(text)?.groupValues?.getOrNull(1).orEmpty()
}
