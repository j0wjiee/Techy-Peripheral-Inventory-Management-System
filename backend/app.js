import express from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import argon2 from 'argon2';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validEmail, validUsername, validPassword, validateItem, stockStatus, priceToCents, centsToPrice } from './validation.js';

const cookieName = 'techy_session';
const oneWeek = 7 * 24 * 60 * 60 * 1000;
const defaultUploadDir = fileURLToPath(new URL('../uploads/', import.meta.url));
const hash = token => createHash('sha256').update(token).digest('hex');
const error = (res, status, message, fields) => res.status(status).json({ error: message, ...(fields ? { fields } : {}) });
const safeUser = user => ({ id: user.id, email: user.email, username: user.username });
const formatItem = item => ({ ...item, purchasePriceCents: undefined, purchasePrice: centsToPrice(item.purchasePriceCents), purchaseDate: item.purchaseDate?.toISOString().slice(0, 10) ?? null, status: stockStatus(item), imageUrl: item.imagePath ? `/api/items/${item.id}/image` : null, imagePath: undefined });
const itemData = data => { const { purchasePrice, ...rest } = data; return { ...rest, purchasePriceCents: priceToCents(purchasePrice) }; };
const imageTypes = { 'image/jpeg': { ext: '.jpg', signature: b => b.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) }, 'image/png': { ext: '.png', signature: b => b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) }, 'image/webp': { ext: '.webp', signature: b => b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' } };

export function createApp(prisma, options = {}) {
  const app = express();
  const uploadDir = options.uploadDir ?? defaultUploadDir;
  const origin = options.origin ?? process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173';
  const allowedOrigins = new Set([origin]);
  const localOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
  if (process.env.NODE_ENV !== 'production' && localOrigins.includes(origin)) {
    for (const localOrigin of localOrigins) allowedOrigins.add(localOrigin);
  }
  const secure = options.secure ?? process.env.NODE_ENV === 'production';
  const cookieOptions = { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: oneWeek };
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 }, fileFilter: (_req, file, cb) => cb(imageTypes[file.mimetype] ? null : Object.assign(new Error('Invalid image type.'), { status: 400 }), true) }).single('image');
  const uploadImage = (req, res, next) => upload(req, res, err => err ? error(res, 400, err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 5 MB or smaller.' : 'Use a JPG, PNG, or WebP image.') : next());
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use((req, res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.get('Origin') && !allowedOrigins.has(req.get('Origin'))) return error(res, 403, 'Request origin is not allowed.');
    next();
  });
  const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many attempts. Try again later.' } });
  const sessionToken = req => req.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  async function requireAuth(req, res, next) {
    const token = sessionToken(req);
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return error(res, 401, 'Authentication required.');
    try {
      const session = await prisma.session.findUnique({ where: { id: hash(token) }, include: { user: true } });
      if (!session || session.expiresAt <= new Date()) return error(res, 401, 'Authentication required.');
      req.user = session.user;
      req.sessionId = session.id;
      next();
    } catch (e) { next(e); }
  }
  const validItemId = (req, res, next) => /^[a-f\d]{24}$/i.test(req.params.id) ? next() : error(res, 404, 'Item not found.');
  async function startSession(user, res) {
    const token = randomBytes(32).toString('hex');
    await prisma.session.create({ data: { id: hash(token), userId: user.id, expiresAt: new Date(Date.now() + oneWeek) } });
    res.cookie(cookieName, token, cookieOptions);
  }
  app.post('/api/auth/register', authLimit, async (req, res, next) => {
    try {
      const { email, username, password, confirmPassword } = req.body ?? {};
      const fields = {};
      if (!validEmail(email)) fields.email = 'Enter a valid email without whitespace.';
      if (!validUsername(username)) fields.username = 'Enter a username of 2–50 characters without whitespace.';
      if (!validPassword(password)) fields.password = 'Use 8+ characters with lowercase, uppercase, number, special character, and no whitespace.';
      if (password !== confirmPassword) fields.confirmPassword = 'Passwords do not match.';
      if (Object.keys(fields).length) return error(res, 400, 'Check the registration details.', fields);
      const normalizedEmail = email.toLowerCase();
      if (await prisma.user.findUnique({ where: { email: normalizedEmail } })) return error(res, 409, 'Email already registered.', { email: 'Email already registered.' });
      if (await prisma.user.findUnique({ where: { usernameKey: username.toLowerCase() } })) return error(res, 409, 'Username already taken.', { username: 'Username already taken.' });
      const user = await prisma.user.create({ data: { email: normalizedEmail, username, usernameKey: username.toLowerCase(), passwordHash: await argon2.hash(password, { type: argon2.argon2id }) } });
      await startSession(user, res);
      res.status(201).json({ user: safeUser(user) });
    } catch (e) {
      if (e.code === 'P2002') return error(res, 409, 'Email or username already registered.');
      next(e);
    }
  });
  app.post('/api/auth/login', authLimit, async (req, res, next) => {
    try {
      const { email, password } = req.body ?? {};
      if (!validEmail(email) || typeof password !== 'string' || !password) return error(res, 401, 'Invalid email or password.');
      const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      if (!user || !(await argon2.verify(user.passwordHash, password))) return error(res, 401, 'Invalid email or password.');
      await startSession(user, res);
      res.json({ user: safeUser(user) });
    } catch (e) { next(e); }
  });
  app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: safeUser(req.user) }));
  app.post('/api/auth/logout', requireAuth, async (req, res, next) => {
    try { await prisma.session.delete({ where: { id: req.sessionId } }); res.clearCookie(cookieName, { ...cookieOptions, maxAge: undefined }); res.status(204).end(); } catch (e) { next(e); }
  });
  app.get('/api/items', requireAuth, async (req, res, next) => {
    try {
      const { search = '', category = '', brand = '', stock = 'All', sort = 'newest' } = req.query;
      if ([search, category, brand, stock, sort].some(v => typeof v !== 'string' || v.length > 160) || !['All', 'In Stock', 'Low Stock', 'Out of Stock'].includes(stock)) return error(res, 400, 'Invalid inventory filters.');
      const orders = { newest: { createdAt: 'desc' }, oldest: { createdAt: 'asc' }, nameAsc: { name: 'asc' }, nameDesc: { name: 'desc' }, quantityAsc: { quantity: 'asc' }, quantityDesc: { quantity: 'desc' }, priceAsc: { purchasePriceCents: 'asc' }, priceDesc: { purchasePriceCents: 'desc' } };
      if (!orders[sort]) return error(res, 400, 'Invalid sort order.');
      const where = { userId: req.user.id, ...(category ? { category } : {}), ...(brand ? { brand } : {}), ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { brand: { contains: search, mode: 'insensitive' } }] } : {}) };
      const items = await prisma.item.findMany({ where, orderBy: orders[sort] });
      res.json({ items: items.filter(item => stock === 'All' || stockStatus(item) === stock).map(formatItem) });
    } catch (e) { next(e); }
  });
  app.get('/api/items/:id/image', requireAuth, validItemId, async (req, res, next) => {
    try {
      const item = await prisma.item.findFirst({ where: { id: req.params.id, userId: req.user.id }, select: { imagePath: true } });
      if (!item?.imagePath || !/^[a-f0-9-]+\.(jpg|png|webp)$/.test(item.imagePath)) return error(res, 404, 'Image not found.');
      res.set('Cache-Control', 'private, no-store');
      res.sendFile(path.join(uploadDir, item.imagePath), err => { if (err && !res.headersSent) next(err); });
    } catch (e) { next(e); }
  });
  app.get('/api/items/:id', requireAuth, validItemId, async (req, res, next) => {
    try { const item = await prisma.item.findFirst({ where: { id: req.params.id, userId: req.user.id } }); item ? res.json({ item: formatItem(item) }) : error(res, 404, 'Item not found.'); } catch (e) { next(e); }
  });
  async function saveImage(file) {
    if (!file) return null;
    const type = imageTypes[file.mimetype];
    if (!type || !type.signature(file.buffer)) throw Object.assign(new Error('Invalid image data.'), { status: 400 });
    const filename = `${randomUUID()}${type.ext}`;
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, filename), file.buffer, { flag: 'wx' });
    return filename;
  }
  const removeImage = async name => { if (name) await unlink(path.join(uploadDir, name)).catch(() => {}); };
  app.post('/api/items', requireAuth, uploadImage, async (req, res, next) => {
    let imagePath;
    try {
      const { data, errors } = validateItem(req.body);
      if (Object.keys(errors).length) return error(res, 400, 'Check the item details.', errors);
      imagePath = await saveImage(req.file);
      const item = await prisma.$transaction(async tx => {
        const created = await tx.item.create({ data: { ...itemData(data), userId: req.user.id, imagePath } });
        await tx.activityLog.create({ data: { userId: req.user.id, itemId: created.id, itemName: created.name, action: 'CREATE' } });
        return created;
      });
      res.status(201).json({ item: formatItem(item) });
    } catch (e) { await removeImage(imagePath); next(e); }
  });
  app.put('/api/items/:id', requireAuth, validItemId, uploadImage, async (req, res, next) => {
    let imagePath;
    try {
      const { data, errors } = validateItem(req.body);
      if (Object.keys(errors).length) return error(res, 400, 'Check the item details.', errors);
      imagePath = await saveImage(req.file);
      const result = await prisma.$transaction(async tx => {
        const old = await tx.item.findFirst({ where: { id: req.params.id, userId: req.user.id } });
        if (!old) return null;
        const item = await tx.item.update({ where: { id: old.id }, data: { ...itemData(data), ...(imagePath ? { imagePath } : {}) } });
        await tx.activityLog.create({ data: { userId: req.user.id, itemId: item.id, itemName: item.name, action: 'UPDATE' } });
        return { item, oldImage: old.imagePath };
      });
      if (!result) { await removeImage(imagePath); return error(res, 404, 'Item not found.'); }
      if (imagePath) await removeImage(result.oldImage);
      res.json({ item: formatItem(result.item) });
    } catch (e) { await removeImage(imagePath); next(e); }
  });
  app.delete('/api/items/:id', requireAuth, validItemId, async (req, res, next) => {
    try {
      const old = await prisma.$transaction(async tx => {
        const item = await tx.item.findFirst({ where: { id: req.params.id, userId: req.user.id } });
        if (!item) return null;
        await tx.activityLog.create({ data: { userId: req.user.id, itemId: item.id, itemName: item.name, action: 'DELETE' } });
        await tx.item.delete({ where: { id: item.id } });
        return item;
      });
      if (!old) return error(res, 404, 'Item not found.');
      await removeImage(old.imagePath);
      res.status(204).end();
    } catch (e) { next(e); }
  });
  app.get('/api/dashboard', requireAuth, async (req, res, next) => {
    try {
      const [items, recentActivity] = await Promise.all([
        prisma.item.findMany({ where: { userId: req.user.id } }),
        prisma.activityLog.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' }, take: 6, select: { id: true, itemId: true, itemName: true, action: true, createdAt: true } })
      ]);
      const categories = {};
      let totalQuantity = 0, lowStockCount = 0, valueCents = 0n;
      const lowStockItems = [];
      for (const item of items) {
        totalQuantity += item.quantity;
        categories[item.category] = (categories[item.category] ?? 0) + 1;
        valueCents += item.purchasePriceCents * BigInt(item.quantity);
        if (stockStatus(item) !== 'In Stock') lowStockItems.push({ id: item.id, name: item.name, quantity: item.quantity, status: stockStatus(item) });
        if (stockStatus(item) === 'Low Stock') lowStockCount++;
      }
      res.json({ totalProducts: items.length, totalQuantity, lowStockCount, totalValue: `${valueCents / 100n}.${(valueCents % 100n).toString().padStart(2, '0')}`, categories: Object.entries(categories).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count), lowStockItems: lowStockItems.sort((a, b) => a.quantity - b.quantity).slice(0, 8), recentActivity });
    } catch (e) { next(e); }
  });
  app.use((err, _req, res, _next) => {
    if (res.headersSent) return;
    const status = err.status === 400 ? 400 : err.status === 413 ? 413 : 500;
    const message = err.message === 'Invalid image data.' ? err.message : status === 400 ? 'Invalid request body.' : status === 413 ? 'Request body too large.' : 'Something went wrong. Please try again.';
    error(res, status, message);
  });
  return app;
}
