package com.tareghmsr.jeppiran

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class XPlaneMappingProtocolTest {
    @Test
    fun parsesForeFlightStyleGpsPacket() {
        val messages = XPlaneMappingProtocol.parseText(
            "XGPSX-Plane,-80.11,34.55,1200.1,359.05,55.6\u0000"
        )

        assertEquals(1, messages.size)
        val gps = messages.first() as XPlaneMappingMessage.Gps
        assertEquals("X-Plane", gps.simulatorName)
        assertEquals(-80.11, gps.longitude, 0.0001)
        assertEquals(34.55, gps.latitude, 0.0001)
        assertEquals(1200.1, gps.altitudeMeters, 0.01)
        assertEquals(359.05, gps.trackTrueDegrees, 0.001)
        assertEquals(55.6, gps.groundSpeedMps, 0.01)
    }

    @Test
    fun parsesAttitudePacketAndNormalizesHeading() {
        val messages = XPlaneMappingProtocol.parseText(
            "XATTX-Plane,361.2,0.1,-2.4"
        )

        assertEquals(1, messages.size)
        val att = messages.first() as XPlaneMappingMessage.Attitude
        assertEquals(1.2, att.trueHeadingDegrees, 0.001)
        assertEquals(0.1, att.pitchDegrees, 0.001)
        assertEquals(-2.4, att.rollDegrees, 0.001)
    }

    @Test
    fun ignoresMalformedAndUnrelatedPackets() {
        val messages = XPlaneMappingProtocol.parseText(
            "XTRAFFICX-Plane,168,33.8,-118.3,3000,0,1,180,120,TEST\nXGPSbad"
        )
        assertTrue(messages.isEmpty())
    }
}
