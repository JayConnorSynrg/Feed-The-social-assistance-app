# FEED App Store Preparation Guide

## iOS App Store Submission (P6-T6)

### Prerequisites Checklist
- [ ] Apple Developer Account ($99/year)
- [ ] App Store Connect account set up
- [ ] Certificates and provisioning profiles created
- [ ] App icon set (1024x1024 required)
- [ ] Screenshots for all device sizes

### Required Assets

#### App Icon
- 1024x1024 PNG (no transparency, no rounded corners)
- Located at: `ios/App/App/Assets.xcassets/AppIcon.appiconset/`

#### Screenshots Required
| Device | Size (pixels) |
|--------|---------------|
| iPhone 6.7" | 1290 x 2796 |
| iPhone 6.5" | 1284 x 2778 |
| iPhone 5.5" | 1242 x 2208 |
| iPad Pro 12.9" | 2048 x 2732 |

#### App Information
- **App Name**: FEED - Mutual Aid Platform
- **Subtitle**: Find Benefits & Community Resources
- **Category**: Primary: Lifestyle, Secondary: Utilities
- **Age Rating**: 4+ (no objectionable content)
- **Privacy Policy URL**: [Required - must be hosted]
- **Support URL**: [Required]

### App Description
```
FEED connects you with benefits, community resources, and mutual aid support.

KEY FEATURES:
- Find local resources on an interactive map
- Check eligibility for SNAP, Medicaid, and other benefits
- Complete and track benefit applications
- Securely store important documents
- Get AI-powered assistance with forms and questions
- Connect with your community through our social feed

PRIVACY & SECURITY:
- Your sensitive data is encrypted
- We never sell your information
- You control what you share

FEED is built by and for the community, helping everyone access the support they deserve.
```

### Build Commands
```bash
# Build web assets
cd apps/web
CAPACITOR_BUILD=true npm run build

# Sync to iOS
cd ../mobile
npx cap sync ios

# Open in Xcode
npx cap open ios
```

### Xcode Settings
1. Set Bundle Identifier: `com.feed.app`
2. Set Version: `1.0.0`
3. Set Build Number: `1`
4. Configure signing with Apple Developer account
5. Set deployment target: iOS 14.0+

### Submission Checklist
- [ ] Archive build in Xcode
- [ ] Upload to App Store Connect
- [ ] Complete app information
- [ ] Submit for review
- [ ] Respond to any reviewer questions

---

## Google Play Store Submission (P6-T7)

### Prerequisites Checklist
- [ ] Google Play Developer Account ($25 one-time)
- [ ] Google Play Console access
- [ ] Keystore file created and secured
- [ ] App icon set (512x512 required)
- [ ] Feature graphic (1024x500)
- [ ] Screenshots for phone and tablet

### Required Assets

#### App Icon
- 512x512 PNG (32-bit with alpha)

#### Feature Graphic
- 1024x500 PNG or JPG

#### Screenshots Required
| Device Type | Minimum | Size |
|-------------|---------|------|
| Phone | 2 | 320-3840px wide |
| 7" Tablet | 2 | 320-3840px wide |
| 10" Tablet | 2 | 320-3840px wide |

#### Store Listing
- **App Name**: FEED - Mutual Aid Platform
- **Short Description**: Find benefits, resources & community support
- **Full Description**: [Same as iOS]
- **Category**: Lifestyle
- **Content Rating**: Everyone
- **Privacy Policy URL**: [Required]

### Build Commands
```bash
# Build web assets
cd apps/web
CAPACITOR_BUILD=true npm run build

# Sync to Android
cd ../mobile
npx cap sync android

# Open in Android Studio
npx cap open android
```

### Android Studio Settings
1. Update `android/app/build.gradle`:
   - applicationId: `com.feed.app`
   - versionCode: `1`
   - versionName: `1.0.0`
   - minSdkVersion: `24` (Android 7.0+)
   - targetSdkVersion: `34`

2. Sign the release build with keystore

### Generate Signed APK/AAB
```bash
# Generate keystore (first time only)
keytool -genkey -v -keystore feed-release-key.keystore -alias feed -keyalg RSA -keysize 2048 -validity 10000

# Build release AAB
cd android
./gradlew bundleRelease
```

### Submission Checklist
- [ ] Generate signed AAB (Android App Bundle)
- [ ] Upload to Google Play Console
- [ ] Complete store listing
- [ ] Set up pricing and distribution
- [ ] Complete content rating questionnaire
- [ ] Submit for review

---

## Privacy Policy Requirements

Both stores require a privacy policy. Key points to include:

1. **Data Collection**: What data is collected
2. **Data Usage**: How the data is used
3. **Data Sharing**: Who has access to the data
4. **Data Storage**: Where and how data is stored
5. **User Rights**: How users can access/delete their data
6. **Contact Information**: How to reach you with privacy questions

---

## Post-Launch Checklist

- [ ] Monitor crash reports
- [ ] Respond to user reviews
- [ ] Track key metrics (downloads, retention, engagement)
- [ ] Plan regular updates
- [ ] Monitor for security vulnerabilities
