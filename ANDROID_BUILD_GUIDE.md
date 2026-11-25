# Bubble Pop Adventure — Android APK build (cloud)

This package wraps the existing React + TypeScript + Vite game in a Capacitor Android app. The included GitHub Actions workflow builds a **debug APK in GitHub's cloud runner**; Android Studio, Android SDK, and Java do not need to be installed on your own computer.

## Build the APK

1. Create/sign in to a GitHub account.
2. Create a new **private** repository, for example `bubble-pop-adventure`.
3. Extract this ZIP on your computer and upload all files/folders inside it to the repository root (not the outer ZIP folder). Make sure `.github/workflows/build-android-apk.yml` is included. GitHub's web uploader may hide dot-folders; if so, use GitHub Desktop or upload through a git client.
4. Commit the files to the `main` branch.
5. Open the repository on GitHub, select **Actions**, and open **Build Bubble Pop Adventure Android APK**.
6. If asked, enable GitHub Actions, then choose **Run workflow**. A push to `main` also starts the workflow automatically.
7. Wait for the workflow to finish. If successful, open its run page and find **Artifacts** at the bottom. Download `Bubble-Pop-Adventure-debug-APK`.
8. Extract the downloaded artifact ZIP. It contains `app-debug.apk`.
9. Transfer `app-debug.apk` to your Android phone, open it, and allow installation from that source if Android asks. Only install APKs you built from your own trusted repository.

## Notes

- This produces a **debug APK for testing**, not a signed Play Store release. A Play Store release normally needs a signed Android App Bundle (AAB) and a securely managed signing key.
- This is a web game packaged in an Android WebView using Capacitor, not a native Godot game.
- The project has not been compiled or tested in this environment. The cloud workflow is provided to attempt the build; review the Actions log if it fails.
- App ID: `com.bubblepopadventure.game`. Choose your final unique application ID before publishing; changing it later creates a separate Android app identity.
