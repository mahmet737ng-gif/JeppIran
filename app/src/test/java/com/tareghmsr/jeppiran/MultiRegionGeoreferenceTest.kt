package com.tareghmsr.jeppiran

import org.junit.Assert.*
import org.junit.Test

/**
 * Synthetic geometry only: exercises rendering of separate independently
 * calibrated regions. These coordinates are NOT published aeronautical data.
 */
class MultiRegionGeoreferenceTest {

    private fun region(
        x0: Double, y0: Double
    ): GeoReference {
        val controls = listOf(
            GeoReferencePoint(x0, y0 + 100.0, 31.0, 48.0),
            GeoReferencePoint(x0 + 100.0, y0 + 100.0, 31.0, 48.01),
            GeoReferencePoint(x0, y0, 31.01, 48.0),
            GeoReferencePoint(x0 + 100.0, y0, 31.01, 48.01)
        )
        return GeoReference(
            page = 42,
            width = 612.0,
            height = 792.0,
            bounds = GeoReferenceBounds(x0 - 5, y0 - 5,
                x0 + 105, y0 + 105),
            points = controls,
            verifiedFootprint = listOf(
                x0 to y0,
                (x0 + 100) to y0,
                (x0 + 100) to (y0 + 100),
                x0 to (y0 + 100)
            )
        )
    }

    @Test fun sameGroundPositionProducesTwoIndependentMarkers() {
        val main = region(100.0, 300.0)
        val inset = region(400.0, 550.0)
        assertTrue(main.isValid())
        assertTrue(inset.isValid())
        val mainMarker = main.renderedPosition(31.005, 48.005, 90.0,
            612, 792, 1224, 1584, 0, 0, 1224, 1584)!!
        val insetMarker = inset.renderedPosition(31.005, 48.005, 90.0,
            612, 792, 1224, 1584, 0, 0, 1224, 1584)!!
        assertEquals(300.0, mainMarker.x.toDouble(), 0.01)
        assertEquals(700.0, mainMarker.y.toDouble(), 0.01)
        assertEquals(900.0, insetMarker.x.toDouble(), 0.01)
        assertEquals(1200.0, insetMarker.y.toDouble(), 0.01)
    }

    @Test fun unverifiedExteriorProducesNoMarkers() {
        val main = region(100.0, 300.0)
        val inset = region(400.0, 550.0)
        assertNull(main.project(31.012, 48.005))
        assertNull(inset.project(31.012, 48.005))
        assertNull(inset.renderedPosition(31.02, 48.005, 90.0,
            612, 792, 1224, 1584, 0, 0, 1224, 1584))
    }
}
