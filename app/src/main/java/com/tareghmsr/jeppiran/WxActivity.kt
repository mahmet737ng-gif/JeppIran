package com.tareghmsr.jeppiran

import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.text.InputFilter
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.concurrent.thread

class WxActivity : AppCompatActivity() {

    companion object {
        private const val PREFS =
            "jeppiran_wx_cache"

        private const val TIMEOUT_MS =
            15000
    }

    private lateinit var icaoInput:
        EditText

    private lateinit var statusText:
        TextView

    private lateinit var metarCheck:
        CheckBox

    private lateinit var tafCheck:
        CheckBox

    private lateinit var decodedCheck:
        CheckBox

    private lateinit var metarTitle:
        TextView

    private lateinit var metarText:
        TextView

    private lateinit var tafTitle:
        TextView

    private lateinit var tafText:
        TextView

    private lateinit var decodedTitle:
        TextView

    private lateinit var decodedText:
        TextView

    private lateinit var getButton:
        Button


    override fun onCreate(
        savedInstanceState: Bundle?
    ) {

        ThemeManager.apply(
            this
        )

        super.onCreate(
            savedInstanceState
        )

        enableEdgeToEdge()

        buildUi()
    }


    private fun buildUi() {

        val root =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.VERTICAL

                setBackgroundColor(
                    backgroundColor()
                )
            }


        val scroll =
            ScrollView(
                this
            )


        val content =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.VERTICAL

