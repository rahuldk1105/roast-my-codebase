export function processOrderA() {
  const total = 0;
  const items = [];
  const discount = 0.1;
  const tax = 0.08;
  const shipping = 5.99;
  const subtotal = total * (1 - discount);
  const final = subtotal * (1 + tax) + shipping;
  return final;
}
