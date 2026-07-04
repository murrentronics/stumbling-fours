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

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Clear WebView cache on every launch so updated APKs always load fresh JS
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().clearCache(true);
        }

        setupWindow();
    }

    @Override
    public void onResume() {
        super.onResume();
        // Do NOT re-apply immersive mode here — it interrupts keyboard focus
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        // Do NOT re-apply immersive mode here — this fires when the keyboard
        // appears/disappears and calling hide(navigationBars) at that moment
        // cancels the IME focus and freezes inputs.
    }

    private void setupWindow() {
        Window window = getWindow();
        View decorView = window.getDecorView();

        // Keep screen on — prevents sleep while app is in foreground
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // Draw edge-to-edge so the app fills the whole screen
        WindowCompat.setDecorFitsSystemWindows(window, false);

        // Transparent bars
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            window.setStatusBarColor(Color.TRANSPARENT);
            window.setNavigationBarColor(Color.TRANSPARENT);
        }

        // Kill nav bar contrast scrim on Android 10+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.setNavigationBarContrastEnforced(false);
        }

        // Use WindowInsetsController (API 30+) — this approach does NOT
        // interfere with the IME because we only hide bars ONCE on startup,
        // not on every focus change.
        WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(window, decorView);
        if (controller != null) {
            controller.setAppearanceLightStatusBars(false);
            controller.setAppearanceLightNavigationBars(false);
            controller.hide(WindowInsetsCompat.Type.statusBars());
            // IMPORTANT: do NOT hide navigationBars — hiding them is what
            // triggers the focus-change loop that freezes keyboard inputs.
            // The status bar alone is sufficient for the immersive look.
            controller.setSystemBarsBehavior(
                    WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            );
        }

        // Legacy flags for API < 30 — use LAYOUT flags only, no HIDE_NAVIGATION
        int flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_FULLSCREEN;
        decorView.setSystemUiVisibility(flags);
    }
}