                setPadding(
                    20.dp,
                    18.dp,
                    20.dp,
                    32.dp
                )
            }


        content.addView(
            TextView(
                this
            ).apply {

                text =
                    "WX"

                textSize =
                    27f

                typeface =
                    Typeface.DEFAULT_BOLD

                setTextColor(
                    primaryTextColor()
                )
            }
        )


        content.addView(
            TextView(
                this
            ).apply {

                text =
                    "Insert ICAO Code"

                textSize =
                    13f

                typeface =
                    Typeface.DEFAULT_BOLD

                setTextColor(
                    secondaryTextColor()
                )

                setPadding(
                    2.dp,
                    18.dp,
                    2.dp,
                    8.dp
                )
            }
        )


        icaoInput =
            EditText(
                this
            ).apply {

                hint =
                    "Type ICAO code"

                textSize =
                    18f

                isSingleLine =
                    true

                inputType =
                    InputType.TYPE_CLASS_TEXT or
                        InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS

                filters =
                    arrayOf(
                        InputFilter.LengthFilter(
                            4
                        )
                    )

                setTextColor(
                    primaryTextColor()
                )

                setHintTextColor(
                    secondaryTextColor()
                )

                background =
                    cardBackground()

                setPadding(
                    16.dp,
                    0,
                    16.dp,
                    0
                )
            }


        content.addView(
            icaoInput,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                56.dp
            )
        )


        content.addView(
            TextView(
                this
            ).apply {

                text =
                    "DATA"

                textSize =
                    11f

                typeface =
                    Typeface.DEFAULT_BOLD

                setTextColor(
                    secondaryTextColor()
                )

                setPadding(
                    2.dp,
                    18.dp,
                    2.dp,
                    6.dp
                )
            }
        )


        val optionRow =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.HORIZONTAL

                gravity =
                    Gravity.CENTER_VERTICAL
            }


        metarCheck =
            CheckBox(
                this
            ).apply {

                text =
                    "METAR"

                isChecked =
                    true

                setTextColor(
                    primaryTextColor()
                )
            }


        tafCheck =
            CheckBox(
                this
            ).apply {

                text =
                    "TAF"

                isChecked =
                    false

                setTextColor(
                    primaryTextColor()
                )
            }


        decodedCheck =
            CheckBox(
                this
            ).apply {

                text =
                    "DECODED"

                isChecked =
                    false

                setTextColor(
                    primaryTextColor()
                )
            }


        optionRow.addView(
            metarCheck,
            LinearLayout.LayoutParams(
                0,
                48.dp,
                1f
            )
        )


        optionRow.addView(
            tafCheck,
            LinearLayout.LayoutParams(
                0,
                48.dp,
                1f
            )
        )


        optionRow.addView(
            decodedCheck,
            LinearLayout.LayoutParams(
                0,
                48.dp,
                1f
            )
        )


        content.addView(
            optionRow
        )


        getButton =
            Button(
                this
            ).apply {

                text =
                    "GET DATA"

                setOnClickListener {

                    getData()
                }
            }


        content.addView(
            getButton,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                56.dp
            ).apply {

                topMargin =
                    8.dp
            }
        )


        statusText =
            TextView(
                this
            ).apply {

                textSize =
                    12f

                setTextColor(
                    secondaryTextColor()
                )

                setPadding(
                    4.dp,
                    8.dp,
                    4.dp,
                    4.dp
                )
            }


        content.addView(
            statusText
        )


        metarTitle =
            resultTitle(
                "METAR"
            )

        metarText =
            resultCard()


        tafTitle =
            resultTitle(
                "TAF"
            )

        tafText =
            resultCard()


        decodedTitle =
            resultTitle(
                "DECODED"
            )

        decodedText =
            resultCard()


        content.addView(
            metarTitle
        )

        content.addView(
            metarText
        )

        content.addView(
            tafTitle
        )

        content.addView(
            tafText
        )

        content.addView(
            decodedTitle
        )

        content.addView(
            decodedText
        )


        setResultVisibility(
            false,
            false,
            false
        )


        scroll.addView(
            content
        )


        root.addView(
            scroll,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1f
            )
        )


        setContentView(
            root
        )


        ViewCompat.setOnApplyWindowInsetsListener(
            root
        ) { view, insets ->

            val bars =
                insets.getInsets(
                    WindowInsetsCompat.Type.systemBars()
                )


            view.setPadding(
                bars.left,
                bars.top,
                bars.right,
                bars.bottom
            )


            insets
        }


        ViewCompat.requestApplyInsets(
            root
        )
    }


    private fun getData() {

        val icao =
            icaoInput.text
                .toString()
                .trim()
                .uppercase(
                    Locale.US
                )


        if (
            !Regex(
                "^[A-Z]{4}$"
            ).matches(
                icao
            )
        ) {

            statusText.text =
                "Insert a valid four-letter ICAO code."

            return
        }


        val rawMetar =
            metarCheck.isChecked

        val rawTaf =
            tafCheck.isChecked

        val decoded =
            decodedCheck.isChecked


        if (
            !rawMetar &&
            !rawTaf &&
            !decoded
        ) {

            statusText.text =
                "Select METAR, TAF, DECODED, or a combination."

            return
        }


        val needMetar =
            rawMetar ||
                decoded

        val needTaf =
            rawTaf ||
                decoded


        showCache(
            icao,
            rawMetar,
            rawTaf,
            decoded
        )


        getButton.isEnabled =
            false

        statusText.text =
            icao +
                " • getting data…"


        thread(
            name =
                "JeppIran-WX"
        ) {

            val metarResult =
                if (
                    needMetar
                ) {

                    runCatching {
                        fetchRaw(
                            "metar",
                            icao
                        )
                    }

                } else {

                    null
                }


            val tafResult =
                if (
                    needTaf
                ) {

                    runCatching {
                        fetchRaw(
                            "taf",
                            icao
                        )
                    }

                } else {

                    null
                }


            val metar =
                metarResult
                    ?.getOrNull()
                    .orEmpty()
                    .trim()


            val taf =
                tafResult
                    ?.getOrNull()
                    .orEmpty()
                    .trim()


            val decodedValue =
                if (
                    decoded
                ) {

                    buildString {

                        if (
                            needMetar
                        ) {

                            append(
                                "METAR\n"
                            )

                            append(
                                decodeMetar(
                                    metar
                                )
                            )
                        }


                        if (
                            needMetar &&
                            needTaf
                        ) {

                            append(
                                "\n\n"
                            )
                        }


                        if (
                            needTaf
                        ) {

                            append(
                                "TAF\n"
                            )

                            append(
                                decodeTaf(
                                    taf
                                )
                            )
                        }
                    }

                } else {

                    ""
                }


            val now =
                System.currentTimeMillis()


            if (
                metarResult?.isSuccess ==
                    true ||
                tafResult?.isSuccess ==
                    true
            ) {

                val editor =
                    getSharedPreferences(
                        PREFS,
                        MODE_PRIVATE
                    )
                        .edit()


                if (
                    needMetar &&
                    metarResult?.isSuccess ==
                    true
                ) {

                    editor.putString(
                        "metar_" +
                            icao,
                        metar
                    )
                }


                if (
                    needTaf &&
                    tafResult?.isSuccess ==
                    true
                ) {

                    editor.putString(
                        "taf_" +
                            icao,
                        taf
                    )
                }


                if (
                    decoded
                ) {

                    editor.putString(
                        "decoded_" +
                            icao,
                        decodedValue
                    )
                }


                editor
                    .putLong(
                        "time_" +
                            icao,
                        now
                    )
                    .apply()
            }


            runOnUiThread {

                getButton.isEnabled =
                    true


                val metarFailed =
                    needMetar &&
                        metarResult?.isFailure ==
                            true


                val tafFailed =
                    needTaf &&
                        tafResult?.isFailure ==
                            true


                val allRequestedFailed =
                    (
                        !needMetar ||
                            metarFailed
                        ) &&
                        (
                            !needTaf ||
                                tafFailed
                            )


                if (
                    allRequestedFailed
                ) {

                    statusText.text =
                        icao +
                            " • unable to update • cached data shown"

                    showCache(
                        icao,
                        rawMetar,
                        rawTaf,
                        decoded
                    )

                    return@runOnUiThread
                }


                if (
                    rawMetar &&
                    !metarFailed
                ) {

                    metarText.text =
                        metar.ifBlank {
                            "No METAR available."
                        }
                }


                if (
                    rawTaf &&
                    !tafFailed
                ) {

                    tafText.text =
                        taf.ifBlank {
                            "No TAF available."
                        }
                }


                if (
                    decoded
                ) {

                    decodedText.text =
                        decodedValue.ifBlank {
                            "No decoded data available."
                        }
                }


                setResultVisibility(
                    rawMetar,
                    rawTaf,
                    decoded
                )


                statusText.text =
                    if (
                        metarFailed ||
                        tafFailed
                    ) {

                        icao +
                            " • partial update • unavailable data kept from cache"

                    } else {

                        icao +
                            " • " +
                            formatTime(
                                now
                            )
                    }
            }
        }
    }


    private fun fetchRaw(
        product: String,
        icao: String
    ):
        String {

        var connection:
            HttpURLConnection? =
            null


        try {

            connection =
                URL(
                    "https://aviationweather.gov/api/data/" +
                        product +
                        "?ids=" +
                        icao +
                        "&format=raw"
                )
                    .openConnection()
                    as HttpURLConnection


            connection.connectTimeout =
                TIMEOUT_MS

            connection.readTimeout =
                TIMEOUT_MS

            connection.requestMethod =
                "GET"

            connection.setRequestProperty(
                "Accept",
                "text/plain"
            )

            connection.setRequestProperty(
                "User-Agent",
                "JEPPIRAN/" + AppVersion.name(this) + " Android"
            )


            val code =
                connection.responseCode


            if (
                code !in
                200..299
            ) {

                error(
                    "HTTP " +
                        code
                )
            }


            return connection
                .inputStream
                .bufferedReader()
                .use {
                    reader ->

                    reader.readText()
                }

        } finally {

            connection?.disconnect()
        }
    }


    private fun decodeMetar(
        raw: String
    ):
        String {

        if (
            raw.isBlank()
        ) {

            return "No METAR available."
        }


        val report =
            raw.lines()
                .firstOrNull {
                    it.isNotBlank()
                }
                .orEmpty()
                .trim()


        val tokens =
            report.split(
                Regex(
                    "\\s+"
                )
            )


        val lines =
            mutableListOf<String>()


        tokens.firstOrNull {
            Regex(
                "^[A-Z]{4}$"
            ).matches(
                it
            )
        }
            ?.let {

                lines.add(
                    "Station: " +
                        it
                )
            }


        tokens.firstOrNull {
            Regex(
                "^\\d{6}Z$"
            ).matches(
                it
            )
        }
            ?.let {

                lines.add(
                    "Observation: day " +
                        it.substring(
                            0,
                            2
                        ) +
                        " at " +
                        it.substring(
                            2,
                            4
                        ) +
                        ":" +
                        it.substring(
                            4,
                            6
                        ) +
                        " UTC"
                )
            }


        tokens.firstOrNull {
            Regex(
                "^(VRB|\\d{3})\\d{2,3}(G\\d{2,3})?KT$"
            ).matches(
                it
            )
        }
            ?.let {
                token ->

                val match =
                    Regex(
                        "^(VRB|\\d{3})(\\d{2,3})(G(\\d{2,3}))?KT$"
                    )
                        .find(
                            token
                        )


                if (
                    match !=
                    null
                ) {

                    val direction =
                        match.groupValues[
                            1
                        ]


                    val speed =
                        match.groupValues[
                            2
                        ]


                    val gust =
                        match.groupValues[
                            4
                        ]


                    lines.add(
                        "Wind: " +
                            (
                                if (
                                    direction ==
                                    "VRB"
                                ) {

                                    "variable"

                                } else {

                                    direction +
                                        "°"
                                }
                                ) +
                            " at " +
                            speed +
                            " kt" +
                            (
                                if (
                                    gust.isNotBlank()
                                ) {

                                    ", gust " +
                                        gust +
                                        " kt"

                                } else {

                                    ""
                                }
                                )
                    )
                }
            }


        tokens.firstOrNull {
            it ==
                "CAVOK" ||
                Regex(
                    "^\\d{4}$"
                ).matches(
                    it
                )
        }
            ?.let {

                lines.add(
                    if (
                        it ==
                        "CAVOK"
                    ) {

                        "Visibility: CAVOK"

                    } else {

                        "Visibility: " +
                            it +
                            " m"
                    }
                )
            }


        val weatherCodes =
            tokens.filter {
                token ->

                Regex(
                    "^(\\+|-|VC)?(MI|PR|BC|DR|BL|SH|TS|FZ)?(DZ|RA|SN|SG|IC|PL|GR|GS|UP|BR|FG|FU|VA|DU|SA|HZ|PY|PO|SQ|FC|SS|DS)+$"
                ).matches(
                    token
                )
            }


        if (
            weatherCodes.isNotEmpty()
        ) {

            lines.add(
                "Weather: " +
                    weatherCodes.joinToString(
                        " "
                    )
            )
        }


        val clouds =
            tokens.filter {
                Regex(
                    "^(FEW|SCT|BKN|OVC|VV)\\d{3}(CB|TCU)?$"
                ).matches(
                    it
                )
            }


        if (
            clouds.isNotEmpty()
        ) {

            lines.add(
                "Clouds: " +
                    clouds.joinToString(
                        " • "
                    ) {
                        decodeCloud(
                            it
                        )
                    }
            )
        }


        tokens.firstOrNull {
            Regex(
                "^M?\\d{2}/M?\\d{2}$"
            ).matches(
                it
            )
        }
            ?.let {
                token ->

                val parts =
                    token.split(
                        "/"
                    )


                lines.add(
                    "Temperature / Dew point: " +
                        decodeSignedTemp(
                            parts[
                                0
                            ]
                        ) +
                        "°C / " +
                        decodeSignedTemp(
                            parts[
                                1
                            ]
                        ) +
                        "°C"
                )
            }


        tokens.firstOrNull {
            Regex(
                "^Q\\d{4}$"
            ).matches(
                it
            )
        }
            ?.let {

                lines.add(
                    "QNH: " +
                        it.substring(
                            1
                        ) +
                        " hPa"
                )
            }


        tokens.firstOrNull {
            Regex(
                "^A\\d{4}$"
            ).matches(
                it
            )
        }
            ?.let {

                val value =
                    it.substring(
                        1
                    )
                        .toIntOrNull()


                if (
                    value !=
                    null
                ) {

                    lines.add(
                        "Altimeter: " +
                            String.format(
                                Locale.US,
                                "%.2f inHg",
                                value /
                                    100.0
                            )
                    )
                }
            }


        if (
            lines.isEmpty()
        ) {

            return report
        }


        return lines.joinToString(
            "\n"
        )
    }


    private fun decodeTaf(
        raw: String
    ):
        String {

        if (
            raw.isBlank()
        ) {

            return "No TAF available."
        }


        val clean =
            raw.replace(
                Regex(
                    "\\s+"
                ),
                " "
            )
                .trim()


        val tokens =
            clean.split(
                " "
            )


        val result =
            mutableListOf<String>()


        tokens.firstOrNull {
            Regex(
                "^[A-Z]{4}$"
            ).matches(
                it
            )
        }
            ?.let {

                result.add(
                    "Station: " +
                        it
                )
            }


        tokens.firstOrNull {
            Regex(
                "^\\d{6}Z$"
            ).matches(
                it
            )
        }
            ?.let {

                result.add(
                    "Issued: day " +
                        it.substring(
                            0,
                            2
                        ) +
                        " at " +
                        it.substring(
                            2,
                            4
                        ) +
                        ":" +
                        it.substring(
                            4,
                            6
                        ) +
                        " UTC"
                )
            }


        tokens.firstOrNull {
            Regex(
                "^\\d{4}/\\d{4}$"
            ).matches(
                it
            )
        }
            ?.let {

                result.add(
                    "Validity: " +
                        it
                )
            }


        val groups =
            mutableListOf<String>()

        var current =
            StringBuilder()


        tokens.forEach {
            token ->

            val startsGroup =
                token ==
                    "TEMPO" ||
                    token ==
                        "BECMG" ||
                    token.startsWith(
                        "FM"
                    ) ||
                    token.startsWith(
                        "PROB"
                    )


            if (
                startsGroup &&
                current.isNotEmpty()
            ) {

                groups.add(
                    current.toString()
                )

                current =
                    StringBuilder()
            }


            if (
                current.isNotEmpty()
            ) {

                current.append(
                    " "
                )
            }


            current.append(
                token
            )
        }


        if (
            current.isNotEmpty()
        ) {

            groups.add(
                current.toString()
            )
        }


        if (
            groups.isNotEmpty()
        ) {

            result.add(
                "Forecast groups:"
            )


            groups.forEach {
                group ->

                result.add(
                    "• " +
                        decodeTafGroup(
                            group
                        )
                )
            }
        }


        return result.joinToString(
            "\n"
        )
            .ifBlank {
                clean
            }
    }


    private fun decodeTafGroup(
        group: String
    ):
        String {

        var value =
            group


        value =
            value.replace(
                Regex(
                    "(VRB|\\d{3})(\\d{2,3})(G(\\d{2,3}))?KT"
                )
            ) {
                match ->

                val direction =
                    if (
                        match.groupValues[
                            1
                        ] ==
                        "VRB"
                    ) {

                        "variable"

                    } else {

                        match.groupValues[
                            1
                        ] +
                            "°"
                    }


                "wind " +
                    direction +
                    " " +
                    match.groupValues[
                        2
                    ] +
                    " kt" +
                    (
                        if (
                            match.groupValues[
                                4
                            ].isNotBlank()
                        ) {

                            " gust " +
                                match.groupValues[
                                    4
                                ] +
                                " kt"

                        } else {

                            ""
                        }
                        )
            }


        value =
            value.replace(
                "CAVOK",
                "visibility CAVOK"
            )


        return value
    }


    private fun decodeCloud(
        token: String
    ):
        String {

        val amount =
            when {

                token.startsWith(
                    "FEW"
                ) ->
                    "few"

                token.startsWith(
                    "SCT"
                ) ->
                    "scattered"

                token.startsWith(
                    "BKN"
                ) ->
                    "broken"

                token.startsWith(
                    "OVC"
                ) ->
                    "overcast"

                else ->
                    "vertical visibility"
            }


        val base =
            token.substring(
                3,
                6
            )
                .toIntOrNull()
                ?.times(
                    100
                )


        return amount +
            (
                if (
                    base !=
                    null
                ) {

                    " at " +
                        base +
                        " ft"

                } else {

                    ""
                }
                ) +
            (
                if (
                    token.endsWith(
                        "CB"
                    )
                ) {

                    " CB"

                } else if (
                    token.endsWith(
                        "TCU"
                    )
                ) {

                    " TCU"

                } else {

                    ""
                }
                )
    }


    private fun decodeSignedTemp(
        token: String
    ):
        String =
        if (
            token.startsWith(
                "M"
            )
        ) {

            "-" +
                token.substring(
                    1
                )
                    .toIntOrNull()
                    .orZero()

        } else {

            token.toIntOrNull()
                .orZero()
                .toString()
        }


    private fun Int?.orZero():
        Int =
        this
            ?: 0


    private fun showCache(
        icao: String,
        showMetar: Boolean,
        showTaf: Boolean,
        showDecoded: Boolean
    ) {

        val prefs =
            getSharedPreferences(
                PREFS,
                MODE_PRIVATE
            )


        metarText.text =
            prefs.getString(
                "metar_" +
                    icao,
                ""
            )
                .orEmpty()
                .ifBlank {
                    "No cached METAR."
                }


        tafText.text =
            prefs.getString(
                "taf_" +
                    icao,
                ""
            )
                .orEmpty()
                .ifBlank {
                    "No cached TAF."
                }


        decodedText.text =
            prefs.getString(
                "decoded_" +
                    icao,
                ""
            )
                .orEmpty()
                .ifBlank {
                    "No cached decoded data."
                }


        setResultVisibility(
            showMetar,
            showTaf,
            showDecoded
        )


        val time =
            prefs.getLong(
                "time_" +
                    icao,
                0L
            )


        statusText.text =
            if (
                time >
                0L
            ) {

                icao +
                    " • cached " +
                    formatTime(
                        time
                    )

            } else {

                ""
            }
    }


    private fun setResultVisibility(
        metar: Boolean,
        taf: Boolean,
        decoded: Boolean
    ) {

        metarTitle.visibility =
            if (
                metar
            ) {

                View.VISIBLE

            } else {

                View.GONE
            }


        metarText.visibility =
            metarTitle.visibility


        tafTitle.visibility =
            if (
                taf
            ) {

                View.VISIBLE

            } else {

                View.GONE
            }


        tafText.visibility =
            tafTitle.visibility


        decodedTitle.visibility =
            if (
                decoded
            ) {

                View.VISIBLE

            } else {

                View.GONE
            }


        decodedText.visibility =
            decodedTitle.visibility
    }


    private fun resultTitle(
        value: String
    ):
        TextView =
        TextView(
            this
        ).apply {

            text =
                value

            textSize =
                12f

            typeface =
                Typeface.DEFAULT_BOLD

            setTextColor(
                secondaryTextColor()
            )

            setPadding(
                2.dp,
                18.dp,
                2.dp,
                8.dp
            )
        }


    private fun resultCard():
        TextView =
        TextView(
            this
        ).apply {

            textSize =
                15f

            typeface =
                Typeface.MONOSPACE

            setTextColor(
                primaryTextColor()
            )

            setLineSpacing(
                4f,
                1.08f
            )

            setPadding(
                16.dp,
                16.dp,
                16.dp,
                16.dp
            )

            background =
                cardBackground()
        }


    private fun formatTime(
        millis: Long
    ):
        String =
        SimpleDateFormat(
            "dd MMM HH:mm",
            Locale.US
        )
            .format(
                Date(
                    millis
                )
            )


    private fun cardBackground() =
        GradientDrawable()
            .apply {

                shape =
                    GradientDrawable.RECTANGLE

                cornerRadius =
                    14.dp.toFloat()

                setColor(
                    if (
                        isDarkTheme()
                    ) {

                        Color.rgb(
                            25,
                            35,
                            45
                        )

                    } else {

                        Color.WHITE
                    }
                )

                setStroke(
                    1.dp,
                    if (
                        isDarkTheme()
                    ) {

                        Color.rgb(
                            55,
                            70,
                            84
                        )

                    } else {

                        Color.rgb(
                            224,
                            230,
                            236
                        )
                    }
                )
            }


    private fun backgroundColor() =
        if (
            isDarkTheme()
        ) {

            Color.rgb(
                14,
                22,
                30
            )

        } else {

            Color.rgb(
                244,
                247,
                250
            )
        }


    private fun primaryTextColor() =
        if (
            isDarkTheme()
        ) {

            Color.rgb(
                241,
                245,
                248
            )

        } else {

            Color.rgb(
                18,
                32,
                48
            )
        }


    private fun secondaryTextColor() =
        if (
            isDarkTheme()
        ) {

            Color.rgb(
                158,
                174,
                187
            )

        } else {

            Color.rgb(
                91,
                107,
                122
            )
        }


    private fun isDarkTheme() =
        (
            resources.configuration.uiMode and
                android.content.res.Configuration
                    .UI_MODE_NIGHT_MASK
            ) ==
            android.content.res.Configuration
                .UI_MODE_NIGHT_YES


    private val Int.dp:
        Int
        get() =
            (
                this *
                    resources
                        .displayMetrics
                        .density
                )
                .toInt()
}
