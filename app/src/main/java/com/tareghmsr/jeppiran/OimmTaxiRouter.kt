package com.tareghmsr.jeppiran

import android.content.Context
import org.json.JSONObject
import java.util.PriorityQueue
import kotlin.math.cos
import kotlin.math.hypot

/**
 * Simulator-only OIMM ground network. No fabricated taxiway connection or
 * implicit runway access. This uses the SAME V2621 ground JSON as the web PWA.
 */
internal class OimmTaxiRouter private constructor(private val graph: JSONObject) {
    data class Point(val lat: Double, val lon: Double)
    data class Plan(
        val destination: String, val nodes: List<Point>, val nodeIds: List<String>,
        val taxiways: List<String>, val metres: Int, val holdShort: Boolean
    )
    data class Result(val plan: Plan? = null, val error: String? = null)

    private data class Link(val to: String, val metres: Double, val way: String)
    private data class QueueItem(val node: String, val cost: Double)

    private val nodes = mutableMapOf<String, Point>()
    private val links = mutableMapOf<String, MutableList<Link>>()
    private val stands = mutableMapOf<String, String>()
    private val holdNodes = mutableSetOf<String>()
    private val runwayHolds = mutableMapOf<String, String>()
    private val routable = mutableSetOf<String>()

    init {
        val all = graph.getJSONObject("nodes")
        val ids = all.keys()
        while (ids.hasNext()) {
            val id = ids.next()
            val p = all.getJSONObject(id)
            nodes[id] = Point(p.getDouble("lat"), p.getDouble("lon"))
        }
        val positions = graph.getJSONObject("stands")
        val standIds = positions.keys()
        while (standIds.hasNext()) {
            val id = standIds.next()
            val obj = positions.get(id)
            stands[id] = if (obj is JSONObject) obj.getString("node") else obj.toString()
        }
        val holds = graph.optJSONObject("holdNodes")
        if (holds != null) {
            val keys = holds.keys()
            while (keys.hasNext()) holdNodes.add(keys.next())
        }
        val taxiways = graph.getJSONObject("taxiways")
        val backtracks = graph.optJSONObject("runwayBacktracks")
        if (backtracks != null) {
            val keys = backtracks.keys()
            while (keys.hasNext()) {
                val token = keys.next()
                val entry = backtracks.getJSONObject(token)
                val exitWay = entry.optString("fromTaxiway")
                val hold = taxiways.optJSONObject(exitWay)?.optString("exitNode").orEmpty()
                if (token.startsWith("BT") && holdNodes.contains(hold) && nodes.containsKey(hold)) {
                    runwayHolds[token.removePrefix("BT")] = hold
                }
            }
        }
        val edges = graph.getJSONArray("edges")
        for (i in 0 until edges.length()) {
            val e = edges.getJSONObject(i)
            if (e.optBoolean("closed") || e.optBoolean("military") || e.optBoolean("runway")) continue
            val from = e.optString("from")
            val to = e.optString("to")
            val a = nodes[from] ?: continue
            val b = nodes[to] ?: continue
            val length = distance(a, b)
            if (length <= 0.00001 || length >= 12000.0) continue
            val label = e.optString("taxiway").uppercase()
            links.getOrPut(from) { mutableListOf() }.add(Link(to, length, label))
            if (e.optBoolean("bidirectional", true))
                links.getOrPut(to) { mutableListOf() }.add(Link(from, length, label))
            routable.add(from)
            routable.add(to)
        }
    }

    fun hasStand(stand: String): Boolean = stands.containsKey(stand.removePrefix("ST"))
    fun mappedRunways(): Set<String> = runwayHolds.keys
    fun standIds(): List<String> = stands.keys.sortedBy { it.toIntOrNull() ?: Int.MAX_VALUE }

