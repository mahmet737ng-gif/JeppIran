plugins {
    id("com.android.application")
}

android {
    namespace = "com.tareghmsr.jeppiran"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.tareghmsr.jeppiran"
        minSdk = 24
        targetSdk = 36
        versionCode = 2620
        versionName = "26-20"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }
}

dependencies {
    testImplementation("junit:junit:4.13.2")
    implementation("androidx.core:core-ktx:1.17.0")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("com.google.android.material:material:1.13.0")
    implementation("androidx.activity:activity-ktx:1.10.1")
}
