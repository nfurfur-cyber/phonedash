import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Usage statistics (UsageStats.kt) need the Firebase project's google-services.json, which is not in the repository. A
// build without it has no Firebase project and never offers or sends statistics.
if (file("google-services.json").isFile) apply(plugin = "com.google.gms.google-services")

// Release signing (Play upload key): PHONEDASH_STORE_FILE, PHONEDASH_STORE_PASSWORD, PHONEDASH_KEY_ALIAS and
// PHONEDASH_KEY_PASSWORD from a Gradle property, an environment variable or ~/.phonedash/signing.properties (kept
// outside the repository, next to upload-key.jks). A release build without them stops instead of quietly signing
// with the debug key.
val localSigning = Properties().apply {
    val file = File(System.getProperty("user.home"), ".phonedash/signing.properties")
    if (file.isFile) file.inputStream().use { load(it) }
}
fun signingValue(name: String): String? =
    (project.findProperty(name) as String?)?.takeIf { it.isNotBlank() }
        ?: System.getenv(name)?.takeIf { it.isNotBlank() }
        ?: localSigning.getProperty(name)?.takeIf { it.isNotBlank() }

// The PhoneDash site (https://<owner>.github.io/phonedash/) hosts the Wi-Fi pairing page. Debug builds use a host
// that cannot exist (.invalid), so a test build never sends a pairing link to someone else's site.
val siteOwner: String? = (project.findProperty("phonedash.owner") as String?)?.trim()?.lowercase()?.takeIf { it.isNotEmpty() }
val pairHost = siteOwner?.let { "$it.github.io" } ?: "phonedash.invalid"
val pairPath = "/phonedash/pair"
val linkScheme = "phonedash"
val releaseRequested = gradle.startParameter.taskNames.any { it.contains("Release", ignoreCase = true) }
if (releaseRequested && siteOwner == null) {
    throw GradleException("Set phonedash.owner in android/gradle.properties (the GitHub account that hosts the PhoneDash site) before a release build.")
}

android {
    namespace = "kr.phonedash.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "kr.phonedash.app"
        minSdk = 24 // Android 7.0: Google Play automatic protection needs it; see CONTRIBUTING.md before changing it
        targetSdk = 36
        versionCode = 3
        versionName = "1.0.0"

        manifestPlaceholders["pairHost"] = pairHost
        manifestPlaceholders["pairPath"] = pairPath
        manifestPlaceholders["linkScheme"] = linkScheme
        buildConfigField("String", "PAIR_HOST", "\"$pairHost\"")
        buildConfigField("String", "PAIR_PATH", "\"$pairPath\"")
        buildConfigField("String", "LINK_SCHEME", "\"$linkScheme\"")
        buildConfigField("String", "SITE_URL", "\"https://$pairHost/phonedash/\"")
        buildConfigField("String", "PRIVACY_URL", "\"https://$pairHost/phonedash/privacy.html\"")
    }

    signingConfigs {
        val storeFile = signingValue("PHONEDASH_STORE_FILE")
        if (storeFile != null && file(storeFile).exists()) {
            create("release") {
                this.storeFile = file(storeFile)
                storePassword = signingValue("PHONEDASH_STORE_PASSWORD")
                keyAlias = signingValue("PHONEDASH_KEY_ALIAS")
                keyPassword = signingValue("PHONEDASH_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.findByName("release")
                ?: if (releaseRequested) throw GradleException("Release signing is not set up: see PHONEDASH_STORE_FILE in android/app/build.gradle.kts.") else null
        }
    }

    buildFeatures {
        buildConfig = true
    }

    lint {
        // Unsupported framework calls can crash old phones before the panel opens.
        fatal += "NewApi"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

// The MIT licence (PhoneBox's copyright notice must ship with every copy) and the third-party notices go into the app
// as assets/licenses/, copied from the repository at build time so there is only one copy of each text.
abstract class LicenseAssets : DefaultTask() {
    @get:InputFiles abstract val sources: ConfigurableFileCollection
    @get:OutputDirectory abstract val outputDir: DirectoryProperty

    @TaskAction
    fun copy() {
        val dir = outputDir.get().asFile.resolve("licenses")
        dir.deleteRecursively()
        dir.mkdirs()
        sources.files.forEach { it.copyTo(dir.resolve(if (it.name == "LICENSE") "LICENSE.txt" else it.name), overwrite = true) }
    }
}
val licenseAssets = tasks.register<LicenseAssets>("licenseAssets") {
    sources.from(rootProject.file("../LICENSE"), rootProject.file("THIRD-PARTY-NOTICES.txt"))
}
androidComponents {
    onVariants { variant -> variant.sources.assets?.addGeneratedSourceDirectory(licenseAssets, LicenseAssets::outputDir) }
}

dependencies {
    implementation("androidx.webkit:webkit:1.12.1")
    // PhoneDash Pro, the one-time unlock sold through Google Play (ProStore.kt). Each major version must be replaced
    // within two years: 9 is accepted for new apps and updates until 31 August 2028.
    implementation("com.android.billingclient:billing:9.1.0")
    // usage statistics, only after the user agrees; 24 needs Android 7, and 23.2 a newer Kotlin than this project uses
    implementation("com.google.firebase:firebase-analytics:23.0.0")
    // Google Play's rating card (ReviewAsk.kt)
    implementation("com.google.android.play:review:2.0.2")
    testImplementation("junit:junit:4.13.2")
    // android.jar's org.json is a stub on the JVM; the real one lets the unit tests build and read JSON
    testImplementation("org.json:json:20240303")
}
