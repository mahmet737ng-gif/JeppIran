package com.tareghmsr.jeppiran

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.os.SystemClock
import android.widget.Toast
import android.view.View
import android.webkit.CookieManager
import android.webkit.GeolocationPermissions
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import java.io.ByteArrayInputStream
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewAssetLoader

/**
 * Fully local Android chart UI. All UI, metadata, and airport PDFs are bundled
 * INSIDE the signed APK and served from WebViewAssetLoader (not browser cache).
 * The separately deployed JEPPIRAN website continues to use GitHub Pages.
 * Network requests are only for optional live external services like weather.
 */
class MobileWebActivity : AppCompatActivity() {
    private val appHost = "appassets.androidplatform.net"
    private val appPath = "/assets/jeppiran-web/"
    // Side-by-side Carousel QA build launches only the BUNDLED local test UI.
    // Production application ID keeps its existing owner-approved Classic home.
    private val appUrl: String by lazy {
        if (applicationContext.packageName.endsWith(".phoneqa"))
            "https://$appHost${appPath}preview/airport-carousel-r5/index.html?platform=android-carousel-qa"
        else
            "https://$appHost${appPath}index.html?platform=android-phone"
    }

    private val assetLoader by lazy {
        WebViewAssetLoader.Builder()
            .setDomain(appHost)
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
    }

    private lateinit var browser: WebView
    private lateinit var progress: ProgressBar
    private lateinit var errorMessage: TextView
    private var lastQaBackPress: Long = 0L
    private var geoOrigin: String? = null
    private var geoCallback: GeolocationPermissions.Callback? = null

    private val locationPermission = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        val allowed = grants.values.any { it }
        geoCallback?.invoke(geoOrigin, allowed, false)
        geoCallback = null
        geoOrigin = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        ThemeManager.apply(this)
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.rgb(5, 19, 33)
        window.navigationBarColor = Color.rgb(5, 19, 33)

