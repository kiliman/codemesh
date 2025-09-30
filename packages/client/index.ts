import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createInterface } from 'node:readline';
import type {
  ListToolsRequest,
  CallToolRequest,
  ListPromptsRequest,
  GetPromptRequest,
  ListResourcesRequest,
  ResourceLink,
  ReadResourceRequest,
} from '@modelcontextprotocol/sdk/types.js';
import {
  ListToolsResultSchema,
  CallToolResultSchema,
  ListPromptsResultSchema,
  GetPromptResultSchema,
  ListResourcesResultSchema,
  LoggingMessageNotificationSchema,
  ResourceListChangedNotificationSchema,
  ElicitRequestSchema,
  ReadResourceResultSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { getDisplayName } from '@modelcontextprotocol/sdk/shared/metadataUtils.js';
import Ajv from 'ajv';

// Create readline interface for user input
const readline = createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Track received notifications for debugging resumability
let notificationCount = 0;

// Global client and transport for interactive commands
let client: Client | null = null;
let transport: StreamableHTTPClientTransport | StdioClientTransport | null = null;
let serverUrl: string | null = null;
let connectionType: 'http' | 'stdio' | null = null;
let stdioCommand: string[] | null = null;
let notificationsToolLastEventId: string | undefined = undefined;
let sessionId: string | undefined = undefined;

interface CliOptions {
  connect?: string;
  stdio?: boolean;
  command?: string[];
  listTools?: boolean;
  callTool?: string;
  toolArgs?: string;
  toolArgsFile?: string;
  codeFile?: string;
  listPrompts?: boolean;
  getPrompt?: string;
  promptArgs?: string;
  listResources?: boolean;
  readResource?: string;
  help?: boolean;
  interactive?: boolean;
}

function parseCliArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--connect':
        options.connect = args[++i];
        break;
      case '--stdio':
        options.stdio = true;
        // Collect args until we hit another --option
        const commandArgs = [];
        for (let j = i + 1; j < args.length; j++) {
          if (args[j].startsWith('--')) {
            break;
          }
          commandArgs.push(args[j]);
        }
        options.command = commandArgs;
        i += commandArgs.length;
        break;
      case '--list-tools':
        options.listTools = true;
        break;
      case '--call-tool':
        options.callTool = args[++i];
        break;
      case '--tool-args':
        options.toolArgs = args[++i];
        break;
      case '--tool-args-file':
        options.toolArgsFile = args[++i];
        break;
      case '--code-file':
        options.codeFile = args[++i];
        break;
      case '--list-prompts':
        options.listPrompts = true;
        break;
      case '--get-prompt':
        options.getPrompt = args[++i];
        break;
      case '--prompt-args':
        options.promptArgs = args[++i];
        break;
      case '--list-resources':
        options.listResources = true;
        break;
      case '--read-resource':
        options.readResource = args[++i];
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--interactive':
      case '-i':
        options.interactive = true;
        break;
    }
  }

  return options;
}

function printCliHelp(): void {
  console.log('MCP Client - CLI Mode');
  console.log('====================');
  console.log('');
  console.log('Usage:');
  console.log('  node dist/index.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  --connect <url>              Connect to HTTP MCP server');
  console.log('  --stdio <command...>         Connect to stdio MCP server (provide command + args)');
  console.log('  --list-tools                 List available tools');
  console.log('  --call-tool <name>           Call a tool');
  console.log('  --tool-args <json>           JSON arguments for tool call');
  console.log('  --tool-args-file <file>      Load JSON arguments from file');
  console.log('  --code-file <file>           Load TypeScript code from file (for execute-code tool)');
  console.log('  --list-prompts               List available prompts');
  console.log('  --get-prompt <name>          Get a prompt');
  console.log('  --prompt-args <json>         JSON arguments for prompt');
  console.log('  --list-resources             List available resources');
  console.log('  --read-resource <uri>        Read a resource');
  console.log('  --interactive, -i            Force interactive mode');
  console.log('  --help, -h                   Show this help');
  console.log('');
  console.log('Examples:');
  console.log('  # Connect to HTTP server and list tools');
  console.log('  node dist/index.js --connect http://localhost:3002/mcp --list-tools');
  console.log('');
  console.log('  # Connect to stdio server and list tools');
  console.log('  node dist/index.js --stdio npx codemesh --list-tools');
  console.log('');
  console.log('  # Call a tool via stdio with arguments');
  console.log(
    '  node dist/index.js --stdio tsx packages/codemesh-server/src/index.ts --call-tool discover-tools',
  );
  console.log('');
  console.log('  # Interactive mode (default when no commands given)');
  console.log('  node dist/index.js --interactive');
}

