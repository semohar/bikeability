import axios, { AxiosError } from 'axios';
import type { RouteResponse, Node, ElevationPoint, ApiError, RouteType } from '../types/api.types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const api = {
  getRandomNodes: async (): Promise<Node[]> => {
    try {
      const response = await apiClient.get<Node[]>('/api/nodes/random');
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },

  getRoute: async (
    startNode: number,
    endNode: number,
    type: RouteType = 'fastest'
  ): Promise<RouteResponse> => {
    try {
      const response = await apiClient.get<RouteResponse>('/api/route', {
        params: { start: startNode, end: endNode, type },
      });
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },

  getElevationProfile: async (
    startNode: number,
    endNode: number
  ): Promise<ElevationPoint[]> => {
    try {
      const response = await apiClient.get<ElevationPoint[]>('/api/elevation-profile', {
        params: { start: startNode, end: endNode },
      });
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },
};

function handleApiError(error: unknown): Error {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiError>;
    
    if (axiosError.response) {
      const errorData = axiosError.response.data;
      return new Error(errorData.error || 'API request failed');
    } else if (axiosError.request) {
      return new Error('No response from server. Is the API running?');
    }
  }
  
  return new Error('An unexpected error occurred');
}