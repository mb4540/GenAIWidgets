import type { Context } from '@netlify/functions';
import { authenticateRequest, createErrorResponse, createSuccessResponse } from './lib/auth';

/**
 * Builtin Weather Tool
 * 
 * Uses Open-Meteo APIs (free, no API key required):
 * - Geocoding API: https://geocoding-api.open-meteo.com
 * - Weather API: https://api.open-meteo.com
 * 
 * Documentation: https://open-meteo.com/
 */

interface WeatherInput {
  location: string;
  units?: 'imperial' | 'metric';
}

interface GeocodingResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string;
  timezone: string;
}

interface GeocodingResponse {
  results?: GeocodingResult[];
}

interface CurrentWeather {
  temperature: number;
  windspeed: number;
  winddirection: number;
  weathercode: number;
  is_day: number;
  time: string;
}

interface WeatherResponse {
  latitude: number;
  longitude: number;
  timezone: string;
  current_weather: CurrentWeather;
  hourly?: {
    time: string[];
    temperature_2m: number[];
    relative_humidity_2m: number[];
    precipitation_probability: number[];
    weathercode: number[];
  };
}

interface WeatherOutput {
  location: {
    name: string;
    country: string;
    region?: string;
    latitude: number;
    longitude: number;
    timezone: string;
  };
  current: {
    temperature: number;
    temperature_unit: string;
    feels_like?: number;
    humidity?: number;
    wind_speed: number;
    wind_speed_unit: string;
    wind_direction: string;
    conditions: string;
    is_day: boolean;
  };
  forecast?: {
    time: string;
    temperature: number;
    humidity: number;
    precipitation_probability: number;
    conditions: string;
  }[];
}

const WEATHER_CODES: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Foggy',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snow',
  73: 'Moderate snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
};

function getWeatherCondition(code: number): string {
  return WEATHER_CODES[code] || 'Unknown';
}

function getWindDirection(degrees: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index] || 'N';
}

function celsiusToFahrenheit(celsius: number): number {
  return Math.round((celsius * 9/5 + 32) * 10) / 10;
}

function kmhToMph(kmh: number): number {
  return Math.round(kmh * 0.621371 * 10) / 10;
}

async function searchLocation(query: string): Promise<GeocodingResult | null> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Geocoding API error: ${response.status}`);
  }
  
  const data = await response.json() as GeocodingResponse;
  return data.results?.[0] || null;
}

async function getWeather(latitude: number, longitude: number, useMetric: boolean): Promise<WeatherResponse> {
  const tempUnit = useMetric ? 'celsius' : 'fahrenheit';
  const windUnit = useMetric ? 'kmh' : 'mph';
  
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,weathercode&temperature_unit=${tempUnit}&windspeed_unit=${windUnit}&timezone=auto&forecast_days=1`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status}`);
  }
  
  return await response.json() as WeatherResponse;
}

export default async function handler(req: Request, _context: Context): Promise<Response> {
  // Authenticate request
  const authResult = await authenticateRequest(req);
  if (!authResult.success) {
    return createErrorResponse(authResult.error, 401);
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return createErrorResponse('Method not allowed', 405);
  }

  try {
    const body = await req.json() as WeatherInput;
    const { location, units = 'imperial' } = body;

    if (!location || typeof location !== 'string' || location.trim().length === 0) {
      return createErrorResponse('Location is required', 400);
    }

    // Search for location
    const geoResult = await searchLocation(location.trim());
    if (!geoResult) {
      return createErrorResponse(`Location not found: ${location}`, 404);
    }

    // Get weather data
    const useMetric = units === 'metric';
    const weather = await getWeather(geoResult.latitude, geoResult.longitude, useMetric);

    // Build response
    const current = weather.current_weather;
    const tempUnit = useMetric ? '°C' : '°F';
    const windUnit = useMetric ? 'km/h' : 'mph';

    // Get current hour's humidity from hourly data
    let currentHumidity: number | undefined;
    if (weather.hourly) {
      const currentTime = new Date(current.time);
      const hourIndex = weather.hourly.time.findIndex(t => {
        const hourTime = new Date(t);
        return hourTime.getHours() === currentTime.getHours();
      });
      if (hourIndex >= 0) {
        currentHumidity = weather.hourly.relative_humidity_2m[hourIndex];
      }
    }

    const result: WeatherOutput = {
      location: {
        name: geoResult.name,
        country: geoResult.country,
        region: geoResult.admin1,
        latitude: geoResult.latitude,
        longitude: geoResult.longitude,
        timezone: weather.timezone,
      },
      current: {
        temperature: current.temperature,
        temperature_unit: tempUnit,
        humidity: currentHumidity,
        wind_speed: current.windspeed,
        wind_speed_unit: windUnit,
        wind_direction: getWindDirection(current.winddirection),
        conditions: getWeatherCondition(current.weathercode),
        is_day: current.is_day === 1,
      },
    };

    // Add next 6 hours forecast
    if (weather.hourly) {
      const currentHour = new Date().getHours();
      result.forecast = [];
      
      for (let i = 0; i < Math.min(6, weather.hourly.time.length); i++) {
        const hourTime = new Date(weather.hourly.time[i] || '');
        if (hourTime.getHours() > currentHour || i > 0) {
          result.forecast.push({
            time: weather.hourly.time[i] || '',
            temperature: weather.hourly.temperature_2m[i] || 0,
            humidity: weather.hourly.relative_humidity_2m[i] || 0,
            precipitation_probability: weather.hourly.precipitation_probability[i] || 0,
            conditions: getWeatherCondition(weather.hourly.weathercode[i] || 0),
          });
        }
        if (result.forecast.length >= 6) break;
      }
    }

    return createSuccessResponse({ result });
  } catch (error) {
    console.error('[tool-weather] Error:', error);
    const message = error instanceof Error ? error.message : 'Weather lookup failed';
    return createErrorResponse(message, 500);
  }
}