async function runCliMode(options: CliOptions): Promise<void> {
  try {
    // Connect to server
    if (options.stdio && options.command && options.command.length > 0) {
      console.log(`Connecting to stdio server: ${options.command.join(' ')}...`);
      await connectStdio(options.command);
    } else {
      const serverUrl = options.connect || 'http://localhost:3000/mcp';
      console.log(`Connecting to ${serverUrl}...`);
      await connect(serverUrl);
    }

    // Execute commands in sequence
    if (options.listTools) {
      await listTools();
    }

    if (options.callTool) {
      let toolArgs = {};

      // Load tool args from file if specified
      if (options.toolArgsFile) {
        try {
          const fs = await import('node:fs/promises');
          const argsContent = await fs.readFile(options.toolArgsFile, 'utf-8');
          toolArgs = JSON.parse(argsContent);
          console.log(`📄 Loaded tool args from ${options.toolArgsFile}`);
        } catch (error) {
          console.error(`❌ Error loading tool args file ${options.toolArgsFile}:`, error);
          return;
        }
      }
      // Otherwise use inline args
      else if (options.toolArgs) {
        try {
          toolArgs = JSON.parse(options.toolArgs);
        } catch (error) {
          console.error('❌ Invalid JSON in --tool-args:', error);
          return;
        }
      }

      // Special handling for execute-code tool with --code-file
      if (options.callTool === 'execute-code' && options.codeFile) {
        try {
          const fs = await import('node:fs/promises');
          const codeContent = await fs.readFile(options.codeFile, 'utf-8');
          toolArgs = { ...toolArgs, code: codeContent };
          console.log(`📄 Loaded code from ${options.codeFile}`);
        } catch (error) {
          console.error(`❌ Error loading code file ${options.codeFile}:`, error);
          return;
        }
      }

      await callTool(options.callTool, toolArgs);
    }

    if (options.listPrompts) {
      await listPrompts();
    }

    if (options.getPrompt) {
      let promptArgs = {};
      if (options.promptArgs) {
        try {
          promptArgs = JSON.parse(options.promptArgs);
        } catch (error) {
          console.error('❌ Invalid JSON in --prompt-args:', error);
          return;
        }
      }
      await getPrompt(options.getPrompt, promptArgs);
    }

    if (options.listResources) {
      await listResources();
    }

    if (options.readResource) {
      await readResource(options.readResource);
    }
  } catch (error) {
    console.error('❌ CLI execution error:', error);
    process.exit(1);
  } finally {
    // Always cleanup when done
    await cleanup();
  }
}

async function runInteractiveMode(): Promise<void> {
  console.log('MCP Interactive Client');
  console.log('=====================');

  // Set up raw mode for keyboard input to capture Escape key (interactive mode only)
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.on('data', async (data) => {
      // Check for Escape key (27)
      if (data.length === 1 && data[0] === 27) {
        console.log('\nESC key pressed. Disconnecting from server...');

        // Abort current operation and disconnect from server
        if (client && transport) {
          await disconnect();
          console.log('Disconnected. Press Enter to continue.');
        } else {
          console.log('Not connected to server.');
        }

        // Re-display the prompt
        process.stdout.write('> ');
      }
    });
  }

  // Connect to server if connection info was provided
  if (connectionType === 'stdio' && stdioCommand) {
    await connectStdio(stdioCommand);
  } else if (connectionType === 'http' && serverUrl) {
    await connect(serverUrl);
  } else {
    console.log('No server connection configured. Use "connect <url>" or "connect-stdio <command...>" to connect.');
  }

  // Print help and start the command loop
  printHelp();
  commandLoop();
}

