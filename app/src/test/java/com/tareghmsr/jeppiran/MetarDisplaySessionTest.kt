package com.tareghmsr.jeppiran

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class MetarDisplaySessionTest {
    private val first = "OICI 100300Z 32005KT CAVOK 18/06 Q1015"
    private val next = "OICI 100330Z 32005KT CAVOK 18/06 Q1015"
    private val interval = 5 * 60 * 1000L

    @Test fun switchingChartsOrReopeningViewerKeepsTheDisplayedReport() {
        val session = MetarDisplaySession()
        session.remember("OICI", MetarDisplaySession.Report(first, first))
        assertTrue(session.shouldAutoShow("OICI", first))
        session.markDisplayed("OICI", first)
        assertFalse(session.shouldAutoShow("OICI", session.latest("OICI")!!.raw))
        assertTrue(session.hasDisplayed("OICI"))
    }

    @Test fun eachAirportHasIndependentDisplayHistory() {
        val session = MetarDisplaySession()
        session.markDisplayed("OICI", first)
        val other = first.replace("OICI", "OIII")
        assertTrue(session.shouldAutoShow("OIII", other))
        session.markDisplayed("OIII", other)
        assertFalse(session.shouldAutoShow("OICI", first))
        assertFalse(session.shouldAutoShow(" oiii ", other))
    }

    @Test fun newObservationOrCorrectionCanReopenTheBanner() {
        val session = MetarDisplaySession()
        session.markDisplayed("OICI", first)
        assertTrue(session.shouldAutoShow("OICI", next))
        assertTrue(session.shouldAutoShow("OICI", first.replace("100300Z", "100300Z COR")))
        session.markDisplayed("OICI", next)
        assertFalse(session.shouldAutoShow("OICI", next))
    }

    @Test fun formattingAndCategoryChangesDoNotCountAsANewReport() {
        val session = MetarDisplaySession()
        session.markDisplayed("OICI", first)
        val formatted = "  METAR  ${first.lowercase().replace(" ", "\n  ")}=  "
        session.remember("OICI", MetarDisplaySession.Report(formatted, "OICI METAR • VFR • $formatted"))
        assertFalse(session.shouldAutoShow("OICI", session.latest("OICI")!!.raw))
    }

    @Test fun receivingAReportInBackgroundDoesNotMarkItDisplayed() {
        val session = MetarDisplaySession()
        session.markDisplayed("OICI", first)
        session.remember("OICI", MetarDisplaySession.Report(next, next))
        assertTrue(session.shouldAutoShow("OICI", session.latest("OICI")!!.raw))
    }

    @Test fun manuallyShownReportIsNotRepeatedAutomatically() {
        val session = MetarDisplaySession()
        session.remember("OICI", MetarDisplaySession.Report(first, first))
        session.markDisplayed("OICI", first)
        assertFalse(session.shouldAutoShow("OICI", first))
        assertEquals(first, session.latest("OICI")!!.text)
    }

    @Test fun chartChangesPreserveTheFiveMinuteRefreshDeadline() {
        val session = MetarDisplaySession()
        session.remember("OICI", MetarDisplaySession.Report(first, first))
        session.recordCheck("OICI", 1000L)
        assertFalse(session.needsRefresh("OICI", 1000L + interval - 1, interval))
        assertEquals(1L, session.nextRefreshDelay("OICI", 1000L + interval - 1, interval))
        assertTrue(session.needsRefresh("OICI", 1000L + interval, interval))
        assertEquals(interval, session.nextRefreshDelay("OIII", 1000L, interval))
    }

    @Test fun missingReportCanBeRetriedAndDoesNotConsumeFirstDisplay() {
        val session = MetarDisplaySession()
        session.recordCheck("OICI", 1000L)
        session.remember("OICI", MetarDisplaySession.Report(" ", "data available"))
        session.markDisplayed("OICI", "")
        assertNull(session.latest("OICI"))
        assertFalse(session.hasDisplayed("OICI"))
        assertTrue(session.needsRefresh("OICI", 1001L, interval))
        assertTrue(session.shouldAutoShow("OICI", first))
    }
}
