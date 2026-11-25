import React, { useEffect, useRef, useState } from 'react';
import { validEmail, validPassword, validUsername, validateItem } from '../../backend/validation.js';

async function api(url, options = {}) {
  const response = await fetch(`/api${url}`, { credentials: 'same-origin', ...options, headers: options.body instanceof FormData ? options.headers : { 'Content-Type': 'application/json', ...options.headers } });
  if (response.status === 204) return null;
  const data = await response.json().catch(error => { if (options.signal?.aborted) throw options.signal.reason; if (response.ok) throw new Error('The server returned an unreadable response.'); return {}; });
  if (!response.ok) throw Object.assign(new Error(data.error || 'Request failed.'), { fields: data.fields || {} });
  return data;
}
const php = value => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value || 0));
const dateLabel = value => value ? new Date(value).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';

function Logo({ compact = false }) { return <div className={`logo ${compact ? 'logo-compact' : ''}`}><span className="logo-mark" aria-hidden="true"/><span><strong>Techy</strong>{!compact && <small>Your Peripherals Inventory Management System</small>}</span></div>; }

function Auth({ mode, onSuccess, navigate }) {
  const [form, setForm] = useState({ username: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [fields, setFields] = useState({});
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const register = mode === 'register';
  const update = event => setForm({ ...form, [event.target.name]: event.target.value });
  async function submit(event) {
    event.preventDefault();
    const errors = {};
    if (!validEmail(form.email)) errors.email = 'Enter a valid email without whitespace.';
    if (register) {
      if (!validUsername(form.username)) errors.username = 'Use 2–50 characters with no whitespace.';
      if (!validPassword(form.password)) errors.password = 'Use 8+ characters, lowercase, uppercase, a number, a special character, and no whitespace.';
      if (form.password !== form.confirmPassword) errors.confirmPassword = 'Passwords do not match.';
    }
    if (Object.keys(errors).length) { setFields(errors); setError('Check the highlighted fields.'); return; }
    setBusy(true); setError(''); setFields({});
    try { const result = await api(`/auth/${register ? 'register' : 'login'}`, { method: 'POST', body: JSON.stringify(form), signal: AbortSignal.timeout(20000) }); onSuccess(result.user); }
    catch (e) { setError(e.name === 'TimeoutError' ? 'The server took too long to respond. Check the API terminal and Atlas connection, then try again.' : e.message); setFields(e.fields ?? {}); }
    finally { setBusy(false); }
  }
  return <div className={`auth-shell ${register ? 'register' : 'login'}`}>
    <div className="auth-photo" role="img" aria-label="Computer laboratory"/>
    <main className="auth-content"><div className="auth-inner"><Logo/><h1>{register ? 'Create your account' : 'Nice to see you again'}</h1>
      <form onSubmit={submit} noValidate>
        {register && <label>Username<input name="username" value={form.username} onChange={update} autoComplete="username" placeholder="Your username" aria-invalid={!!fields.username}/>{fields.username && <span className="field-error">{fields.username}</span>}</label>}
        <label>Email<input name="email" type="email" value={form.email} onChange={update} autoComplete="email" placeholder="Email address" aria-invalid={!!fields.email}/>{fields.email && <span className="field-error">{fields.email}</span>}</label>
        <label>Password<div className="password-wrap"><input name="password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={update} autoComplete={register ? 'new-password' : 'current-password'} placeholder="Enter password" aria-invalid={!!fields.password}/><button type="button" className="eye" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Hide' : 'Show'}</button></div>{fields.password && <span className="field-error">{fields.password}</span>}</label>
        {register && <label>Confirm Password<input name="confirmPassword" type={showPassword ? 'text' : 'password'} value={form.confirmPassword} onChange={update} autoComplete="new-password" placeholder="Enter password again" aria-invalid={!!fields.confirmPassword}/>{fields.confirmPassword && <span className="field-error">{fields.confirmPassword}</span>}</label>}
        {error && <div className="alert" role="alert">{error}</div>}
        <button className="primary auth-submit" disabled={busy}>{busy ? 'Please wait…' : register ? 'Register' : 'Sign in'}</button>
      </form><p className="auth-switch">{register ? 'Already have an account?' : 'Don’t have an account?'} <button className="text-button" onClick={() => navigate(register ? '/login' : '/register')}>{register ? 'Login now' : 'Sign up now'}</button></p>
    </div></main>
  </div>;
}

function Sidebar({ page, navigate, logout, busy }) {
  return <aside className="sidebar"><Logo compact/><div className="menu-caption">MAIN MENU</div><nav aria-label="Main menu">
    <button className={page === '/' ? 'active' : ''} onClick={() => navigate('/')}>▦ <span>Dashboard</span></button>
    <button className={page === '/inventory' ? 'active' : ''} onClick={() => navigate('/inventory')}>⬡ <span>Inventory</span></button>
    <button className={page === '/items/new' || page.startsWith('/items/edit/') ? 'active' : ''} onClick={() => navigate('/items/new')}>⊕ <span>Add New Item</span></button>
  </nav><button className="logout" onClick={logout} disabled={busy}>⇥ <span>Logout</span></button></aside>;
}

function Dashboard({ revision, openItem }) {
  const [data, setData] = useState(null), [error, setError] = useState('');
  useEffect(() => { let live = true; setData(null); setError(''); api('/dashboard').then(v => { if (live) setData(v); }).catch(e => { if (live) setError(e.message); }); return () => { live = false; }; }, [revision]);
  if (error) return <main className="content"><h1>DASHBOARD</h1><div className="alert" role="alert">{error}</div></main>;
  if (!data) return <main className="content"><h1>DASHBOARD</h1><p>Loading dashboard…</p></main>;
  const max = Math.max(1, ...data.categories.map(c => c.count));
  return <main className="content"><header className="page-head"><h1>DASHBOARD</h1><p>Overview of your inventory</p></header>
    <div className="stat-grid"><section className="blue-card stat"><h2>Total<br/>Products</h2><strong>{data.totalProducts}</strong></section><section className="blue-card stat"><h2>Total<br/>Quantity</h2><strong>{data.totalQuantity}</strong></section><section className="blue-card stat"><h2>Low Stock<br/>Items</h2><strong>{data.lowStockCount}</strong></section><section className="blue-card stat"><h2>Inventory<br/>Value</h2><strong className="value-stat">{php(data.totalValue)}</strong></section></div>
    <div className="dashboard-grid"><section className="blue-card categories"><h2>Items by Category</h2>{data.categories.length ? data.categories.map(c => <div className="category-row" key={c.name}><div><span>{c.name}</span><span>{c.count}</span></div><div className="bar"><i style={{ width: `${c.count / max * 100}%` }}/></div></div>) : <p>No categories yet. Add your first item.</p>}</section>
      <div className="dashboard-side"><section className="blue-card"><h2>Recent Activity</h2>{data.recentActivity.length ? data.recentActivity.map(a => <div className="activity-row" key={a.id}><span>{a.itemName} {a.action.toLowerCase()}</span><small>{dateLabel(a.createdAt)}</small></div>) : <p>No activity yet.</p>}</section><section className="blue-card"><h2>Low Stock</h2>{data.lowStockItems.length ? data.lowStockItems.map(i => <button className="stock-row" key={i.id} onClick={() => openItem(i.id)}><span>{i.name}</span><span>{i.quantity} left</span></button>) : <p>All items are sufficiently stocked.</p>}</section></div>
    </div></main>;
}

function ProductPlaceholder() { return <div className="product-placeholder" aria-label="No product image"><svg viewBox="0 0 100 100" role="img" aria-hidden="true"><rect x="24" y="9" width="52" height="82" rx="25" fill="#e8eef2" stroke="#a6b5bf" strokeWidth="3"/><path d="M50 10v33M24 45h52" stroke="#a6b5bf" strokeWidth="3"/><rect x="47" y="24" width="6" height="13" rx="3" fill="#1689c3"/></svg></div>; }
function ProductImage({ item }) { return item.imageUrl ? <img className="product-image" src={item.imageUrl} alt={item.name}/> : <ProductPlaceholder/>; }

function Modal({ children, onClose, className = '' }) {
  const ref = useRef(null);
  useEffect(() => { const el = ref.current; el.showModal(); return () => { if (el.open) el.close(); }; }, []);
  return <dialog ref={ref} className={className} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === ref.current) onClose(); }}>{children}</dialog>;
}

