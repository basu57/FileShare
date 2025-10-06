require('dotenv').config();
const { testCloudinaryConnection } = require('./config/cloudinary');

console.log('Cloudinary Environment Variables:');
console.log('CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME);
console.log('CLOUDINARY_API_KEY:', process.env.CLOUDINARY_API_KEY ? 'Set (hidden)' : 'Not set');
console.log('CLOUDINARY_API_SECRET:', process.env.CLOUDINARY_API_SECRET ? 'Set (hidden)' : 'Not set');

(async () => {
  try {
    console.log('Testing Cloudinary connection...');
    const result = await testCloudinaryConnection();
    console.log('Cloudinary connection test result:', result);
  } catch (error) {
    console.error('Error testing Cloudinary connection:', error.message);
  }
})(); 