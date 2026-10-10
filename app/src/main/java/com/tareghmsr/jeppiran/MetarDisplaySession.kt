package com.tareghmsr.jeppiran

import java.util.Locale

/** Weather display history shared by chart viewers for the current app session. */
internal class MetarDisplaySession {
    data class Report(val raw: String, val text: String)

    private val reports = mutableMapOf<String, Report>()
    private val displayed = mutableMapOf<String, String>()
    private val checkedAt = mutableMapOf<String, Long>()

    private fun airportKey(icao: String) = icao.trim().uppercase(Locale.US)

    private fun reportKey(raw: String) = raw.trim().uppercase(Locale.US)
        .replace(Regex("\\s+"), " ")
        .removePrefix("METAR ")
        .removeSuffix("=").trimEnd()

    fun remember(icao: String, report: Report) {
        if (reportKey(report.raw).isNotEmpty()) reports[airportKey(icao)] = report
    }

    fun latest(icao: String): Report? = reports[airportKey(icao)]

    fun hasDisplayed(icao: String): Boolean = displayed.containsKey(airportKey(icao))

    fun shouldAutoShow(icao: String, raw: String): Boolean {
        val key = reportKey(raw)
        return key.isNotEmpty() && displayed[airportKey(icao)] != key
    }

    fun markDisplayed(icao: String, raw: String) {
        val key = reportKey(raw)
        if (key.isNotEmpty()) displayed[airportKey(icao)] = key
    }

    fun recordCheck(icao: String, now: Long) {
        checkedAt[airportKey(icao)] = now
    }

    fun needsRefresh(icao: String, now: Long, interval: Long): Boolean {
        val lastCheck = checkedAt[airportKey(icao)] ?: return true
        return latest(icao) == null || now - lastCheck >= interval
    }

    fun nextRefreshDelay(icao: String, now: Long, interval: Long): Long {
        val lastCheck = checkedAt[airportKey(icao)] ?: return interval
        return (interval - (now - lastCheck)).coerceIn(1L, interval)
    }
}
