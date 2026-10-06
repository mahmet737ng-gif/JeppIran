package com.tareghmsr.jeppiran

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class FlightDataStoreTest {

    @Test
    fun cavokMeansTenKilometresOrMore() {
        assertEquals(
            10000,
            FlightDataStore.visibilityMeters(
                "OIII 061200Z 30005KT CAVOK 32/18 Q1013"
            )
        )
    }

    @Test
    fun qnhIsNotMistakenForVisibility() {
        assertNull(
            FlightDataStore.visibilityMeters(
                "OIII 061200Z 30005KT NSC 32/18 Q1013"
            )
        )
    }

    @Test
    fun metricVisibilityIsParsedAfterWind() {
        assertEquals(
            8000,
            FlightDataStore.visibilityMeters(
                "OIAW 061200Z 30005KT 8000 FEW020 SCT080 36/24 Q1001"
            )
        )
    }

    @Test
    fun metresPerSecondWindIsConvertedToKnots() {
        val wind =
            FlightDataStore.parseWind(
                "UGTB 061200Z 32010G15MPS 9999 SCT030 18/10 Q1016"
            )

        assertEquals(
            320,
            wind?.direction
        )

        assertEquals(
            19,
            wind?.speedKt
        )

        assertEquals(
            29,
            wind?.gustKt
        )
    }

    @Test
    fun runwayComponentsHaveExpectedDirection() {
        val component =
            FlightDataStore.components(
                FlightDataStore.Wind(
                    direction = 360,
                    speedKt = 20,
                    gustKt = null
                ),
                "36"
            )

        assertTrue(
            component != null
        )

        assertTrue(
            component!!.headwindKt >=
                19
        )

        assertTrue(
            component.crosswindKt <=
                1
        )
    }
}
