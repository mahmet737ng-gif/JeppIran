package com.tareghmsr.jeppiran

import android.app.Activity

/**
 * Android system Back is the only global Back control. Do not inject a
 * floating 46dp arrow over AIRPORTS, the chart drawer, or other touch targets.
 * Native activities retain their normal Activity back stack; MobileWebActivity
 * additionally handles Chart -> Airport -> Home -> double-Back exit.
 */
object BackNavigation {
    @Suppress("UNUSED_PARAMETER")
    fun install(activity: Activity) {
        // Intentionally no floating button.
    }
}