// Flag to track if we're in CLI mode
let isCliMode = false;

async function main(): Promise<void> {
  const options = parseCliArgs();

  // Show help if requested
  if (options.help) {
    printCliHelp();
    return;
  }

  // Determine if we should run in CLI or interactive mode
  const hasCommands =
    options.listTools ||
    options.callTool ||
    options.listPrompts ||
    options.getPrompt ||
    options.listResources ||
    options.readResource;

  // If --interactive is explicitly set, always use interactive mode
  if (options.interactive) {
    isCliMode = false;

    // If connection options were provided, set them up for auto-connect
    if (options.stdio && options.command && options.command.length > 0) {
      stdioCommand = options.command;
      connectionType = 'stdio';
    } else if (options.connect) {
      serverUrl = options.connect;
      connectionType = 'http';
    }

    await runInteractiveMode();
  } else if (hasCommands || options.connect || options.stdio) {
    // CLI mode - execute commands and exit
    isCliMode = true;
    await runCliMode(options);
  } else {
    // Interactive mode - default behavior
    isCliMode = false;
    await runInteractiveMode();
  }
}

function printHelp(): void {
  console.log('\nAvailable commands:');
  console.log('  connect <url>              - Connect to HTTP MCP server');
  console.log('  connect-stdio <cmd...>     - Connect to stdio MCP server');
  console.log('  disconnect                 - Disconnect from server');
  console.log('  terminate-session          - Terminate the current session');
  console.log('  reconnect                  - Reconnect to the last server');
  console.log('  list-tools                 - List available tools');
  console.log('  call-tool <name> [args]    - Call a tool with optional JSON arguments');
  console.log('  greet [name]               - Call the greet tool');
  console.log('  multi-greet [name]         - Call the multi-greet tool with notifications');
  console.log(
    '  collect-info [type]        - Test elicitation with collect-user-info tool (contact/preferences/feedback)',
  );
  console.log('  start-notifications [interval] [count] - Start periodic notifications');
  console.log(
    '  run-notifications-tool-with-resumability [interval] [count] - Run notification tool with resumability',
  );
  console.log('  list-prompts               - List available prompts');
  console.log('  get-prompt [name] [args]   - Get a prompt with optional JSON arguments');
  console.log('  list-resources             - List available resources');
  console.log('  read-resource <uri>        - Read a specific resource by URI');
  console.log('  help                       - Show this help');
  console.log('  quit                       - Exit the program');
}

function commandLoop(): void {
  readline.question('\n> ', async (input) => {
    const args = input.trim().split(/\s+/);
    const command = args[0]?.toLowerCase();

    try {
      switch (command) {
        case 'connect':
          await connect(args[1]);
          break;

        case 'connect-stdio':
          if (args.length < 2) {
            console.log('Usage: connect-stdio <command> [args...]');
          } else {
            await connectStdio(args.slice(1));
          }
          break;

        case 'disconnect':
          await disconnect();
          break;

        case 'terminate-session':
          await terminateSession();
          break;

        case 'reconnect':
          await reconnect();
          break;

        case 'list-tools':
          await listTools();
          break;

        case 'call-tool':
          if (args.length < 2) {
            console.log('Usage: call-tool <name> [args]');
          } else {
            const toolName = args[1];
            let toolArgs = {};
            if (args.length > 2) {
              try {
                toolArgs = JSON.parse(args.slice(2).join(' '));
              } catch {
                console.log('Invalid JSON arguments. Using empty args.');
              }
            }
            await callTool(toolName, toolArgs);
          }
          break;

        case 'greet':
          await callGreetTool(args[1] || 'MCP User');
          break;

        case 'multi-greet':
          await callMultiGreetTool(args[1] || 'MCP User');
          break;

        case 'collect-info':
          await callCollectInfoTool(args[1] || 'contact');
          break;

        case 'start-notifications': {
          const interval = args[1] ? parseInt(args[1], 10) : 2000;
          const count = args[2] ? parseInt(args[2], 10) : 10;
          await startNotifications(interval, count);
          break;
        }

        case 'run-notifications-tool-with-resumability': {
          const interval = args[1] ? parseInt(args[1], 10) : 2000;
          const count = args[2] ? parseInt(args[2], 10) : 10;
          await runNotificationsToolWithResumability(interval, count);
          break;
        }

        case 'list-prompts':
          await listPrompts();
          break;

        case 'get-prompt':
          if (args.length < 2) {
            console.log('Usage: get-prompt <name> [args]');
          } else {
            const promptName = args[1];
            let promptArgs = {};
            if (args.length > 2) {
              try {
                promptArgs = JSON.parse(args.slice(2).join(' '));
              } catch {
                console.log('Invalid JSON arguments. Using empty args.');
              }
            }
            await getPrompt(promptName, promptArgs);
          }
          break;

        case 'list-resources':
          await listResources();
          break;

        case 'read-resource':
          if (args.length < 2) {
            console.log('Usage: read-resource <uri>');
          } else {
            await readResource(args[1]);
          }
          break;

        case 'help':
          printHelp();
          break;

        case 'quit':
        case 'exit':
          await cleanup();
          return;

        default:
          if (command) {
            console.log(`Unknown command: ${command}`);
          }
          break;
      }
    } catch (error) {
      console.error(`Error executing command: ${error}`);
    }

    // Continue the command loop
    commandLoop();
  });
}

