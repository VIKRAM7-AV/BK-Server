import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, child } from 'firebase/database';

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.APIKey,
  authDomain: process.env.AUTHDOMAIN,
  databaseURL: process.env.DATABASEURL,
  projectId: process.env.PROJECTID,
  storageBucket: process.env.STORAGEBUCKET,
  messagingSenderId: process.env.MESSAGINGSENDERID,
  appId: process.env.APPID,
  measurementId: process.env.MEASUREMENTID,
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const database = getDatabase(firebaseApp);
const dbRef = ref(database);

// Save push token
export const saveToken = async (userId, token) => {
  try {
    if (!userId || !token) {
      throw new Error('User ID and token are required');
    }
    const userTokenRef = ref(database, `userTokens/${userId}`);
    await set(userTokenRef, { token });
    console.log(`✅ Push token saved for user: ${userId}`);
    return true;
  } catch (error) {
    console.error('❌ Error saving token:', error);
    throw error;
  }
};

// Get push token
export const getToken = async (userId) => {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }
    const snapshot = await get(ref(database, `userTokens/${userId}`));
    const tokenData = snapshot.val();
    if (!tokenData) {
      console.log(`⚠️ No token found for user: ${userId}`);
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
  try {
    const testRef = ref(database, 'test');
    await set(testRef, { test: 'connection' });
    const snapshot = await get(testRef);
    console.log('✅ Firebase connection test:', snapshot.val());
  } catch (error) {
    console.error('❌ Firebase connection test failed:', error);
  }
};