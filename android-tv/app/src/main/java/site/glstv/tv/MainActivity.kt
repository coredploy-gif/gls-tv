package site.glstv.tv

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.webkit.*
import android.widget.FrameLayout
import android.widget.ProgressBar
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewFeature

/** Shared secure web shell for the TV and mobile GLS TV variants. */
class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private lateinit var progress: ProgressBar
    private lateinit var offlinePanel: View
    private lateinit var retryButton: View
    private var customView: View? = null
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null
    private var fullscreenContainer: FrameLayout? = null
    private var lastRequestedUrl: String = ""

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        webView = findViewById(R.id.webview)
        progress = findViewById(R.id.progress)
        offlinePanel = findViewById(R.id.offline_panel)
        retryButton = findViewById(R.id.retry_button)
        fullscreenContainer = findViewById(R.id.fullscreen_container)
        if (BuildConfig.GLS_TV_MODE) enterImmersiveMode()
        configureCookies()
        configureWebView()
        retryButton.setOnClickListener {
            offlinePanel.visibility = View.GONE
            val retryUrl = lastRequestedUrl.ifBlank { resolveLaunchUrl(intent) }
            webView.loadUrl(retryUrl)
        }
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (customView != null) hideCustomView() else dispatchWebBack()
            }
        })
        if (savedInstanceState != null) webView.restoreState(savedInstanceState)
        else openUrl(resolveLaunchUrl(intent))
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        openUrl(resolveLaunchUrl(intent))
    }

    private fun openUrl(url: String) {
        lastRequestedUrl = url
        offlinePanel.visibility = View.GONE
        webView.loadUrl(url)
    }

    private fun resolveLaunchUrl(intent: Intent?): String {
        val deepLink = intent?.data?.toString()?.takeIf(::isGlsUrl)
        val url = deepLink ?: BuildConfig.GLS_BASE_URL.trimEnd('/') + BuildConfig.GLS_START_PATH
        return if (BuildConfig.GLS_TV_MODE) ensureTvParam(url) else url
    }

    private fun enterImmersiveMode() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    private fun configureCookies() = CookieManager.getInstance().run {
        setAcceptCookie(true)
        setAcceptThirdPartyCookies(webView, true)
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
            loadWithOverviewMode = BuildConfig.GLS_TV_MODE
            builtInZoomControls = false
            displayZoomControls = false
            setSupportZoom(false)
            allowFileAccess = false
            allowContentAccess = false
            javaScriptCanOpenWindowsAutomatically = false
            userAgentString = "$userAgentString ${BuildConfig.GLS_USER_AGENT_SUFFIX}"
        }
        webView.setBackgroundColor(0xFF0A0A0A.toInt())
        webView.isFocusable = true
        webView.isFocusableInTouchMode = true
        webView.requestFocus()
        if (WebViewFeature.isFeatureSupported(WebViewFeature.FORCE_DARK)) {
            @Suppress("DEPRECATION")
            WebSettingsCompat.setForceDark(webView.settings, WebSettingsCompat.FORCE_DARK_OFF)
        }
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url?.toString() ?: return false
                if (isGlsUrl(url)) {
                    if (BuildConfig.GLS_TV_MODE && Uri.parse(url).getQueryParameter("tv") != "1") {
                        view.loadUrl(ensureTvParam(url))
                        return true
                    }
                    return false
                }
                if (isSupabaseUrl(url)) return false
                if (!BuildConfig.GLS_TV_MODE && (url.startsWith("https://") || url.startsWith("http://"))) {
                    runCatching { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
                }
                return true
            }

            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                if (url != null && isGlsUrl(url)) lastRequestedUrl = url
                offlinePanel.visibility = View.GONE
                progress.visibility = View.VISIBLE
            }

            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: WebResourceError,
            ) {
                super.onReceivedError(view, request, error)
                if (request.isForMainFrame) showOffline()
            }

            @Suppress("DEPRECATION")
            override fun onReceivedError(
                view: WebView,
                errorCode: Int,
                description: String?,
                failingUrl: String?,
            ) {
                super.onReceivedError(view, errorCode, description, failingUrl)
                showOffline()
            }

            override fun onReceivedHttpError(
                view: WebView,
                request: WebResourceRequest,
                errorResponse: WebResourceResponse,
            ) {
                super.onReceivedHttpError(view, request, errorResponse)
                if (request.isForMainFrame && errorResponse.statusCode >= 500) showOffline()
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                progress.visibility = View.GONE
                if (!BuildConfig.GLS_TV_MODE) return
                view?.evaluateJavascript("""
                    (function(){try{
                      document.documentElement.setAttribute('data-tv','1');
                      document.documentElement.classList.add('gls-tv-nav');
                      try{sessionStorage.setItem('gls-tv-nav','1');}catch(e){}
                    }catch(e){}})();
                """.trimIndent(), null)
            }
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                progress.progress = newProgress
                progress.visibility = if (newProgress in 1..99) View.VISIBLE else View.GONE
            }
            override fun onShowCustomView(view: View?, callback: CustomViewCallback?) {
                if (customView != null) { callback?.onCustomViewHidden(); return }
                customView = view
                customViewCallback = callback
                webView.visibility = View.GONE
                fullscreenContainer?.visibility = View.VISIBLE
                fullscreenContainer?.addView(view)
            }
            override fun onHideCustomView() = hideCustomView()
        }
    }

    /** Gives dialogs and the player first refusal before navigating or exiting. */
    private fun dispatchWebBack() {
        webView.evaluateJavascript("""
            (function(){try{
              var e=new CustomEvent('gls-tv-back',{cancelable:true});
              return window.dispatchEvent(e)?'unhandled':'handled';
            }catch(e){return 'unhandled';}})();
        """.trimIndent()) { result ->
            if (result == "\"handled\"") return@evaluateJavascript
            if (webView.canGoBack()) webView.goBack() else finish()
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

    private fun showOffline() {
        progress.visibility = View.GONE
        offlinePanel.visibility = View.VISIBLE
        retryButton.requestFocus()
    }

    /** Normalize hardware transport buttons across TV remotes and Bluetooth controllers. */
    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.action == KeyEvent.ACTION_DOWN) {
            val webKey = when (event.keyCode) {
                KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE, KeyEvent.KEYCODE_HEADSETHOOK -> "MediaPlayPause"
                KeyEvent.KEYCODE_MEDIA_PLAY -> "MediaPlay"
                KeyEvent.KEYCODE_MEDIA_PAUSE, KeyEvent.KEYCODE_MEDIA_STOP -> "MediaPause"
                KeyEvent.KEYCODE_MEDIA_NEXT, KeyEvent.KEYCODE_CHANNEL_DOWN -> "ChannelDown"
                KeyEvent.KEYCODE_MEDIA_PREVIOUS, KeyEvent.KEYCODE_CHANNEL_UP -> "ChannelUp"
                KeyEvent.KEYCODE_MEDIA_FAST_FORWARD -> "l"
                KeyEvent.KEYCODE_MEDIA_REWIND -> "j"
                else -> null
            }
            if (webKey != null && ::webView.isInitialized) {
                webView.evaluateJavascript(
                    "window.dispatchEvent(new KeyboardEvent('keydown',{key:'$webKey'}));",
                    null,
                )
                return true
            }
        }
        return super.dispatchKeyEvent(event)
    }

    override fun onSaveInstanceState(outState: Bundle) { super.onSaveInstanceState(outState); webView.saveState(outState) }
    override fun onPause() { webView.onPause(); CookieManager.getInstance().flush(); super.onPause() }
    override fun onResume() { super.onResume(); webView.onResume(); if (BuildConfig.GLS_TV_MODE) enterImmersiveMode() }
    override fun onDestroy() {
        webView.apply { loadUrl("about:blank"); stopLoading(); clearHistory(); removeAllViews(); destroy() }
        super.onDestroy()
    }

    companion object {
        private fun isGlsUrl(url: String): Boolean = runCatching {
            val host = Uri.parse(url).host?.lowercase() ?: return false
            host == "glstv.site" || host.endsWith(".glstv.site") || host == "gls-tv.vercel.app" ||
                (host.endsWith(".vercel.app") && host.contains("gls"))
        }.getOrDefault(false)
        private fun isSupabaseUrl(url: String): Boolean = runCatching {
            Uri.parse(url).host?.lowercase()?.endsWith(".supabase.co") == true
        }.getOrDefault(false)
        fun ensureTvParam(url: String): String {
            val uri = Uri.parse(url)
            if (uri.getQueryParameter("tv") == "1") return url
            val builder = uri.buildUpon().clearQuery()
            for (name in uri.queryParameterNames) {
                if (name != "tv") for (value in uri.getQueryParameters(name)) builder.appendQueryParameter(name, value)
            }
            return builder.appendQueryParameter("tv", "1").build().toString()
        }
    }
}
