plugins {
    id("com.android.application")
}

val ciVersionCode =
    System.getenv("JEPPIRAN_VERSION_CODE")
        ?.toIntOrNull()
        ?: 262000

val ciVersionName =
    System.getenv("JEPPIRAN_VERSION_NAME")
        ?.takeIf { it.isNotBlank() }
        ?: "V2620-dev"

val signingStorePath =
    System.getenv("JEPPIRAN_KEYSTORE_PATH")
        ?.takeIf { it.isNotBlank() }

val signingStorePassword =
    System.getenv("JEPPIRAN_KEYSTORE_PASSWORD")
        ?.takeIf { it.isNotBlank() }

val signingKeyAlias =
    System.getenv("JEPPIRAN_KEY_ALIAS")
        ?.takeIf { it.isNotBlank() }

val signingKeyPassword =
    System.getenv("JEPPIRAN_KEY_PASSWORD")
        ?.takeIf { it.isNotBlank() }

val stableSigningReady =
    signingStorePath != null &&
        signingStorePassword != null &&
        signingKeyAlias != null &&
        signingKeyPassword != null

android {
    namespace = "com.tareghmsr.jeppiran"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.tareghmsr.jeppiran"
        minSdk = 24
        targetSdk = 36
        versionCode = ciVersionCode
        versionName = ciVersionName

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    signingConfigs {
        if (stableSigningReady) {
            create("jeppiranStable") {
                storeFile = file(signingStorePath!!)
                storePassword = signingStorePassword
                keyAlias = signingKeyAlias
                keyPassword = signingKeyPassword
            }
        }
    }

    buildTypes {
        getByName("debug") {
            if (stableSigningReady) {
                signingConfig = signingConfigs.getByName("jeppiranStable")
            }
        }

        getByName("release") {
            if (stableSigningReady) {
                signingConfig = signingConfigs.getByName("jeppiranStable")
            }
        }
    }
}

dependencies {
    testImplementation("junit:junit:4.13.2")
    implementation("androidx.core:core-ktx:1.17.0")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("com.google.android.material:material:1.13.0")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("androidx.work:work-runtime-ktx:2.10.1")
}
