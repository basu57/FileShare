require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const logger = require('./utils/logger');

// Function to test password hashing
const testPasswordHashing = async () => {
  try {
    console.log('Testing password hashing functionality...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');
    
    // Create a test user
    const testUser = new User({
      name: 'Password Test User',
      email: 'passwordtest@example.com',
      password: 'testpassword123',
      isVerified: true
    });
    
    // Save the user - this should trigger the password hashing pre-save hook
    await testUser.save();
    console.log('Test user created with ID:', testUser._id);
    
    // Verify the password was hashed
    console.log('Original password:', 'testpassword123');
    console.log('Hashed password stored in database:', testUser.password);
    
    // Test password matching
    const passwordMatches = await testUser.matchPassword('testpassword123');
    console.log('Password matching test result:', passwordMatches);
    
    // Test updating password
    testUser.password = 'newpassword456';
    await testUser.save();
    console.log('Password updated');
    
    // Verify the new password was hashed
    console.log('New password:', 'newpassword456');
    console.log('New hashed password in database:', testUser.password);
    
    // Test new password matching
    const newPasswordMatches = await testUser.matchPassword('newpassword456');
    console.log('New password matching test result:', newPasswordMatches);
    
    // Clean up - delete the test user
    await User.findByIdAndDelete(testUser._id);
    console.log('Test user deleted');
    
    console.log('Password hashing tests completed successfully');
  } catch (error) {
    console.error('Error during password hashing test:', error);
  } finally {
    // Close the database connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
};

// Run the test
testPasswordHashing(); 