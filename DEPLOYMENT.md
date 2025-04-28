# SPH Chat Deployment Guide

This guide provides instructions for deploying the SPH Chat application to ensure consistent behavior between development and production environments.

## Environment Setup

### Required Environment Variables

The application requires the following environment variables to be set in both development and production:

```
# Required
DATABASE_URL=postgresql://user:password@hostname:port/database
NODE_ENV=production (or development)
SESSION_SECRET=your-secure-session-secret

# Optional - Slack integration
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
SLACK_CHANNEL_ID=C0123456789

# Optional - Email settings for summaries
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_USER=user@example.com
EMAIL_PASS=your-email-password

# Optional - OpenAI API for AI features
OPENAI_API_KEY=your-openai-api-key
```

### Database Configuration

The application uses a PostgreSQL database through the Neon serverless client. The same database should be used for both development and production to ensure feature parity.

1. Create a PostgreSQL database (using Supabase, Neon, or another provider)
2. Set the `DATABASE_URL` environment variable to point to this database
3. The application will automatically create necessary tables on first run

## Authentication

Authentication relies on cookies, which behave differently in development and production:

- **Development**: Uses `lax` sameSite cookies without `secure` flag
- **Production**: Uses `none` sameSite cookies with `secure` flag and the `.sphbuddy.info` domain

## Deployment Process

1. **Pre-deployment checks**:
   - Run `node server/test-db-connection.js` to verify database connectivity
   - Check system health with `/api/system/health` endpoint 
   - Check database basic health with `/api/system/db-status` endpoint
   - Perform comprehensive database verification with `/api/system/db-verify` endpoint

2. **Environment verification**:
   - Verify all environment variables are set correctly
   - Check auth status with `/api/auth-status` endpoint
   - Verify CORS settings allow requests from your domain

3. **Production deployment**:
   - Deploy the application to your hosting provider
   - Set up a proper SSL certificate for your domain
   - Ensure the database URL points to the correct database
   - Set NODE_ENV=production

4. **Post-deployment verification**:
   - Check application health at https://sphbuddy.info/api/system/health
   - Verify database status at https://sphbuddy.info/api/system/db-verify
   - Test authentication at https://sphbuddy.info/api/auth-status
   - Perform a login test and check that cookies are properly set

## Troubleshooting

### Authentication Issues

If users cannot log in on production:
- Check auth status via `/api/auth-status` endpoint
- Verify that cookies are being set correctly (check browser dev tools)
- Ensure SESSION_SECRET is consistent across deployments
- Ensure database connection is working

### Database Connectivity Issues

If database operations fail:
- Check `/api/system/db-status` for detailed database status
- Verify DATABASE_URL is correct and accessible
- Check that the database schema is properly initialized

### Slack Integration Issues

If Slack integration doesn't work:
- Verify SLACK_BOT_TOKEN and SLACK_CHANNEL_ID are set
- Check bot permissions in Slack
- Test connectivity with `/api/slack/test-connection` endpoint

## Version Compatibility

When updating the application, ensure that:
1. The database schema is compatible with the new version
2. All required environment variables are set
3. Session handling is consistent between environments

## Monitoring and Health Checking

### Monitoring Endpoints

- `/api/system/health` - Basic application health
- `/api/system/db-status` - Database connection status
- `/api/system/db-verify` - Comprehensive database verification
- `/api/auth-status` - Authentication system status

### Health Check Tool

The project includes a built-in health check script that verifies the deployment is working correctly:

```bash
# Check local development environment
node check-deployment-health.js

# Check production environment
node check-deployment-health.js https://sphbuddy.info
```

This tool will:
- Check basic system health
- Verify database connectivity and schema
- Confirm authentication is properly configured
- Provide detailed diagnostics and recommended fixes for any issues

### Log Monitoring

- Check application logs for errors
- Set up alerts based on the health check endpoints
- Monitor for database connection failures

## Contact

For additional support, contact the development team at support@example.com.