<?xml version="1.0" encoding="utf-8"?>

<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- Internet access for chart/PDF updates and WX -->
    <uses-permission android:name="android.permission.INTERNET" />

    <application
        android:allowBackup="true"
        android:label="JeppIran"
        android:supportsRtl="true"
        android:theme="@style/Theme.JeppIran">

        <!-- Main screen -->
        <activity
            android:name=".MainActivity"
            android:exported="true">

            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>

        </activity>

        <!-- Airport list -->
        <activity
            android:name=".ChartsActivity"
            android:exported="false" />

        <!-- Charts inside an airport -->
        <activity
            android:name=".AirportChartsActivity"
            android:exported="false" />

        <!-- PDF chart viewer -->
        <activity
            android:name=".PdfViewerActivity"
            android:exported="false" />

    </application>

</manifest>
