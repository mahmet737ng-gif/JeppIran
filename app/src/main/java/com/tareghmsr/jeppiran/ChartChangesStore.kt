package com.tareghmsr.jeppiran

import android.content.Context
import org.json.JSONObject
import java.util.Locale

data class ChartCycleChange(
    val action: String,
    val procedure: String,
    val index: String,
    val revisionDate: String,
    val effectiveDate: String
)

data class TerminalChangeNotice(
    val type: String,
    val effectivity: String,
    val beginDate: String,
    val endDate: String,
    val text: String
)

data class AirportChartChanges(
    val icao: String,
    val changes: List<ChartCycleChange>,
    val notices: List<TerminalChangeNotice>
) {
    val added: Int
        get() = changes.count { it.action == "ADD" }

    val revised: Int
        get() = changes.count { it.action == "REV" }

    val deleted: Int
        get() = changes.count { it.action == "DEL" }

    fun hasAny(): Boolean =
        changes.isNotEmpty() ||
            notices.isNotEmpty()

    fun badgeText(): String =
        buildList {
            if (added > 0) add("${added} Added")
            if (revised > 0) add("${revised} Revised")
            if (deleted > 0) add("${deleted} Deleted")
            if (notices.isNotEmpty()) add("${notices.size} Notice")
        }
            .joinToString(
                " • "
            )
}

object ChartChangesStore {

    private const val ASSET =
        "chart-changes.json"


    fun airport(
        context: Context,
        icao: String
    ):
        AirportChartChanges {

        val key =
            icao
                .trim()
                .uppercase(
                    Locale.US
                )

        val root =
            loadRoot(
                context
            )

        val airport =
            root
                ?.optJSONObject(
                    "airports"
                )
                ?.optJSONObject(
                    key
                )


        if (
            airport ==
            null
        ) {

            return AirportChartChanges(
                key,
                emptyList(),
                emptyList()
            )
        }


        val changes =
            mutableListOf<ChartCycleChange>()

        airport
            .optJSONArray(
                "summary"
            )
            ?.let {
                array ->

                for (
                    i in
                        0 until
                            array.length()
                ) {

                    val item =
                        array.optJSONObject(
                            i
                        )
                            ?: continue

                    changes.add(
                        ChartCycleChange(
                            item.optString(
                                "action"
                            )
                                .trim()
                                .uppercase(
                                    Locale.US
                                ),
                            item.optString(
                                "procedure"
                            )
                                .trim(),
                            item.optString(
                                "index"
                            )
                                .trim()
                                .uppercase(
                                    Locale.US
                                ),
                            item.optString(
                                "revisionDate"
                            )
                                .trim(),
                            item.optString(
                                "effectiveDate"
                            )
                                .trim()
                        )
                    )
                }
            }


        val notices =
            mutableListOf<TerminalChangeNotice>()

        airport
            .optJSONArray(
                "notices"
            )
            ?.let {
                array ->

                for (
                    i in
                        0 until
                            array.length()
                ) {

                    val item =
                        array.optJSONObject(
                            i
                        )
                            ?: continue

                    notices.add(
                        TerminalChangeNotice(
                            item.optString(
                                "type"
                            )
                                .trim(),
                            item.optString(
                                "effectivity"
                            )
                                .trim(),
                            item.optString(
                                "beginDate"
                            )
                                .trim(),
                            item.optString(
                                "endDate"
                            )
                                .trim(),
                            item.optString(
                                "text"
                            )
                                .trim()
                        )
                    )
                }
            }


        return AirportChartChanges(
            key,
            changes,
            notices
        )
    }


    fun hasChanges(
        context: Context,
        icao: String
    ):
        Boolean =
        airport(
            context,
            icao
        )
            .hasAny()


    fun allChangedAirports(
        context: Context
    ):
        Set<String> {

        val airports =
            loadRoot(
                context
            )
                ?.optJSONObject(
                    "airports"
                )
                ?: return emptySet()

        val result =
            mutableSetOf<String>()

        val keys =
            airports.keys()

        while (
            keys.hasNext()
        ) {

            val icao =
                keys.next()

            if (
                airport(
                    context,
                    icao
                )
                    .hasAny()
            ) {

                result.add(
                    icao
                )
            }
        }

        return result
    }


    private fun loadRoot(
        context: Context
    ):
        JSONObject? {

        val raw =
            ChartUpdateStore
                .readChanges(
                    context
                )
                ?: runCatching {

                    context.assets
                        .open(
                            ASSET
                        )
                        .bufferedReader()
                        .use {
                            it.readText()
                        }
                }
                    .getOrNull()
                ?: return null

        return runCatching {
            JSONObject(
                raw
            )
        }
            .getOrNull()
    }
}
