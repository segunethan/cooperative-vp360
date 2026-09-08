export const nairaToKobo = (naira: number): number => Math.round(naira * 100);
export const koboToNaira = (kobo: number): number => kobo / 100;

export const formatMoney = (kobo: number): string => {
  const naira = kobo / 100;
  if (naira >= 1_000_000) return `₦${(naira / 1_000_000).toFixed(1)}M`;
  if (naira >= 1_000) return `₦${(naira / 1_000).toFixed(0)}K`;
  return `₦${naira.toLocaleString("en-NG")}`;
};

export const formatMoneyFull = (kobo: number): string =>
  `₦${(kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;

export const generatePaymentReference = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
