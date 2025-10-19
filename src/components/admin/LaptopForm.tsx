import React, { useState, useRef, useEffect } from 'react';
import { useToast } from '../../components/Toast';
import ReactQuill from 'react-quill';
import { XIcon, UploadCloudIcon, StarIcon, SpinnerIcon } from '../Icons';
import uploadToCloudinary from '../../lib/cloudinary';
import { ConfirmationModal } from '../ConfirmationModal';

interface LaptopFormProps {
    laptop: any;
    onSave: (laptop: any) => void;
    onCancel: () => void;
    allCategories: string[];
}

export const LaptopForm: React.FC<LaptopFormProps> = ({ laptop, onSave, onCancel, allCategories }) => {
    const { showToast } = useToast();
    const initial = { 
        ...laptop, 
        price: laptop.id === 0 ? '' : laptop.price, 
        inclusions: laptop.inclusions || [],
        ram: laptop.ram || '',
        storage: laptop.storage || '',
        cpu: laptop.cpu || '',
        displayInch: laptop.displayInch === undefined || laptop.displayInch === null ? '' : laptop.displayInch,
        condition: laptop.condition || 'second',
        grade: laptop.grade || '',
        features: laptop.features || [],
        accessories: laptop.accessories || []
        ,
        inStock: typeof laptop.inStock === 'boolean' ? laptop.inStock : (laptop.in_stock === undefined ? true : Boolean(laptop.in_stock))
    };
    const [formData, setFormData] = useState<any>(initial);
    const [imageUrls, setImageUrls] = useState<string[]>((laptop.galleryImages && laptop.galleryImages.length > 0) ? laptop.galleryImages : (laptop.imageUrl ? [laptop.imageUrl] : []));
    const [publicIds, setPublicIds] = useState<(string | null)[]>((laptop.galleryPublicIds && laptop.galleryPublicIds.length > 0) ? laptop.galleryPublicIds : (laptop.imagePublicId ? [laptop.imagePublicId] : []));
    const [uploadFiles, setUploadFiles] = useState<(File | null)[]>(imageUrls.map(() => null));
    const [uploadProgress, setUploadProgress] = useState<number[]>(imageUrls.map(() => 100));
    const [removedPublicIds, setRemovedPublicIds] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [customInclusion, setCustomInclusion] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const AVAILABLE_FEATURES = ['Touchscreen','360° Hinge','Backlit Keyboard','Fingerprint Reader','Dedicated GPU','Thunderbolt','Lightweight','Long Battery','Numeric Keypad','IPS Display'];
    const AVAILABLE_ACCESSORIES = ['Charger','Tas','Mouse','Flashdisk','Adaptor','Kabel','Manual','Box'];
    const [specSuggestions, setSpecSuggestions] = useState<Record<string, string[]>>({ ram: [], storage: [], cpu: [], displayInch: [], brand: [] });

    const handleChange = (e: any) => {
        const { name, value } = e.target;
        if (name === 'price') setFormData((p: any) => ({ ...p, [name]: value === '' ? '' : Number(value) }));
        else if (name === 'displayInch') setFormData((p: any) => ({ ...p, [name]: value === '' ? '' : Number(value) }));
        else setFormData((p: any) => ({ ...p, [name]: value }));
    };

    // Load suggestions from localStorage on mount
    useEffect(() => {
        try {
            const raw = localStorage.getItem('laptop_spec_suggestions');
            if (raw) {
                const parsed = JSON.parse(raw);
                setSpecSuggestions((prev) => ({ ...prev, ...parsed }));
            }
        } catch (e) {
            // ignore
        }
    }, []);

    // Clear grade when condition becomes new (grade only relevant for 'second')
    useEffect(() => {
        if (formData.condition === 'new' && formData.grade) {
            setFormData((p:any) => ({ ...p, grade: '' }));
        }
    }, [formData.condition]);

    const extractSnippet = (text: string) => {
        if (!text) return '';
        const words = String(text).trim().split(/\s+/).filter(Boolean);
        if (words.length === 0) return '';
        // take last up to 4 words
        const last = words.slice(Math.max(0, words.length - 4));
        return last.join(' ');
    };

    const saveSuggestion = (field: string, value: string) => {
        const snippet = extractSnippet(value);
        if (!snippet) return;
        setSpecSuggestions(prev => {
            const current = prev[field] || [];
            const dedup = [snippet, ...current.filter(s => s !== snippet)].slice(0, 10);
            const next = { ...prev, [field]: dedup };
            try { localStorage.setItem('laptop_spec_suggestions', JSON.stringify(next)); } catch (e) {}
            return next;
        });
    };

    const handleSpecBadgeClick = (field: string, val: string) => {
        setFormData((p: any) => ({ ...p, [field]: val }));
    };

    const toggleFeature = (feature: string) => {
        setFormData((p:any) => {
            const current = p.features || [];
            const next = current.includes(feature) ? current.filter((f:string)=>f!==feature) : [...current, feature];
            return { ...p, features: next };
        });
    };

    const toggleAccessory = (accessory: string) => {
        setFormData((p:any) => {
            const current = p.accessories || [];
            const next = current.includes(accessory) ? current.filter((a:string)=>a!==accessory) : [...current, accessory];
            return { ...p, accessories: next };
        });
    };

    // no popover: features rendered inline

    // Price input: format with dots every 3 digits for display, keep numeric in state
    const handlePriceInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = String(e.target.value || '');
        const digits = raw.replace(/[^0-9]/g, '');
        const num = digits === '' ? '' : Number(digits);
        setFormData((p: any) => ({ ...p, price: num }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return; const files = Array.from(e.target.files) as File[];
        files.forEach(file => {
            const reader = new FileReader(); reader.onloadend = () => {
                setImageUrls(prev => { const newIndex = prev.length; setUploadProgress(pp => { const np = [...pp]; np.splice(newIndex, 0, -2); return np; }); setUploadFiles(pp => { const nf = [...pp]; nf.splice(newIndex, 0, file); return nf; }); setPublicIds(pp => { const np = [...pp]; np.splice(newIndex, 0, null); return np; }); return [...prev, reader.result as string]; });
            }; reader.readAsDataURL(file as Blob);
        }); if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleDeleteImage = (index: number) => {
        const currentPid = publicIds[index];
        if (currentPid) setRemovedPublicIds(prev => prev.includes(currentPid) ? prev : [...prev, currentPid]);
        setPublicIds(prev => prev.filter((_, i) => i !== index));
        setImageUrls(prev => prev.filter((_, i) => i !== index));
        setUploadFiles(prev => prev.filter((_, i) => i !== index));
        setUploadProgress(prev => prev.filter((_, i) => i !== index));
    };

    const handleSetMain = (index: number) => {
        if (index === 0) return; const newUrls = [...imageUrls]; const item = newUrls.splice(index, 1); const reordered = [item[0], ...newUrls]; setImageUrls(reordered);
        setUploadProgress(prev => { const p = [...prev]; const it = p.splice(index,1); return [it[0], ...p]; });
        setUploadFiles(prev => { const p = [...prev]; const it = p.splice(index,1); return [it[0], ...p]; });
        setPublicIds(prev => { const p = [...prev]; const it = p.splice(index,1); return [it[0], ...p]; });
    };

    const retryUpload = async (index: number) => { const file = uploadFiles[index]; if (!file) return; setUploadProgress(prev => { const np = [...prev]; np[index] = 0; return np; }); try { const res = await uploadToCloudinary(file, (pct: number) => setUploadProgress(prev => { const np = [...prev]; np[index] = pct; return np; })); setImageUrls(prev => { const arr = [...prev]; arr[index] = res.url; return arr; }); setPublicIds(prev => { const arr = [...prev]; arr[index] = res.public_id || null; return arr; }); setUploadFiles(prev => { const arr = [...prev]; arr[index] = null; return arr; }); setUploadProgress(prev => { const np = [...prev]; np[index] = 100; return np; }); } catch (err) { setUploadProgress(prev => { const np = [...prev]; np[index] = -1; return np; }); } };

    const addInclusion = () => { if (!customInclusion.trim()) return; if ((formData.inclusions || []).includes(customInclusion.trim())) return; setFormData((p:any) => ({ ...p, inclusions: [...(p.inclusions || []), customInclusion.trim()] })); setCustomInclusion(''); };
    const removeInclusion = (inc: string) => setFormData((p:any) => ({ ...p, inclusions: (p.inclusions || []).filter((i:string) => i !== inc) }));

    const handleDescriptionChange = (value: string) => {
        setFormData((p: any) => ({ ...p, description: value }));
    };

    const modules = {
        toolbar: [
            [{ 'header': [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike', 'blockquote'],
            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
            [{ 'align': [] }],
            ['link'],
            ['clean']
        ]
    };

    const formatPrice = (p: any) => {
        try { const n = Number(p); if (!n) return ''; return new Intl.NumberFormat('id-ID').format(n); } catch { return String(p); }
    };

    const generateDescription = () => {
        const name = formData.name || '';
        const brands = (formData.categories || []).join(', ');
        const features = formData.features || [];
        const accessories = formData.accessories || [];

        const condText = formData.condition === 'new' ? 'baru' : 'bekas';
        const gradeText = formData.grade ? `Grade ${formData.grade}` : '';

        // Build a single-paragraph description: join all sentences into one <p> without line breaks
        const sentences: string[] = [];

        // Intro sentence
        if (name) {
            let intro = `${name}`;
            if (brands) intro += ` dari ${brands}`;
            intro += ` merupakan ${formData.condition === 'new' ? 'unit baru' : 'unit second'}`;
            if (gradeText && formData.condition !== 'new') intro += ` dengan ${gradeText}`;
            if (formData.price) intro += `, ditawarkan dengan harga Rp ${formatPrice(formData.price)}`;
            intro += `.`;
            sentences.push(intro);
        }

        // Specs sentence
        const specParts: string[] = [];
        if (formData.cpu) specParts.push(`${formData.cpu}`);
        if (formData.ram) specParts.push(`RAM ${formData.ram}`);
        if (formData.storage) specParts.push(`${formData.storage}`);
        if (formData.displayInch) specParts.push(`layar ${formData.displayInch}\"`);
        if (specParts.length > 0) {
            const specSentence = `Performa ditopang oleh ${specParts.join(', ').replace(/, ([^,]*)$/, ' dan $1')}.`;
            sentences.push(specSentence);
        }

        // Features & accessories sentence(s)
        const extraSentences: string[] = [];
        if (features.length > 0) {
            extraSentences.push(`Kelebihan utama meliputi ${features.join(', ').replace(/, ([^,]*)$/, ' dan $1')}`);
        }
        if (accessories.length > 0) {
            extraSentences.push(`Kelengkapan yang disertakan: ${accessories.join(', ').replace(/, ([^,]*)$/, ' dan $1')}`);
        }
        if (extraSentences.length > 0) {
            // join with a period so they remain separate sentences, but we'll combine all into one paragraph
            sentences.push(...extraSentences.map(s => s.endsWith('.') ? s : `${s}.`));
        }

        let html = '';
        if (sentences.length > 0) {
            // join sentences with a single space to avoid newlines and wrap in one <p>
            const oneParagraph = sentences.join(' ');
            html = `<p>${oneParagraph}</p>`;
        } else {
            html = `<p>${name || 'Laptop ini'} — deskripsi singkat belum tersedia.</p>`;
        }

        try { handleDescriptionChange(html); showToast('Deskripsi naratif telah digenerate', 'success'); } catch (e) { handleDescriptionChange(html); }
    };

    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); setIsSaving(true); setTimeout(async () => {
        const finalImageUrls = [...imageUrls]; const localPublicIds = finalImageUrls.map((_, i) => (publicIds[i] ?? null));
        for (let i = 0; i < finalImageUrls.length; i++) { const file = uploadFiles[i]; if (file) { try { setUploadProgress(prev => { const np = [...prev]; np[i] = 0; return np; }); const res = await uploadToCloudinary(file, (pct: number) => setUploadProgress(prev => { const np = [...prev]; np[i] = pct; return np; })); finalImageUrls[i] = res.url; localPublicIds[i] = res.public_id || null; setUploadFiles(prev => { const nf = [...prev]; nf[i] = null; return nf; }); setUploadProgress(prev => { const np = [...prev]; np[i] = 100; return np; }); } catch (err) { setUploadProgress(prev => { const np = [...prev]; np[i] = -1; return np; }); } } }
        setPublicIds(localPublicIds);
        const slug = formData.slug && formData.slug.trim() !== '' ? formData.slug.trim() : String(formData.name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const finalData = {
            ...formData,
            slug,
            imageUrl: finalImageUrls[0] || '',
            galleryImages: finalImageUrls,
            imagePublicId: localPublicIds && localPublicIds[0] ? localPublicIds[0] : null,
            galleryPublicIds: localPublicIds && localPublicIds.length > 0 ? localPublicIds : [],
            ...(removedPublicIds && removedPublicIds.length > 0 ? { removed_public_ids: Array.from(new Set(removedPublicIds.filter(Boolean))) } : {}),
            price: formData.price === '' ? 0 : Number(formData.price) || 0,
            inclusions: formData.inclusions || [],
            categories: formData.categories || [],
            // Specs
            ram: formData.ram || '',
            storage: formData.storage || '',
            cpu: formData.cpu || '',
            displayInch: formData.displayInch === '' ? 0 : Number(formData.displayInch) || 0,
            condition: formData.condition || 'second',
            grade: formData.grade || '',
            accessories: formData.accessories || []
            ,
            inStock: typeof formData.inStock === 'boolean' ? formData.inStock : (formData.in_stock === undefined ? true : Boolean(formData.in_stock))
        };
        try { await onSave(finalData); } catch (err:any) { const msg = (err && err.message) ? err.message : 'Gagal menyimpan laptop'; try { showToast(msg, 'error'); } catch {} }
    setIsSaving(false); }, 1200); };

    return (
        <div className="admin-card">
            <div className="admin-form-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ margin: 0 }}>{formData.id === 0 ? 'Tambah' : 'Edit'} Laptop</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label className="form-toggle" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.95rem' }}>
                        <span className="form-toggle-label">In stock</span>
                        <button type="button" aria-pressed={!!formData.inStock} onClick={() => setFormData((p:any)=>({...p, inStock: !p.inStock}))} className={`toggle-switch ${formData.inStock ? 'on' : 'off'}`}>
                            <span className="toggle-thumb" aria-hidden />
                        </button>
                    </label>
                </div>
            </div>
            <form className="admin-form" onSubmit={handleSubmit}>
                <div className="form-group"><label>Nama</label><input name="name" value={formData.name} onChange={handleChange} required/></div>
                <div className="form-group"><label>Galeri Gambar</label>
                    <div className="image-upload-grid">{imageUrls.map((url, index) => (
                        <div key={index} className="image-preview-item">
                            <img src={url} alt={`Preview ${index+1}`} loading="lazy" decoding="async" />
                            {index === 0 && <div className="main-image-badge">Utama</div>}
                            {uploadProgress[index] !== undefined && uploadProgress[index] >=0 && uploadProgress[index] < 100 && (<div className="upload-overlay"><div className="progress-circle">{uploadProgress[index]}%</div></div>)}
                            {uploadProgress[index] === -1 && (<div className="upload-overlay upload-failed"><button type="button" className="btn btn-secondary btn-small" onClick={() => retryUpload(index)}>Retry</button></div>)}
                            <div className="image-actions"><button type="button" className={`image-action-btn star ${index===0?'active':''}`} onClick={() => handleSetMain(index)} disabled={index===0}><StarIcon filled={index===0} /></button><button type="button" className="image-action-btn delete" onClick={() => handleDeleteImage(index)}><XIcon /></button></div>
                        </div>
                    ))}
                    <button type="button" className="upload-placeholder" onClick={() => fileInputRef.current?.click()}><UploadCloudIcon /><span>Unggah</span></button>
                    <input type="file" ref={fileInputRef} className="hidden-file-input" multiple accept="image/*" onChange={handleFileChange} />
                    </div></div>

                

                <div className="form-row-compact" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    <div className="form-group">
                        <label>Brand</label>
                        <input
                            name="categories"
                            value={(formData.categories || []).join(', ')}
                            onChange={(e)=> setFormData((p:any)=>({...p, categories: String(e.target.value).split(',').map((s:string)=>s.trim()).filter(Boolean)}))}
                            onBlur={(e) => {
                                // save last token as brand suggestion
                                const val = String(e.target.value || '');
                                const parts = val.split(',').map(s=>s.trim()).filter(Boolean);
                                const last = parts.length > 0 ? parts[parts.length-1] : '';
                                if (last) saveSuggestion('brand', last);
                            }}
                        />
                        {specSuggestions.brand && specSuggestions.brand.length > 0 && (
                            <div className="suggestion-badges" style={{ marginTop: 8 }}>
                                {specSuggestions.brand.map((s) => (
                                    <button
                                        type="button"
                                        key={s}
                                        className="suggestion-badge"
                                        onClick={() => {
                                            setFormData((p:any) => {
                                                const current = p.categories || [];
                                                if (current.includes(s)) return p;
                                                return { ...p, categories: [...current, s] };
                                            });
                                        }}
                                    >{s}</button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <div className="form-group">
                            <label>Kondisi</label>
                            <select name="condition" value={formData.condition} onChange={handleChange}>
                                <option value="second">Second</option>
                                <option value="new">New</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Grade</label>
                            <select name="grade" value={formData.grade} onChange={handleChange} disabled={formData.condition === 'new'}>
                                <option value="">Pilih grade</option>
                                <option value="A">A</option>
                                <option value="B">B</option>
                                <option value="C">C</option>
                                <option value="D">D</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="form-group">
                    <label>Harga (IDR)</label>
                    <input
                        name="price"
                        value={formData.price === '' ? '' : new Intl.NumberFormat('id-ID').format(Number(formData.price))}
                        onChange={handlePriceInputChange}
                        inputMode="numeric"
                        placeholder="cth: 1.500.000"
                    />
                </div>

                <div className="form-group">
                    <label>Spesifikasi</label>
                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                        <div className="form-row-compact" style={{ gridTemplateColumns: '1fr 1fr' }}>
                            <div className="form-group">
                                <label>RAM</label>
                                <input name="ram" value={formData.ram} onChange={handleChange} onBlur={(e)=> saveSuggestion('ram', String(e.target.value))} placeholder="cth: 8GB, 16GB" />
                                {specSuggestions.ram && specSuggestions.ram.length > 0 && (
                                    <div className="suggestion-badges">
                                        {specSuggestions.ram.map((s) => (
                                            <button type="button" key={s} className="suggestion-badge" onClick={() => handleSpecBadgeClick('ram', s)}>{s}</button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="form-group">
                                <label>Storage</label>
                                <input name="storage" value={formData.storage} onChange={handleChange} onBlur={(e)=> saveSuggestion('storage', String(e.target.value))} placeholder="cth: 256GB SSD" />
                                {specSuggestions.storage && specSuggestions.storage.length > 0 && (
                                    <div className="suggestion-badges">
                                        {specSuggestions.storage.map((s) => (
                                            <button type="button" key={s} className="suggestion-badge" onClick={() => handleSpecBadgeClick('storage', s)}>{s}</button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="form-row-compact" style={{ gridTemplateColumns: '1fr 1fr' }}>
                            <div className="form-group">
                                <label>CPU</label>
                                <input name="cpu" value={formData.cpu} onChange={handleChange} onBlur={(e)=> saveSuggestion('cpu', String(e.target.value))} placeholder="cth: Intel i5-1135G7" />
                                {specSuggestions.cpu && specSuggestions.cpu.length > 0 && (
                                    <div className="suggestion-badges">
                                        {specSuggestions.cpu.map((s) => (
                                            <button type="button" key={s} className="suggestion-badge" onClick={() => handleSpecBadgeClick('cpu', s)}>{s}</button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="form-group">
                                <label>Display (inch)</label>
                                <input name="displayInch" value={formData.displayInch} onChange={handleChange} onBlur={(e)=> saveSuggestion('displayInch', String(e.target.value))} inputMode="decimal" placeholder="cth: 14" />
                                {specSuggestions.displayInch && specSuggestions.displayInch.length > 0 && (
                                    <div className="suggestion-badges">
                                        {specSuggestions.displayInch.map((s) => (
                                            <button type="button" key={s} className="suggestion-badge" onClick={() => handleSpecBadgeClick('displayInch', s)}>{s}</button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="form-group">
                    <label>Kelebihan (Features)</label>
                    <div className="chip-group" role="list">
                        {AVAILABLE_FEATURES.map(feature => {
                            const active = (formData.features || []).includes(feature);
                            return (
                                <button
                                    key={feature}
                                    type="button"
                                    role="listitem"
                                    aria-pressed={active}
                                    className={`chip ${active ? 'chip--active' : ''}`}
                                    onClick={() => toggleFeature(feature)}
                                >
                                    {feature}
                                </button>
                            );
                        })}
                    </div>
                    {/* selected features are represented by chip state; no duplicate badges needed */}
                </div>

                <div className="form-group">
                    <label>Kelengkapan (Accessories)</label>
                    <div className="chip-group" role="list">
                        {AVAILABLE_ACCESSORIES.map(acc => {
                            const active = (formData.accessories || []).includes(acc);
                            return (
                                <button
                                    key={acc}
                                    type="button"
                                    role="listitem"
                                    aria-pressed={active}
                                    className={`chip ${active ? 'chip--active' : ''}`}
                                    onClick={() => toggleAccessory(acc)}
                                >
                                    {acc}
                                </button>
                            );
                        })}
                    </div>
                    {/* selected accessories are represented by chip state; no duplicate badges needed */}
                </div>

                <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>Deskripsi</span>
                        <button type="button" className="btn btn-secondary" onClick={generateDescription} style={{ fontSize: '0.85rem' }}>Generate</button>
                    </label>
                    <ReactQuill className="description-editor" theme="snow" value={formData.description || ''} onChange={handleDescriptionChange} modules={modules} />
                </div>

                <div className="form-actions"><button type="button" className="btn btn-secondary" onClick={onCancel} disabled={isSaving}>Batal</button>
                <button type="submit" className={`btn btn-primary ${isSaving ? 'loading' : ''}`} disabled={isSaving}>{isSaving && <SpinnerIcon/>}<span>Simpan</span></button></div>
            </form>
        </div>
    );
};

export default LaptopForm;
