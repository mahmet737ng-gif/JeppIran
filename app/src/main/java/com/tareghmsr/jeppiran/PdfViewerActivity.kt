package com.tareghmsr.jeppiran

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.os.Bundle
import android.os.ParcelFileDescriptor
import android.view.Gravity
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import java.io.File

class PdfViewerActivity : ComponentActivity() {

    private var renderer: PdfRenderer? = null
    private var descriptor: ParcelFileDescriptor? = null
    private var currentPage = 0

    private lateinit var imageView: ImageView
    private lateinit var pageLabel: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val requestedPage =
            (intent.getIntExtra("PAGE", 1) - 1)
                .coerceAtLeast(0)

        currentPage = requestedPage

        val file = File(
            filesDir,
            "Iran2620.pdf"
        )

        if (!file.exists()) {
            showNotDownloaded()
            return
        }

        descriptor = ParcelFileDescriptor.open(
            file,
            ParcelFileDescriptor.MODE_READ_ONLY
        )

        renderer = PdfRenderer(descriptor!!)

        buildUi()
        showPage(currentPage)
    }

    private fun buildUi() {

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.BLACK)
        }

        val toolbar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setBackgroundColor(Color.rgb(20, 25, 30))
        }

        val back = ImageButton(this).apply {
            setImageResource(
                android.R.drawable.ic_menu_revert
            )

            setOnClickListener {
                finish()
            }
        }

        toolbar.addView(
            back,
            LinearLayout.LayoutParams(55, 55)
        )

        pageLabel = TextView(this).apply {
            textColor()
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

        val previous = TextView(this).apply {
            text = "‹"
            textColor()
            textSize = 32f
            gravity = Gravity.CENTER

            setOnClickListener {
                showPage(currentPage - 1)
            }
        }

        toolbar.addView(
            previous,
            LinearLayout.LayoutParams(55, 55)
        )

        val next = TextView(this).apply {
            text = "›"
            textColor()
            textSize = 32f
            gravity = Gravity.CENTER

            setOnClickListener {
                showPage(currentPage + 1)
            }
        }

        toolbar.addView(
            next,
            LinearLayout.LayoutParams(55, 55)
        )

        root.addView(toolbar)

        val scroll =
            androidx.core.widget.NestedScrollView(this)

        val zoomContainer =
            android.widget.FrameLayout(this)

        imageView = ImageView(this).apply {
            scaleType = ImageView.ScaleType.FIT_CENTER
            setBackgroundColor(Color.BLACK)
        }

        zoomContainer.addView(
            imageView,
            android.widget.FrameLayout.LayoutParams(
                -1,
                -1
            )
        )

        scroll.addView(
            zoomContainer,
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

    private fun showPage(index: Int) {

        val pdf = renderer ?: return

        if (index < 0 || index >= pdf.pageCount) {
            return
        }

        currentPage = index

        val page = pdf.openPage(index)

        val width = page.width * 2
        val height = page.height * 2

        val bitmap = Bitmap.createBitmap(
            width,
            height,
            Bitmap.Config.ARGB_8888
        )

        bitmap.eraseColor(Color.WHITE)

        page.render(
            bitmap,
            null,
            null,
            PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY
        )

        page.close()

        imageView.setImageBitmap(bitmap)

        pageLabel.text =
            "Page ${index + 1} / ${pdf.pageCount}"
    }

    private fun showNotDownloaded() {

        val text = TextView(this).apply {
            text = "Iran2620.pdf is not downloaded."
            textSize = 18f
            gravity = Gravity.CENTER
            setTextColor(Color.WHITE)
        }

        setContentView(text)
    }

    private fun TextView.textColor() {
        setTextColor(Color.WHITE)
    }

    override fun onDestroy() {
        renderer?.close()
        descriptor?.close()
        super.onDestroy()
    }
}