function ItemDetails({ id, onClose, onEdit, onDeleted }) {
  const [item, setItem] = useState(null), [error, setError] = useState(''), [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false);
  useEffect(() => { let live = true; api(`/items/${id}`).then(v => { if (live) setItem(v.item); }).catch(e => { if (live) setError(e.message); }); return () => { live = false; }; }, [id]);
  async function remove() { setBusy(true); setError(''); try { await api(`/items/${id}`, { method: 'DELETE' }); onDeleted(); } catch (e) { setError(e.message); setBusy(false); } }
  return <Modal onClose={onClose} className="detail-dialog"><button className="dialog-close" aria-label="Close details" onClick={onClose}>×</button>{error && <div className="alert" role="alert">{error}</div>}{!item ? <p>Loading item…</p> : <>
    <div className="detail-layout"><ProductImage item={item}/><div><h2>{item.name}</h2><dl>{[['Category', item.category], ['Brand', item.brand], ['Quantity', item.quantity], ['Stock', item.status], ['Purchased Price', php(item.purchasePrice)], ['Date Purchased', dateLabel(item.purchaseDate)], ['Condition', item.condition], ['Minimum Stock', item.minimumStock], ['Description', item.description], ['Specifications', item.specifications]].map(([label, value]) => <React.Fragment key={label}><dt>{label}:</dt><dd>{value ?? '—'}</dd></React.Fragment>)}</dl></div></div>
    {confirm ? <div className="delete-confirm"><p>Delete <strong>{item.name}</strong>? This cannot be undone.</p><button className="secondary" onClick={() => setConfirm(false)} disabled={busy}>Cancel</button><button className="danger" onClick={remove} disabled={busy}>{busy ? 'Deleting…' : 'Delete item'}</button></div> : <div className="detail-actions"><button className="secondary" onClick={onClose}>Close</button><button className="secondary" onClick={() => onEdit(item.id)}>Edit</button><button className="danger" onClick={() => setConfirm(true)}>Delete</button></div>}
  </>}</Modal>;
}

