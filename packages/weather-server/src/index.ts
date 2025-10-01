#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import * as fs from 'node:fs'

const GetAlertsArgsSchema = z.object({
  state: z.string().length(2).describe('Two-letter state code (e.g. CA, NY)'),
})

const GetForecastArgsSchema = z.object({
  latitude: z.number().describe('Latitude coordinate'),
  longitude: z.number().describe('Longitude coordinate'),
})

async function fetchWeatherAlerts(state: string) {
  try {
    const response = await fetch(`https://api.weather.gov/alerts/active?area=${state}`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json()
    return data
  } catch (error) {
    throw new Error(`Failed to fetch weather alerts: ${error}`)
  }
}

async function fetchWeatherForecast(latitude: number, longitude: number) {
  try {
    const pointResponse = await fetch(`https://api.weather.gov/points/${latitude},${longitude}`)
    if (!pointResponse.ok) {
      throw new Error(`HTTP error! status: ${pointResponse.status}`)
    }
    const pointData = await pointResponse.json()

    const forecastUrl = pointData.properties.forecast
    const forecastResponse = await fetch(forecastUrl)
    if (!forecastResponse.ok) {
      throw new Error(`HTTP error! status: ${forecastResponse.status}`)
    }
    const forecastData = await forecastResponse.json()
    return forecastData
  } catch (error) {
    throw new Error(`Failed to fetch weather forecast: ${error}`)
  }
}

const server = new Server(
  {
    name: 'weather-server',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
)

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_alerts',
        description:
          'Get weather alerts for a state. Returns JSON with features array containing alert objects. Each alert has properties: { event, severity, areaDesc, headline, description, instruction, effective, expires, ends }. Severity levels: Extreme, Severe, Moderate, Minor.',
        inputSchema: {
          type: 'object',
          properties: {
            state: {
              type: 'string',
              description: 'Two-letter state code (e.g. CA, NY)',
            },
          },
          required: ['state'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            features: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  properties: {
                    type: 'object',
                    properties: {
                      event: { type: 'string' },
                      severity: {
                        type: 'string',
                        enum: ['Extreme', 'Severe', 'Moderate', 'Minor'],
                      },
                      areaDesc: { type: 'string' },
                      headline: { type: 'string' },
                      description: { type: 'string' },
                      instruction: { type: 'string' },
                      response: { type: 'string' },
                      effective: { type: 'string' },
                      expires: { type: 'string' },
                      ends: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
          required: ['features'],
        },
      },
      {
        name: 'get_forecast',
        description:
          'Get weather forecast for a location. Returns JSON with properties.periods array containing forecast objects with name, temperature, temperatureUnit, windSpeed, windDirection, shortForecast, detailedForecast.',
        inputSchema: {
          type: 'object',
          properties: {
            latitude: {
              type: 'number',
              description: 'Latitude coordinate',
            },
            longitude: {
              type: 'number',
              description: 'Longitude coordinate',
            },
          },
          required: ['latitude', 'longitude'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            properties: {
              type: 'object',
              properties: {
                periods: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      temperature: { type: 'number' },
                      temperatureUnit: { type: 'string' },
                      windSpeed: { type: 'string' },
                      windDirection: { type: 'string' },
                      shortForecast: { type: 'string' },
                      detailedForecast: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    ],
  }
})

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  try {
    if (name === 'get_alerts') {
      const { state } = GetAlertsArgsSchema.parse(args)
      const alerts = await fetchWeatherAlerts(state.toUpperCase())

      return {
        structuredContent: alerts,
      }
    } else if (name === 'get_forecast') {
      const { latitude, longitude } = GetForecastArgsSchema.parse(args)
      const forecast = await fetchWeatherForecast(latitude, longitude)

      return {
        structuredContent: forecast,
      }
    } else {
      throw new Error(`Unknown tool: ${name}`)
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
    }
  }
})

async function main() {
  const transport = new StdioServerTransport()

  await server.connect(transport)
  console.error('Weather MCP server running on stdio')
}

main().catch((error) => {
  console.error('Fatal error in main():', error)
  process.exit(1)
})
