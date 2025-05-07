/**
 * Standalone script to test Slack integration
 * Run with: NODE_ENV=development node server/test-slack.js C08R5GW0L4E
 * 
 * This script tests sending a message to a Slack channel
 * and provides detailed logs about the process.
 */
import { WebClient } from '@slack/web-api';

// Get channel ID from command line argument
const channelId = process.argv[2];

if (!channelId) {
  console.error('Error: Channel ID is required');
  console.log('Usage: NODE_ENV=development node server/test-slack.js <channel_id>');
  process.exit(1);
}

console.log(`Testing Slack integration with channel ID: ${channelId}`);

// Initialize Slack client
const slackToken = process.env.SLACK_BOT_TOKEN;
if (!slackToken) {
  console.error('Error: SLACK_BOT_TOKEN environment variable is not set');
  process.exit(1);
}

console.log(`Using Slack token starting with: ${slackToken.substring(0, 10)}...`);
const slack = new WebClient(slackToken);

async function testSlackConnection() {
  try {
    console.log('Testing auth.test...');
    const authTest = await slack.auth.test();
    console.log('Auth test result:', JSON.stringify(authTest, null, 2));
    
    return {
      connected: true,
      botName: authTest.bot_id ? `${authTest.user} (Bot)` : authTest.user,
      teamName: authTest.team,
      url: authTest.url,
      userId: authTest.user_id,
      teamId: authTest.team_id
    };
  } catch (error) {
    console.error('Slack connection test failed:', error);
    return {
      connected: false,
      error: error?.data?.error || error?.message || 'Unknown error'
    };
  }
}

async function sendTestMessage() {
  try {
    const connectionTest = await testSlackConnection();
    
    if (!connectionTest.connected) {
      console.error('Failed to connect to Slack API:', connectionTest.error);
      process.exit(1);
    }
    
    console.log('Slack connection successful!');
    console.log(`Bot name: ${connectionTest.botName}`);
    console.log(`Team name: ${connectionTest.teamName}`);
    console.log(`URL: ${connectionTest.url}`);
    
    const testMessage = `Test message from SPH Chat - ${new Date().toLocaleString()}`;
    console.log(`Sending test message: "${testMessage}"`);
    
    const result = await slack.chat.postMessage({
      channel: channelId,
      text: testMessage,
    });
    
    console.log('Message sent successfully!');
    console.log('Message details:', JSON.stringify(result, null, 2));
    
    // Now try to fetch channels to check scope
    try {
      console.log('\nTesting channel access...');
      const channels = await slack.conversations.list({
        types: 'public_channel,private_channel',
        exclude_archived: true,
        limit: 10
      });
      
      console.log(`Found ${channels.channels.length} channels`);
      const accessibleChannels = channels.channels
        .filter(channel => channel.is_member)
        .map(channel => ({
          id: channel.id,
          name: channel.name,
          isPrivate: channel.is_private,
          memberCount: channel.num_members
        }));
      
      console.log('Channels bot has access to:', JSON.stringify(accessibleChannels, null, 2));
      
      // Check if our target channel is in the list
      const targetChannel = accessibleChannels.find(c => c.id === channelId);
      if (targetChannel) {
        console.log(`✅ Bot has access to target channel: ${targetChannel.name} (${channelId})`);
      } else {
        console.log(`❌ Bot does NOT have access to channel: ${channelId}`);
        console.log('This may be why your messages are not being sent to this channel.');
        console.log('Make sure to invite the bot to the channel with /invite @your_bot_name');
      }
    } catch (error) {
      console.error('Error listing channels:', error?.data?.error || error?.message);
    }
  } catch (error) {
    console.error('Error in test:', error);
    if (error.data) {
      console.error('Slack API error details:', JSON.stringify(error.data, null, 2));
    }
  }
}

sendTestMessage();