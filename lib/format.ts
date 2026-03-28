export function formatINR(amount: number, short = false): string {
  if (short) {
    return formatINRShort(amount);
  }

  // Use Indian locale formatting with Intl.NumberFormat
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

  return `₹${formatted}`;
}

function formatINRShort(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const absAmount = Math.abs(amount);

  // Values less than 1000 show without suffix
  if (absAmount < 1000) {
    return `${sign}₹${absAmount}`;
  }

  // Crores (10 million and above)
  if (absAmount >= 10000000) {
    const crores = absAmount / 10000000;
    const formatted = crores % 1 === 0 ? crores.toString() : crores.toFixed(1);
    return `${sign}₹${formatted}Cr`;
  }

  // Lakhs (100,000 and above)
  if (absAmount >= 100000) {
    const lakhs = absAmount / 100000;
    const formatted = lakhs % 1 === 0 ? lakhs.toString() : lakhs.toFixed(1);
    return `${sign}₹${formatted}L`;
  }

  // Thousands (1,000 and above)
  if (absAmount >= 1000) {
    const thousands = absAmount / 1000;
    const formatted = thousands % 1 === 0 ? thousands.toString() : thousands.toFixed(1);
    return `${sign}₹${formatted}K`;
  }

  return `${sign}₹${absAmount}`;
}