function Inventory({ revision, navigate, selectedId, setSelectedId, onChanged }) {
  const [items, setItems] = useState(null), [allItems, setAllItems] = useState([]), [error, setError] = useState('');
  const [search, setSearch] = useState(''), [category, setCategory] = useState(''), [brand, setBrand] = useState(''), [stock, setStock] = useState('All'), [sort, setSort] = useState('newest');
  useEffect(() => { let live = true; api('/items').then(v => { if (live) setAllItems(v.items); }).catch(() => {}); return () => { live = false; }; }, [revision]);
  useEffect(() => { let live = true; setItems(null); const query = new URLSearchParams({ search, category, brand, stock, sort }); api(`/items?${query}`).then(v => { if (live) { setItems(v.items); setError(''); } }).catch(e => { if (live) { setItems([]); setError(e.message); } }); return () => { live = false; }; }, [search, category, brand, stock, sort, revision]);
  const categories = [...new Set(allItems.map(i => i.category))].sort();
  const brands = [...new Set(allItems.map(i => i.brand).filter(Boolean))].sort();
  return <main className="content"><header className="page-head inventory-head"><div><h1>INVENTORY</h1><p>Manage your computer peripherals</p></div><button className="primary" onClick={() => navigate('/items/new')}>⊕ &nbsp; Add New Item</button></header>
    <label className="search-label"><span className="sr-only">Search items</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by item name or brand"/><span aria-hidden="true">⌕</span></label>
    <div className="category-pills" role="group" aria-label="Categories"><button className={!category ? 'selected' : ''} onClick={() => setCategory('')}>All</button>{categories.map(c => <button key={c} className={category === c ? 'selected' : ''} onClick={() => setCategory(c)}>{c}</button>)}</div>
    <div className="filter-row"><label>Brand<select value={brand} onChange={e => setBrand(e.target.value)}><option value="">All brands</option>{brands.map(b => <option key={b}>{b}</option>)}</select></label><label>Stock<select value={stock} onChange={e => setStock(e.target.value)}>{['All', 'In Stock', 'Low Stock', 'Out of Stock'].map(s => <option key={s}>{s}</option>)}</select></label><label>Sort<select value={sort} onChange={e => setSort(e.target.value)}><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="nameAsc">Name A–Z</option><option value="nameDesc">Name Z–A</option><option value="quantityAsc">Quantity low–high</option><option value="quantityDesc">Quantity high–low</option><option value="priceAsc">Price low–high</option><option value="priceDesc">Price high–low</option></select></label></div>
    {error && <div className="alert" role="alert">{error}</div>}{!items ? <p>Loading inventory…</p> : items.length ? <div className="product-grid">{items.map(item => <button className="product-card" key={item.id} onClick={() => setSelectedId(item.id)} aria-label={`View ${item.name} details`}><ProductImage item={item}/><strong>{item.name}</strong><span>{item.category}</span><small>Qty: {item.quantity} <span aria-hidden="true">→</span></small></button>)}</div> : <div className="empty-state"><h2>No items found</h2><p>{allItems.length ? 'Try different search or filters.' : 'Add your first peripheral to start tracking inventory.'}</p><button className="primary" onClick={() => navigate('/items/new')}>Add New Item</button></div>}
    {selectedId && <ItemDetails id={selectedId} onClose={() => setSelectedId(null)} onEdit={id => { setSelectedId(null); navigate(`/items/edit/${id}`); }} onDeleted={() => { setSelectedId(null); onChanged('Item deleted.'); }}/>}</main>;
}

