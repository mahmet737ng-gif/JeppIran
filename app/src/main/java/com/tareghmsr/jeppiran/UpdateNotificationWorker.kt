package com.tareghmsr.jeppiran

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

class UpdateNotificationWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : Worker(
    appContext,
    workerParams
) {

    override fun doWork(): Result {
        if (
            !ChartUpdateNotifier.notificationsAllowed(
                applicationContext
            )
        ) {
            return Result.success()
        }

        var temporaryFailure =
            false

        try {
            val dataNotice =
                ChartUpdateNotifier
                    .checkSync(
                        applicationContext
                    )

            if (
                dataNotice !=
                null
            ) {
                ChartUpdateNotifier
                    .postNotification(
                        applicationContext,
                        dataNotice
                    )
            }
        } catch (
            _: Throwable
        ) {
            temporaryFailure =
                true
        }

        try {
            val enrouteNotice =
                ChartUpdateNotifier
                    .checkEnrouteSync(
                        applicationContext
                    )

            if (
                enrouteNotice !=
                null
            ) {
                ChartUpdateNotifier
                    .postEnrouteNotification(
                        applicationContext,
                        enrouteNotice
                    )
            }
        } catch (
            _: Throwable
        ) {
            temporaryFailure =
                true
        }

        try {
            val appResult =
                AppUpdateManager
                    .check(
                        applicationContext
                    )

            if (
                appResult.updateAvailable &&
                appResult.remote !=
                null
            ) {
                ChartUpdateNotifier
                    .postAppNotification(
                        applicationContext,
                        appResult.remote
                    )
            }
        } catch (
            _: Throwable
        ) {
            temporaryFailure =
                true
        }

        return if (
            temporaryFailure
        ) {
            Result.retry()
        } else {
            Result.success()
        }
    }
}

object UpdateNotificationScheduler {

    private const val PERIODIC_WORK =
        "jeppiran-update-monitor"

    private const val IMMEDIATE_WORK =
        "jeppiran-update-check-now"

    fun schedule(
        context: Context
    ) {
        val constraints =
            Constraints.Builder()
                .setRequiredNetworkType(
                    NetworkType.CONNECTED
                )
                .build()

        val periodic =
            PeriodicWorkRequestBuilder<
                UpdateNotificationWorker
            >(
                1,
                TimeUnit.HOURS
            )
                .setConstraints(
                    constraints
                )
                .build()

        WorkManager
            .getInstance(
                context.applicationContext
            )
            .enqueueUniquePeriodicWork(
                PERIODIC_WORK,
                ExistingPeriodicWorkPolicy.UPDATE,
                periodic
            )

        val immediate =
            OneTimeWorkRequestBuilder<
                UpdateNotificationWorker
            >()
                .setConstraints(
                    constraints
                )
                .build()

        WorkManager
            .getInstance(
                context.applicationContext
            )
            .enqueueUniqueWork(
                IMMEDIATE_WORK,
                ExistingWorkPolicy.REPLACE,
                immediate
            )
    }
}
