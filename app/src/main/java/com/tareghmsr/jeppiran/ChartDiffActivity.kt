package com.tareghmsr.jeppiran

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.pdf.PdfRenderer
import android.os.Bundle
import android.os.ParcelFileDescriptor
import android.view.Gravity
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

class ChartDiffActivity :
    AppCompatActivity() {

    private var icao =
        ""

    private var chartNumber =
        ""

    private var procedure =
        ""

    private lateinit var image:
        ImageView

    private lateinit var status:
        TextView

    private var currentBitmap:
        Bitmap? =
        null

    private var previousBitmap:
        Bitmap? =
        null

    private var overlayBitmap:
        Bitmap? =
        null


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

        icao =
            intent
                .getStringExtra(
                    "ICAO"
                )
                .orEmpty()
                .trim()
                .uppercase()

        chartNumber =
            intent
                .getStringExtra(
                    "CHART_NUMBER"
                )
                .orEmpty()
                .trim()
                .uppercase()

        procedure =
            intent
                .getStringExtra(
                    "PROCEDURE"
                )
                .orEmpty()
                .trim()

        buildUi()

        loadComparison()
    }


    override fun onDestroy() {

        currentBitmap
            ?.recycle()

        previousBitmap
            ?.recycle()

        overlayBitmap
            ?.recycle()

        super.onDestroy()
    }


    private fun buildUi() {

        val root =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.VERTICAL

                setBackgroundColor(
                    Color.rgb(
                        4,
                        12,
                        24
                    )
                )
            }


        val header =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.HORIZONTAL

                gravity =
                    Gravity.CENTER_VERTICAL

                setPadding(
                    10.dp,
                    8.dp,
                    10.dp,
                    8.dp
                )
            }


        header.addView(
            TextView(
                this
            ).apply {

                text =
                    "‹"

                textSize =
                    34f

                gravity =
                    Gravity.CENTER

                setTextColor(
                    Color.WHITE
                )

                setOnClickListener {
                    finish()
                }
            },
            LinearLayout.LayoutParams(
                46.dp,
                46.dp
            )
        )


        header.addView(
            TextView(
                this
            ).apply {

                text =
                    "CHANGES OVERLAY\n" +
                        icao +
                        " • " +
                        (
                            procedure.ifBlank {
                                chartNumber
                            }
                            )

                textSize =
                    14f

                setTextColor(
                    Color.WHITE
                )

                maxLines =
                    2
            },
            LinearLayout.LayoutParams(
                0,
                LinearLayout.LayoutParams.WRAP_CONTENT,
                1f
            )
        )


        root.addView(
            header
        )


        status =
            TextView(
                this
            ).apply {

                text =
                    "Preparing previous and current charts…"

                textSize =
                    12f

                setTextColor(
                    Color.rgb(
                        175,
                        195,
                        211
                    )
                )

                gravity =
                    Gravity.CENTER

                setPadding(
                    8.dp,
                    5.dp,
                    8.dp,
                    8.dp
                )
            }


        root.addView(
            status
        )


        image =
            ImageView(
                this
            ).apply {

                scaleType =
                    ImageView.ScaleType.FIT_CENTER

                setBackgroundColor(
                    Color.rgb(
                        13,
                        16,
                        21
                    )
                )
            }


        root.addView(
            image,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1f
            )
        )


        val modes =
            LinearLayout(
                this
            ).apply {

                orientation =
                    LinearLayout.HORIZONTAL

                gravity =
                    Gravity.CENTER

                setPadding(
                    8.dp,
                    8.dp,
                    8.dp,
                    10.dp
                )
            }


        fun modeButton(
            label: String,
            onClick: () -> Unit
        ):
            TextView =
            TextView(
                this
            ).apply {

                text =
                    label

                textSize =
                    12f

                gravity =
                    Gravity.CENTER

                setTextColor(
                    Color.WHITE
                )

                background =
                    android.graphics.drawable
                        .GradientDrawable()
                        .apply {

                            cornerRadius =
                                12.dp.toFloat()

                            setColor(
                                Color.rgb(
                                    5,
                                    38,
                                    68
                                )
                            )

                            setStroke(
                                1.dp,
                                Color.rgb(
                                    47,
                                    217,
                                    255
                                )
                            )
                        }

                setOnClickListener {
                    onClick()
                }
            }


        modes.addView(
            modeButton(
                "PREVIOUS"
            ) {

                previousBitmap
                    ?.let {
                        image.setImageBitmap(
                            it
                        )
                    }
            },
            LinearLayout.LayoutParams(
                0,
                48.dp,
                1f
            ).apply {

                marginEnd =
                    5.dp
            }
        )


        modes.addView(
            modeButton(
                "CURRENT"
            ) {

                currentBitmap
                    ?.let {
                        image.setImageBitmap(
                            it
                        )
                    }
            },
            LinearLayout.LayoutParams(
                0,
                48.dp,
                1f
            ).apply {

                marginStart =
                    5.dp

                marginEnd =
                    5.dp
            }
        )


        modes.addView(
            modeButton(
                "CHANGES"
            ) {

                overlayBitmap
                    ?.let {
                        image.setImageBitmap(
                            it
                        )
                    }
            },
            LinearLayout.LayoutParams(
                0,
                48.dp,
                1f
            ).apply {

                marginStart =
                    5.dp
            }
        )


        root.addView(
            modes
        )


        setContentView(
            root
        )


        ViewCompat.setOnApplyWindowInsetsListener(
            root
        ) {
            view,
            insets ->

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
    }


    private fun loadComparison() {

        thread(
            name =
                "JeppIran-ChartDiff"
        ) {

            try {

                val repository =
                    ChartRepository(
                        this
                    )

                val currentChart =
                    repository
                        .getChartsForAirport(
                            icao
                        )
                        .firstOrNull {
                            it.chartNumber.equals(
                                chartNumber,
                                ignoreCase =
                                    true
                            )
                        }
                        ?: repository
                            .getChartsForAirport(
                                icao
                            )
                            .firstOrNull {
                                it.name.contains(
                                    procedure,
                                    ignoreCase =
                                        true
                                )
                            }
                        ?: error(
                            "Current chart not found"
                        )


                val previousChartsRaw =
                    ChartUpdateStore
                        .readPreviousCharts(
                            this
                        )
                        ?: error(
                            "Previous cycle metadata is not available yet"
                        )

                val previousManifestRaw =
                    ChartUpdateStore
                        .readPreviousManifest(
                            this
                        )
                        ?: error(
                            "Previous cycle manifest is not available yet"
                        )


                val previousChart =
                    findPreviousChart(
                        previousChartsRaw,
                        icao,
                        chartNumber,
                        procedure
                    )
                        ?: error(
                            "Previous version of this chart was not found"
                        )


                val currentPdf =
                    repository.getAirportPdfInfo(
                        icao
                    )

                val previousPdf =
                    previousPdfInfo(
                        previousManifestRaw,
                        icao
                    )
                        ?: error(
                            "Previous airport PDF is not listed"
                        )


                val currentFile =
                    ensurePdf(
                        "diff-current-" +
                            currentPdf.file,
                        currentPdf.url
                    )

                val previousFile =
                    ensurePdf(
                        "diff-previous-" +
                            previousPdf.first,
                        previousPdf.second
                    )


                val current =
                    renderPage(
                        currentFile,
                        currentChart.pdfPage
                    )
                        ?: error(
                            "Unable to render current chart"
                        )

                var previous =
                    renderPage(
                        previousFile,
                        previousChart.second
                    )
                        ?: error(
                            "Unable to render previous chart"
                        )


                previous =
                    orientAndScale(
                        previous,
                        current.width,
                        current.height
                    )


                val aligned =
                    alignTranslation(
                        previous,
                        current
                    )

                if (
                    aligned !==
                    previous
                ) {

                    previous.recycle()
                }


                val overlay =
                    buildDiffOverlay(
                        aligned,
                        current
                    )


                currentBitmap =
                    current

                previousBitmap =
                    aligned

                overlayBitmap =
                    overlay


                runOnUiThread {

                    status.text =
                        "Aligned previous/current • highlighted pixels show chart changes"

                    image.setImageBitmap(
                        overlay
                    )
                }


            } catch (
                error: Throwable
            ) {

                runOnUiThread {

                    status.text =
                        error.message
                            ?: "Unable to compare chart cycles"
                }
            }
        }
    }


    private fun findPreviousChart(
        raw: String,
        targetIcao: String,
        targetNumber: String,
        targetProcedure: String
    ):
        Pair<Int, Int>? {

        val trimmed =
            raw.trim()

        val array =
            if (
                trimmed.startsWith(
                    "["
                )
            ) {

                JSONArray(
                    trimmed
                )

            } else {

                JSONObject(
                    trimmed
                )
                    .optJSONArray(
                        "charts"
                    )
                    ?: return null
            }


        var procedureFallback:
            Pair<Int, Int>? =
            null


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

            val airport =
                (
                    item.optString(
                        "airport"
                    )
                        .ifBlank {
                            item.optString(
                                "icao"
                            )
                        }
                    )
                    .trim()
                    .uppercase()

            if (
                airport !=
                targetIcao
            ) {
                continue
            }


            val page =
                item.optInt(
                    "page",
                    -1
                )

            val pdfPage =
                item.optInt(
                    "pdf_page",
                    -1
                )

            if (
                page <=
                    0 ||
                pdfPage <=
                    0
            ) {
                continue
            }


            val number =
                item.optString(
                    "chart_number"
                )
                    .trim()
                    .uppercase()


            if (
                targetNumber.isNotBlank() &&
                number ==
                    targetNumber
            ) {

                return Pair(
                    page,
                    pdfPage
                )
            }


            val name =
                item.optString(
                    "name"
                )

            if (
                targetProcedure.isNotBlank() &&
                name.contains(
                    targetProcedure,
                    ignoreCase =
                        true
                )
            ) {

                procedureFallback =
                    Pair(
                        page,
                        pdfPage
                    )
            }
        }


        return procedureFallback
    }


    private fun previousPdfInfo(
        manifestRaw: String,
        targetIcao: String
    ):
        Pair<String, String>? {

        val item =
            JSONObject(
                manifestRaw
            )
                .optJSONObject(
                    "airports"
                )
                ?.optJSONObject(
                    targetIcao
                )
                ?: return null

        val file =
            item.optString(
                "file"
            )
                .ifBlank {
                    "$targetIcao.pdf"
                }

        val url =
            item.optString(
                "url"
            )

        if (
            url.isBlank()
        ) {
            return null
        }

        return Pair(
            file,
            url
        )
    }


    private fun ensurePdf(
        name: String,
        address: String
    ):
        File {

        val file =
            File(
                cacheDir,
                name
                    .replace(
                        Regex(
                            "[^A-Za-z0-9._-]"
                        ),
                        "_"
                    )
            )

        if (
            file.isFile &&
            file.length() >
                0L
        ) {

            return file
        }


        val temp =
            File(
                cacheDir,
                file.name +
                    ".tmp"
            )


        val connection =
            URL(
                address
            )
                .openConnection()
                as HttpURLConnection

        try {

            connection.connectTimeout =
                30000

            connection.readTimeout =
                30000

            connection.inputStream.use {
                input ->

                temp.outputStream()
                    .use {
                        output ->

                        input.copyTo(
                            output
                        )
                    }
            }

        } finally {

            connection.disconnect()
        }


        temp.copyTo(
            file,
            overwrite =
                true
        )

        temp.delete()

        return file
    }


    private fun renderPage(
        file: File,
        pdfPage: Int
    ):
        Bitmap? {

        val descriptor =
            ParcelFileDescriptor.open(
                file,
                ParcelFileDescriptor.MODE_READ_ONLY
            )

        val renderer =
            PdfRenderer(
                descriptor
            )

        return try {

            val index =
                pdfPage -
                    1

            if (
                index !in
                0 until
                    renderer.pageCount
            ) {

                return null
            }


            val page =
                renderer.openPage(
                    index
                )

            val longest =
                max(
                    page.width,
                    page.height
                )

            val scale =
                (
                    1700f /
                        longest
                    )
                    .coerceAtMost(
                        2.6f
                    )
                    .coerceAtLeast(
                        1f
                    )

            val bitmap =
                Bitmap.createBitmap(
                    max(
                        1,
                        (
                            page.width *
                                scale
                            )
                            .toInt()
                    ),
                    max(
                        1,
                        (
                            page.height *
                                scale
                            )
                            .toInt()
                    ),
                    Bitmap.Config.ARGB_8888
                )

            bitmap.eraseColor(
                Color.WHITE
            )

            page.render(
                bitmap,
                null,
                null,
                PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY
            )

            page.close()


            Canvas(
                bitmap
            )
                .drawRect(
                    0f,
                    0f,
                    bitmap.width.toFloat(),
                    bitmap.height *
                        0.021f,
                    Paint().apply {
                        color =
                            Color.WHITE
                    }
                )


            bitmap

        } finally {

            renderer.close()

            descriptor.close()
        }
    }


    private fun orientAndScale(
        source: Bitmap,
        width: Int,
        height: Int
    ):
        Bitmap {

        var working =
            source


        val sourceLandscape =
            source.width >
                source.height

        val targetLandscape =
            width >
                height


        if (
            sourceLandscape !=
            targetLandscape
        ) {

            val matrix =
                Matrix()
                    .apply {
                        postRotate(
                            90f
                        )
                    }

            working =
                Bitmap.createBitmap(
                    source,
                    0,
                    0,
                    source.width,
                    source.height,
                    matrix,
                    true
                )

            if (
                working !==
                source
            ) {

                source.recycle()
            }
        }


        if (
            working.width ==
                width &&
            working.height ==
                height
        ) {

            return working
        }


        val scaled =
            Bitmap.createScaledBitmap(
                working,
                width,
                height,
                true
            )

        if (
            scaled !==
            working
        ) {

            working.recycle()
        }

        return scaled
    }


    private fun alignTranslation(
        previous: Bitmap,
        current: Bitmap
    ):
        Bitmap {

        val step =
            18

        val search =
            12

        var bestDx =
            0

        var bestDy =
            0

        var bestScore =
            Double.MAX_VALUE


        for (
            dy in
                -search..search step 3
        ) {

            for (
                dx in
                    -search..search step 3
            ) {

                var score =
                    0.0

                var count =
                    0


                var y =
                    (
                        current.height *
                            0.08f
                        )
                        .toInt()

                while (
                    y <
                    current.height -
                        step
                ) {

                    var x =
                        step

                    while (
                        x <
                        current.width -
                            step
                    ) {

                        val px =
                            x +
                                dx

                        val py =
                            y +
                                dy

                        if (
                            px in
                                0 until
                                    previous.width &&
                            py in
                                0 until
                                    previous.height
                        ) {

                            val a =
                                current.getPixel(
                                    x,
                                    y
                                )

                            val b =
                                previous.getPixel(
                                    px,
                                    py
                                )

                            score +=
                                abs(
                                    Color.red(
                                        a
                                    ) -
                                        Color.red(
                                            b
                                        )
                                ) +
                                    abs(
                                        Color.green(
                                            a
                                        ) -
                                            Color.green(
                                                b
                                            )
                                    ) +
                                    abs(
                                        Color.blue(
                                            a
                                        ) -
                                            Color.blue(
                                                b
                                            )
                                    )

                            count++
                        }

                        x +=
                            step
                    }

                    y +=
                        step
                }


                if (
                    count >
                        0
                ) {

                    score /=
                        count


                    if (
                        score <
                        bestScore
                    ) {

                        bestScore =
                            score

                        bestDx =
                            dx

                        bestDy =
                            dy
                    }
                }
            }
        }


        if (
            bestDx ==
                0 &&
            bestDy ==
                0
        ) {

            return previous
        }


        return Bitmap.createBitmap(
            current.width,
            current.height,
            Bitmap.Config.ARGB_8888
        )
            .also {
                aligned ->

                aligned.eraseColor(
                    Color.WHITE
                )

                Canvas(
                    aligned
                )
                    .drawBitmap(
                        previous,
                        bestDx.toFloat(),
                        bestDy.toFloat(),
                        Paint(
                            Paint.ANTI_ALIAS_FLAG or
                                Paint.FILTER_BITMAP_FLAG
                        )
                    )
            }
    }


    private fun buildDiffOverlay(
        previous: Bitmap,
        current: Bitmap
    ):
        Bitmap {

        val width =
            current.width

        val height =
            current.height

        val oldPixels =
            IntArray(
                width *
                    height
            )

        val newPixels =
            IntArray(
                width *
                    height
            )

        previous.getPixels(
            oldPixels,
            0,
            width,
            0,
            0,
            width,
            height
        )

        current.getPixels(
            newPixels,
            0,
            width,
            0,
            0,
            width,
            height
        )


        val ignoreTop =
            (
                height *
                    0.055f
                )
                .toInt()


        for (
            y in
                ignoreTop until
                    height
        ) {

            val row =
                y *
                    width

            for (
                x in
                    0 until
                        width
            ) {

                val i =
                    row +
                        x

                val old =
                    oldPixels[
                        i
                    ]

                val fresh =
                    newPixels[
                        i
                    ]

                val difference =
                    abs(
                        Color.red(
                            old
                        ) -
                            Color.red(
                                fresh
                            )
                    ) +
                        abs(
                            Color.green(
                                old
                            ) -
                                Color.green(
                                    fresh
                                )
                        ) +
                        abs(
                            Color.blue(
                                old
                            ) -
                                Color.blue(
                                    fresh
                                )
                        )


                if (
                    difference >
                    105
                ) {

                    newPixels[i] =
                        Color.rgb(
                            min(
                                255,
                                (
                                    Color.red(
                                        fresh
                                    ) *
                                        0.45f +
                                        255 *
                                        0.55f
                                    )
                                    .toInt()
                            ),
                            (
                                Color.green(
                                    fresh
                                ) *
                                    0.45f
                                )
                                .toInt(),
                            min(
                                255,
                                (
                                    Color.blue(
                                        fresh
                                    ) *
                                        0.45f +
                                        160 *
                                        0.55f
                                    )
                                    .toInt()
                            )
                        )
                }
            }
        }


        return Bitmap.createBitmap(
            newPixels,
            width,
            height,
            Bitmap.Config.ARGB_8888
        )
    }


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
