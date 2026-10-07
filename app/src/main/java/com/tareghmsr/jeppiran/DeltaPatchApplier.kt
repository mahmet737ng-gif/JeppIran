package com.tareghmsr.jeppiran

import org.apache.commons.compress.compressors.bzip2.BZip2CompressorInputStream
import java.io.ByteArrayInputStream
import java.io.File
import java.io.FileOutputStream
import java.io.RandomAccessFile
import java.nio.charset.StandardCharsets

object DeltaPatchApplier {

    fun apply(
        oldFile: File,
        patchFile: File,
        newFile: File
    ) {
        require(
            oldFile.isFile &&
                oldFile.length() >
                0L
        ) {
            "Installed APK is unavailable"
        }

        require(
            patchFile.isFile &&
                patchFile.length() >=
                32L
        ) {
            "Delta patch is invalid"
        }

        val patchBytes =
            patchFile.readBytes()

        val magic =
            String(
                patchBytes,
                0,
                8,
                StandardCharsets.US_ASCII
            )

        require(
            magic ==
                "BSDIFF40"
        ) {
            "Unsupported delta patch format"
        }

        val controlLength =
            readOffset(
                patchBytes,
                8
            )

        val diffLength =
            readOffset(
                patchBytes,
                16
            )

        val newSize =
            readOffset(
                patchBytes,
                24
            )

        require(
            controlLength >=
                0L &&
                diffLength >=
                    0L &&
                newSize >=
                    0L
        ) {
            "Delta patch header is invalid"
        }

        val controlStart =
            32L

        val diffStart =
            controlStart +
                controlLength

        val extraStart =
            diffStart +
                diffLength

        require(
            controlStart <=
                patchBytes.size.toLong() &&
                diffStart <=
                    patchBytes.size.toLong() &&
                extraStart <=
                    patchBytes.size.toLong()
        ) {
            "Delta patch blocks are truncated"
        }

        val controlInput =
            bzipStream(
                patchBytes,
                controlStart,
                controlLength
            )

        val diffInput =
            bzipStream(
                patchBytes,
                diffStart,
                diffLength
            )

        val extraInput =
            bzipStream(
                patchBytes,
                extraStart,
                patchBytes.size.toLong() -
                    extraStart
            )

        if (
            newFile.exists()
        ) {
            newFile.delete()
        }

        newFile.parentFile
            ?.mkdirs()

        RandomAccessFile(
            oldFile,
            "r"
        ).use {
            oldRandom ->

            controlInput.use {
                control ->

                diffInput.use {
                    diff ->

                    extraInput.use {
                        extra ->

                        FileOutputStream(
                            newFile
                        ).use {
                            output ->

                            var oldPosition =
                                0L

                            var newPosition =
                                0L

                            val diffBuffer =
                                ByteArray(
                                    64 *
                                        1024
                                )

                            val oldBuffer =
                                ByteArray(
                                    64 *
                                        1024
                                )

                            val extraBuffer =
                                ByteArray(
                                    64 *
                                        1024
                                )

                            while (
                                newPosition <
                                    newSize
                            ) {
                                val addLength =
                                    readControlValue(
                                        control
                                    )

                                val copyLength =
                                    readControlValue(
                                        control
                                    )

                                val seekAdjustment =
                                    readControlValue(
                                        control
                                    )

                                require(
                                    addLength >=
                                        0L &&
                                        copyLength >=
                                            0L
                                ) {
                                    "Delta patch control data is invalid"
                                }

                                require(
                                    newPosition +
                                        addLength <=
                                        newSize
                                ) {
                                    "Delta patch exceeds target size"
                                }

                                var remaining =
                                    addLength

                                while (
                                    remaining >
                                    0L
                                ) {
                                    val chunk =
                                        minOf(
                                            diffBuffer.size
                                                .toLong(),
                                            remaining
                                        )
                                            .toInt()

                                    readFully(
                                        diff,
                                        diffBuffer,
                                        chunk
                                    )

                                    java.util.Arrays.fill(
                                        oldBuffer,
                                        0,
                                        chunk,
                                        0.toByte()
                                    )

                                    if (
                                        oldPosition <
                                            oldRandom.length() &&
                                        oldPosition +
                                            chunk >
                                            0L
                                    ) {
                                        val prefixOutside =
                                            if (
                                                oldPosition <
                                                0L
                                            ) {
                                                minOf(
                                                    chunk.toLong(),
                                                    -oldPosition
                                                )
                                                    .toInt()
                                            } else {
                                                0
                                            }

                                        val readableStart =
                                            oldPosition +
                                                prefixOutside

                                        val readableCount =
                                            minOf(
                                                (
                                                    chunk -
                                                        prefixOutside
                                                    )
                                                    .toLong(),
                                                oldRandom.length() -
                                                    readableStart
                                            )
                                                .coerceAtLeast(
                                                    0L
                                                )
                                                .toInt()

                                        if (
                                            readableCount >
                                            0
                                        ) {
                                            oldRandom.seek(
                                                readableStart
                                            )

                                            oldRandom.readFully(
                                                oldBuffer,
                                                prefixOutside,
                                                readableCount
                                            )
                                        }
                                    }

                                    for (
                                        i in
                                        0 until
                                            chunk
                                    ) {
                                        diffBuffer[i] =
                                            (
                                                diffBuffer[i]
                                                    .toInt() +
                                                    oldBuffer[i]
                                                        .toInt()
                                                )
                                                .toByte()
                                    }

                                    output.write(
                                        diffBuffer,
                                        0,
                                        chunk
                                    )

                                    newPosition +=
                                        chunk

                                    oldPosition +=
                                        chunk

                                    remaining -=
                                        chunk
                                }

                                require(
                                    newPosition +
                                        copyLength <=
                                        newSize
                                ) {
                                    "Delta patch extra block exceeds target size"
                                }

                                var extraRemaining =
                                    copyLength

                                while (
                                    extraRemaining >
                                    0L
                                ) {
                                    val chunk =
                                        minOf(
                                            extraBuffer.size
                                                .toLong(),
                                            extraRemaining
                                        )
                                            .toInt()

                                    readFully(
                                        extra,
                                        extraBuffer,
                                        chunk
                                    )

                                    output.write(
                                        extraBuffer,
                                        0,
                                        chunk
                                    )

                                    newPosition +=
                                        chunk

                                    extraRemaining -=
                                        chunk
                                }

                                oldPosition +=
                                    seekAdjustment
                            }
                        }
                    }
                }
            }
        }

        require(
            newFile.length() ==
                newSize
        ) {
            "Delta patch produced an invalid APK size"
        }
    }

