package com.tareghmsr.jeppiran

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.ParcelFileDescriptor
import android.view.Gravity
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.activity.ComponentActivity
import java.io.BufferedInputStream
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

class PdfViewerActivity : ComponentActivity() {

    private var renderer: PdfRenderer? = null
    private var descriptor: ParcelFileDescriptor? = null

    private var currentPage = 0

    private lateinit var imageView: ImageView
    private lateinit var pageLabel: TextView
    private lateinit var statusLabel: TextView
    private lateinit var progressBar: ProgressBar

    private val handler = Handler(Looper.getMainLooper())

    /*
     * GitHub LFS resolved download URL
     */
    private val pdfUrl =
        "https://media.githubusercontent.com/media/mahmet737ng-gif/JeppIran/main/Iran2620.pdf"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        currentPage =
            (intent.getIntExtra("PAGE", 1) - 1)
                .coerceAtLeast(0)

        val file = File(
            filesDir,
            "Iran2620.pdf"
        )

        if (file.exists() && file.length() > 0) {

            buildUi()
            openPdf(file)

        } else {

            buildDownloadUi()
            downloadPdf(file)
        }
    }

    /*
     * Normal PDF viewer UI
     */
    private fun buildUi() {

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.BLACK)
        }

        /*
         * Toolbar
         */
        val toolbar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setBackgroundColor(
                Color.rgb(20, 25, 30)
            )
        }

        val back = ImageButton(this).apply {

            setImageResource(
                android.R.drawable.ic_menu_revert
            )

            setBackgroundColor(
                Color.TRANSPARENT
            )

            setOnClickListener {
                finish()
            }
        }

        toolbar.addView(
            back,
            LinearLayout.LayoutParams(
                55,
                55
            )
        )

        pageLabel = TextView(this).apply {

            setTextColor(Color.WHITE)

            gravity = Gravity.CENTER

            textSize = 15f
        }

        toolbar.addView(
            pageLabel,
            LinearLayout.LayoutParams(
                0,
                55,
                1f
            )
        )

        /*
         * Previous page
         */
        val previous = TextView(this).apply {

            text = "‹"

            setTextColor(Color.WHITE)

            textSize = 32f

            gravity = Gravity.CENTER

            setOnClickListener {

                showPage(
                    currentPage - 1
                )
            }
        }

        toolbar.addView(
            previous,
            LinearLayout.LayoutParams(
                55,
                55
            )
        )

        /*
         * Next page
         */
        val next = TextView(this).apply {

            text = "›"

            setTextColor(Color.WHITE)

            textSize = 32f

            gravity = Gravity.CENTER

            setOnClickListener {

                showPage(
                    currentPage + 1
                )
            }
        }

        toolbar.addView(
            next,
            LinearLayout.LayoutParams(
                55,
                55
            )
        )

        root.addView(toolbar)

        /*
         * PDF image
         */
        val scroll =
            androidx.core.widget.NestedScrollView(this)

        val container =
            android.widget.FrameLayout(this)

        imageView = ImageView(this).apply {

            scaleType =
                ImageView.ScaleType.FIT_CENTER

            setBackgroundColor(Color.BLACK)
        }

        container.addView(
            imageView,
            android.widget.FrameLayout.LayoutParams(
                -1,
                -1
            )
        )

        scroll.addView(
            container,
            android.widget.FrameLayout.LayoutParams(
                -1,
                -1
            )
        )

        root.addView(
            scroll,
            LinearLayout.LayoutParams(
                -1,
                0,
                1f
            )
        )

        setContentView(root)
    }

    /*
     * Download screen
     */
    private fun buildDownloadUi() {

        val root = LinearLayout(this).apply {

            orientation =
                LinearLayout.VERTICAL

            gravity =
                Gravity.CENTER

            setPadding(
                40,
                40,
                40,
                40
            )

            setBackgroundColor(
                Color.rgb(233, 238, 243)
            )
        }

        val title = TextView(this).apply {

            text =
                "Downloading Iran Airport Charts"

            textSize = 21f

            gravity =
                Gravity.CENTER

            setTextColor(
                Color.rgb(25, 48, 72)
            )
        }

        root.addView(
            title,
            LinearLayout.LayoutParams(
                -1,
                -2
            )
        )

        val size = TextView(this).apply {

            text =
                "Approximately 40 MB"

            textSize = 15f

            gravity =
                Gravity.CENTER

            setTextColor(
                Color.DKGRAY
            )

            setPadding(
                0,
                12,
                0,
                20
            )
        }

        root.addView(
            size,
            LinearLayout.LayoutParams(
                -1,
                -2
            )
        )

        progressBar =
            ProgressBar(
                this,
                null,
                android.R.attr.progressBarStyleHorizontal
            )

        progressBar.max = 100

        root.addView(
            progressBar,
            LinearLayout.LayoutParams(
                -1,
                30
            )
        )

        statusLabel = TextView(this).apply {

            text =
                "Preparing download..."

            textSize = 15f

            gravity =
                Gravity.CENTER

            setTextColor(
                Color.rgb(55, 70, 85)
            )

            setPadding(
                0,
                15,
                0,
                0
            )
        }

        root.addView(
            statusLabel,
            LinearLayout.LayoutParams(
                -1,
                -2
            )
        )

        setContentView(root)
    }

    /*
     * Download PDF
     */
    private fun downloadPdf(
        destination: File
    ) {

        Thread {

            var connection:
                    HttpURLConnection? = null

            val temporaryFile =
                File(
                    filesDir,
                    "Iran2620.pdf.part"
                )

            try {

                handler.post {

                    statusLabel.text =
                        "Connecting to GitHub..."
                }

                connection =
                    URL(pdfUrl)
                        .openConnection()
                            as HttpURLConnection

                connection.connectTimeout =
                    30000

                connection.readTimeout =
                    60000

                connection.instanceFollowRedirects =
                    true

                connection.requestMethod =
                    "GET"

                connection.connect()

                val response =
                    connection.responseCode

                if (
                    response !in
                    200..299
                ) {

                    throw Exception(
                        "HTTP $response"
                    )
                }

                val total =
                    connection.contentLengthLong

                val input =
                    BufferedInputStream(
                        connection.inputStream
                    )

                val output =
                    FileOutputStream(
                        temporaryFile
                    )

                val buffer =
                    ByteArray(64 * 1024)

                var downloaded =
                    0L

                while (true) {

                    val count =
                        input.read(buffer)

                    if (count == -1) {
                        break
                    }

                    output.write(
                        buffer,
                        0,
                        count
                    )

                    downloaded += count

                    if (total > 0) {

                        val percent =
                            (
                                downloaded *
                                    100L /
                                    total
                            )
                                .toInt()

                        val downloadedMb =
                            downloaded /
                                (1024.0 * 1024.0)

                        val totalMb =
                            total /
                                (1024.0 * 1024.0)

                        handler.post {

                            progressBar.progress =
                                percent

                            statusLabel.text =
                                String.format(
                                    "%.1f MB / %.1f MB  (%d%%)",
                                    downloadedMb,
                                    totalMb,
                                    percent
                                )
                        }
                    }
                }

                output.flush()
                output.close()
                input.close()

                if (
                    !temporaryFile.exists() ||
                    temporaryFile.length() == 0L
                ) {

                    throw Exception(
                        "Downloaded file is empty"
                    )
                }

                if (destination.exists()) {
                    destination.delete()
                }

                if (
                    !temporaryFile.renameTo(
                        destination
                    )
                ) {

                    throw Exception(
                        "Could not save PDF"
                    )
                }

                handler.post {

                    statusLabel.text =
                        "Opening chart..."

                    openPdf(destination)
                }

            } catch (e: Exception) {

                e.printStackTrace()

                if (temporaryFile.exists()) {
                    temporaryFile.delete()
                }

                handler.post {

                    statusLabel.text =
                        "Download failed:\n${e.message}"
                }

            } finally {

                connection?.disconnect()
            }

        }.start()
    }

    /*
     * Open PDF
     */
    private fun openPdf(
        file: File
    ) {

        try {

            descriptor =
                ParcelFileDescriptor.open(
                    file,
                    ParcelFileDescriptor.MODE_READ_ONLY
                )

            renderer =
                PdfRenderer(
                    descriptor!!
                )

            buildUi()

            showPage(
                currentPage
            )

        } catch (e: Exception) {

            e.printStackTrace()

            showError(
                "Could not open PDF:\n${e.message}"
            )
        }
    }

    /*
     * Render selected PDF page
     */
    private fun showPage(
        index: Int
    ) {

        val pdf =
            renderer
                ?: return

        if (
            index < 0 ||
            index >= pdf.pageCount
        ) {
            return
        }

        currentPage = index

        val page =
            pdf.openPage(index)

        val width =
            page.width * 2

        val height =
            page.height * 2

        val bitmap =
            Bitmap.createBitmap(
                width,
                height,
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

        imageView.setImageBitmap(
            bitmap
        )

        pageLabel.text =
            "Page ${index + 1} / ${pdf.pageCount}"
    }

    /*
     * Error screen
     */
    private fun showError(
        message: String
    ) {

        val text =
            TextView(this).apply {

                text = message

                textSize = 17f

                gravity = Gravity.CENTER

                setTextColor(
                    Color.WHITE
                )

                setBackgroundColor(
                    Color.BLACK
                )

                setPadding(
                    30,
                    30,
                    30,
                    30
                )
            }

        setContentView(text)
    }

    override fun onDestroy() {

        renderer?.close()

        descriptor?.close()

        super.onDestroy()
    }
}
