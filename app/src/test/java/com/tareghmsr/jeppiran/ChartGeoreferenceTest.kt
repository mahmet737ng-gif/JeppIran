package com.tareghmsr.jeppiran

import org.junit.Assert.*
import org.junit.Test

class ChartGeoreferenceTest {
    // Measured source-page 42 grid, not a production location generator.
    private fun ahwaz() = GeoReference(42, 612.0, 792.0,
        GeoReferenceBounds(90.96, 179.04, 531.84, 498.96),
        listOf(31 + 10.0 / 60, 31 + 20.0 / 60).flatMap { lat ->
            listOf(48 + 40.0 / 60, 48 + 50.0 / 60, 49.0).mapIndexed { i, lon ->
                GeoReferencePoint(168.72 + i * 158.88,
                    if (lat < 31.3) 485.28 else 300.24, lat, lon)
            }
        })

    @Test fun independentStationMatchesItsPrintedSymbol() {
        val point = ahwaz().project(31 + 20.3 / 60, 48 + 45.9 / 60)!!
        assertEquals(261.48, point.first, 1.6)
        assertEquals(295.56, point.second, 1.6)
    }

    @Test fun exactCropAndRenderSizePreserveTheGroundPoint() {
        val ref = ahwaz()
        val lat = 31 + 20.3 / 60
        val lon = 48 + 45.9 / 60
        val pdf = ref.project(lat, lon)!!
        for (factor in listOf(2, 5)) {
            val width = 612 * factor
            val height = 792 * factor
            val crop = (height * .014f).toInt()
            val actual = ref.renderedPosition(lat, lon, 0.0, 612, 792,
                width, height, crop, width, height - crop)!!
            assertEquals(pdf.first * factor, actual.x.toDouble(), .001)
            assertEquals(pdf.second * factor - crop, actual.y.toDouble(), .001)
        }
        assertNull(ref.renderedPosition(lat, lon, 0.0, 600, 792, 1224, 1584, 22, 1224, 1562))
    }

    @Test fun invalidAndInconsistentDataCannotProduceAnAircraftMarker() {
        val ref = ahwaz()
        assertNull(ref.project(Double.NaN, 48.0))
        assertNull(ref.project(31.0, Double.POSITIVE_INFINITY))
        assertNull(ref.project(0.0, 0.0))
        assertFalse(ref.copy(points = ref.points.take(3)).isValid())
        val changed = ref.points.mapIndexed { i, p -> if (i == 0) p.copy(x = p.x + 10) else p }
        assertFalse(ref.copy(points = changed).isValid())
        assertFalse(ref.copy(points = List(4) { GeoReferencePoint(200.0, 300.0, 31.0, 48.0) }).isValid())
    }

    @Test fun insetsAreMaskedAndRotatedNorthUsesThePageOrientation() {
        val ref = ahwaz()
        val point = ref.project(31 + 20.3 / 60, 48 + 45.9 / 60)!!
        assertNull(ref.copy(excludedBounds = listOf(GeoReferenceBounds(
            point.first - 2, point.second - 2, point.first + 2, point.second + 2)))
            .project(31 + 20.3 / 60, 48 + 45.9 / 60))
        val rotated = GeoReference(1, 792.0, 612.0,
            GeoReferenceBounds(0.0, 0.0, 792.0, 612.0),
            ref.points.map { it.copy(x = it.y, y = 612 - it.x) })
        assertTrue(rotated.isValid())
        assertEquals(-90.0, rotated.renderedHeading(31.3, 0.0, 792, 612)!!.toDouble(), .001)
        assertEquals(0.0, rotated.renderedHeading(31.3, 90.0, 792, 612)!!.toDouble(), .001)
    }
}