    private fun bzipStream(
        bytes: ByteArray,
        start: Long,
        length: Long
    ):
        BZip2CompressorInputStream {

        require(
            start >=
                0L &&
                length >=
                    0L &&
                start +
                    length <=
                    bytes.size.toLong()
        ) {
            "Delta patch block range is invalid"
        }

        return BZip2CompressorInputStream(
            ByteArrayInputStream(
                bytes,
                start.toInt(),
                length.toInt()
            ),
            true
        )
    }

    private fun readControlValue(
        input:
            BZip2CompressorInputStream
    ): Long {
        val buffer =
            ByteArray(
                8
            )

        readFully(
            input,
            buffer,
            buffer.size
        )

        return readOffset(
            buffer,
            0
        )
    }

    private fun readOffset(
        bytes: ByteArray,
        offset: Int
    ): Long {
        var value =
            (
                bytes[
                    offset +
                        7
                ]
                    .toInt() and
                    0x7f
                )
                .toLong()

        for (
            i in
            6 downTo
                0
        ) {
            value =
                value *
                    256L +
                    (
                        bytes[
                            offset +
                                i
                        ]
                            .toInt() and
                            0xff
                        )
        }

        if (
            bytes[
                offset +
                    7
            ]
                .toInt() and
                0x80 !=
            0
        ) {
            value =
                -value
        }

        return value
    }

    private fun readFully(
        input: java.io.InputStream,
        buffer: ByteArray,
        length: Int
    ) {
        var offset =
            0

        while (
            offset <
            length
        ) {
            val count =
                input.read(
                    buffer,
                    offset,
                    length -
                        offset
                )

            require(
                count >
                    0
            ) {
                "Delta patch ended unexpectedly"
            }

            offset +=
                count
        }
    }
}
