declare module "japanese-holidays" {
  export function isHoliday(date: Date, respect_holiday?: boolean): string | undefined;
}
