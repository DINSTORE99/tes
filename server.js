const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { Low, JSONFile } = require('lowdb');
const { nanoid } = require('nanoid');
const cors = require('cors');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Setup lowdb
const dbFile = './db.json';
if (!fs.existsSync(dbFile)) fs.writeFileSync(dbFile, JSON.stringify({ users: [], orders: [], topups: [] }, null, 2));
const adapter = new JSONFile(dbFile);
const db = new Low(adapter);

async function initDB() {
  await db.read();
  db.data = db.data || { users: [], orders: [], topups: [] };
  await db.write();
}
initDB();

// Sample plans
const PLANS = {
  p1: { id: 'p1', name: 'SSH 7 Hari', price: 5000, type: 'ssh', duration_days: 7 },
  p2: { id: 'p2', name: 'SSH 30 Hari', price: 15000, type: 'ssh', duration_days: 30 },
  p3: { id: 'p3', name: 'VMess 7 Hari', price: 7000, type: 'vmess', duration_days: 7 },
  p4: { id: 'p4', name: 'VMess 30 Hari', price: 20000, type: 'vmess', duration_days: 30 }
};

// Helper: find or create user by email
async function getUserByEmail(email){
  await db.read();
  let user = db.data.users.find(u => u.email === email);
  if(!user){
    user = { id: nanoid(8), email, balance: 0, createdAt: new Date().toISOString() };
    db.data.users.push(user);
    await db.write();
  }
  return user;
}

// Public: get plans
app.get('/api/plans', (req, res) => {
  res.json(Object.values(PLANS));
});

// Public: get user (by email query)
app.get('/api/user', async (req, res) => {
  const email = (req.query.email || '').toLowerCase();
  if(!email) return res.status(400).json({ error: 'email required' });
  const user = await getUserByEmail(email);
  res.json(user);
});

// Public: create topup invoice (simulasi)
app.post('/api/topup', async (req, res) => {
  const { email, amount } = req.body;
  if(!email || !amount || amount <= 0) return res.status(400).json({ error: 'email and positive amount required' });
  const user = await getUserByEmail(email.toLowerCase());
  const invoiceId = nanoid(12);
  const invoice = { id: invoiceId, userId: user.id, email: user.email, amount, status: 'pending', createdAt: new Date().toISOString() };
  await db.read();
  db.data.topups.push(invoice);
  await db.write();

  // In real integration: generate payment link from gateway and return.
  const paymentLink = `${process.env.BASE_URL || 'http://localhost:' + PORT}/pay/${invoiceId}`;

  res.json({ ok: true, invoice, paymentLink, note: 'Ini adalah link simulasi. Tandai invoice paid menggunakan endpoint /api/topup/mark-paid untuk menyelesaikan topup (webhook simulasi).' });
});

// Simulasi halaman pembayaran (simple) - user bisa klik bayar (simulasi)
app.get('/pay/:invoiceId', async (req, res) => {
  const id = req.params.invoiceId;
  await db.read();
  const invoice = db.data.topups.find(i => i.id === id);
  if(!invoice) return res.status(404).send('Invoice tidak ditemukan');

  res.send(`<h3>Simulasi Pembayaran</h3><p>Invoice: ${invoice.id}</p><p>Amount: Rp ${invoice.amount}</p><form method="POST" action="/api/topup/mark-paid"><input type="hidden" name="invoiceId" value="${invoice.id}"/><input type="hidden" name="token" value="${nanoid(8)}"/><button type="submit">Bayar (simulasi)</button></form>`);
});

