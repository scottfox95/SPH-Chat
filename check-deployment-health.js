#!/usr/bin/env node

/**
 * This script checks the health of a SPHBuddy deployment
 * Run it with:
 *   - No arguments to check the local development server
 *   - An argument to specify a production URL, e.g.: node check-deployment-health.js https://sphbuddy.info
 */

import https from 'https';
import http from 'http';

// Default to local development environment if no URL is provided
const baseUrl = process.argv[2] || 'http://localhost:5000';
const isLocal = baseUrl.includes('localhost');
const client = baseUrl.startsWith('https') ? https : http;

console.log(`\n🔍 Checking deployment health for ${baseUrl}...\n`);

// Function to make a GET request to an endpoint
async function checkEndpoint(path) {
  return new Promise((resolve, reject) => {
    const url = `${baseUrl}${path}`;
    console.log(`Checking ${url}...`);
    
    const req = client.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          console.log(`✅ ${path} - Status: ${res.statusCode}`);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (err) {
          console.log(`❌ ${path} - Error parsing JSON: ${err.message}`);
          reject(err);
        }
      });
    });
    
    req.on('error', (err) => {
      console.log(`❌ ${path} - Request error: ${err.message}`);
      reject(err);
    });
    
    req.end();
  });
}

// Main function to check all health endpoints
async function checkHealth() {
  try {
    // Check general system health
    const healthResult = await checkEndpoint('/api/system/health');
    console.log(`  - System Status: ${healthResult.data.status}`);
    console.log(`  - Environment: ${healthResult.data.environment}`);
    console.log(`  - Timestamp: ${healthResult.data.timestamp}`);
    
    // Check database status
    const dbStatusResult = await checkEndpoint('/api/system/db-status');
    console.log(`  - Database Connected: ${dbStatusResult.data.database.connected}`);
    if (dbStatusResult.data.database.connected) {
      console.log(`  - Database Details: ${dbStatusResult.data.database.details}`);
    } else {
      console.log(`  - Database Error: ${dbStatusResult.data.database.error}`);
    }
    
    // Check detailed database verification
    const dbVerifyResult = await checkEndpoint('/api/system/db-verify');
    if (dbVerifyResult.data.verification.success) {
      console.log(`  - Database Verification: SUCCESS`);
      console.log(`  - Tables Found: ${dbVerifyResult.data.verification.tables.length}`);
      console.log(`  - User Count: ${dbVerifyResult.data.verification.userCount}`);
      console.log(`  - DB Pool: ${dbVerifyResult.data.verification.poolInfo.totalConnections} connections`);
    } else {
      console.log(`  - Database Verification: FAILED`);
      console.log(`  - Failure Step: ${dbVerifyResult.data.verification.step}`);
      console.log(`  - Error: ${dbVerifyResult.data.verification.error}`);
    }
    
    // Check authentication status
    const authStatusResult = await checkEndpoint('/api/auth-status');
    console.log(`  - Authenticated: ${authStatusResult.data.authenticated}`);
    console.log(`  - Environment: ${authStatusResult.data.environment}`);
    console.log(`  - Session ID: ${authStatusResult.data.sessionID}`);
    console.log(`  - CORS Enabled: ${authStatusResult.data.cors?.enabled}`);
    console.log(`  - Cookie Settings: ${JSON.stringify(authStatusResult.data.cookieSettings)}`);
    
    console.log("\n✅ All health checks completed");
    
    // Provide summary
    console.log("\n📋 DEPLOYMENT HEALTH SUMMARY");
    console.log("---------------------------");
    console.log(`System: ${healthResult.data.status === 'ok' ? '✅ OK' : '❌ ISSUES'}`);
    console.log(`Database: ${dbStatusResult.data.database.connected ? '✅ CONNECTED' : '❌ DISCONNECTED'}`);
    console.log(`Database Verification: ${dbVerifyResult.data.verification.success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Authentication Setup: ${authStatusResult.status === 200 ? '✅ CONFIGURED' : '❌ ISSUES'}`);
    
    const allGood = 
      healthResult.data.status === 'ok' && 
      dbStatusResult.data.database.connected && 
      dbVerifyResult.data.verification.success &&
      authStatusResult.status === 200;
    
    console.log("\n" + (allGood 
      ? "✅ ALL CHECKS PASSED - Deployment appears healthy!" 
      : "⚠️ ISSUES DETECTED - See above details for more information"));
      
    if (!allGood) {
      console.log("\nRecommended actions:");
      
      if (!dbStatusResult.data.database.connected) {
        console.log("- Check DATABASE_URL environment variable is correct");
        console.log("- Verify database is running and accessible");
      }
      
      if (!dbVerifyResult.data.verification.success) {
        console.log("- Run migrations or database setup scripts");
        console.log("- Check database permissions");
      }
      
      if (authStatusResult.status !== 200) {
        console.log("- Verify SESSION_SECRET is set");
        console.log("- Check cookie settings match your environment");
      }
    }
    
  } catch (error) {
    console.error("❌ Error checking health:", error.message);
  }
}

checkHealth();