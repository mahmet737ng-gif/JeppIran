package com.tareghmsr.jeppiran

import android.content.Context
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale

object OfflineBriefingStore {

    data class Result(
        val weather: Boolean,
        val notams: Boolean,
        val airportPdf: Boolean,
        val message: String
    )

    fun prefetch(context: Context, icao: String): Result {
        val key = icao.trim().uppercase(Locale.US)
        var weather = false
        var notams = false
        var pdf = false
        val notes = mutableListOf<String>()

        runCatching { FlightDataStore.fetch(context, key) }
            .onSuccess { weather = true }
            .onFailure { notes += "WX: " + (it.message ?: "failed") }

        runCatching { NotamStore.fetch(context, key) }
            .onSuccess { notams = true }
            .onFailure { notes += "NOTAM: " + (it.message ?: "failed") }

        runCatching {
            val repository = ChartRepository(context)
            val info = repository.getAirportPdfInfo(key)
            val target = File(
                context.filesDir,
                "airport_" + key + "_" + repository.getReleaseTag() + ".pdf"
            )
            val connection = URL(info.url).openConnection() as HttpURLConnection
            try {
                connection.connectTimeout = 12000
                connection.readTimeout = 30000
                connection.setRequestProperty("User-Agent", "JEPPIRAN/1.0 Taregh Msr")
                if (connection.responseCode !in 200..299) {
                    throw IllegalStateException("HTTP " + connection.responseCode)
                }
                connection.inputStream.use { input ->
                    target.outputStream().use { output -> input.copyTo(output) }
                }
                if (target.length() <= 0L) error("Empty airport PDF")
                pdf = true
            } finally {
                connection.disconnect()
            }
        }.onFailure { notes += "Chart PDF: " + (it.message ?: "failed") }

        context.getSharedPreferences("jeppiran_offline_airports", Context.MODE_PRIVATE)
            .edit().putLong(key, System.currentTimeMillis()).apply()

        return Result(
            weather = weather,
            notams = notams,
            airportPdf = pdf,
            message = if (notes.isEmpty()) {
                "Airport data saved for offline use."
            } else {
                notes.joinToString("\n")
            }
        )
    }

    fun lastPrefetch(context: Context, icao: String): Long =
        context.getSharedPreferences("jeppiran_offline_airports", Context.MODE_PRIVATE)
            .getLong(icao.trim().uppercase(Locale.US), 0L)
}
