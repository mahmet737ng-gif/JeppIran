package com.tareghmsr.jeppiran

sealed class XPlaneMappingMessage {
    data class Gps(
        val simulatorName: String,
        val longitude: Double,
        val latitude: Double,
        val altitudeMeters: Double,
        val trackTrueDegrees: Double,
        val groundSpeedMps: Double
    ) : XPlaneMappingMessage()

    data class Attitude(
        val simulatorName: String,
        val trueHeadingDegrees: Double,
        val pitchDegrees: Double,
        val rollDegrees: Double
    ) : XPlaneMappingMessage()
}

object XPlaneMappingProtocol {
    fun parsePacket(data: ByteArray, length: Int): List<XPlaneMappingMessage> {
        if (length <= 0) return emptyList()
        val safeLength = length.coerceAtMost(data.size)
        val text = String(data, 0, safeLength, Charsets.US_ASCII)
        return parseText(text)
    }

    fun parseText(payload: String): List<XPlaneMappingMessage> {
        if (payload.isBlank()) return emptyList()

        return payload
            .replace('\u0000', '\n')
            .split('\r', '\n')
            .mapNotNull { parseLine(it.trim()) }
    }

    private fun parseLine(line: String): XPlaneMappingMessage? {
        if (line.isBlank()) return null

        return when {
            line.startsWith("XGPS", ignoreCase = false) -> parseGps(line.removePrefix("XGPS"))
            line.startsWith("XATT", ignoreCase = false) -> parseAttitude(line.removePrefix("XATT"))
            else -> null
        }
    }

    private fun parseGps(body: String): XPlaneMappingMessage.Gps? {
        val fields = body.split(',').map { it.trim() }
        if (fields.size < 6) return null

        val longitude = fields[1].toDoubleOrNull() ?: return null
        val latitude = fields[2].toDoubleOrNull() ?: return null
        val altitudeMeters = fields[3].toDoubleOrNull() ?: return null
        val track = fields[4].toDoubleOrNull() ?: return null
        val groundSpeed = fields[5].toDoubleOrNull() ?: return null

        if (latitude !in -90.0..90.0 || longitude !in -180.0..180.0) return null

        return XPlaneMappingMessage.Gps(
            simulatorName = fields[0].ifBlank { "X-Plane" },
            longitude = longitude,
            latitude = latitude,
            altitudeMeters = altitudeMeters,
            trackTrueDegrees = normalizeHeading(track),
            groundSpeedMps = groundSpeed.coerceAtLeast(0.0)
        )
    }

    private fun parseAttitude(body: String): XPlaneMappingMessage.Attitude? {
        val fields = body.split(',').map { it.trim() }
        if (fields.size < 4) return null

        val heading = fields[1].toDoubleOrNull() ?: return null
        val pitch = fields[2].toDoubleOrNull() ?: return null
        val roll = fields[3].toDoubleOrNull() ?: return null

        return XPlaneMappingMessage.Attitude(
            simulatorName = fields[0].ifBlank { "X-Plane" },
            trueHeadingDegrees = normalizeHeading(heading),
            pitchDegrees = pitch,
            rollDegrees = roll
        )
    }

    private fun normalizeHeading(value: Double): Double {
        val normalized = value % 360.0
        return if (normalized < 0.0) normalized + 360.0 else normalized
    }
}
