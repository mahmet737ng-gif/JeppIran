package com.tareghmsr.jeppiran

import android.content.Context

object AppVersion {

    @Suppress("DEPRECATION")
    fun name(
        context: Context
    ): String =
        runCatching {

            context.packageManager
                .getPackageInfo(
                    context.packageName,
                    0
                )
                .versionName
                .orEmpty()

        }
            .getOrDefault(
                ""
            )
            .ifBlank {
                "V2620"
            }
}