async function connect(url?: string): Promise<void> {
  if (client) {
    console.log('Already connected. Disconnect first.');
    return;
  }

  if (url) {
    serverUrl = url;
    connectionType = 'http';
  }

  if (!serverUrl) {
    console.log('Error: No server URL provided. Usage: connect <url>');
    return;
  }

  console.log(`Connecting to ${serverUrl}...`);

  try {
    // Create a new client with elicitation capability
    client = new Client(
      {
        name: 'example-client',
        version: '1.0.0',
      },
      {
        capabilities: {
          elicitation: {},
        },
      },
    );
    client.onerror = (error) => {
      console.error('\x1b[31mClient error:', error, '\x1b[0m');
    };

    // Set up elicitation request handler with proper validation
    client.setRequestHandler(ElicitRequestSchema, async (request) => {
      console.log('\n🔔 Elicitation Request Received:');
      console.log(`Message: ${request.params.message}`);
      console.log('Requested Schema:');
      console.log(JSON.stringify(request.params.requestedSchema, null, 2));

      const schema = request.params.requestedSchema;
      const properties = schema.properties;
      const required = schema.required || [];

      // Set up AJV validator for the requested schema
      const ajv = new Ajv();
      const validate = ajv.compile(schema);

      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        attempts++;
        console.log(`\nPlease provide the following information (attempt ${attempts}/${maxAttempts}):`);

        const content: Record<string, unknown> = {};
        let inputCancelled = false;

        // Collect input for each field
        for (const [fieldName, fieldSchema] of Object.entries(properties)) {
          const field = fieldSchema as {
            type?: string;
            title?: string;
            description?: string;
            default?: unknown;
            enum?: string[];
            minimum?: number;
            maximum?: number;
            minLength?: number;
            maxLength?: number;
            format?: string;
          };

          const isRequired = required.includes(fieldName);
          let prompt = `${field.title || fieldName}`;

          // Add helpful information to the prompt
          if (field.description) {
            prompt += ` (${field.description})`;
          }
          if (field.enum) {
            prompt += ` [options: ${field.enum.join(', ')}]`;
          }
          if (field.type === 'number' || field.type === 'integer') {
            if (field.minimum !== undefined && field.maximum !== undefined) {
              prompt += ` [${field.minimum}-${field.maximum}]`;
            } else if (field.minimum !== undefined) {
              prompt += ` [min: ${field.minimum}]`;
            } else if (field.maximum !== undefined) {
              prompt += ` [max: ${field.maximum}]`;
            }
          }
          if (field.type === 'string' && field.format) {
            prompt += ` [format: ${field.format}]`;
          }
          if (isRequired) {
            prompt += ' *required*';
          }
          if (field.default !== undefined) {
            prompt += ` [default: ${field.default}]`;
          }

          prompt += ': ';

          const answer = await new Promise<string>((resolve) => {
            readline.question(prompt, (input) => {
              resolve(input.trim());
            });
          });

          // Check for cancellation
          if (answer.toLowerCase() === 'cancel' || answer.toLowerCase() === 'c') {
            inputCancelled = true;
            break;
          }

          // Parse and validate the input
          try {
            if (answer === '' && field.default !== undefined) {
              content[fieldName] = field.default;
            } else if (answer === '' && !isRequired) {
              // Skip optional empty fields
              continue;
            } else if (answer === '') {
              throw new Error(`${fieldName} is required`);
            } else {
              // Parse the value based on type
              let parsedValue: unknown;

              if (field.type === 'boolean') {
                parsedValue = answer.toLowerCase() === 'true' || answer.toLowerCase() === 'yes' || answer === '1';
              } else if (field.type === 'number') {
                parsedValue = parseFloat(answer);
                if (isNaN(parsedValue as number)) {
                  throw new Error(`${fieldName} must be a valid number`);
                }
              } else if (field.type === 'integer') {
                parsedValue = parseInt(answer, 10);
                if (isNaN(parsedValue as number)) {
                  throw new Error(`${fieldName} must be a valid integer`);
                }
              } else if (field.enum) {
                if (!field.enum.includes(answer)) {
                  throw new Error(`${fieldName} must be one of: ${field.enum.join(', ')}`);
                }
                parsedValue = answer;
              } else {
                parsedValue = answer;
              }

              content[fieldName] = parsedValue;
            }
          } catch (error) {
            console.log(`❌ Error: ${error}`);
            // Continue to next attempt
            break;
          }
        }

        if (inputCancelled) {
          return { action: 'cancel' };
        }

        // If we didn't complete all fields due to an error, try again
        if (
          Object.keys(content).length !==
          Object.keys(properties).filter((name) => required.includes(name) || content[name] !== undefined).length
        ) {
          if (attempts < maxAttempts) {
            console.log('Please try again...');
            continue;
          } else {
            console.log('Maximum attempts reached. Declining request.');
            return { action: 'decline' };
          }
        }

        // Validate the complete object against the schema
        const isValid = validate(content);

        if (!isValid) {
          console.log('❌ Validation errors:');
          validate.errors?.forEach((error) => {
            console.log(`  - ${error.instancePath || 'root'}: ${error.message}`);
          });

          if (attempts < maxAttempts) {
            console.log('Please correct the errors and try again...');
            continue;
          } else {
            console.log('Maximum attempts reached. Declining request.');
            return { action: 'decline' };
          }
        }

        // Show the collected data and ask for confirmation
        console.log('\n✅ Collected data:');
        console.log(JSON.stringify(content, null, 2));

        const confirmAnswer = await new Promise<string>((resolve) => {
          readline.question('\nSubmit this information? (yes/no/cancel): ', (input) => {
            resolve(input.trim().toLowerCase());
          });
        });

        if (confirmAnswer === 'yes' || confirmAnswer === 'y') {
          return {
            action: 'accept',
            content,
          };
        } else if (confirmAnswer === 'cancel' || confirmAnswer === 'c') {
          return { action: 'cancel' };
        } else if (confirmAnswer === 'no' || confirmAnswer === 'n') {
          if (attempts < maxAttempts) {
            console.log('Please re-enter the information...');
            continue;
          } else {
            return { action: 'decline' };
          }
        }
      }

      console.log('Maximum attempts reached. Declining request.');
      return { action: 'decline' };
    });

    transport = new StreamableHTTPClientTransport(new URL(serverUrl), {
      sessionId: sessionId,
    });

    // Set up notification handlers
    client.setNotificationHandler(LoggingMessageNotificationSchema, (notification) => {
      notificationCount++;
      console.log(`\nNotification #${notificationCount}: ${notification.params.level} - ${notification.params.data}`);
      // Re-display the prompt
      process.stdout.write('> ');
    });

    client.setNotificationHandler(ResourceListChangedNotificationSchema, async (_) => {
      console.log(`\nResource list changed notification received!`);
      try {
        if (!client) {
          console.log('Client disconnected, cannot fetch resources');
          return;
        }
        const resourcesResult = await client.request(
          {
            method: 'resources/list',
            params: {},
          },
          ListResourcesResultSchema,
        );
        console.log('Available resources count:', resourcesResult.resources.length);
      } catch {
        console.log('Failed to list resources after change notification');
      }
      // Re-display the prompt
      process.stdout.write('> ');
    });

    // Connect the client
    await client.connect(transport);
    sessionId = transport.sessionId;
    console.log('Transport created with session ID:', sessionId);
    console.log('Connected to MCP server');
  } catch (error) {
    console.error('Failed to connect:', error);
    client = null;
    transport = null;
  }
}

