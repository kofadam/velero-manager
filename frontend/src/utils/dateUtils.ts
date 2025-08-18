export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString() + ', ' + date.toLocaleTimeString();
};

export const formatDateShort = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString();
};

export const isExpired = (expirationDate: string): boolean => {
  return new Date(expirationDate) < new Date();
};
