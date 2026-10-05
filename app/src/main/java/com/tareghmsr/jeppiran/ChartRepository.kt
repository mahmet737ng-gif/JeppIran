package com.tareghmsr.jeppiran

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale

class ChartRepository(
    private val context: Context
) {

    data class AirportInfo(
        val icao: String,
        val airportName: String,
        val city: String
    )

    data class ChartInfo(
        val page: Int,
        val icao: String,
        val airportName: String,
        val city: String,
        val category: String,
        val chartNumber: String,
        val name: String
    )

    data class SearchResult(
        val page: Int,
        val icao: String,
        val airportName: String,
        val city: String,
        val category: String,
        val chartNumber: String,
        val name: String
    )

    companion object {

        private const val ASSET_FILE =
            "charts-app-v16.json"

        private val AIRPORTS =
            listOf(

                AirportInfo(
                    "LTFM",
                    "ISTANBUL",
                    "ISTANBUL"
                ),

                AirportInfo(
                    "OIAA",
                    "ABADAN",
                    "ABADAN"
                ),

                AirportInfo(
                    "OIAM",
                    "MAHSHAHR",
                    "MAHSHAHR"
                ),

                AirportInfo(
                    "OIAW",
                    "AHWAZ",
                    "AHWAZ"
                ),

                AirportInfo(
                    "OIBB",
                    "BUSHEHR",
                    "BUSHEHR"
                ),

                AirportInfo(
                    "OIBK",
                    "KISH",
                    "KISH"
                ),

                AirportInfo(
                    "OIBP",
                    "ASALOUYEH",
                    "ASALOUYEH"
                ),

                AirportInfo(
                    "OICC",
                    "KERMANSHAH",
                    "KERMANSHAH"
                ),

                AirportInfo(
                    "OICI",
                    "ILAM",
                    "ILAM"
                ),

                AirportInfo(
                    "OIFM",
                    "ISFAHAN",
                    "ISFAHAN"
                ),

                AirportInfo(
                    "OIGG",
                    "RASHT",
                    "RASHT"
                ),

                AirportInfo(
                    "OIHH",
                    "HAMADAN",
                    "HAMADAN"
                ),

                AirportInfo(
                    "OIIE",
                    "IMAM KHOMEINI",
                    "TEHRAN"
                ),

                AirportInfo(
                    "OIII",
                    "MEHRABAD",
                    "TEHRAN"
                ),

                AirportInfo(
                    "OIIP",
                    "KARAJ",
                    "KARAJ"
                ),

                AirportInfo(
                    "OIKK",
                    "KERMAN",
                    "KERMAN"
                ),

                AirportInfo(
                    "OIMB",
                    "BIRJAND",
                    "BIRJAND"
                ),

                AirportInfo(
                    "OIMM",
                    "MASHHAD",
                    "MASHHAD"
                ),

                AirportInfo(
                    "OIMN",
                    "BOJNURD",
                    "BOJNURD"
                ),

                AirportInfo(
                    "OIMS",
                    "SABZEVAR",
                    "SABZEVAR"
                ),

                AirportInfo(
                    "OING",
                    "GORGAN",
                    "GORGAN"
                ),

                AirportInfo(
                    "OINZ",
                    "SARI",
                    "SARI"
                ),

                AirportInfo(
                    "OISS",
                    "SHIRAZ",
                    "SHIRAZ"
                ),

                AirportInfo(
                    "OITL",
                    "ARDABIL",
                    "ARDABIL"
                ),

                AirportInfo(
                    "OITR",
                    "URMIA",
                    "URMIA"
                ),

                AirportInfo(
                    "OITT",
                    "TABRIZ",
                    "TABRIZ"
                ),

                AirportInfo(
                    "OIYY",
                    "YAZD",
                    "YAZD"
                ),

                AirportInfo(
                    "OIZC",
                    "CHABAHAR",
                    "CHABAHAR"
                ),

                AirportInfo(
                    "OIZH",
                    "ZAHEDAN",
                    "ZAHEDAN"
                ),

                AirportInfo(
                    "OMDB",
                    "DUBAI INTL",
                    "DUBAI"
                ),

                AirportInfo(
                    "OOMS",
                    "MUSCAT INTL",
                    "MUSCAT"
                ),

                AirportInfo(
                    "ORBI",
                    "BAGHDAD INTL",
                    "BAGHDAD"
                ),

                AirportInfo(
                    "ORNI",
                    "NAJAF",
                    "NAJAF"
                ),

                AirportInfo(
                    "UDYZ",
                    "ZVARTNOTS",
                    "YEREVAN"
                ),

                AirportInfo(
                    "UGSB",
                    "BATUMI",
                    "BATUMI"
                ),

                AirportInfo(
                    "UGTB",
                    "TBILISI",
                    "TBILISI"
                )
            )

        private val CATEGORY_ORDER =
            listOf(
                "Airport",
                "STAR",
                "SID",
                "Approach",
                "Other"
            )

        fun airports():
            List<AirportInfo> {

            return AIRPORTS.toList()
        }

        fun airport(
            icao: String
        ): AirportInfo? {

            val key =
                icao
                    .trim()
                    .uppercase(Locale.US)

            return AIRPORTS.firstOrNull {
                it.icao == key
            }
        }

        fun airportName(
            icao: String
        ): String {

            return airport(
                icao
            )?.airportName
                ?: ""
        }

        fun city(
            icao: String
        ): String {

            return airport(
                icao
            )?.city
                ?: ""
        }

        fun categoryOrder(
            category: String
        ): Int {

            val normalized =
                normalizeCategory(
                    category
                )

            val index =
                CATEGORY_ORDER.indexOf(
                    normalized
                )

            return if (
                index >= 0
            ) {
                index
            } else {
                CATEGORY_ORDER.size
            }
        }

        fun normalizeCategory(
            value: String
        ): String {

            return when (
                value
                    .trim()
                    .uppercase(Locale.US)
            ) {

                "AIRPORT" ->
                    "Airport"

                "STAR" ->
                    "STAR"

                "SID" ->
                    "SID"

                "APPROACH" ->
                    "Approach"

                else ->
                    "Other"
            }
        }
    }

    private var loaded =
        false

    private val chartList =
        mutableListOf<ChartInfo>()

    @Synchronized
    fun getAllCharts():
        List<ChartInfo> {

        ensureLoaded()

        return chartList.toList()
    }

    @Synchronized
    fun getChartsForAirport(
        icao: String
    ):
        List<ChartInfo> {

        ensureLoaded()

        val key =
            icao
                .trim()
                .uppercase(Locale.US)

        return chartList
            .filter {
                it.icao == key
            }
            .sortedBy {
                it.page
            }
    }

    @Synchronized
    fun getChartForPage(
        icao: String,
        page: Int
    ): ChartInfo? {

        ensureLoaded()

        val key =
            icao
                .trim()
                .uppercase(Locale.US)

        return chartList.firstOrNull {
            it.icao == key &&
                it.page == page
        }
    }

    fun search(
        query: String
    ):
        List<SearchResult> {

        ensureLoaded()

        val normalizedQuery =
            query
                .trim()
                .lowercase(Locale.US)

        if (
            normalizedQuery.isBlank()
        ) {
            return emptyList()
        }

        return chartList
            .mapNotNull { chart ->

                val airport =
                    airport(
                        chart.icao
                    )

                val fields =
                    listOf(
                        chart.icao,
                        chart.airportName,
                        chart.city,
                        chart.category,
                        chart.chartNumber,
                        chart.name
                    )

                val matches =
                    fields.any {
                        it.lowercase(
                            Locale.US
                        ).contains(
                            normalizedQuery
                        )
                    }

                if (
                    !matches
                ) {
                    return@mapNotNull null
                }

                SearchResult(
                    page =
                        chart.page,

                    icao =
                        chart.icao,

                    airportName =
                        airport?.airportName
                            ?: chart.airportName,

                    city =
                        airport?.city
                            ?: chart.city,

                    category =
                        chart.category,

                    chartNumber =
                        chart.chartNumber,

                    name =
                        chart.name
                )
            }
            .sortedWith(
                compareByDescending<SearchResult> {
                    exactMatchScore(
                        it,
                        normalizedQuery
                    )
                }
                    .thenBy {
                        it.icao
                    }
                    .thenBy {
                        it.page
                    }
            )
    }

    private fun exactMatchScore(
        result: SearchResult,
        query: String
    ): Int {

        val q =
            query.lowercase(
                Locale.US
            )

        if (
            result.icao.equals(
                q,
                ignoreCase = true
            )
        ) {
            return 1000
        }

        if (
            result.name.equals(
                q,
                ignoreCase = true
            )
        ) {
            return 900
        }

        if (
            result.chartNumber.equals(
                q,
                ignoreCase = true
            )
        ) {
            return 850
        }

        if (
            result.airportName.equals(
                q,
                ignoreCase = true
            )
        ) {
            return 800
        }

        if (
            result.city.equals(
                q,
                ignoreCase = true
            )
        ) {
            return 750
        }

        if (
            result.category.equals(
                q,
                ignoreCase = true
            )
        ) {
            return 700
        }

        if (
            result.icao.contains(
                q,
                ignoreCase = true
            )
        ) {
            return 600
        }

        if (
            result.name.contains(
                q,
                ignoreCase = true
            )
        ) {
            return 500
        }

        if (
            result.chartNumber.contains(
                q,
                ignoreCase = true
            )
        ) {
            return 450
        }

        if (
            result.airportName.contains(
                q,
                ignoreCase = true
            )
        ) {
            return 400
        }

        if (
            result.city.contains(
                q,
                ignoreCase = true
            )
        ) {
            return 350
        }

        return 100
    }

    @Synchronized
    fun reload() {

        loaded =
            false

        chartList.clear()

        ensureLoaded()
    }

    private fun ensureLoaded() {

        if (
            loaded
        ) {
            return
        }

        chartList.clear()

        try {

            val raw =
                context.assets
                    .open(
                        ASSET_FILE
                    )
                    .bufferedReader()
                    .use {
                        it.readText()
                    }
                    .trim()

            if (
                raw.startsWith("[")
            ) {

                readArray(
                    JSONArray(
                        raw
                    )
                )

            } else {

                val root =
                    JSONObject(
                        raw
                    )

                val arrayKeys =
                    listOf(
                        "charts",
                        "data",
                        "items",
                        "pages"
                    )

                var arrayLoaded =
                    false

                for (
                    key in arrayKeys
                ) {

                    val value =
                        root.opt(
                            key
                        )

                    if (
                        value is JSONArray
                    ) {

                        readArray(
                            value
                        )

                        arrayLoaded =
                            true

                        break
                    }
                }

                if (
                    !arrayLoaded
                ) {

                    val keys =
                        root.keys()

                    while (
                        keys.hasNext()
                    ) {

                        val key =
                            keys.next()

                        val value =
                            root.opt(
                                key
                            )

                        if (
                            value is JSONObject
                        ) {

                            readChartObject(
                                value
                            )
                        }
                    }
                }
            }

            chartList.sortBy {
                it.page
            }

            loaded =
                true

        } catch (
            _: Exception
        ) {

            loaded =
                true
        }
    }

    private fun readArray(
        array: JSONArray
    ) {

        for (
            index in 0 until array.length()
        ) {

            val item =
                array.optJSONObject(
                    index
                )
                    ?: continue

            readChartObject(
                item
            )
        }
    }

    private fun readChartObject(
        item: JSONObject
    ) {

        val itemIcao =
            firstNonEmpty(
                item.optString(
                    "icao"
                ),
                item.optString(
                    "airport"
                ),
                item.optString(
                    "airport_icao"
                )
            )
                .uppercase(Locale.US)

        if (
            itemIcao.isBlank()
        ) {
            return
        }

        val page =
            firstPositiveInt(
                item.optInt(
                    "page",
                    -1
                ),
                item.optInt(
                    "pageNumber",
                    -1
                ),
                item.optInt(
                    "page_number",
                    -1
                )
            )

        if (
            page <= 0
        ) {
            return
        }

        val category =
            normalizeCategory(
                firstNonEmpty(
                    item.optString(
                        "category"
                    ),
                    item.optString(
                        "type"
                    ),
                    item.optString(
                        "chart_type"
                    ),
                    "Other"
                )
            )

        val chartNumber =
            firstNonEmpty(
                item.optString(
                    "chart_number"
                ),
                item.optString(
                    "chartNumber"
                ),
                item.optString(
                    "chart_no"
                ),
                item.optString(
                    "number"
                )
            )

        val rawName =
            firstNonEmpty(
                item.optString(
                    "name"
                ),
                item.optString(
                    "title"
                ),
                item.optString(
                    "chart_name"
                )
            )

        val cleanName =
            buildDisplayName(
                rawName,
                category,
                chartNumber
            )

        val info =
            airport(
                itemIcao
            )

        chartList.add(
            ChartInfo(
                page =
                    page,

                icao =
                    itemIcao,

                airportName =
                    info?.airportName
                        ?: itemIcao,

                city =
                    info?.city
                        ?: itemIcao,

                category =
                    category,

                chartNumber =
                    chartNumber,

                name =
                    cleanName
            )
        )
    }

    private fun buildDisplayName(
        rawName: String,
        category: String,
        chartNumber: String
    ): String {

        val clean =
            rawName
                .trim()

        val placeholder =
            clean.isBlank() ||
                clean.matches(
                    Regex(
                        "(?i)chart\\s*page\\s*\\d+"
                    )
                )

        if (
            !placeholder
        ) {
            return clean
        }

        if (
            chartNumber.isNotBlank()
        ) {

            return category
                .uppercase(Locale.US) +
                " " +
                chartNumber
                    .trim()
        }

        return category
            .uppercase(Locale.US) +
            " CHART"
    }

    private fun firstNonEmpty(
        vararg values: String
    ): String {

        return values
            .firstOrNull {
                it.trim().isNotEmpty()
            }
            ?.trim()
            ?: ""
    }

    private fun firstPositiveInt(
        vararg values: Int
    ): Int {

        return values
            .firstOrNull {
                it > 0
            }
            ?: -1
    }
}
