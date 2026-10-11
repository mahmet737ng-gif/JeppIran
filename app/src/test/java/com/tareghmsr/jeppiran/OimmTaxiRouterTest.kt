package com.tareghmsr.jeppiran

import org.junit.Assert.*
import org.junit.Test

class OimmTaxiRouterTest {
    private val testGraph = """
    {
      "nodes":{
        "A":{"lat":36.0,"lon":59.0},
        "B":{"lat":36.0,"lon":59.0005},
        "C":{"lat":36.0007,"lon":59.0005},
        "D":{"lat":36.0,"lon":59.001}
      },
      "edges":[
        {"from":"A","to":"B","taxiway":"A","bidirectional":true},
        {"from":"B","to":"D","taxiway":"B","bidirectional":true},
        {"from":"A","to":"C","taxiway":"C","bidirectional":true},
        {"from":"C","to":"D","taxiway":"D","bidirectional":true},
        {"from":"A","to":"D","taxiway":"BT13R","runway":true,"bidirectional":true},
        {"from":"B","to":"C","taxiway":"L","military":true}
      ],
      "stands":{"101":{"node":"A"},"109":{"node":"D"}},
      "taxiways":{"A":{"exitNode":"B"}},
      "holdNodes":{"B":{"taxiway":"A","runway":"13R/31L"}},
      "runwayBacktracks":{"BT13R":{"fromTaxiway":"A","requiresExplicitClearance":true}}
    }""".trimIndent()

    @Test fun safeStandToStandRouteUsesOnlyConnectedEdges() {
        val router = OimmTaxiRouter.fromJsonForTest(testGraph)
        val result = router.route("ST109", fromStand = "ST101")
        assertNull(result.error)
        assertEquals(listOf("A", "B", "D"), result.plan!!.nodeIds)
        assertEquals(listOf("A", "B"), result.plan!!.taxiways)
    }

    @Test fun automaticRunwayGoalStopsAtHoldShort() {
        val router = OimmTaxiRouter.fromJsonForTest(testGraph)
        val result = router.route("RWY 13R", fromStand = "ST101")
        assertNull(result.error)
        assertEquals("B", result.plan!!.nodeIds.last())
        assertTrue(result.plan!!.holdShort)
        assertTrue(router.route("31R", fromStand = "ST101").error!!.contains("no reviewed"))
    }

    @Test fun nearestLiveStandAndDeviationRemainWithinMappedGeometry() {
        val router = OimmTaxiRouter.fromJsonForTest(testGraph)
        val origin = OimmTaxiRouter.Point(36.0, 59.0)
        val result = router.route("ST109", position = origin)
        assertEquals("A", result.plan!!.nodeIds.first())
        assertTrue(router.deviation(result.plan!!, OimmTaxiRouter.Point(36.01, 59.01)) > 300)
        assertNull(router.route("ST109", position = OimmTaxiRouter.Point(0.0, 0.0)).plan)
    }
}
