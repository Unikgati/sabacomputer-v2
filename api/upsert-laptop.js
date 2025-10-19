// api/upsert-laptop.js
// Serverless endpoint to upsert a laptop using SUPABASE_SERVICE_ROLE_KEY.
// Environment variables required:
// SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, optional Cloudinary creds.

export default async function handler(req, res) {
  const setCors = () => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '3600');
  };
  setCors();
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Server misconfiguration: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' });
  }

  const authHeader = (req.headers.authorization || '');
  const userToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!userToken) return res.status(401).json({ error: 'Missing user token' });

  try {
    const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${userToken}`, 'apikey': SERVICE_ROLE_KEY }
    });
    if (!userResp.ok) return res.status(401).json({ error: 'Invalid user token' });
    const userJson = await userResp.json();
    const uid = userJson?.id;
    if (!uid) return res.status(401).json({ error: 'Unable to verify user' });

    const adminCheck = await fetch(`${SUPABASE_URL}/rest/v1/admins?auth_uid=eq.${uid}&select=id`, {
      method: 'GET',
      headers: { 'apikey': SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SERVICE_ROLE_KEY}`, 'Accept': 'application/json' }
    });
    if (!adminCheck.ok) {
      const txt = await adminCheck.text().catch(() => null);
      return res.status(500).json({ error: 'Failed to check admin table', detail: txt });
    }
    const adminRows = await adminCheck.json();
    if (!Array.isArray(adminRows) || adminRows.length === 0) return res.status(403).json({ error: 'Not an admin' });

    const payload = req.body;
    if (!payload || typeof payload !== 'object') return res.status(400).json({ error: 'Invalid payload' });

    const keyMap = {
      id: 'id',
      name: 'name',
      slug: 'slug',
      description: 'description',
      imageUrl: 'imageurl',
      galleryImages: 'galleryimages',
      imagePublicId: 'image_public_id',
      galleryPublicIds: 'gallery_public_ids',
      price: 'price',
      inclusions: 'inclusions',
      categories: 'categories'
    };

    // map new spec fields
    keyMap.ram = 'ram';
    keyMap.storage = 'storage';
    keyMap.cpu = 'cpu';
    keyMap.displayInch = 'display_inch';
    keyMap.condition = 'condition';
    keyMap.features = 'features';
  // inventory
  keyMap.inStock = 'in_stock';

    const safePayload = {};
    for (const srcKey of Object.keys(payload)) {
      const normalized = keyMap[srcKey] || srcKey.toLowerCase();
      safePayload[normalized] = payload[srcKey];
    }

    if (!safePayload.slug && safePayload.name) {
      safePayload.slug = String(safePayload.name).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }

    if (!('id' in safePayload) || safePayload.id == null || Number(safePayload.id) === 0) {
      const genId = Date.now();
      safePayload.id = Math.floor(genId * 1000 + Math.floor(Math.random() * 1000));
    }

    const toPgArrayLiteral = (arr) => {
      if (!Array.isArray(arr)) return arr;
      const escaped = arr.map(v => String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"'));
      return `{${escaped.join(',')}}`;
    };
    if ('inclusions' in safePayload && Array.isArray(safePayload.inclusions)) safePayload.inclusions = toPgArrayLiteral(safePayload.inclusions);
    if ('categories' in safePayload && Array.isArray(safePayload.categories)) safePayload.categories = toPgArrayLiteral(safePayload.categories);
    if ('gallery_public_ids' in safePayload && Array.isArray(safePayload.gallery_public_ids)) safePayload.gallery_public_ids = toPgArrayLiteral(safePayload.gallery_public_ids);
    // Ensure features remains JSON (stringify if array)
    if ('features' in safePayload && Array.isArray(safePayload.features)) {
      try { safePayload.features = JSON.stringify(safePayload.features); } catch (e) { /* ignore */ }
    }

    // normalize in_stock to boolean if string/number provided
    if ('in_stock' in safePayload) {
      const v = safePayload.in_stock;
      if (typeof v === 'string') {
        const lower = v.trim().toLowerCase();
        if (lower === 'false' || lower === '0' || lower === 'no') safePayload.in_stock = false;
        else safePayload.in_stock = true;
      } else if (typeof v === 'number') {
        safePayload.in_stock = Boolean(v);
      } else {
        safePayload.in_stock = !!v;
      }
    }

    const extractCloudinaryPublicId = (url) => {
      if (!url || typeof url !== 'string') return null;
      try {
        const u = new URL(url);
        const parts = u.pathname.split('/');
        const uploadIndex = parts.findIndex(p => p === 'upload');
        if (uploadIndex === -1) return null;
        const remainder = parts.slice(uploadIndex + 1).join('/');
        if (!remainder) return null;
        const withoutVersion = remainder.replace(/^v\d+\//, '');
        const publicIdWithPath = withoutVersion.replace(/\.[^/.]+$/, '');
        return publicIdWithPath || null;
      } catch (e) { return null; }
    };

    if ((!('image_public_id' in safePayload) || safePayload.image_public_id == null) && safePayload.imageurl) {
      const d = extractCloudinaryPublicId(safePayload.imageurl);
      if (d) safePayload.image_public_id = d;
    }
    if (Array.isArray(safePayload.galleryimages)) {
      const needDerive = !Array.isArray(safePayload.gallery_public_ids) || (Array.isArray(safePayload.gallery_public_ids) && safePayload.gallery_public_ids.some(v => v == null));
      if (needDerive) {
        const derived = safePayload.galleryimages.map((u) => extractCloudinaryPublicId(typeof u === 'string' ? u : ''));
        if (derived.some(d => d)) {
          safePayload.gallery_public_ids = derived.map(d => d || '');
          safePayload.gallery_public_ids = toPgArrayLiteral(safePayload.gallery_public_ids);
        }
      }
    }

    if (Array.isArray(payload.removed_public_ids) && payload.removed_public_ids.length > 0) {
      const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || process.env.VITE_CLOUDINARY_CLOUD_NAME;
      if (CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
        try {
          const { v2: cloudinary } = await import('cloudinary').catch(err => { throw err; });
          cloudinary.config({ cloud_name: CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET });
          for (const pid of payload.removed_public_ids) {
            try { await cloudinary.uploader.destroy(pid, { invalidate: true }); } catch (e) { console.warn('cloudinary destroy failed for', pid, e && e.message ? e.message : e); }
          }
        } catch (e) { console.warn('Cloudinary removal failed (skipping)', e && e.message ? e.message : e); }
      } else { console.info('Skipping Cloudinary removal: credentials not configured'); }
    }

    if ('removed_public_ids' in safePayload) { try { delete safePayload.removed_public_ids; } catch (e) {} }

  const ensureJson = (k) => { if (!(k in safePayload)) return; try { if (typeof safePayload[k] === 'string') safePayload[k] = JSON.parse(safePayload[k]); } catch (e) {} };
  ['galleryimages','features'].forEach(ensureJson);

    const insertResp = await fetch(`${SUPABASE_URL}/rest/v1/laptops?on_conflict=id`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation,resolution=merge-duplicates'
      },
      body: JSON.stringify([safePayload])
    });

    if (!insertResp.ok) {
      const errText = await insertResp.text().catch(() => '<no body>');
      return res.status(insertResp.status || 500).json({ error: 'Upsert failed', status: insertResp.status, detail: errText });
    }
    const inserted = await insertResp.json();
    return res.status(200).json({ data: inserted[0] });
  } catch (err) {
    console.error('upsert-laptop error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
