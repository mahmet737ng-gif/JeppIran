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

    private const val ROOT_DIR =
        "chart-data"

    private const val MANIFEST =
        "manifest.json"

    private const val CHARTS =
        "charts.json"

    private const val GEOREF =
        "chart-georef.json"


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


    @Synchronized
    fun activate(
        context: Context,
        version: String,
        manifestRaw: String,
        chartsRaw: String,
        georefRaw: String
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
