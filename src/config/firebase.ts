////// firebase config ////// 

import admin from "firebase-admin";


interface FirebaseServiceAccount {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
  universe_domain: string;
}

// Helper function to format private key (replace \n with actual newlines)
const formatPrivateKey = (key: string | undefined): string => {
  if (!key) return '';
  // Replace escaped newlines with actual newlines
  // Also handle cases where the key might be in a single line format
  return key.replace(/\\n/g, '\n');
};

const serviceAccount: FirebaseServiceAccount = {
  type: process.env.FIREBASE_TYPE || 'service_account',
  project_id: process.env.FIREBASE_PROJECT_ID || '',
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID || '',
  private_key: formatPrivateKey(process.env.FIREBASE_PRIVATE_KEY),
  client_email: process.env.FIREBASE_CLIENT_EMAIL || '',
  client_id: process.env.FIREBASE_CLIENT_ID || '',
  auth_uri: process.env.FIREBASE_AUTH_URL || '',
  token_uri: process.env.FIREBASE_TOKEN_URL || '',
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_URL || '',
  client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL || '',
  universe_domain: process.env.UNIVERSE_DOMAIN || '',
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount)
});



export default admin;