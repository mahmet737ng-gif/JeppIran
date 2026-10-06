package com.tareghmsr.jeppiran

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

object ChartUpdateStore {

    private const val PREFS =
        "jeppiran_chart_data"

    private const val ACTIVE_VERSION =
        "active_version"

    private const val PREVIOUS_DIR =
        "previous"

    private const val ROOT_DIR =
        "chart-data"

    private const val MANIFEST =
        "manifest.json"

    private const val CHARTS =
        "charts.json"

    private const val GEOREF =
        "chart-georef.json"

    private const val CHANGES =
        "chart-changes.json"


    fun activeVersion(
        context: Context
    ): String =
        context
            .getSharedPreferences(
                PREFS,
                Context.MODE_PRIVATE
            )
            .getString(
                ACTIVE_VERSION,
                ""
            )
            .orEmpty()


    fun activeDirectory(
        context: Context
    ): File? {

        val version =
            activeVersion(
                context
            )

        if (
            version.isBlank()
        ) {
            return null
        }

        val directory =
            File(
                File(
                    context.filesDir,
                    ROOT_DIR
                ),
                safeVersion(
                    version
                )
            )

        return directory.takeIf {
            File(
                it,
                MANIFEST
            ).isFile &&
                File(
                    it,
                    CHARTS
                ).isFile &&
                File(
                    it,
                    GEOREF
                ).isFile
        }
    }


    fun readManifest(
        context: Context
    ): String? =
        activeDirectory(
            context
        )
            ?.let {
                File(
                    it,
                    MANIFEST
                )
            }
            ?.takeIf {
                it.isFile
            }
            ?.readText()


    fun readCharts(
        context: Context
    ): String? =
        activeDirectory(
            context
        )
            ?.let {
                File(
                    it,
                    CHARTS
                )
            }
            ?.takeIf {
                it.isFile
            }
            ?.readText()


    fun readGeoref(
        context: Context
    ): String? =
        activeDirectory(
            context
        )
            ?.let {
                File(
                    it,
                    GEOREF
                )
            }
            ?.takeIf {
                it.isFile
            }
            ?.readText()


    fun readChanges(
        context: Context
    ): String? =
        activeDirectory(
            context
        )
            ?.let {
                File(
                    it,
                    CHANGES
                )
            }
            ?.takeIf {
                it.isFile
            }
            ?.readText()


    private fun previousDirectory(
        context: Context
    ):
        File =
        File(
            File(
                context.filesDir,
                ROOT_DIR
            ),
            PREVIOUS_DIR
        )


    fun readPreviousManifest(
        context: Context
    ): String? =
        File(
            previousDirectory(
                context
            ),
            MANIFEST
        )
            .takeIf {
                it.isFile
            }
            ?.readText()


    fun readPreviousCharts(
        context: Context
    ): String? =
        File(
            previousDirectory(
                context
            ),
            CHARTS
        )
            .takeIf {
                it.isFile
            }
            ?.readText()


    fun readPreviousChanges(
        context: Context
    ): String? =
        File(
            previousDirectory(
                context
            ),
            CHANGES
        )
            .takeIf {
                it.isFile
            }
            ?.readText()


