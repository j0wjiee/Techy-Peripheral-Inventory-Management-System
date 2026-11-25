export const validEmail = value => typeof value === 'string' && value.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export const validUsername = value => typeof value === 'string' && value.length >= 2 && value.length <= 50 && !/\s/.test(value);
export const validPassword = value => typeof value === 'string' && value.length >= 8 && !/\s/.test(value) && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9\s]/.test(value);
export const priceToCents = price => { const [whole, fraction = ''] = String(price).split('.'); return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0') || '0'); };
export const centsToPrice = cents => `${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`;

export function validateItem(input) {
  const errors = {};
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const category = typeof input.category === 'string' ? input.category.trim() : '';
  if (!name || name.length > 160) errors.name = 'Enter an item name (up to 160 characters).';
  if (!category || category.length > 80) errors.category = 'Enter a category (up to 80 characters).';
  const quantityText = String(input.quantity ?? '');
  const minimumText = String(input.minimumStock ?? 0);
  const quantity = Number(quantityText);
  const minimumStock = Number(minimumText);
  const priceText = String(input.purchasePrice ?? '0');
  if (!/^\d+$/.test(quantityText) || !Number.isInteger(quantity) || quantity > 2147483647) errors.quantity = 'Quantity must be a nonnegative whole number up to 2147483647.';
  if (!/^\d+$/.test(minimumText) || !Number.isInteger(minimumStock) || minimumStock > 2147483647) errors.minimumStock = 'Minimum stock must be a nonnegative whole number up to 2147483647.';
  if (!/^(?:\d+)(?:\.\d{1,2})?$/.test(priceText) || Number(priceText) > 9999999999.99) errors.purchasePrice = 'Price must be a nonnegative amount with at most two decimals.';
  const optional = ['brand', 'condition', 'description', 'specifications'];
  const limits = { brand: 100, condition: 60, description: 5000, specifications: 5000 };
  const data = { name, category, quantity, minimumStock, purchasePrice: priceText };
  for (const key of optional) {
    if (input[key] != null && typeof input[key] !== 'string') errors[key] = 'Invalid text.';
    else if (input[key]?.length > limits[key]) errors[key] = `Use at most ${limits[key]} characters.`;
    else data[key] = input[key]?.trim() || null;
  }
  if (input.purchaseDate) {
    const date = new Date(`${input.purchaseDate}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.purchaseDate) || Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== input.purchaseDate) errors.purchaseDate = 'Enter a valid purchase date.';
    else data.purchaseDate = date;
  } else data.purchaseDate = null;
  return { data, errors };
}

export function stockStatus(item) {
  return item.quantity === 0 ? 'Out of Stock' : item.quantity <= item.minimumStock ? 'Low Stock' : 'In Stock';
}
