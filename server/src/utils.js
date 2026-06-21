export function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function requireFields(body, fields) {
  const missing = fields.filter((field) => body[field] === undefined || body[field] === null || body[field] === '');

  if (missing.length) {
    const label = missing.length === 1 ? 'field is' : 'fields are';
    const error = new Error(`Required ${label} missing: ${missing.join(', ')}`);
    error.status = 400;
    throw error;
  }
}

export function makeReferralNumber() {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const random = Math.floor(1000 + Math.random() * 9000);
  return `REF-${stamp}-${random}`;
}

export function makeCaseNumber() {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const random = Math.floor(1000 + Math.random() * 9000);
  return `CASE-${stamp}-${random}`;
}