async function connectStdio(command: string[]): Promise<void> {
  if (client) {
    console.log('Already connected. Disconnect first.');
    return;
  }

  // Store connection info for reconnect
  stdioCommand = command;
  connectionType = 'stdio';

  try {
    // Create a new client with elicitation capability
    client = new Client(
      {
        name: 'example-client',
        version: '1.0.0',
      },
      {
        capabilities: {
          elicitation: {},
        },
      },
    );
    client.onerror = (error) => {
      console.error('\x1b[31mClient error:', error, '\x1b[0m');
    };

    // Set up the same notification handlers as HTTP
    client.setNotificationHandler(LoggingMessageNotificationSchema, (notification) => {
      notificationCount++;
      console.log(`\nNotification #${notificationCount}: ${notification.params.level} - ${notification.params.data}`);
      // Re-display the prompt
      process.stdout.write('> ');
    });

    client.setNotificationHandler(ResourceListChangedNotificationSchema, async (_) => {
      console.log(`\nResource list changed notification received!`);
      try {
        if (!client) {
          console.log('Client disconnected, cannot fetch resources');
          return;
        }
        const resourcesResult = await client.request(
          {
            method: 'resources/list',
            params: {},
          },
          ListResourcesResultSchema,
        );
        console.log('Available resources count:', resourcesResult.resources.length);
      } catch {
        console.log('Failed to list resources after change notification');
      }
      // Re-display the prompt
      process.stdout.write('> ');
    });

    // Create stdio transport
    transport = new StdioClientTransport({
      command: command[0],
      args: command.slice(1),
    });

    // Connect the client
    await client.connect(transport);
    console.log('Connected to MCP server via stdio');
  } catch (error) {
    console.error('Failed to connect:', error);
    client = null;
    transport = null;
  }
}

