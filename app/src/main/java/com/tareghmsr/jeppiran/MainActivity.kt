package com.tareghmsr.jeppiran

import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity :
    AppCompatActivity() {

    override fun onCreate(
        savedInstanceState: Bundle?
    ) {

        ThemeManager.apply(
            this
        )

        super.onCreate(
            savedInstanceState
        )

        enableEdgeToEdge()

        setContentView(
            R.layout.activity_main
        )

        val mainView =
            findViewById<android.view.View>(
                R.id.main
            )

        ViewCompat.setOnApplyWindowInsetsListener(
            mainView
        ) { view, insets ->

            val systemBars =
                insets.getInsets(
                    WindowInsetsCompat.Type.systemBars()
                )

            view.setPadding(
                systemBars.left + 16,
                systemBars.top + 16,
                systemBars.right + 16,
                systemBars.bottom + 16
            )

            insets
        }

        findViewById<android.view.View>(
            R.id.cardCharts
        ).setOnClickListener {

            startActivity(
                Intent(
                    this,
                    ChartsActivity::class.java
                )
            )
        }

        findViewById<android.view.View>(
            R.id.cardEnroute
        ).setOnClickListener {

            Toast.makeText(
                this,
                "En-route Charts",
                Toast.LENGTH_SHORT
            ).show()
        }

        findViewById<android.view.View>(
            R.id.cardWx
        ).setOnClickListener {

            Toast.makeText(
                this,
                "WX",
                Toast.LENGTH_SHORT
            ).show()
        }

        findViewById<android.view.View>(
            R.id.cardUpdate
        ).setOnClickListener {

            Toast.makeText(
                this,
                "Update",
                Toast.LENGTH_SHORT
            ).show()
        }

        findViewById<android.view.View>(
            R.id.cardSettings
        ).setOnClickListener {

            startActivity(
                Intent(
                    this,
                    SettingsActivity::class.java
                )
            )
        }

        findViewById<android.view.View>(
            R.id.cardInfo
        ).setOnClickListener {

            Toast.makeText(
                this,
                "JeppIran\nDeveloper: Taregh Msr",
                Toast.LENGTH_SHORT
            ).show()
        }
    }
}
