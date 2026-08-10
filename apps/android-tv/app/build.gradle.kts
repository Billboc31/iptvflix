plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
}

android {
    namespace = "com.iptvflix.androidtv"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.iptvflix.androidtv"
        minSdk = 21
        targetSdk = 34
        versionCode = 1
        versionName = "0.0.1"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    // Uncomment to enable Jetpack Compose for TV
    // buildFeatures {
    //     compose = true
    // }
    // composeOptions {
    //     kotlinCompilerExtensionVersion = "1.5.14"
    // }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)

    // Uncomment for Jetpack Compose for TV
    // implementation("androidx.tv:tv-foundation:1.0.0-alpha11")
    // implementation("androidx.tv:tv-material:1.0.0-alpha11")

    // Uncomment for Media3
    // implementation("androidx.media3:media3-exoplayer:1.4.0")
    // implementation("androidx.media3:media3-ui:1.4.0")
}
