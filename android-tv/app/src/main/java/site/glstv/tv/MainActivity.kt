package site.glstv.tv

import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.ProgressBar
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewFeature

/**
 * Professional Android TV shell for GLS TV.
 * Loads the production HTTPS site in a leanback-friendly WebView with ?tv=1.
 */
class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView
    private lateinit var progress: ProgressBar
    private var customView: View? = null
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null
    private var fullscreenContainer: FrameLayout? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webview)
        progress = findViewById(R.id.progress)
        fullscreenContainer = findViewById(R.id.fullscreen_container)

        enterImmersiveMode()
        configureCookies()
        configureWebView()

        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    when {
                        customView != null -> hideCustomView()
                        webView.canGoBack() -> webView.goBack()
                        else -> {
                            isEnabled = false
                            onBackPressedDispatcher.onBackPressed()
                        }
                    }
                }
            },
        )

        val startUrl = BuildConfig.GLS_BASE_URL.trimEnd('/') + BuildConfig.GLS_START_PATH
        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState)
        } else {
            webView.loadUrl(ensureTvParam(startUrl))
        }
    }

    private fun enterImmersiveMode() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        val controller = WindowInsetsControllerCompat(window, window.decorView)
        controller.hide(WindowInsetsCompat.Type.systemBars())
        controller.systemBarsBehavior =
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    }

    private fun configureCookies() {
        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, true)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        with(webView.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            cacheMode = WebSettings.LOAD_DEFAULT
            useWideViewPort = true
            loadWithOverviewMode = true
            builtInZoomControls = false
            displayZoomControls = false
            setSupportZoom(false)
            allowFileAccess = false
            allowContentAccess = false
            javaScriptCanOpenWindowsAutomatically = false
            userAgentString =
                "$userAgentString ${BuildConfig.GLS_USER_AGENT_SUFFIX}"
        }

        webView.setBackgroundColor(0xFF0A0A0A.toInt())
        webView.isFocusable = true
        webView.isFocusableInTouchMode = true
        webView.requestFocus()

        // Prefer leanback-style pointer / focus when supported.
        if (WebViewFeature.isFeatureSupported(WebViewFeature.FORCE_DARK)) {
            @Suppress("DEPRECATION")
            WebSettingsCompat.setForceDark(webView.settings, WebSettingsCompat.FORCE_DARK_OFF)
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest,
            ): Boolean {
                val url = request.url?.toString() ?: return false
                if (!isAllowedHost(url)) {
                    // Keep users inside GLS for auth / watch flows.
                    return true
                }
                if (!url.contains("tv=1") && isGlsUrl(url)) {
                    view.loadUrl(ensureTvParam(url))
                    return true
                }
                return false
            }

            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                progress.visibility = View.VISIBLE
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                progress.visibility = View.GONE
                // Reinforce TV mode in case SPA navigations drop the query.
                view?.evaluateJavascript(
                    """
                    (function(){
                      try {
                        document.documentElement.setAttribute('data-tv','1');
                        document.documentElement.classList.add('gls-tv-nav');
                        try { sessionStorage.setItem('gls-tv-nav','1'); } catch(e) {}
                      } catch(e) {}
                    })();
                    """.trimIndent(),
                    null,
                )
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                progress.progress = newProgress
                progress.visibility = if (newProgress in 1..99) View.VISIBLE else View.GONE
            }

            override fun onShowCustomView(view: View?, callback: CustomViewCallback?) {
                if (customView != null) {
                    callback?.onCustomViewHidden()
                    return
                }
                customView = view
                customViewCallback = callback
                webView.visibility = View.GONE
                fullscreenContainer?.visibility = View.VISIBLE
                fullscreenContainer?.addView(view)
            }

            override fun onHideCustomView() {
                hideCustomView()
            }
        }
    }

    private fun hideCustomView() {
        customView?.let { fullscreenContainer?.removeView(it) }
        customView = null
        customViewCallback?.onCustomViewHidden()
        customViewCallback = null
        fullscreenContainer?.visibility = View.GONE
        webView.visibility = View.VISIBLE
        webView.requestFocus()
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        // Forward DPAD into the page; WebView handles most keys natively.
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            return super.onKeyDown(keyCode, event)
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onPause() {
        webView.onPause()
        CookieManager.getInstance().flush()
        super.onPause()
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
        enterImmersiveMode()
    }

    override fun onDestroy() {
        webView.apply {
            loadUrl("about:blank")
            stopLoading()
            clearHistory()
            removeAllViews()
            destroy()
        }
        super.onDestroy()
    }

    companion object {
        private fun isGlsUrl(url: String): Boolean {
            return try {
                val host = android.net.Uri.parse(url).host?.lowercase() ?: return false
                host == "glstv.site" ||
                    host.endsWith(".glstv.site") ||
                    host == "gls-tv.vercel.app" ||
                    (host.endsWith(".vercel.app") && host.contains("gls"))
            } catch (_: Exception) {
                false
            }
        }

        private fun isAllowedHost(url: String): Boolean {
            if (isGlsUrl(url)) return true
            return try {
                val host = android.net.Uri.parse(url).host?.lowercase() ?: return false
                // Supabase auth / storage callbacks stay in-app.
                host.endsWith(".supabase.co") ||
                    host == "accounts.google.com" ||
                    host.endsWith(".google.com")
            } catch (_: Exception) {
                false
            }
        }

        fun ensureTvParam(url: String): String {
            val uri = android.net.Uri.parse(url)
            if (uri.getQueryParameter("tv") == "1") return url
            val builder = uri.buildUpon().clearQuery()
            val names = uri.queryParameterNames
            for (name in names) {
                if (name == "tv") continue
                for (value in uri.getQueryParameters(name)) {
                    builder.appendQueryParameter(name, value)
                }
            }
            builder.appendQueryParameter("tv", "1")
            return builder.build().toString()
        }
    }
}
