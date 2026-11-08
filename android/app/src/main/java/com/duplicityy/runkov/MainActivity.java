package com.duplicityy.runkov;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.res.AssetManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import java.io.ByteArrayInputStream;
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** A fullscreen, hardware-accelerated shell around the bundled game. */
public final class MainActivity extends Activity {
    static final String GAME_ORIGIN = "https://appassets.androidplatform.net";
    private static final String GAME_URL = GAME_ORIGIN + "/assets/www/index.html";
    private static final Pattern RANGE = Pattern.compile("bytes=(\\d+)-(\\d*)");
    private WebView webView;
    private GamepadBridge controllers;
    private FrameLayout root;
    private View fullscreenView;
    private WebChromeClient.CustomViewCallback fullscreenCallback;
    private boolean backPending;
    private boolean destroyed;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= 28) {
            getWindow().getAttributes().layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        setContentView(root);
        createGameView();
        immersive();
    }

    private void createGameView() {
        webView = new WebView(this);
        webView.setBackgroundColor(Color.BLACK);
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setGeolocationEnabled(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSafeBrowsingEnabled(true);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setWebViewClient(new LocalGameClient());
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public void onShowCustomView(View view, CustomViewCallback callback) {
                if (fullscreenView != null) { callback.onCustomViewHidden(); return; }
                fullscreenView = view;
                fullscreenCallback = callback;
                root.addView(view, new FrameLayout.LayoutParams(-1, -1));
                webView.setVisibility(View.GONE);
                immersive();
            }
            @Override public void onHideCustomView() { leaveFullscreen(); }
            @Override public boolean onConsoleMessage(ConsoleMessage message) {
                if (BuildConfig.DEBUG) android.util.Log.d("Runkov", message.message());
                return true;
            }
        });
        root.addView(webView, new FrameLayout.LayoutParams(-1, -1));
        controllers = new GamepadBridge(this, webView);
        webView.loadUrl(GAME_URL);
    }

    private void leaveFullscreen() {
        if (fullscreenView == null) return;
        root.removeView(fullscreenView);
        fullscreenView = null;
        webView.setVisibility(View.VISIBLE);
        if (fullscreenCallback != null) fullscreenCallback.onCustomViewHidden();
        fullscreenCallback = null;
        immersive();
    }

    private void immersive() {
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController insets = getWindow().getInsetsController();
            if (insets != null) {
                insets.hide(WindowInsets.Type.systemBars());
                insets.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        }
    }

    @Override public void onWindowFocusChanged(boolean focused) {
        super.onWindowFocusChanged(focused);
        if (focused) {
            immersive();
            hostFocus();
        } else if (controllers != null && webView != null) {
            controllers.clear();
            webView.evaluateJavascript("window.dispatchEvent(new Event('blur'));", null);
        }
    }

    @Override protected void onPause() {
        if (controllers != null) controllers.clear();
        if (webView != null) {
            webView.evaluateJavascript("if(typeof window.__runkovNativePause==='function')window.__runkovNativePause();", null);
            webView.onPause();
        }
        super.onPause();
    }

    @Override protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
        if (controllers != null) controllers.refresh();
        hostFocus();
        immersive();
    }

    private void hostFocus() {
        if (webView != null) webView.evaluateJavascript("window.dispatchEvent(new Event('focus'));", null);
    }

    @Override protected void onDestroy() {
        destroyed = true;
        if (controllers != null) controllers.dispose();
        if (webView != null) {
            root.removeView(webView);
            webView.stopLoading();
            webView.destroy();
        }
        super.onDestroy();
    }

    @Override public boolean dispatchGenericMotionEvent(MotionEvent event) {
        return controllers != null && controllers.motion(event) || super.dispatchGenericMotionEvent(event);
    }

    @Override public boolean dispatchKeyEvent(KeyEvent event) {
        return controllers != null && controllers.key(event) || super.dispatchKeyEvent(event);
    }

    @Override public void onBackPressed() {
        if (fullscreenView != null) { leaveFullscreen(); return; }
        if (webView == null || backPending) return;
        backPending = true;
        webView.evaluateJavascript("typeof window.__runkovNativeBack==='function'&&window.__runkovNativeBack()", result -> {
            backPending = false;
            if (!destroyed && !"true".equals(result)) finish();
        });
    }

    private final class LocalGameClient extends WebViewClient {
        @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            return localAsset(request.getUrl(), request.getMethod(), request.getRequestHeaders());
        }

        @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if ("https".equals(uri.getScheme()) && "appassets.androidplatform.net".equals(uri.getHost())) return false;
            if (!request.isForMainFrame()) return true;
            if ("https".equals(uri.getScheme()) || "http".equals(uri.getScheme())) {
                try { startActivity(new Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE)); }
                catch (ActivityNotFoundException ignored) { Toast.makeText(MainActivity.this, "No browser is available for this link.", Toast.LENGTH_SHORT).show(); }
            }
            return true;
        }

        @Override public void onPageFinished(WebView view, String url) {
            if (url.startsWith(GAME_ORIGIN + "/") && controllers != null) controllers.publish();
            immersive();
        }

        @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (request.isForMainFrame() && !destroyed) {
                new AlertDialog.Builder(MainActivity.this).setMessage("The game could not be opened. Try reopening it.")
                    .setPositiveButton("Retry", (dialog, which) -> webView.loadUrl(GAME_URL))
                    .setNegativeButton("Close", (dialog, which) -> finish()).show();
            }
        }

        @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
            if (controllers != null) controllers.dispose();
            controllers = null;
            root.removeView(view);
            view.destroy();
            webView = null;
            if (!destroyed) {
                new AlertDialog.Builder(MainActivity.this).setMessage("The game needs to restart.")
                    .setPositiveButton("Restart", (dialog, which) -> createGameView())
                    .setNegativeButton("Close", (dialog, which) -> finish()).show();
            }
            return true;
        }
    }

    private WebResourceResponse localAsset(Uri uri, String method, Map<String, String> requestHeaders) {
        if (!"https".equals(uri.getScheme()) || !"appassets.androidplatform.net".equals(uri.getHost())) return null;
        String path = uri.getPath();
        if (path == null || !path.startsWith("/assets/www/") || (!"GET".equals(method) && !"HEAD".equals(method))) return error(404);
        String name = path.substring("/assets/www/".length());
        if (name.isEmpty()) name = "index.html";
        for (String segment : name.split("/")) if (segment.equals("..") || segment.indexOf('\\') >= 0 || segment.indexOf('\0') >= 0) return error(404);
        try {
            InputStream stream = getAssets().open(name, AssetManager.ACCESS_STREAMING);
            long length = stream.available();
            Map<String, String> headers = new HashMap<>();
            headers.put("Cache-Control", "no-cache");
            headers.put("X-Content-Type-Options", "nosniff");
            headers.put("Accept-Ranges", "bytes");
            headers.put("Content-Length", Long.toString(length));
            String range = null;
            for (Map.Entry<String, String> header : requestHeaders.entrySet()) if (header.getKey().equalsIgnoreCase("Range")) range = header.getValue();
            int status = 200;
            if (range != null) {
                Matcher match = RANGE.matcher(range);
                if (match.matches()) {
                    long start = Long.parseLong(match.group(1));
                    long end = match.group(2).isEmpty() ? length - 1 : Math.min(length - 1, Long.parseLong(match.group(2)));
                    if (start < 0 || start > end || start >= length) { stream.close(); return error(416); }
                    long skipped = 0;
                    while (skipped < start) {
                        long count = stream.skip(start - skipped);
                        if (count == 0) { if (stream.read() < 0) throw new IOException("Short asset"); count = 1; }
                        skipped += count;
                    }
                    stream = new LimitedInputStream(stream, end - start + 1);
                    headers.put("Content-Range", "bytes " + start + "-" + end + "/" + length);
                    headers.put("Content-Length", Long.toString(end - start + 1));
                    status = 206;
                }
            }
            if (method.equals("HEAD")) { stream.close(); stream = new ByteArrayInputStream(new byte[0]); }
            String mime = mime(name);
            String encoding = mime.startsWith("text/") || mime.contains("json") || mime.contains("javascript") ? "UTF-8" : null;
            return new WebResourceResponse(mime, encoding, status, status == 206 ? "Partial Content" : "OK", headers, stream);
        } catch (IOException | NumberFormatException error) {
            return error(404);
        }
    }

    private static WebResourceResponse error(int status) {
        String message = status == 416 ? "Range Not Satisfiable" : "Not Found";
        return new WebResourceResponse("text/plain", "UTF-8", status, message, java.util.Collections.emptyMap(),
            new ByteArrayInputStream(message.getBytes(StandardCharsets.UTF_8)));
    }

    private static String mime(String name) {
        String file = name.toLowerCase(Locale.ROOT);
        if (file.endsWith(".html")) return "text/html";
        if (file.endsWith(".js") || file.endsWith(".mjs")) return "application/javascript";
        if (file.endsWith(".css")) return "text/css";
        if (file.endsWith(".json")) return "application/json";
        if (file.endsWith(".png")) return "image/png";
        if (file.endsWith(".jpg") || file.endsWith(".jpeg")) return "image/jpeg";
        if (file.endsWith(".webp")) return "image/webp";
        if (file.endsWith(".svg")) return "image/svg+xml";
        if (file.endsWith(".glb")) return "model/gltf-binary";
        if (file.endsWith(".gltf")) return "model/gltf+json";
        if (file.endsWith(".wasm")) return "application/wasm";
        if (file.endsWith(".ttf")) return "font/ttf";
        if (file.endsWith(".woff2")) return "font/woff2";
        if (file.endsWith(".ogg")) return "audio/ogg";
        if (file.endsWith(".mp3")) return "audio/mpeg";
        if (file.endsWith(".wav")) return "audio/wav";
        return "application/octet-stream";
    }

    private static final class LimitedInputStream extends FilterInputStream {
        private long remaining;
        LimitedInputStream(InputStream stream, long remaining) { super(stream); this.remaining = remaining; }
        @Override public int read() throws IOException {
            if (remaining <= 0) return -1;
            int value = super.read();
            if (value >= 0) remaining--;
            return value;
        }
        @Override public int read(byte[] buffer, int offset, int count) throws IOException {
            if (remaining <= 0) return -1;
            int value = super.read(buffer, offset, (int) Math.min(count, remaining));
            if (value > 0) remaining -= value;
            return value;
        }
        @Override public int available() throws IOException { return (int) Math.min(super.available(), remaining); }
    }
}
