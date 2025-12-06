# Firebase Admin SDK Setup Guide

## 🚀 Quick Start

Your server will now start successfully even without Firebase credentials. Push notification features will be disabled until you configure Firebase.

## Overview
The application uses Firebase Admin SDK for server-side push notification token management. Admin SDK has elevated privileges and is designed for backend operations.

## Required Environment Variables

Add the following variables to your `.env` file:

```env
# Firebase Admin SDK Configuration
PROJECTID=your-project-id
DATABASEURL=https://your-project-id.firebaseio.com
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYourPrivateKeyHere\n-----END PRIVATE KEY-----\n"
```

## How to Get Firebase Service Account Credentials

1. **Go to Firebase Console**
   - Visit https://console.firebase.google.com/
   - Select your project

2. **Navigate to Project Settings**
   - Click the gear icon ⚙️ next to "Project Overview"
   - Click "Project settings"

3. **Go to Service Accounts Tab**
   - Click on the "Service accounts" tab
   - Click "Generate new private key"
   - Click "Generate key" in the confirmation dialog

4. **Download the JSON File**
   - A JSON file will be downloaded (e.g., `your-project-id-firebase-adminsdk-xxxxx.json`)

5. **Extract Values from JSON**
   Open the downloaded JSON file and extract these values:
   
   ```json
   {
     "project_id": "your-project-id",  // → PROJECTID
     "private_key": "-----BEGIN PRIVATE KEY-----\n...",  // → FIREBASE_PRIVATE_KEY
     "client_email": "firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com"  // → FIREBASE_CLIENT_EMAIL
   }
   ```

6. **Update .env File**
   ```env
   PROJECTID=your-project-id
   DATABASEURL=https://your-project-id.firebaseio.com
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYourActualPrivateKeyHere\n-----END PRIVATE KEY-----\n"
   ```

   **Important:** Keep the quotes around FIREBASE_PRIVATE_KEY and include the `\n` characters as they appear in the JSON.

## Security Notes

⚠️ **IMPORTANT:**
- Never commit the service account JSON file to version control
- Never commit your `.env` file
- Add both to `.gitignore`:
  ```
  .env
  *-firebase-adminsdk-*.json
  ```
- The private key gives full access to your Firebase project - keep it secure!

## Testing

After setting up the credentials, restart your server. The application should now be able to:
- Save push tokens without permission errors
- Read tokens from Firebase Realtime Database
- Perform all database operations with admin privileges

## Troubleshooting

### Error: "Failed to parse private key"
- Ensure the private key includes `\n` characters
- Make sure the key is wrapped in quotes in the .env file

### Error: "Invalid service account"
- Verify the `FIREBASE_CLIENT_EMAIL` is correct
- Ensure you're using the latest service account key

### Error: "Database URL is invalid"
- Check that `DATABASEURL` matches your Firebase project
- Format: `https://YOUR-PROJECT-ID.firebaseio.com` or `https://YOUR-PROJECT-ID.REGION.firebasedatabase.app`

## Migration Notes

The following changes were made:
- ✅ Replaced `firebase/app` with `firebase-admin`
- ✅ Updated `saveToken()` to use Admin SDK syntax
- ✅ Updated `getToken()` to use Admin SDK syntax
- ✅ Updated `testFirebaseConnection()` to use Admin SDK syntax
- ✅ All functions now have proper error handling and logging

No changes are required in your controller files - they will work with the updated service.
