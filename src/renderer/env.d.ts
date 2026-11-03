/// <reference types="svelte" />
/// <reference types="vite/client" />
import type { HouseApi } from '@shared/types';

declare global {
  interface Window {
    house: HouseApi;
  }
}
