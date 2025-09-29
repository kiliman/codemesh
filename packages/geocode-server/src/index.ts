#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

const GeocodeArgsSchema = z.object({
  location: z.string().describe("Location to geocode (e.g., 'Moyock, NC' or 'New York, NY')"),
});

async function geocodeLocation(location: string) {
  try {
    // Use OpenStreetMap Nominatim API - free and no API key required
    const encodedLocation = encodeURIComponent(location);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodedLocation}&format=json&limit=1&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'CodeMode-MCP-Server/1.0.0 (https://github.com/modelcontextprotocol)',
        },
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      throw new Error(`No results found for location: ${location}`);
    }

    const result = data[0];
    return {
      location: location,
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      displayName: result.display_name,
      address: result.address || {},
    };
  } catch (error) {
    throw new Error(`Failed to geocode location: ${error}`);
  }
}

const server = new Server(
  {
    name: 'geocode-server',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'geocode',
        description:
          'Convert a location name to latitude/longitude coordinates. Returns structured data with latitude, longitude, and formatted address information.',
        inputSchema: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: "Location to geocode (e.g., 'Moyock, NC' or 'New York, NY')",
            },
          },
          required: ['location'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            location: { type: 'string' },
            latitude: { type: 'number' },
            longitude: { type: 'number' },
            displayName: { type: 'string' },
            address: { type: 'object' },
          },
          required: ['location', 'latitude', 'longitude', 'displayName'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === 'geocode') {
      const { location } = GeocodeArgsSchema.parse(args);
      const result = await geocodeLocation(location);

      return {
        structuredContent: result,
      };
    } else {
      throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Geocode MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
