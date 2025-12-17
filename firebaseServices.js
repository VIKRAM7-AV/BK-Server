import admin from 'firebase-admin';
import dotenv from 'dotenv';
import User from './Model/UserModel.js';

dotenv.config();

// Check if Firebase credentials are configured
const isFirebaseConfigured = !!(
  process.env.FIREBASE_CLIENT_EMAIL && 
  process.env.FIREBASE_PRIVATE_KEY && 
  process.env.PROJECTID && 
  process.env.DATABASEURL
);

let database = null;

// Initialize Firebase Admin only if credentials are available
if (isFirebaseConfigured) {
  try {
    const firebaseConfig = {
      credential: admin.credential.cert({
        projectId: process.env.PROJECTID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
      databaseURL: process.env.DATABASEURL,
    };

    if (!admin.apps.length) {
      admin.initializeApp(firebaseConfig);
      database = admin.database();
      console.log('✅ Firebase Admin SDK initialized successfully');
    }
  } catch (error) {
    console.error('❌ Firebase initialization error:', error.message);
    console.warn('⚠️  Firebase features will be disabled. See FIREBASE_SETUP.md for setup instructions.');
  }
} else {
  console.warn('⚠️  Firebase credentials not found in .env file.');
  console.warn('⚠️  Push notification features will be disabled.');
  console.warn('⚠️  See FIREBASE_SETUP.md for setup instructions.');
}

// Save push token
export const saveToken = async (userId, token) => {
  // If Firebase DB isn't available, fall back to storing token in MongoDB User model
  if (!database) {
    try {
      if (!userId || !token) {
        throw new Error('User ID and token are required');
      }
      const filter = { $or: [{ _id: userId }, { userId: userId }] };
      const update = { expoPushToken: token };
      const options = { new: true };
      const user = await User.findOneAndUpdate(filter, update, options);
      if (user) {
        console.log('✅ Token saved to MongoDB for user:', userId);
        return true;
      } else {
        console.warn('⚠️  User not found in MongoDB, token not saved:', userId);
        return false;
      }
    } catch (error) {
      console.error('❌ Error saving token to MongoDB fallback:', error);
      throw error;
    }
  }

  try {
    if (!userId || !token) {
      throw new Error('User ID and token are required');
    }
    const userTokenRef = database.ref(`userTokens/${userId}`);
    await userTokenRef.set({ token });
    console.log('✅ Token saved successfully for user:', userId);
    return true;
  } catch (error) {
    console.error('❌ Error saving token:', error);
    throw error;
  }
};

// Get push token
export const getToken = async (userId) => {
  // If Firebase DB isn't available, try reading token from MongoDB User model
  if (!database) {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }
      const filter = { $or: [{ _id: userId }, { userId: userId }] };
      const user = await User.findOne(filter).select('expoPushToken');
      if (!user) return null;
      return user.expoPushToken || null;
    } catch (error) {
      console.error('❌ Error retrieving token from MongoDB fallback:', error);
      throw error;
    }
  }

  try {
    if (!userId) {
      throw new Error('User ID is required');
    }
    const snapshot = await database.ref(`userTokens/${userId}`).once('value');
    const tokenData = snapshot.val();
    if (!tokenData) {
      return null;
    }
    return tokenData; 
  } catch (error) {
    console.error('❌ Error retrieving token:', error);
    throw error;
  }
};

// Test Firebase connection
export const testFirebaseConnection = async () => {
  if (!database) {
    console.warn('⚠️  Firebase not configured. Connection test skipped.');
    return false;
  }
  
  try {
    const testRef = database.ref('test');
    await testRef.set({ test: 'connection' });
    const snapshot = await testRef.once('value');
    console.log('✅ Firebase connection test successful');
    return true;
  } catch (error) {
    console.error('❌ Firebase connection test failed:', error);
    return false;
  }
};