async function disconnect(): Promise<void> {
  if (!client || !transport) {
    console.log('Not connected.');
    return;
  }

  try {
    await transport.close();
    console.log('Disconnected from MCP server');
    client = null;
    transport = null;
    // Don't reset connectionType, serverUrl, or stdioCommand so reconnect works
  } catch (error) {
    console.error('Error disconnecting:', error);
  }
}

async function terminateSession(): Promise<void> {
  if (!client || !transport) {
    console.log('Not connected.');
    return;
  }

  // Session termination is only for HTTP transports
  if (connectionType === 'stdio') {
    console.log('Session termination not applicable for stdio connections');
    return;
  }

  try {
    const httpTransport = transport as StreamableHTTPClientTransport;
    console.log('Terminating session with ID:', httpTransport.sessionId);
    await httpTransport.terminateSession();
    console.log('Session terminated successfully');

    // Check if sessionId was cleared after termination
    if (!httpTransport.sessionId) {
      console.log('Session ID has been cleared');
      sessionId = undefined;

      // Also close the transport and clear client objects
      await transport.close();
      console.log('Transport closed after session termination');
      client = null;
      transport = null;
    } else {
      console.log('Server responded with 405 Method Not Allowed (session termination not supported)');
      console.log('Session ID is still active:', httpTransport.sessionId);
    }
  } catch (error) {
    console.error('Error terminating session:', error);
  }
}

async function reconnect(): Promise<void> {
  if (client) {
    await disconnect();
  }
  if (connectionType === 'stdio' && stdioCommand) {
    await connectStdio(stdioCommand);
  } else {
    await connect();
  }
}

