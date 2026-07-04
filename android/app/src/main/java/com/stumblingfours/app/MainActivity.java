package com.stumblingfours.app;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    // Track whether the soft keyboard is currently visible.
    // While it is up we must NOT re-apply immersive mode — doing so
    // cancels the IME session and freezes inputs.
    private boolean keyboardVisible = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Clear WebView cache on every launch so updated APKs load fresh JS
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().clearCache(true);
        }

        setupWindow();
        listenForKeyboard();
    }

    @Override
    public void onResume() {
        super.onResume();
        if (!keyboardVisible) {
            applyImmersive();
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        // Only re-apply when we regain focus AND keyboard is not open.
        // This is safe: the keyboard being shown steals focus briefly,
        // so keyboardVisible=true prevents us from fighting the IME.
        if (hasFocus && !keyboardVisible) {
            applyImmersive();
        }
    }

    /**
     * Listen to the Capacitor Keyboard plugin's JS events via the WebView
     * so we know exactly when the keyboard is up or down.
     */
    private void listenForKeyboard() {
        if (getBridge() == null) return;

        getBridge().getWebView().addJavascriptInterface(new Object() {
            @android.webkit.JavascriptInterface
            public void onKeyboardShow() {
                keyboardVisible = true;
            }

            @android.webkit.JavascriptInterface
            public void onKeyboardHide() {
                keyboardVisible = false;
                // Post back to UI thread to restore immersive after keyboard gone
                runOnUiThread(() -> applyImmersive());
            }
        }, "_immersiveKbBridge");

        // Inject the JS listeners once the page is ready
        getBridge().getWebView().post(() ->
            getBridge().getWebView().evaluateJavascript(
                "(function() {" +
                "  window.addEventListener('ionKeyboardDidShow', function() {" +
                "    if(window._immersiveKbBridge) window._immersiveKbBridge.onKeyboardShow();" +
                "  });" +
                "  window.addEventListener('ionKeyboardDidHide', function() {" +
                "    if(window._immersiveKbBridge) window._immersiveKbBridge.onKeyboardHide();" +
                "  });" +
                "  window.addEventListener('keyboardDidShow', function() {" +
                "    if(window._immersiveKbBridge) window._immersiveKbBridge.onKeyboardShow();" +
                "  });" +
                "  window.addEventListener('keyboardDidHide', function() {" +
                "    if(window._immersiveKbBridge) window._immersiveKbBridge.onKeyboardHide();" +
                "  });" +
                "})()", null)
        );
    }

    private void setupWindow() {
        Window window = getWindow();

        // Keep screen on
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // Edge-to-edge
        WindowCompat.setDecorFitsSystemWindows(window, false);

        // Transparent bars
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            window.setStatusBarColor(Color.TRANSPARENT);
            window.setNavigationBarColor(Color.TRANSPARENT);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.setNavigationBarContrastEnforced(false);
        }

        applyImmersive();
    }

    /** Full immersive sticky — hides both status bar and nav bar. */
    private void applyImmersive() {
        Window window = getWindow();
        View decorView = window.getDecorView();

        WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(window, decorView);
        if (controller != null) {
            controller.setAppearanceLightStatusBars(false);
            controller.setAppearanceLightNavigationBars(false);
            controller.hide(WindowInsetsCompat.Type.statusBars());
            controller.hide(WindowInsetsCompat.Type.navigationBars());
            controller.setSystemBarsBehavior(
                    WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            );
        }

        // Legacy support for API < 30
        int flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY;
        decorView.setSystemUiVisibility(flags);
    }
}