const emptyForm = { name: '', category: 'Mouse', brand: '', quantity: '0', purchasePrice: '0.00', purchaseDate: '', condition: 'New', description: '', specifications: '', minimumStock: '0' };
function ItemForm({ id, navigate, onChanged }) {
  const [form, setForm] = useState(emptyForm), [file, setFile] = useState(null), [existingImage, setExistingImage] = useState(null), [loading, setLoading] = useState(!!id), [busy, setBusy] = useState(false), [error, setError] = useState(''), [fields, setFields] = useState({});
  useEffect(() => { if (!id) { setForm(emptyForm); setLoading(false); return; } let live = true; api(`/items/${id}`).then(v => { if (live) { const i = v.item; setForm(Object.fromEntries(Object.keys(emptyForm).map(k => [k, i[k] ?? '']))); setExistingImage(i.imageUrl); setLoading(false); } }).catch(e => { if (live) { setError(e.message); setLoading(false); } }); return () => { live = false; }; }, [id]);
  const update = e => setForm({ ...form, [e.target.name]: e.target.value });
  async function submit(e) {
    e.preventDefault();
    const result = validateItem(form);
    const errors = { ...result.errors };
    if (file && (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)) errors.image = 'Choose a JPG, PNG, or WebP image up to 5 MB.';
    if (Object.keys(errors).length) { setFields(errors); setError('Check the highlighted fields.'); return; }
    setBusy(true); setError(''); setFields({});
    const body = new FormData(); Object.entries(form).forEach(([key, value]) => body.append(key, value)); if (file) body.append('image', file);
    try { await api(id ? `/items/${id}` : '/items', { method: id ? 'PUT' : 'POST', body }); onChanged(id ? 'Item updated.' : 'Item added.'); navigate('/inventory'); }
    catch (e) { setError(e.message); setFields(e.fields); setBusy(false); }
  }
  if (loading) return <main className="content"><p>Loading item…</p></main>;
  return <main className="content"><header className="page-head"><h1>{id ? 'Edit Item' : 'Add New Item'}</h1><p>Fill in the details below to {id ? 'update' : 'add'} a peripheral to your inventory.</p></header>
    <form className="item-form" onSubmit={submit} noValidate><div className="form-top"><label className="upload-box">{file ? file.name : existingImage ? 'Replace image' : 'Upload an Image'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setFile(e.target.files[0] || null)}/></label><div className="form-actions"><button type="button" className="secondary" onClick={() => { setForm(emptyForm); setFile(null); setFields({}); }}>Clear</button><button className="primary" disabled={busy}>{busy ? 'Saving…' : id ? 'Save Changes' : '⊕  Add Item'}</button></div></div>{fields.image && <span className="field-error">{fields.image}</span>}
      {error && <div className="alert" role="alert">{error}</div>}<h2>Basic Information</h2><div className="form-grid">
        <label>Item Name *<input name="name" value={form.name} onChange={update} placeholder="e.g. Logitech G102 Lightsync" aria-invalid={!!fields.name}/>{fields.name && <span className="field-error">{fields.name}</span>}</label>
        <label>Category *<input name="category" value={form.category} onChange={update} list="categories" placeholder="e.g. Mouse" aria-invalid={!!fields.category}/><datalist id="categories">{['Mouse', 'Keyboard', 'Headset', 'Monitor', 'Microphone', 'Accessories', 'Cables', 'Storage', 'Components'].map(c => <option key={c} value={c}/>)}</datalist>{fields.category && <span className="field-error">{fields.category}</span>}</label>
        <label>Brand<input name="brand" value={form.brand} onChange={update} placeholder="e.g. Logitech" aria-invalid={!!fields.brand}/>{fields.brand && <span className="field-error">{fields.brand}</span>}</label>
        <label>Quantity *<input type="number" min="0" step="1" name="quantity" value={form.quantity} onChange={update} aria-invalid={!!fields.quantity}/>{fields.quantity && <span className="field-error">{fields.quantity}</span>}</label>
        <label>Purchased Price (₱)<input type="number" min="0" step="0.01" name="purchasePrice" value={form.purchasePrice} onChange={update} aria-invalid={!!fields.purchasePrice}/>{fields.purchasePrice && <span className="field-error">{fields.purchasePrice}</span>}</label>
        <label>Condition<input name="condition" value={form.condition} onChange={update} placeholder="New" aria-invalid={!!fields.condition}/>{fields.condition && <span className="field-error">{fields.condition}</span>}</label>
        <label>Date Purchased<input type="date" name="purchaseDate" value={form.purchaseDate} onChange={update} aria-invalid={!!fields.purchaseDate}/>{fields.purchaseDate && <span className="field-error">{fields.purchaseDate}</span>}</label>
        <label>Minimum Stock<input type="number" min="0" step="1" name="minimumStock" value={form.minimumStock} onChange={update} aria-invalid={!!fields.minimumStock}/>{fields.minimumStock && <span className="field-error">{fields.minimumStock}</span>}</label>
      </div><h2>Additional Details</h2><div className="form-grid"><label>Description<textarea name="description" value={form.description} onChange={update} placeholder="Enter a short description" aria-invalid={!!fields.description}/>{fields.description && <span className="field-error">{fields.description}</span>}</label><label>Specifications<textarea name="specifications" value={form.specifications} onChange={update} placeholder="e.g. Wired USB, 8000 DPI, RGB Lighting" aria-invalid={!!fields.specifications}/>{fields.specifications && <span className="field-error">{fields.specifications}</span>}</label></div>
    </form></main>;
}

