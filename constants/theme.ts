export const colors = {
  primary: "#007AFF",
  secondary: "#5856D6",
  success: "#34C759",
  danger: "#FF3B30",
  warning: "#FF9500",
  
  background: "#FFFFFF",
  backgroundSecondary: "#F2F2F7",
  backgroundTertiary: "#E5E5EA",
  surface: "#F9F9F9",
  
  text: "#000000",
  textSecondary: "#6C6C70",
  textTertiary: "#C7C7CC",
  
  border: "#E5E5EA",
  separator: "#C6C6C8",
  
  online: "#34C759",
  offline: "#C7C7CC",
} as const;

export const theme = {
  colors,
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
  },
  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 24,
    xxl: 32,
  },
} as const;
