import { useWindowDimensions } from 'react-native';

export const MOBILE_MAX = 768;

// True on phone-sized screens. Drives the menu button and the day-by-day timetable.
export function useIsMobile() {
  const { width } = useWindowDimensions();
  return width < MOBILE_MAX;
}