async function listTools(): Promise<void> {
  if (!client) {
    console.log('Not connected to server.');
    return;
  }

  try {
    const toolsRequest: ListToolsRequest = {
      method: 'tools/list',
      params: {},
    };
    const toolsResult = await client.request(toolsRequest, ListToolsResultSchema);

    console.log('Available tools:');
    if (toolsResult.tools.length === 0) {
      console.log('  No tools available');
    } else {
      for (const tool of toolsResult.tools) {
        console.log(`  - id: ${tool.name}, name: ${getDisplayName(tool)}, description: ${tool.description}`);
      }
    }
  } catch (error) {
    console.log(`Tools not supported by this server (${error})`);
  }
}

async function callTool(name: string, args: Record<string, unknown>): Promise<void> {
  if (!client) {
    console.log('Not connected to server.');
    return;
  }

  try {
    const request: CallToolRequest = {
      method: 'tools/call',
      params: {
        name,
        arguments: args,
      },
    };

    console.log(`Calling tool '${name}' with args:`, args);
    const result = await client.request(request, CallToolResultSchema);

    console.log('Tool result:');
    const resourceLinks: ResourceLink[] = [];

    result.content.forEach((item) => {
      if (item.type === 'text') {
        console.log(`  ${item.text}`);
      } else if (item.type === 'resource_link') {
        const resourceLink = item as ResourceLink;
        resourceLinks.push(resourceLink);
        console.log(`  📁 Resource Link: ${resourceLink.name}`);
        console.log(`     URI: ${resourceLink.uri}`);
        if (resourceLink.mimeType) {
          console.log(`     Type: ${resourceLink.mimeType}`);
        }
        if (resourceLink.description) {
          console.log(`     Description: ${resourceLink.description}`);
        }
      } else if (item.type === 'resource') {
        console.log(`  [Embedded Resource: ${item.resource.uri}]`);
      } else if (item.type === 'image') {
        console.log(`  [Image: ${item.mimeType}]`);
      } else if (item.type === 'audio') {
        console.log(`  [Audio: ${item.mimeType}]`);
      } else {
        console.log(`  [Unknown content type]:`, item);
      }
    });

    // Offer to read resource links
    if (resourceLinks.length > 0) {
      console.log(`\nFound ${resourceLinks.length} resource link(s). Use 'read-resource <uri>' to read their content.`);
    }
  } catch (error) {
    console.log(`Error calling tool ${name}: ${error}`);
  }
}

async function callGreetTool(name: string): Promise<void> {
  await callTool('greet', { name });
}

async function callMultiGreetTool(name: string): Promise<void> {
  console.log('Calling multi-greet tool with notifications...');
  await callTool('multi-greet', { name });
}

async function callCollectInfoTool(infoType: string): Promise<void> {
  console.log(`Testing elicitation with collect-user-info tool (${infoType})...`);
  await callTool('collect-user-info', { infoType });
}

async function startNotifications(interval: number, count: number): Promise<void> {
  console.log(`Starting notification stream: interval=${interval}ms, count=${count || 'unlimited'}`);
  await callTool('start-notification-stream', { interval, count });
}

async function runNotificationsToolWithResumability(interval: number, count: number): Promise<void> {
  if (!client) {
    console.log('Not connected to server.');
    return;
  }

  try {
    console.log(
      `Starting notification stream with resumability: interval=${interval}ms, count=${count || 'unlimited'}`,
    );
    console.log(`Using resumption token: ${notificationsToolLastEventId || 'none'}`);

    const request: CallToolRequest = {
      method: 'tools/call',
      params: {
        name: 'start-notification-stream',
        arguments: { interval, count },
      },
    };

    const onLastEventIdUpdate = (event: string) => {
      notificationsToolLastEventId = event;
      console.log(`Updated resumption token: ${event}`);
    };

    const result = await client.request(request, CallToolResultSchema, {
      resumptionToken: notificationsToolLastEventId,
      onresumptiontoken: onLastEventIdUpdate,
    });

    console.log('Tool result:');
    result.content.forEach((item) => {
      if (item.type === 'text') {
        console.log(`  ${item.text}`);
      } else {
        console.log(`  ${item.type} content:`, item);
      }
    });
  } catch (error) {
    console.log(`Error starting notification stream: ${error}`);
  }
}

