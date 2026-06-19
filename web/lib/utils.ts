import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * TDrive Shared Utilities.
 */

/**
 * Merges Tailwind classes safely.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a UTC date/time string or object into the browser's local timezone
 * and respects the user's locale. Output matches the format: "11 Jun 2026, 21:43".
 */
export function formatLocalTime(dateInput: string | Date | undefined | null): string {
  if (!dateInput) return "";
  try {
    let dateStr = typeof dateInput === "string" ? dateInput : dateInput.toISOString();
    if (typeof dateInput === "string") {
      // If it doesn't have a timezone suffix, treat as UTC by appending 'Z'
      if (!dateStr.endsWith("Z") && !dateStr.includes("+") && !/T[0-9]{2}:[0-9]{2}:[0-9]{2}[.-]/.test(dateStr) && !/-[0-9]{2}:[0-9]{2}$/.test(dateStr)) {
        // Replace space with T for standards compliance
        dateStr = dateStr.replace(" ", "T");
        if (!dateStr.endsWith("Z")) {
          dateStr += "Z";
        }
      }
    }
    
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return String(dateInput);
    }

    // Format: DD MMM YYYY, HH:mm
    return new Intl.DateTimeFormat(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(date);
  } catch (e) {
    return String(dateInput);
  }
}