// Mark topup paid (simulasi webhook / callback dari payment gateway)
app.post('/api/topup/mark-paid', bodyParser.urlencoded({ extended: true }), async (req, res) => {
  const invoiceId = req.body.invoiceId || req.body.id;
  if(!invoiceId) return res.status(400).json({ error: 'invoiceId required' });
  await db.read();
  const invoice = db.data.topups.find(i => i.id === invoiceId);
  if(!invoice) return res.status(404).json({ error: 'invoice not found' });
  if(invoice.status === 'paid') return res.json({ ok: true, msg: 'already paid' });

  invoice.status = 'paid';
  invoice.paidAt = new Date().toISOString();

  // Credit user balance
  const user = db.data.users.find(u => u.id === invoice.userId);
  if(user){
    user.balance = (user.balance || 0) + Number(invoice.amount);
  }
  await db.write();

  // If request came from form, redirect to simple page
  if(req.headers['content-type'] && req.headers['content-type'].includes('application/x-www-form-urlencoded')){
    return res.send(`<h3>Pembayaran berhasil</h3><p>Invoice ${invoice.id} telah ditandai dibayar. Saldo akun ${user.email} sekarang Rp ${user.balance}</p>`);
  }

  res.json({ ok: true, invoice, user });
});

// Buy using wallet balance
app.post('/api/buy', async (req, res) => {
  const { email, planId, useBalance } = req.body;
  if(!email || !planId) return res.status(400).json({ error: 'email and planId required' });
  const plan = PLANS[planId];
  if(!plan) return res.status(404).json({ error: 'plan not found' });

  await db.read();
  const user = await getUserByEmail(email.toLowerCase());

  // If user wants to use balance, check
  if(useBalance){
    if((user.balance || 0) < plan.price) return res.status(400).json({ error: 'insufficient balance' });
    user.balance -= plan.price;
    await db.write();
  } else {
    return res.status(400).json({ error: 'purchase without balance not supported in this template — please topup first or set useBalance=true' });
  }

  // Create local order
  const orderId = nanoid(10);
  const order = {
    id: orderId,
    userId: user.id,
    email: user.email,
    planId: plan.id,
    planName: plan.name,
    price: plan.price,
    type: plan.type,
    status: 'creating',
    providerResponse: null,
    createdAt: new Date().toISOString()
  };
  db.data.orders.push(order);
  await db.write();

  // Call provider API to create account (placeholder)
  const providerUrl = process.env.PROVIDER_API_URL;
  const providerKey = process.env.PROVIDER_API_KEY;
  try{
    const payload = { type: plan.type, duration_days: plan.duration_days, order_ref: orderId };
    const providerRes = await axios.post(providerUrl, payload, { headers: { 'Authorization': `Bearer ${providerKey}` }, timeout: 15000 });
    order.status = 'success';
    order.providerResponse = providerRes.data;
    await db.write();

    res.json({ ok: true, order });
  }catch(err){
    order.status = 'failed';
    order.providerResponse = { error: err.message, details: err.response && err.response.data ? err.response.data : null };
    const u = db.data.users.find(x => x.id === user.id);
    if(u){
      u.balance = (u.balance || 0) + plan.price;
    }
    await db.write();
    res.status(502).json({ ok: false, error: 'failed to create account on provider', provider: order.providerResponse });
  }
});

// Admin endpoints
app.get('/api/admin/orders', async (req, res) => { await db.read(); res.json(db.data.orders.slice().reverse()); });
app.get('/api/admin/topups', async (req, res) => { await db.read(); res.json(db.data.topups.slice().reverse()); });
app.get('/api/admin/users', async (req, res) => { await db.read(); res.json(db.data.users.slice().reverse()); });

// Webhook example: provider can call this to update order
app.post('/api/webhook/provider', async (req, res) => {
  const data = req.body;
  if(!data.order_ref) return res.status(400).json({ error: 'order_ref missing' });
  await db.read();
  const order = db.data.orders.find(o => o.id === data.order_ref);
  if(!order) return res.status(404).json({ error: 'order not found' });
  order.status = data.status || order.status;
  order.providerResponse = { ...(order.providerResponse||{}), webhook: data };
  await db.write();
  res.json({ ok: true });
});

app.listen(PORT, () => console.log('Server listening on port', PORT));