export default function App() {
  const [user, setUser] = useState(undefined), [page, setPage] = useState(window.location.pathname), [revision, setRevision] = useState(0), [selectedId, setSelectedId] = useState(null), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { api('/auth/me').then(v => setUser(v.user)).catch(() => setUser(null)); const pop = () => setPage(window.location.pathname); window.addEventListener('popstate', pop); return () => window.removeEventListener('popstate', pop); }, []);
  useEffect(() => {
    if (user === undefined) return;
    const valid = user ? page === '/' || page === '/inventory' || page === '/items/new' || page.startsWith('/items/edit/') : page === '/login' || page === '/register';
    if (!valid) {
      const fallback = user ? '/' : '/login';
      window.history.replaceState({}, '', fallback);
      setPage(fallback);
    }
  }, [page, user]);
  function navigate(path) { window.history.pushState({}, '', path); setPage(path); setSelectedId(null); window.scrollTo(0, 0); }
  function changed(message) { setNotice(message); setRevision(v => v + 1); }
  async function logout() { setBusy(true); try { await api('/auth/logout', { method: 'POST' }); setUser(null); navigate('/login'); } catch (e) { setNotice(e.message); } finally { setBusy(false); } }
  if (user === undefined) return <div className="boot">Loading Techy…</div>;
  if (!user) return <Auth mode={page === '/register' ? 'register' : 'login'} navigate={navigate} onSuccess={u => { setUser(u); navigate('/'); }}/>;
  const current = page === '/inventory' ? '/inventory' : page === '/items/new' || page.startsWith('/items/edit/') ? page : '/';
  return <div className="app-shell"><Sidebar page={current} navigate={navigate} logout={logout} busy={busy}/><div className="main-area">{notice && <div className="toast" role="status">{notice}<button aria-label="Dismiss message" onClick={() => setNotice('')}>×</button></div>}{current === '/' ? <Dashboard revision={revision} openItem={id => { navigate('/inventory'); setSelectedId(id); }}/> : current === '/inventory' ? <Inventory revision={revision} navigate={navigate} selectedId={selectedId} setSelectedId={setSelectedId} onChanged={changed}/> : <ItemForm id={current.startsWith('/items/edit/') ? current.split('/').pop() : null} navigate={navigate} onChanged={changed}/>}</div></div>;
}