    fun route(destinationText: String, fromStand: String? = null, position: Point? = null): Result {
        val dest = destinationText.trim().uppercase().replace("RUNWAY", "").replace("RWY", "").trim()
        val standCode = dest.removePrefix("ST").removePrefix("P")
        val isStand = stands.containsKey(standCode)
        val goal = if (isStand) stands.getValue(standCode) else runwayHolds[dest]
        if (goal == null) return Result(error = if (dest.matches(Regex("\\d{2}[LRC]?")))
            "RWY $dest: no reviewed hold/entry geometry. Refusing an invented route."
        else "Unknown stand/runway destination: $dest")

        val origin = fromStand?.let { stands[it.uppercase().removePrefix("ST")] }
            ?: position?.let { nearest(it) }
        if (origin == null) return Result(error =
            "No mapped ground centerline within 65 m. Connect simulator, set a start stand, or use the web SET START preview.")
        if (origin == goal) return Result(Plan(if (isStand) "ST$standCode" else "RWY $dest",
            listOfNotNull(nodes[goal]), listOf(goal), emptyList(), 0, !isStand))

        val starts = stands.values.toSet()
        val distances = hashMapOf(origin to 0.0)
        val parent = mutableMapOf<String, Pair<String, String>>()
        val queue = PriorityQueue(compareBy<QueueItem> { it.cost })
        queue.add(QueueItem(origin, 0.0))
        while (queue.isNotEmpty()) {
            val current = queue.remove()
            if (current.cost > (distances[current.node] ?: Double.POSITIVE_INFINITY)) continue
            if (current.node == goal) break
            for (e in links[current.node].orEmpty()) {
                if (e.to in starts && e.to != goal) continue
                if (current.node in starts && current.node != origin && current.node != goal) continue
                val score = current.cost + e.metres
                if (score >= (distances[e.to] ?: Double.POSITIVE_INFINITY)) continue
                distances[e.to] = score
                parent[e.to] = current.node to e.way
                queue.add(QueueItem(e.to, score))
            }
        }
        val metres = distances[goal] ?: return Result(error =
            "No connected civilian chart path. Runways, military areas and unmapped intersections remain blocked.")
        val trace = mutableListOf(goal)
        val reverseWays = mutableListOf<String>()
        var current = goal
        while (current != origin) {
            val p = parent[current] ?: return Result(error = "Disconnected predecessor graph.")
            reverseWays.add(p.second)
            current = p.first
            trace.add(current)
        }
        trace.reverse()
        val compact = mutableListOf<String>()
        for (way in reverseWays.asReversed()) {
            if (way !in listOf("APRON", "UNNAMED", "STAND") && compact.lastOrNull() != way)
                compact.add(way)
        }
        return Result(Plan(
            if (isStand) "ST$standCode" else "RWY $dest",
            trace.mapNotNull { nodes[it] }, trace, compact, metres.toInt(), !isStand
        ))
    }

    private fun nearest(location: Point): String? {
        var bestId: String? = null
        var best = 65.0
        for (id in routable) {
            val pos = nodes[id] ?: continue
            val d = distance(location, pos)
            if (d < best) { best = d; bestId = id }
        }
        return bestId
    }

    fun deviation(plan: Plan, position: Point): Double {
        var result = Double.POSITIVE_INFINITY
        val m = 111195.0
        val cosLat = cos(Math.toRadians(position.lat))
        for (i in 1 until plan.nodes.size) {
            val a = plan.nodes[i - 1]
            val b = plan.nodes[i]
            val ax = (a.lon - position.lon) * m * cosLat
            val ay = (a.lat - position.lat) * m
            val dx = (b.lon - a.lon) * m * cosLat
            val dy = (b.lat - a.lat) * m
            val length = dx * dx + dy * dy
            if (length < 1e-6) continue
            val t = (-(ax * dx + ay * dy) / length).coerceIn(0.0, 1.0)
            result = minOf(result, hypot(ax + t * dx, ay + t * dy))
        }
        return result
    }

    companion object {
        private val sha = "d86b5b5e262a775f8e91d28a403f4b163992dbdd1733ca28e1ba6e46ce8a7ab6"
        @Volatile private var cached: OimmTaxiRouter? = null

        @Synchronized fun load(context: Context): OimmTaxiRouter? {
            cached?.let { return it }
            return runCatching {
                val json = JSONObject(context.assets.open("OIMM.json").bufferedReader().use { it.readText() })
                require(json.getString("airport") == "OIMM")
                require(json.getString("cycle") == "2621")
                require(json.optBoolean("simulatorTestOnly") && !json.optBoolean("verified"))
                require(json.getJSONObject("source").getString("sha256") == sha)
                OimmTaxiRouter(json).also { cached = it }
            }.getOrNull()
        }

        // Used by JVM unit tests; never bypasses main load() chart identity checks.
        internal fun fromJsonForTest(json: String) = OimmTaxiRouter(JSONObject(json))

        fun distance(a: Point, b: Point): Double {
            val lat = Math.toRadians((a.lat + b.lat) / 2)
            return hypot((a.lat - b.lat) * 111195.0, (a.lon - b.lon) * 111195.0 * cos(lat))
        }
    }
}
