// Simple test script to verify the MCP server tools
import { spawn } from 'child_process';

async function testMCPServer() {
  console.log('Testing Weather MCP Server...\n');

  const server = spawn('node', ['src/index.ts'], {
    stdio: ['pipe', 'pipe', 'inherit'],
  });

  // Test list tools
  const listToolsRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {},
  };

  console.log('1. Testing tools/list...');
  server.stdin.write(JSON.stringify(listToolsRequest) + '\n');

  // Test get_alerts tool
  const alertsRequest = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'get_alerts',
      arguments: {
        state: 'CA',
      },
    },
  };

  setTimeout(() => {
    console.log('2. Testing get_alerts for CA...');
    server.stdin.write(JSON.stringify(alertsRequest) + '\n');
  }, 1000);

  // Test get_forecast tool
  const forecastRequest = {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'get_forecast',
      arguments: {
        latitude: 37.7749,
        longitude: -122.4194,
      },
    },
  };

  setTimeout(() => {
    console.log('3. Testing get_forecast for San Francisco...');
    server.stdin.write(JSON.stringify(forecastRequest) + '\n');
  }, 2000);

  // Collect responses
  let responseCount = 0;
  server.stdout.on('data', (data) => {
    const responses = data.toString().trim().split('\n');
    responses.forEach((response) => {
      if (response.trim()) {
        try {
          const parsed = JSON.parse(response);
          responseCount++;
          console.log(`\nResponse ${responseCount}:`, JSON.stringify(parsed, null, 2));

          if (responseCount >= 3) {
            console.log('\n✅ All tests completed!');
            server.kill();
            process.exit(0);
          }
        } catch (e) {
          console.log('Raw response:', response);
        }
      }
    });
  });

  // Timeout after 10 seconds
  setTimeout(() => {
    console.log('\n⏰ Test timeout reached');
    server.kill();
    process.exit(1);
  }, 10000);
}

testMCPServer().catch(console.error);