async function listPrompts(): Promise<void> {
  if (!client) {
    console.log('Not connected to server.');
    return;
  }

  try {
    const promptsRequest: ListPromptsRequest = {
      method: 'prompts/list',
      params: {},
    };
    const promptsResult = await client.request(promptsRequest, ListPromptsResultSchema);
    console.log('Available prompts:');
    if (promptsResult.prompts.length === 0) {
      console.log('  No prompts available');
    } else {
      for (const prompt of promptsResult.prompts) {
        console.log(`  - id: ${prompt.name}, name: ${getDisplayName(prompt)}, description: ${prompt.description}`);
      }
    }
  } catch (error) {
    console.log(`Prompts not supported by this server (${error})`);
  }
}

async function getPrompt(name: string, args: Record<string, unknown>): Promise<void> {
  if (!client) {
    console.log('Not connected to server.');
    return;
  }

  try {
    const promptRequest: GetPromptRequest = {
      method: 'prompts/get',
      params: {
        name,
        arguments: args as Record<string, string>,
      },
    };

    const promptResult = await client.request(promptRequest, GetPromptResultSchema);
    console.log('Prompt template:');
    promptResult.messages.forEach((msg, index) => {
      console.log(`  [${index + 1}] ${msg.role}: ${msg.content.text}`);
    });
  } catch (error) {
    console.log(`Error getting prompt ${name}: ${error}`);
  }
}

async function listResources(): Promise<void> {
  if (!client) {
    console.log('Not connected to server.');
    return;
  }

  try {
    const resourcesRequest: ListResourcesRequest = {
      method: 'resources/list',
      params: {},
    };
    const resourcesResult = await client.request(resourcesRequest, ListResourcesResultSchema);

    console.log('Available resources:');
    if (resourcesResult.resources.length === 0) {
      console.log('  No resources available');
    } else {
      for (const resource of resourcesResult.resources) {
        console.log(`  - id: ${resource.name}, name: ${getDisplayName(resource)}, description: ${resource.uri}`);
      }
    }
  } catch (error) {
    console.log(`Resources not supported by this server (${error})`);
  }
}

async function readResource(uri: string): Promise<void> {
  if (!client) {
    console.log('Not connected to server.');
    return;
  }

  try {
    const request: ReadResourceRequest = {
      method: 'resources/read',
      params: { uri },
    };

    console.log(`Reading resource: ${uri}`);
    const result = await client.request(request, ReadResourceResultSchema);

    console.log('Resource contents:');
    for (const content of result.contents) {
      console.log(`  URI: ${content.uri}`);
      if (content.mimeType) {
        console.log(`  Type: ${content.mimeType}`);
      }

      if ('text' in content && typeof content.text === 'string') {
        console.log('  Content:');
        console.log('  ---');
        console.log(
          content.text
            .split('\n')
            .map((line: string) => '  ' + line)
            .join('\n'),
        );
        console.log('  ---');
      } else if ('blob' in content && typeof content.blob === 'string') {
        console.log(`  [Binary data: ${content.blob.length} bytes]`);
      }
    }
  } catch (error) {
    console.log(`Error reading resource ${uri}: ${error}`);
  }
}

async function cleanup(): Promise<void> {
  if (client && transport) {
    try {
      // First try to terminate the session gracefully (HTTP only)
      if (connectionType === 'http' && 'sessionId' in transport && transport.sessionId) {
        try {
          console.log('Terminating session before exit...');
          await (transport as StreamableHTTPClientTransport).terminateSession();
          console.log('Session terminated successfully');
        } catch (error) {
          console.error('Error terminating session:', error);
        }
      }

      // Then close the transport
      await transport.close();
    } catch (error) {
      console.error('Error closing transport:', error);
    }
  }

  if (process.stdin.isTTY && !isCliMode) {
    process.stdin.setRawMode(false);
  }
  readline.close();
  console.log('\nGoodbye!');
  process.exit(0);
}

// Handle Ctrl+C
process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT. Cleaning up...');
  await cleanup();
});

// Start the interactive client
main().catch((error: unknown) => {
  console.error('Error running MCP client:', error);
  process.exit(1);
});
