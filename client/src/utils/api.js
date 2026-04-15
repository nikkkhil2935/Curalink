import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL,
  timeout: 60000
});

export function extractApiError(error, fallbackMessage = 'Something went wrong. Please try again.') {
  return error?.response?.data?.error || error?.message || fallbackMessage;
}
