package com.tareghmsr.jeppiran

data class GeoPoint(val latitude: Double, val longitude: Double)

data class EnrouteFix(
    val ident: String,
    val position: GeoPoint
)

data class EnrouteNavaid(
    val ident: String,
    val type: String,
    val frequency: String?,
    val position: GeoPoint
)

data class EnrouteAirwaySegment(
    val airway: String,
    val level: String,
    val from: GeoPoint,
    val to: GeoPoint,
    val minAltitudeFt: Int? = null
)

data class EnrouteAirspace(
    val name: String,
    val airspaceClass: String?,
    val lower: String?,
    val upper: String?,
    val boundary: List<GeoPoint>
)

data class EnrouteDataset(
    val cycle: String,
    val source: String,
    val fixes: List<EnrouteFix>,
    val navaids: List<EnrouteNavaid>,
    val airways: List<EnrouteAirwaySegment>,
    val airspaces: List<EnrouteAirspace>
) {
    companion object {
        fun empty() = EnrouteDataset(
            cycle = "UNSET",
            source = "No en-route dataset installed",
            fixes = emptyList(),
            navaids = emptyList(),
            airways = emptyList(),
            airspaces = emptyList()
        )
    }
}
