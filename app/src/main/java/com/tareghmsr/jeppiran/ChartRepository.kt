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


    data class AirportPdfInfo(
        val icao: String,
        val file: String,
        val url: String,
        val sha256: String,
        val size: Long,
        val pages: Int
    )


    data class ChartInfo(
        val page: Int,
        val pdfPage: Int,
        val icao: String,
        val airportName: String,
        val city: String,
        val category: String,
        val chartNumber: String,
        val name: String
    )


    data class SearchResult(
        val page: Int,
        val pdfPage: Int,
        val icao: String,
        val airportName: String,
        val city: String,
        val category: String,
        val chartNumber: String,
        val name: String
    )


    companion object {

        private const val APP_FILE =
            "charts-app-v18.json"

        private const val MANIFEST_FILE =
            "charts-manifest.json"

        private const val FALLBACK_RELEASE_TAG =
            "charts-v18"

        private const val FALLBACK_BASE_URL =
            "https://github.com/mahmet737ng-gif/JeppIran/releases/download/charts-v18/"


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
        ):
            AirportInfo? {

            val key =
                icao
                    .trim()
                    .uppercase(
                        Locale.US
                    )

            return AIRPORTS.firstOrNull {
                it.icao == key
            }
        }


        fun airportName(
            icao: String
        ):
            String {

            return airport(
                icao
            )?.airportName
                ?: ""
        }


        fun city(
            icao: String
        ):
            String {

            return airport(
                icao
            )?.city
                ?: ""
        }


        fun categoryOrder(
            category: String
        ):
            Int {

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
        ):
            String {

            return when (
                value
                    .trim()
                    .uppercase(
                        Locale.US
                    )
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


    private var manifestLoaded =
        false


    private val chartList =
        mutableListOf<ChartInfo>()


    private val airportPdfList =
        mutableMapOf<
            String,
            AirportPdfInfo
        >()


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
                .uppercase(
                    Locale.US
                )


        return chartList
            .filter {
                it.icao == key
            }
            .sortedWith(
                compareBy<ChartInfo> {
                    it.page
                }
            )
    }


    @Synchronized
    fun getChartForPage(
        icao: String,
        page: Int
    ):
        ChartInfo? {

        ensureLoaded()


        val key =
            icao
                .trim()
                .uppercase(
                    Locale.US
                )


        return chartList.firstOrNull {

            it.icao == key &&
                it.page == page
        }
    }


    @Synchronized
    fun getChartForPdfPage(
        icao: String,
        pdfPage: Int
    ):
        ChartInfo? {

        ensureLoaded()


        val key =
            icao
                .trim()
                .uppercase(
                    Locale.US
                )


        return chartList.firstOrNull {

            it.icao == key &&
                it.pdfPage == pdfPage
        }
    }


    @Synchronized
    fun getAirportPdfInfo(
        icao: String
    ):
        AirportPdfInfo {

        ensureManifestLoaded()


        val key =
            icao
                .trim()
                .uppercase(
                    Locale.US
                )


        val existing =
            airportPdfList[key]


        if (
            existing != null
        ) {

            return existing
        }


        val fallback =
            AirportPdfInfo(

                icao =
                    key,

                file =
                    "$key.pdf",

                url =
                    FALLBACK_BASE_URL +
                        "$key.pdf",

                sha256 =
                    "",

                size =
                    0L,

                pages =
                    getChartsForAirport(
                        key
                    ).size
            )


        airportPdfList[key] =
            fallback


        return fallback
    }


    fun getReleaseTag():
        String {

        ensureManifestLoaded()

        val first =
            airportPdfList.values
                .firstOrNull()


        if (
            first != null &&
            first.url.isNotBlank()
        ) {

            val marker =
                "/releases/download/"

            val index =
                first.url.indexOf(
                    marker
                )


            if (
                index >= 0
            ) {

                val rest =
                    first.url.substring(
                        index +
                            marker.length
                    )


                return rest
                    .substringBefore("/")
            }
        }


        return FALLBACK_RELEASE_TAG
    }


    fun search(
        query: String
    ):
        List<SearchResult> {

        ensureLoaded()


        val normalizedQuery =
            query
                .trim()
                .lowercase(
                    Locale.US
                )


        if (
            normalizedQuery.isBlank()
        ) {

            return emptyList()
        }


        return chartList
            .mapNotNull { chart ->

                val fields =
                    listOf(

                        chart.icao,

                        chart.airportName,

                        chart.city,

                        chart.category,

                        chart.chartNumber,

                        chart.name
                    )


                val match =
                    fields.any {

                        it.lowercase(
                            Locale.US
                        )
                            .contains(
                                normalizedQuery
                            )
                    }


                if (
                    !match
                ) {

                    return@mapNotNull null
                }


                SearchResult(

                    page =
                        chart.page,

                    pdfPage =
                        chart.pdfPage,

                    icao =
                        chart.icao,

                    airportName =
                        chart.airportName,

                    city =
                        chart.city,

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
        result:
            SearchResult,
        query:
            String
    ):
        Int {

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

        manifestLoaded =
            false

        chartList.clear()

        airportPdfList.clear()

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
                        APP_FILE
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


                val charts =
                    root.optJSONArray(
                        "charts"
                    )


                if (
                    charts != null
                ) {

                    readArray(
                        charts
                    )
                }
            }


            chartList.sortWith(

                compareBy<ChartInfo> {
                    it.icao
                }
                    .thenBy {
                        it.page
                    }
            )


            loaded =
                true

        } catch (
            _: Exception
        ) {

            loaded =
                true
        }
    }


    private fun ensureManifestLoaded() {

        if (
            manifestLoaded
        ) {

            return
        }


        airportPdfList.clear()


        try {

            val raw =
                context.assets
                    .open(
                        MANIFEST_FILE
                    )
                    .bufferedReader()
                    .use {
                        it.readText()
                    }
                    .trim()


            val root =
                JSONObject(
                    raw
                )


            val airportsObject =
                root.optJSONObject(
                    "airports"
                )


            if (
                airportsObject != null
            ) {

                val keys =
                    airportsObject.keys()


                while (
                    keys.hasNext()
                ) {

                    val icao =
                        keys.next()
                            .trim()
                            .uppercase(
                                Locale.US
                            )


                    val item =
                        airportsObject.optJSONObject(
                            icao
                        )
                            ?: continue


                    val info =
                        AirportPdfInfo(

                            icao =
                                icao,

                            file =
                                item.optString(
                                    "file",
                                    "$icao.pdf"
                                ),

                            url =
                                item.optString(
                                    "url",
                                    FALLBACK_BASE_URL +
                                        "$icao.pdf"
                                ),

                            sha256 =
                                item.optString(
                                    "sha256",
                                    ""
                                ),

                            size =
                                item.optLong(
                                    "size",
                                    0L
                                ),

                            pages =
                                item.optInt(
                                    "pages",
                                    0
                                )
                        )


                    airportPdfList[icao] =
                        info
                }
            }


            manifestLoaded =
                true

        } catch (
            _: Exception
        ) {

            manifestLoaded =
                true
        }
    }


    private fun readArray(
        array: JSONArray
    ) {

        for (
            index in
                0 until
                array.length()
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
                .uppercase(
                    Locale.US
                )


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
                    "global_page",
                    -1
                ),

                item.optInt(
                    "pageNumber",
                    -1
                )
            )


        if (
            page <= 0
        ) {

            return
        }


        val pdfPage =
            firstPositiveInt(

                item.optInt(
                    "pdf_page",
                    -1
                ),

                item.optInt(
                    "local_page",
                    -1
                ),

                item.optInt(
                    "localPage",
                    -1
                )
            )


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


        val airportInfo =
            airport(
                itemIcao
            )


        val displayName =
            cleanRuntimeName(

                rawName,

                category,

                chartNumber,

                page
            )


        chartList.add(

            ChartInfo(

                page =
                    page,

                pdfPage =
                    pdfPage,

                icao =
                    itemIcao,

                airportName =
                    airportInfo
                        ?.airportName
                        ?: itemIcao,

                city =
                    airportInfo
                        ?.city
                        ?: itemIcao,

                category =
                    category,

                chartNumber =
                    chartNumber,

                name =
                    displayName
            )
        )
    }


    private fun cleanRuntimeName(
        rawName: String,
        category: String,
        chartNumber: String,
        page: Int
    ):
        String {

        val clean =
            rawName.trim()


        if (
            clean.isNotBlank() &&
            !isGenericPageName(
                clean
            )
        ) {

            return clean
        }


        if (
            chartNumber.isNotBlank()
        ) {

            return when (
                category
            ) {

                "Airport" ->
                    "AIRPORT " +
                        chartNumber

                "STAR" ->
                    "STAR " +
                        chartNumber

                "SID" ->
                    "SID " +
                        chartNumber

                "Approach" ->
                    "APPROACH " +
                        chartNumber

                else ->
                    "OTHER " +
                        chartNumber
            }
        }


        return when (
            category
        ) {

            "Airport" ->
                "AIRPORT CHART"

            "STAR" ->
                "STAR CHART"

            "SID" ->
                "SID CHART"

            "Approach" ->
                "APPROACH CHART"

            else ->
                "OTHER CHART"
        }
    }


    private fun isGenericPageName(
        value: String
    ):
        Boolean {

        val normalized =
            value
                .trim()
                .lowercase(
                    Locale.US
                )


        if (
            normalized.isBlank()
        ) {

            return true
        }


        if (
            normalized.matches(
                Regex(
                    "chart\\s*page\\s*\\d+"
                )
            )
        ) {

            return true
        }


        if (
            normalized.matches(
                Regex(
                    "page\\s*\\d+"
                )
            )
        ) {

            return true
        }


        if (
            normalized.matches(
                Regex(
                    "chart"
                )
            )
        ) {

            return true
        }


        if (
            normalized.matches(
                Regex(
                    "other\\s*chart"
                )
            )
        ) {

            return true
        }


        return false
    }


    private fun firstNonEmpty(
        vararg values: String
    ):
        String {

        return values
            .firstOrNull {
                it.trim().isNotEmpty()
            }
            ?.trim()
            ?: ""
    }


    private fun firstPositiveInt(
        vararg values: Int
    ):
        Int {

        return values
            .firstOrNull {
                it > 0
            }
            ?: -1
    }
}
