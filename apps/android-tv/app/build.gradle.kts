plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.kotlin.compose)
}

android {
    namespace = "com.iptvflix.androidtv"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.iptvflix.androidtv"
        minSdk = 23
        targetSdk = 34
        versionCode = 1
        versionName = "0.0.1"
        buildConfigField("String", "API_BASE_URL", "\"https://iptvflixapi-production.up.railway.app\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
        freeCompilerArgs += listOf(
            "-opt-in=androidx.tv.material3.ExperimentalTvMaterial3Api",
        )
    }

    testOptions {
        unitTests.isReturnDefaultValues = true
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    // Compose
    implementation(libs.compose.runtime)
    implementation(libs.compose.runtime.saveable)
    implementation(libs.compose.ui)
    implementation(libs.compose.foundation)
    implementation(libs.compose.activity)
    implementation(libs.compose.tv.foundation)
    implementation(libs.compose.tv.material)
    // Lifecycle / ViewModel
    implementation(libs.lifecycle.viewmodel.compose)
    implementation(libs.lifecycle.runtime.ktx)
    // Media3
    implementation(libs.media3.exoplayer)
    implementation(libs.media3.exoplayer.hls)
    implementation(libs.media3.datasource.okhttp)
    implementation(libs.media3.ui)
    implementation(libs.media3.session)
    // Coroutines
    implementation(libs.kotlinx.coroutines.android)
    // Networking
    implementation(libs.okhttp)
    // Serialization
    implementation(libs.kotlinx.serialization.json)
    // Storage
    implementation(libs.datastore.preferences)
    implementation(libs.security.crypto)
    // QR code generation
    implementation(libs.zxing.core)
    // Tests
    testImplementation(libs.junit)
    testImplementation(libs.mockk)
    testImplementation(libs.kotlinx.coroutines.test)
}
