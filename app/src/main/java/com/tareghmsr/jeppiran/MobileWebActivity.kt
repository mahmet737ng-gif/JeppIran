package com.tareghmsr.jeppiran

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
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
import org.json.JSONObject

/**
 * Online-only Android phone rendering of the same JEPPIRAN web UI used on iPad.
 * This is a QA entry point, NOT a subscription security boundary.
 *
 * Do not enable paid chart access until server-side authentication, private
 * encrypted chart storage, and license checks replace public PDF URLs.
 */
class MobileWebActivity : AppCompatActivity() {
    private val appHost = "mahmet737ng-gif.github.io"
    private val appPath = "/JeppIran/"
    private val appUrl = "https://$appHost$appPath?platform=android-phone&native_revision=2621-charts-content-r1"

    private lateinit var browser: WebView
    private lateinit var progress: ProgressBar
    private lateinit var errorMessage: TextView
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
            text = "Could not load JEPPIRAN. Check your internet connection. Tap to retry."
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
                // The hosted iPad app auto-downloads ALL airport PDFs for offline use.
                // Disable only this bulk downloader inside the Android phone preview.
                // Keep the approved iPad website unchanged.
                val uri = request?.url
                if (uri?.host == appHost &&
                    uri.path.orEmpty().endsWith("/offline-manager.js")
                ) {
                    return WebResourceResponse(
                        "application/javascript",
                        "UTF-8",
                        ByteArrayInputStream("/* Online-only Android preview */".toByteArray())
                    )
                }
                return null
            }

            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                val url = request?.url ?: return true
                if (url.scheme == "https" &&
                    url.host == appHost && url.path.orEmpty().startsWith(appPath)
                ) return false
                if (request.isForMainFrame && url.scheme == "https") {
                    startActivity(Intent(Intent.ACTION_VIEW, url))
                }
                return true
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                progress.visibility = View.GONE
                if (url != null && Uri.parse(url).host == appHost) {
                    applyPhoneLayout()
                    discardStalePhoneServiceWorkers()
                }
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
        // Android chart UI is online-only: discard stale WebView HTTP cache
        // rather than mixing old HTML and current airport metadata.
        browser.clearCache(true)
        if (savedInstanceState == null) browser.loadUrl(appUrl)
        else browser.restoreState(savedInstanceState)
    }

    private fun discardStalePhoneServiceWorkers() {
        // Dedicated online-only Android WebView storage. A prior installed
        // JEPPIRAN PWA worker may keep obsolete HTML/JS after an APK upgrade.
        // Do not affect Safari/iPad service workers or native chart assets.
        val script = """
            (async () => {
              const marker = 'jeppiran-android-chart-cache-reset-r1';
              try {
                if (sessionStorage.getItem(marker) === 'done') return;
                sessionStorage.setItem(marker, 'done');
                const regs = 'serviceWorker' in navigator
                    ? await navigator.serviceWorker.getRegistrations() : [];
                await Promise.all(regs.map(reg => reg.unregister()));
                if ('caches' in window) {
                  const keys = await caches.keys();
                  await Promise.all(keys.filter(key => key.startsWith('jeppiran-'))
                    .map(key => caches.delete(key)));
                }
                if (regs.length) location.reload();
              } catch(error) {
                console.warn('JEPPIRAN Android shell refresh', error);
              }
            })();
        """.trimIndent()
        browser.evaluateJavascript(script, null)
    }

    private fun applyPhoneLayout() {
        val css = assets.open("phone-layout.css").bufferedReader().use { it.readText() }
        val script = """
            (() => {
                document.documentElement.classList.add('jp-android-phone');
                let sheet = document.getElementById('jp-android-phone-css');
                if (!sheet) {
                    sheet = document.createElement('style');
                    sheet.id = 'jp-android-phone-css';
                    document.head.appendChild(sheet);
                }
                sheet.textContent = ${JSONObject.quote(css)};
            })();
        """.trimIndent()
        browser.evaluateJavascript(script, null)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        browser.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    override fun onBackPressed() {
        if (browser.canGoBack()) browser.goBack() else super.onBackPressed()
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