        val root = FrameLayout(this).apply {
            setBackgroundColor(Color.rgb(5, 19, 33))
        }
        browser = WebView(this).apply {
            setBackgroundColor(Color.rgb(5, 19, 33))
            overScrollMode = View.OVER_SCROLL_NEVER
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                setGeolocationEnabled(true)
                useWideViewPort = true
                loadWithOverviewMode = false
                builtInZoomControls = false
                displayZoomControls = false
                allowFileAccess = false
                allowContentAccess = false
                mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                cacheMode = WebSettings.LOAD_NO_CACHE
            }
            CookieManager.getInstance().setAcceptThirdPartyCookies(this, false)
        }
        root.addView(
            browser,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        )

        progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 100
            isIndeterminate = true
        }
        root.addView(
            progress,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                3.dp
            )
        )
        errorMessage = TextView(this).apply {
            text = "Local JEPPIRAN files are missing or unavailable. Install a complete APK. Tap to retry."
            textSize = 16f
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.rgb(5, 19, 33))
            setPadding(20.dp, 25.dp, 20.dp, 25.dp)
            visibility = View.GONE
            setOnClickListener {
                visibility = View.GONE
                browser.reload()
            }
        }
        root.addView(
            errorMessage,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                android.view.Gravity.CENTER
            )
        )
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val safe = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
            )
            view.setPadding(safe.left, safe.top, safe.right, safe.bottom)
            insets
        }
        setContentView(root)

        browser.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView?,
                request: WebResourceRequest?
            ): WebResourceResponse? {
                val uri = request?.url ?: return null
                if (uri.host != appHost) return null // Optional live weather, etc.
                // Fail closed: NEVER fetch an absent Android asset from a website.
                return assetLoader.shouldInterceptRequest(uri)
                    ?: WebResourceResponse(
                        "text/plain", "UTF-8", 404, "Not Found",
                        mapOf("Cache-Control" to "no-store"),
                        ByteArrayInputStream(ByteArray(0))
                    )
            }

            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                val url = request?.url ?: return true
                // The APK Update card uses this private, non-network route.
                // Keep the signed native updater instead of the obsolete
                // web-only "Chart data" popup.
                if (request.isForMainFrame &&
                    url.scheme == "jeppiran" && url.host == "updates"
                ) {
                    startActivity(Intent(this@MobileWebActivity, UpdateActivity::class.java))
                    return true
                }
                if (url.scheme == "https" &&
                    url.host == appHost && url.path.orEmpty().startsWith(appPath)
                ) {
                    // The QA top frame may NEVER fall into the Classic airport
                    // home, even through a stale link. Embedded Classic iframe
                    // requests are subframes and remain allowed.
                    if (packageName.endsWith(".phoneqa") &&
                        request.isForMainFrame &&
                        !url.path.orEmpty().startsWith(
                            appPath + "preview/airport-carousel-r5/"
                        )
                    ) {
                        view?.loadUrl(appUrl)
                        return true
                    }
                    return false
                }
                if (request.isForMainFrame && url.scheme == "https") {
                    startActivity(Intent(Intent.ACTION_VIEW, url))
                }
                return true
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                progress.visibility = View.GONE
                // Android skin is linked in the local HTML before rendering.
                // No site load, browser cache or service worker is involved.
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                if (request?.isForMainFrame == true) {
                    progress.visibility = View.GONE
                    errorMessage.visibility = View.VISIBLE
                }
            }
        }
        browser.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                progress.progress = newProgress
                progress.visibility = if (newProgress >= 100) View.GONE else View.VISIBLE
            }

            override fun onGeolocationPermissionsShowPrompt(
                origin: String?,
                callback: GeolocationPermissions.Callback?
            ) {
                if (origin == null || callback == null ||
                    Uri.parse(origin).host != appHost
                ) {
                    callback?.invoke(origin, false, false)
                    return
                }
                if (
                    ContextCompat.checkSelfPermission(
                        this@MobileWebActivity, Manifest.permission.ACCESS_FINE_LOCATION
                    ) == PackageManager.PERMISSION_GRANTED ||
                    ContextCompat.checkSelfPermission(
                        this@MobileWebActivity, Manifest.permission.ACCESS_COARSE_LOCATION
                    ) == PackageManager.PERMISSION_GRANTED
                ) {
                    callback.invoke(origin, true, false)
                } else {
                    geoOrigin = origin
                    geoCallback = callback
                    locationPermission.launch(
                        arrayOf(
                            Manifest.permission.ACCESS_FINE_LOCATION,
                            Manifest.permission.ACCESS_COARSE_LOCATION
                        )
                    )
                }
            }
        }
        // Always start from installed APK assets; never restore a prior
        // session pointing to the now-retired hosted website.
        browser.loadUrl(appUrl)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        browser.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    override fun onBackPressed() {
        // Android's navigation-bar/edge Back gesture replaces any old on-screen
        // Back arrow. Let JEPPIRAN close chart -> profile -> Home in order.
        // Never navigate back into the obsolete hosted website.
        if (!::browser.isInitialized) {
            super.onBackPressed()
            return
        }
        browser.evaluateJavascript(
            "(function(){return window.jeppiranAndroidBack ? window.jeppiranAndroidBack() : false})()"
        ) { result ->
            if (isFinishing || isDestroyed) return@evaluateJavascript
            if (result == "true") {
                lastQaBackPress = 0L
                return@evaluateJavascript
            }
            if (packageName.endsWith(".phoneqa")) {
                // QA is deliberately separate from production. At its landing
                // screen, one stray Android back gesture must NOT kill it.
                val now = SystemClock.elapsedRealtime()
                if (now - lastQaBackPress < 2000L && lastQaBackPress != 0L) {
                    lastQaBackPress = 0L
                    finish()
                } else {
                    lastQaBackPress = now
                    Toast.makeText(
                        this@MobileWebActivity,
                        "Carousel QA: press Back again to exit",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            } else {
                // Original JeppIran keeps its approved Home/back behavior.
                super.onBackPressed()
            }
        }
    }

    override fun onDestroy() {
        geoCallback?.invoke(geoOrigin, false, false)
        geoCallback = null
        browser.destroy()
        super.onDestroy()
    }

    private val Int.dp: Int
        get() = (this * resources.displayMetrics.density + 0.5f).toInt()
}
