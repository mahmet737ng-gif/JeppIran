package com.tareghmsr.jeppiran

import android.content.Context
import java.util.Locale

/**
 * Chooses the best airport-surface chart for the aircraft's current WGS84 position.
 *
 * The primary ADC is the fallback. A georeferenced parking/docking/taxi detail
 * chart wins only while the aircraft position is inside that chart's validated
 * geographic coverage. This lets the viewer enter a detail chart and return to
 * the ADC without inventing taxiway geometry.
 */
object SurfaceChartNavigator {

    data class Selection(
        val chart: ChartRepository.ChartInfo,
        val reason: String,
        val footprintScore: Double?
    )

    private fun normalized(value: String) =
        value.trim().uppercase(Locale.US)

    fun isPrimaryAdc(chart: ChartRepository.ChartInfo): Boolean {
        if (ChartRepository.normalizeCategory(chart.category) != "Airport") return false
        val name = normalized(chart.name)
        return name == "AIRPORT DIAGRAM CHART (ADC)" ||
            (name.contains("AIRPORT DIAGRAM") && !name.contains("CODE F"))
    }

    fun isSurfaceDetail(chart: ChartRepository.ChartInfo): Boolean {
        if (ChartRepository.normalizeCategory(chart.category) != "Airport") return false
        val name = normalized(chart.name)
        return name.contains("PARKING/DOCKING") ||
            name.contains("PARKING STANDS") ||
            name.contains("DOCKING") ||
            name.contains("TAXI ROUTES") ||
            name.contains("REMOTE PARK") ||
            name.contains("AIRPORT DIAGRAM CHART (ADC) - CODE F")
    }

    fun isSurfaceChart(chart: ChartRepository.ChartInfo): Boolean =
        isPrimaryAdc(chart) || isSurfaceDetail(chart)

    fun choose(
        context: Context,
        charts: List<ChartRepository.ChartInfo>,
        latitude: Double,
        longitude: Double,
        dataVersion: String
    ): Selection? {
        if (!latitude.isFinite() || !longitude.isFinite()) return null

        val surface = charts.filter { isSurfaceChart(it) }
        if (surface.isEmpty()) return null

        val detailMatches = surface
            .filter { isSurfaceDetail(it) }
            .filter {
                ChartGeoreferenceStore.containsPosition(
                    context,
                    it.page,
                    latitude,
                    longitude,
                    dataVersion
                )
            }
            .map {
                Selection(
                    chart = it,
                    reason = detailReason(it),
                    footprintScore = ChartGeoreferenceStore.geographicFootprintScore(
                        context,
                        it.page,
                        dataVersion
                    )
                )
            }
            .sortedWith(
                compareByDescending<Selection> { detailPriority(it.chart) }
                    .thenBy { it.footprintScore ?: Double.MAX_VALUE }
                    .thenBy { it.chart.page }
            )

        detailMatches.firstOrNull()?.let { return it }

        val adc = surface
            .filter { isPrimaryAdc(it) }
            .sortedBy { it.page }
            .firstOrNull {
                ChartGeoreferenceStore.containsPosition(
                    context,
                    it.page,
                    latitude,
                    longitude,
                    dataVersion
                )
            }
            ?: return null

        return Selection(
            chart = adc,
            reason = "PRIMARY ADC",
            footprintScore = ChartGeoreferenceStore.geographicFootprintScore(
                context,
                adc.page,
                dataVersion
            )
        )
    }

    private fun detailPriority(chart: ChartRepository.ChartInfo): Int {
        val name = normalized(chart.name)
        return when {
            name.contains("PARKING/DOCKING") -> 100
            name.contains("PARKING STANDS") -> 95
            name.contains("DOCKING") -> 90
            name.contains("REMOTE PARK") -> 85
            name.contains("TAXI ROUTES") -> 75
            name.contains("CODE F") -> 65
            else -> 50
        }
    }

    private fun detailReason(chart: ChartRepository.ChartInfo): String {
        val name = normalized(chart.name)
        return when {
            name.contains("PARKING/DOCKING") -> "PARKING / DOCKING AREA"
            name.contains("PARKING STANDS") -> "PARKING STAND AREA"
            name.contains("REMOTE PARK") -> "REMOTE PARK AREA"
            name.contains("TAXI ROUTES") -> "TAXI DETAIL AREA"
            name.contains("CODE F") -> "CODE F SURFACE AREA"
            else -> "SURFACE DETAIL AREA"
        }
    }
}
