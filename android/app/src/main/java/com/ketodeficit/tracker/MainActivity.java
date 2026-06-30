package com.ketodeficit.tracker;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowInsetsController;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureSystemBars();
        getWindow().getDecorView().post(this::configureSystemBars);
    }

    @Override
    public void onResume() {
        super.onResume();
        configureSystemBars();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            configureSystemBars();
        }
    }

    private void configureSystemBars() {
        Window window = getWindow();
        View decorView = window.getDecorView();

        window.setStatusBarColor(Color.parseColor("#fbfdf9"));
        window.setNavigationBarColor(Color.parseColor("#ffffff"));

        int lightSystemUi = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            lightSystemUi |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        }
        decorView.setSystemUiVisibility(decorView.getSystemUiVisibility() | lightSystemUi);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController controller = window.getInsetsController();
            if (controller != null) {
                int lightBars = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                    | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                controller.setSystemBarsAppearance(lightBars, lightBars);
            }
        }

        WindowInsetsControllerCompat systemBars = WindowCompat.getInsetsController(window, decorView);
        systemBars.setAppearanceLightStatusBars(true);
        systemBars.setAppearanceLightNavigationBars(true);
    }
}
