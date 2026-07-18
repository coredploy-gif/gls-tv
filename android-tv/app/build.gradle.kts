import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val keystorePropertiesFile = rootProject.file("keystore.properties")
val keystoreProperties = Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(keystorePropertiesFile.inputStream())
}

android {
    namespace = "site.glstv.tv"
    compileSdk = 35

    defaultConfig {
        applicationId = "site.glstv.tv"
        minSdk = 21
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"

        // Production GLS site — override with -PglsBaseUrl=... for staging.
        val baseUrl = (project.findProperty("glsBaseUrl") as String?)
            ?: "https://glstv.site"
        buildConfigField("String", "GLS_BASE_URL", "\"$baseUrl\"")
        buildConfigField("String", "GLS_START_PATH", "\"/browse?tv=1\"")
        buildConfigField("String", "GLS_USER_AGENT_SUFFIX", "\"GLSTV-AndroidTV/1.0\"")
    }

    signingConfigs {
        if (keystorePropertiesFile.exists()) {
            create("release") {
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["keyPassword"] as String
                storeFile = file(keystoreProperties["storeFile"] as String)
                storePassword = keystoreProperties["storePassword"] as String
            }
        }
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            resValue("string", "app_name", "GLS TV (Debug)")
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            if (keystorePropertiesFile.exists()) {
                signingConfig = signingConfigs.getByName("release")
            }
            resValue("string", "app_name", "GLS TV")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        buildConfig = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("androidx.leanback:leanback:1.0.0")
    implementation("com.google.android.material:material:1.12.0")
}
