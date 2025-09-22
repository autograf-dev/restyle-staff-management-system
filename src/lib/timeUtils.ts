/**
 * Convert minutes since midnight to HH:MM format
 * @param minutes - Minutes since midnight (e.g., 540 = 9:00 AM)
 * @returns Time string in HH:MM format
 */
export function minutesToTime(minutes: number): string {
  if (minutes < 0 || minutes >= 1440) return "00:00";
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Convert HH:MM format to minutes since midnight
 * @param time - Time string in HH:MM format
 * @returns Minutes since midnight
 */
export function timeToMinutes(time: string): number {
  if (!time || !time.includes(':')) return 0;
  
  const [hours, minutes] = time.split(':').map(Number);
  
  if (isNaN(hours) || isNaN(minutes)) return 0;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return 0;
  
  return hours * 60 + minutes;
}

/**
 * Format minutes to readable time with AM/PM
 * @param minutes - Minutes since midnight
 * @returns Formatted time string (e.g., "9:00 AM")
 */
export function minutesToDisplayTime(minutes: number): string {
  if (minutes < 0 || minutes >= 1440) return "12:00 AM";
  
  const hours24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  const hours12 = hours24 === 0 ? 12 : hours24 > 12 ? hours24 - 12 : hours24;
  const ampm = hours24 >= 12 ? 'PM' : 'AM';
  
  return `${hours12}:${mins.toString().padStart(2, '0')} ${ampm}`;
}

/**
 * Get day name from day_of_week number
 * @param dayOfWeek - Day number (0 = Sunday, 1 = Monday, etc.)
 * @returns Day name
 */
export function getDayName(dayOfWeek: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayOfWeek] || 'Unknown';
}