    @Synchronized
    fun activate(
        context: Context,
        version: String,
        manifestRaw: String,
        chartsRaw: String,
        georefRaw: String,
        changesRaw: String = ""
    ) {

        val normalized =
            safeVersion(
                version
            )

        require(
            normalized.isNotBlank()
        ) {
            "Invalid data version"
        }


        validateManifest(
            normalized,
            manifestRaw
        )

        validateCharts(
            chartsRaw
        )

        validateGeoref(
            normalized,
            georefRaw
        )


        if (
            changesRaw.isNotBlank()
        ) {

            validateChanges(
                normalized,
                changesRaw
            )
        }


        val root =
            File(
                context.filesDir,
                ROOT_DIR
            )

        root.mkdirs()


        val stage =
            File(
                root,
                ".stage-" +
                    normalized +
                    "-" +
                    System.currentTimeMillis()
            )

        if (
            stage.exists()
        ) {
            stage.deleteRecursively()
        }

        require(
            stage.mkdirs()
        ) {
            "Unable to create staging directory"
        }


        try {

            File(
                stage,
                MANIFEST
            )
                .writeText(
                    manifestRaw
                )

            File(
                stage,
                CHARTS
            )
                .writeText(
                    chartsRaw
                )

            File(
                stage,
                GEOREF
            )
                .writeText(
                    georefRaw
                )


            if (
                changesRaw.isNotBlank()
            ) {

                File(
                    stage,
                    CHANGES
                )
                    .writeText(
                        changesRaw
                    )
            }


            validateManifest(
                normalized,
                File(
                    stage,
                    MANIFEST
                ).readText()
            )

            validateCharts(
                File(
                    stage,
                    CHARTS
                ).readText()
            )

            validateGeoref(
                normalized,
                File(
                    stage,
                    GEOREF
                ).readText()
            )


            File(
                stage,
                CHANGES
            )
                .takeIf {
                    it.isFile
                }
                ?.let {
                    file ->

                    validateChanges(
                        normalized,
                        file.readText()
                    )
                }


            val target =
                File(
                    root,
                    normalized
                )


            if (
                target.exists()
            ) {
                target.deleteRecursively()
            }


            if (
                !stage.renameTo(
                    target
                )
            ) {

                target.mkdirs()

                stage
                    .listFiles()
                    .orEmpty()
                    .forEach { file ->

                        file.copyTo(
                            File(
                                target,
                                file.name
                            ),
                            overwrite =
                                true
                        )
                    }

                stage.deleteRecursively()
            }


            require(
                File(
                    target,
                    MANIFEST
                ).isFile &&
                    File(
                        target,
                        CHARTS
                    ).isFile &&
                    File(
                        target,
                        GEOREF
                    ).isFile
            ) {
                "Staged update is incomplete"
            }


            /*
             * Preserve the complete currently-active metadata before the
             * pointer moves. The Changes/Diff viewer uses this snapshot to
             * compare the old and new cycles, including the very first update
             * from the bundled asset set.
             */
            snapshotCurrentAsPrevious(
                context
            )


            /*
             * The active pointer is changed only after every new file
             * has passed validation. If anything above fails, the old
             * active version remains untouched.
             */
            context
                .getSharedPreferences(
                    PREFS,
                    Context.MODE_PRIVATE
                )
                .edit()
                .putString(
                    ACTIVE_VERSION,
                    normalized
                )
                .commit()


            ChartGeoreferenceStore
                .reset()

        } catch (
            error: Throwable
        ) {

            stage.deleteRecursively()

            throw error
        }
    }


    private fun validateManifest(
        version: String,
        raw: String
    ) {

        val root =
            JSONObject(
                raw
            )

        require(
            root.optString(
                "version"
            ) ==
                version
        ) {
            "Manifest version mismatch"
        }

        require(
            root.optString(
                "release_tag"
            )
                .isNotBlank()
        ) {
            "Release tag is missing"
        }

        val airports =
            root.optJSONObject(
                "airports"
            )

        require(
            airports != null &&
                airports.length() > 0
        ) {
            "Airport manifest is empty"
        }
    }


    private fun validateCharts(
        raw: String
    ) {

        val trimmed =
            raw.trim()

        val charts =
            if (
                trimmed.startsWith(
                    "["
                )
            ) {

                JSONArray(
                    trimmed
                )

            } else {

                JSONObject(
                    trimmed
                )
                    .optJSONArray(
                        "charts"
                    )
            }

        require(
            charts != null &&
                charts.length() > 0
        ) {
            "Chart database is empty"
        }
    }


    private fun validateGeoref(
        version: String,
        raw: String
    ) {

        val root =
            JSONObject(
                raw
            )

        val source =
            root.optJSONObject(
                "source"
            )

        require(
            source
                ?.optString(
                    "chartDataVersion"
                ) ==
                version
        ) {
            "Georeference version mismatch"
        }
    }


    private fun snapshotCurrentAsPrevious(
        context: Context
    ) {

        val directory =
            previousDirectory(
                context
            )

        if (
            directory.exists()
        ) {

            directory.deleteRecursively()
        }

        directory.mkdirs()


        fun write(
            fileName: String,
            active: String?,
            assetName: String
        ) {

            val raw =
                active
                    ?: runCatching {

                        context.assets
                            .open(
                                assetName
                            )
                            .bufferedReader()
                            .use {
                                it.readText()
                            }
                    }
                        .getOrNull()
                    ?: return

            File(
                directory,
                fileName
            )
                .writeText(
                    raw
                )
        }


        write(
            MANIFEST,
            readManifest(
                context
            ),
            "charts-manifest.json"
        )

        write(
            CHARTS,
            readCharts(
                context
            ),
            "charts-current.json"
        )

        write(
            GEOREF,
            readGeoref(
                context
            ),
            "chart-georef.json"
        )

        write(
            CHANGES,
            readChanges(
                context
            ),
            "chart-changes.json"
        )
    }


    private fun validateChanges(
        version: String,
        raw: String
    ) {

        val root =
            JSONObject(
                raw
            )

        require(
            root.optInt(
                "version",
                -1
            ) >=
                1
        ) {
            "Change metadata version is invalid"
        }

        val dataVersion =
            root.optString(
                "chartDataVersion"
            )

        require(
            dataVersion.isBlank() ||
                dataVersion ==
                    version
        ) {
            "Change metadata chart version mismatch"
        }
    }


    private fun safeVersion(
        value: String
    ): String =
        value
            .trim()
            .replace(
                Regex(
                    "[^A-Za-z0-9._-]"
                ),
                "_"
            )
}
