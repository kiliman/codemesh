/**
 * Shared utility functions for naming and conversion
 */

/**
 * Convert string to camelCase
 * @example "get_forecast" → "getForecast"
 * @example "weather-server" → "weatherServer"
 */
export function toCamelCase(str: string): string {
  return str.replace(/[-_](.)/g, (_, char) => char.toUpperCase());
}

/**
 * Convert string to PascalCase
 * @example "get_forecast" → "GetForecast"
 * @example "weather-server" → "WeatherServer"
 */
export function toPascalCase(str: string): string {
  const camelCase = toCamelCase(str);
  return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
}

/**
 * Create server object name for namespaced API
 * @example "weather-server" → "weatherServer"
 * @example "geocode-server" → "geocodeServer"
 * @example "filesystem-server" → "filesystemServer"
 */
export function createServerObjectName(serverId: string): string {
  const baseServerId = serverId.replace(/-server$/, '');
  return toCamelCase(baseServerId) + 'Server';
}

/**
 * Convert tool name to camelCase method name
 * @example "get_alerts" → "getAlerts"
 * @example "geocode" → "geocode"
 * @example "read_text_file" → "readTextFile"
 */
export function convertToolName(toolName: string): string {
  return toCamelCase(toolName);
}

/**
 * Convert server ID to proper server name for namespace
 * @example "weather-server" → "WeatherServer"
 * @example "geocode-server" → "GeocodeServer"
 */
export function convertServerName(serverId: string): string {
  return toPascalCase(serverId.replace(/-server$/, ''));
}

/**
 * Create a safe function name from tool name and server ID
 * Used for backwards compatibility in runtime wrapper
 * @example ("get_forecast", "weather-server") → "get_forecast_weather_server"
 */
export function createSafeFunctionName(toolName: string, serverId: string): string {
  const safeName = toolName.replace(/[^a-zA-Z0-9]/g, '_');
  const safeServerId = serverId.replace(/[^a-zA-Z0-9]/g, '_');
  return `${safeName}_${safeServerId}`;
}