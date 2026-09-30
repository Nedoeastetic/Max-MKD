import { useState, useEffect, useRef } from 'react';
import { getUserId, setUserId, clearUserId } from './session';
import { getUser, updateUser, createIncident, getIncidents, assignIncident, resolveIncident, reviewIncident, analyzeText, analyzeImage, getMasters } from './api';
import { TAXONOMY, WORKER_NAMES, SEVERITY_LABELS, STATUS_LABELS, getCategory, getSubcategory, getWorkerTypeForCategory } from './taxonomy';
import { fuse } from './fusion';
import { LIMITS, CharCounter } from './limits';
import { Onboarding } from './components/Onboarding';
import { Send, Camera, Loader2, CheckCircle, Edit, X, MapPin, Star, AlertTriangle, Wrench, Home, Settings, LogOut } from 'lucide-react';

type View = 'resident' | 'master';
type ResidentTab = 'chat' | 'incidents';
type MasterTab = 'available' | 'my';

interface Profile {
  id: string;
  role: string;
  name: string;
  worker_type?: string;
  default_address?: string;
}

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: number;
  photoUrl?: string;
}

function App() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('resident');
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const id = getUserId();
    if (id) {
      getUser(id).then(u => { 
        setProfile(u); 
        setView(u.role as View); // Устанавливаем вкладку по роли пользователя
        setLoading(false); 
      }).catch(() => { 
        clearUserId(); 
        setLoading(false); 
      });
    } else {
      setLoading(false);
    }
  }, []);

  if (loading) return <div className="h-full flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  if (!profile) return <Onboarding onComplete={(id) => getUser(id).then(u => { setProfile(u); setView(u.role as View); })} />;

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--max-surface)' }}>
      {/* Header */}
      <header className="shrink-0 border-b" style={{ background: 'var(--max-background)', borderColor: 'var(--max-border)' }}>
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-center h-14">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--max-primary)' }}>
              <span className="text-white text-xs font-bold">АД</span>
            </div>
            <div className="ml-3 hidden sm:block">
              <h1 className="text-sm font-semibold" style={{ color: 'var(--max-text-primary)' }}>Аварийный диспетчер</h1>
              <p className="text-xs" style={{ color: 'var(--max-text-secondary)' }}>{profile.name} • {profile.role === 'resident' ? 'Житель' : WORKER_NAMES[profile.worker_type || '']}</p>
            </div>
            <nav className="hidden lg:flex items-center gap-1 ml-6">
              <NavBtn active={view === 'resident'} onClick={() => setView('resident')} icon={Home} label="Житель" disabled={profile.role !== 'resident'} />
              <NavBtn active={view === 'master'} onClick={() => setView('master')} icon={Wrench} label="Мастер" disabled={profile.role !== 'master'} />
            </nav>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => setShowSettings(true)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--max-surface)' }}>
                <Settings className="w-4 h-4" style={{ color: 'var(--max-text-secondary)' }} />
              </button>
            </div>
          </div>
          {/* Mobile nav */}
          <nav className="lg:hidden flex items-center gap-1 overflow-x-auto pb-2 -mx-4 px-4">
            <NavBtn active={view === 'resident'} onClick={() => setView('resident')} icon={Home} label="Житель" disabled={profile.role !== 'resident'} small />
            <NavBtn active={view === 'master'} onClick={() => setView('master')} icon={Wrench} label="Мастер" disabled={profile.role !== 'master'} small />
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-hidden">
        {view === 'resident' && profile.role === 'resident' && <ResidentView profile={profile} />}
        {view === 'master' && profile.role === 'master' && <MasterView profile={profile} />}
        {view === 'resident' && profile.role !== 'resident' && <RoleMismatch currentRole="master" />}
        {view === 'master' && profile.role !== 'master' && <RoleMismatch currentRole="resident" />}
      </main>

      {/* Settings Modal */}
      {showSettings && <SettingsModal profile={profile} onClose={() => setShowSettings(false)} onUpdate={setProfile} />}
    </div>
  );
}

function NavBtn({ active, onClick, icon: Icon, label, disabled, small }: any) {
  return (
    <button onClick={onClick} disabled={disabled} className={`flex items-center gap-1.5 ${small ? 'px-2.5 py-1.5' : 'px-3 py-1.5'} rounded-full text-xs font-medium transition-all ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`} style={{ background: active ? 'var(--max-primary-light)' : 'transparent', color: active ? 'var(--max-primary)' : 'var(--max-text-secondary)' }}>
      <Icon className={small ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
      <span className={small ? 'text-[10px]' : ''}>{label}</span>
    </button>
  );
}

function RoleMismatch({ currentRole }: { currentRole: string }) {
  return (
    <div className="h-full flex items-center justify-center p-6" style={{ background: 'var(--max-surface)' }}>
      <div className="max-w-sm text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--max-surface)' }}>
          <span className="text-3xl">{currentRole === 'master' ? '🔧' : '👤'}</span>
        </div>
        <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--max-text-primary)' }}>Раздел недоступен</h2>
        <p className="text-sm mb-4" style={{ color: 'var(--max-text-secondary)' }}>
          Вы зарегистрированы как {currentRole === 'master' ? 'мастер' : 'житель'}. Сменить роль можно в настройках.
        </p>
      </div>
    </div>
  );
}

// ====== RESIDENT VIEW ======
function ResidentView({ profile }: { profile: Profile }) {
  const [tab, setTab] = useState<ResidentTab>('chat');
  const [incidents, setIncidents] = useState<any[]>([]);
  
  // Поднимаем состояние чата выше, чтобы оно не терялось при переключении вкладок
  const [messages, setMessages] = useState<Message[]>([]);
  const [pendingFusion, setPendingFusion] = useState<any>(null);

  useEffect(() => {
    const load = () => getIncidents({ user_id: profile.id }).then(setIncidents).catch(() => {});
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [profile.id]);

  // Загружаем сохраненные сообщения из localStorage при монтировании
  useEffect(() => {
    const saved = localStorage.getItem(`chat_messages_${profile.id}`);
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch {}
    }
  }, [profile.id]);

  // Сохраняем сообщения в localStorage при изменении
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(`chat_messages_${profile.id}`, JSON.stringify(messages.slice(-50))); // Храним последние 50 сообщений
    }
  }, [messages, profile.id]);

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 flex gap-1 p-2" style={{ background: 'var(--max-background)', borderBottom: '1px solid var(--max-border)' }}>
        <button onClick={() => setTab('chat')} className={`flex-1 py-2 rounded-lg text-xs font-medium`} style={{ background: tab === 'chat' ? 'var(--max-primary)' : 'var(--max-surface)', color: tab === 'chat' ? 'white' : 'var(--max-text-secondary)' }}>
          Чат
        </button>
        <button onClick={() => setTab('incidents')} className={`flex-1 py-2 rounded-lg text-xs font-medium`} style={{ background: tab === 'incidents' ? 'var(--max-primary)' : 'var(--max-surface)', color: tab === 'incidents' ? 'white' : 'var(--max-text-secondary)' }}>
          Заявки ({incidents.length})
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        {tab === 'chat' ? (
          <ResidentChat 
            profile={profile} 
            messages={messages}
            setMessages={setMessages}
            pendingFusion={pendingFusion}
            setPendingFusion={setPendingFusion}
          />
        ) : (
          <ResidentIncidents profile={profile} incidents={incidents} onUpdate={() => getIncidents({ user_id: profile.id }).then(setIncidents)} />
        )}
      </div>
    </div>
  );
}

// ====== RESIDENT CHAT ======
function ResidentChat({ 
  profile, 
  messages, 
  setMessages,
  pendingFusion,
  setPendingFusion
}: { 
  profile: Profile;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  pendingFusion: any;
  setPendingFusion: React.Dispatch<React.SetStateAction<any>>;
}) {
  const [input, setInput] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [address, setAddress] = useState(profile.default_address || '');
  const [saveAddress, setSaveAddress] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editCategory, setEditCategory] = useState('');
  const [editSubcategory, setEditSubcategory] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Paste handler
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const file = e.clipboardData?.files[0];
      if (file && file.type.startsWith('image/')) {
        e.preventDefault();
        setPhoto(file);
        setPhotoPreview(URL.createObjectURL(file));
      }
    };
    window.addEventListener('paste', handler);
    return () => window.removeEventListener('paste', handler);
  }, []);

  const addMsg = (role: 'user' | 'ai', content: string, photoUrl?: string) => {
    setMessages(prev => [...prev, { id: `${Date.now()}-${Math.random()}`, role, content, timestamp: Date.now(), photoUrl }]);
  };

  const handleSend = async () => {
    if (!input.trim() && !photo) return;
    const text = input.trim();
    addMsg('user', text || '[Фото]', photoPreview || undefined);
    setInput('');
    const currentPhoto = photo;
    setPhoto(null);
    setPhotoPreview(null);
    setProcessing(true);
    addMsg('ai', '⏳ Анализирую...');

    try {
      let textResult = null, visionResult = null;
      if (text) {
        try { textResult = await analyzeText(text); } catch (e) { console.error('Text API error:', e); }
      }
      if (currentPhoto) {
        try { visionResult = await analyzeImage(currentPhoto); } catch (e) { console.error('Vision API error:', e); }
      }

      const mode = text && currentPhoto ? 'TEXT_AND_IMAGE' : currentPhoto ? 'IMAGE_ONLY' : 'TEXT_ONLY';
      const fused = fuse({ textResult, visionResult, mode });

      setMessages(prev => prev.filter(m => m.content !== '⏳ Анализирую...'));

      if (fused.classificationResult === 'NOT_INCIDENT') {
        addMsg('ai', mode === 'TEXT_ONLY' ? '🔍 Не удалось определить проблему по описанию. Попробуйте описать подробнее или отправить фото.' : '🔍 На фото не обнаружена проблема, связанная с домом. Попробуйте отправить другое фото или опишите проблему текстом.');
        setProcessing(false);
        return;
      }

      setPendingFusion(fused);
      setAddress(profile.default_address || '');

      const cat = getCategory(fused.category || '');
      const sub = fused.category && fused.subcategory ? getSubcategory(fused.category, fused.subcategory) : null;

      addMsg('ai', `✅ Мы поняли проблему так:\n📋 ${cat?.name || 'Не определена'}\n📍 ${sub?.name || 'Не определена'}\n⚡ ${SEVERITY_LABELS[fused.severity || 'MEDIUM']}\n🎯 ${Math.round(fused.confidence * 100)}%\n👷 ${WORKER_NAMES[getWorkerTypeForCategory(fused.category, fused.subcategory)]}\n\nУкажите адрес и подтвердите заявку.`);
    } catch (e: any) {
      setMessages(prev => prev.filter(m => m.content !== '⏳ Анализирую...'));
      addMsg('ai', `❌ ${e.message || 'Ошибка анализа'}`);
    }
    setProcessing(false);
  };

  const handleConfirm = async () => {
    if (!pendingFusion || !address) return;
    setProcessing(true);
    try {
      const inc = await createIncident({
        user_id: profile.id,
        address,
        text: input || undefined,
        category: pendingFusion.category,
        subcategory: pendingFusion.subcategory,
        severity: pendingFusion.severity,
        confidence: pendingFusion.confidence,
        input_mode: photo ? 'TEXT_AND_IMAGE' : 'TEXT_ONLY'
      }, photo || undefined);

      addMsg('ai', `✅ Заявка #${inc.id} создана! Ожидайте мастера.`);
      setPendingFusion(null);

      if (saveAddress) {
        await updateUser(profile.id, { default_address: address });
      }
    } catch (e: any) {
      addMsg('ai', `❌ Ошибка создания заявки: ${e.message}`);
    }
    setProcessing(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-2" style={{ background: 'var(--max-surface)' }}>
        {messages.length === 0 && (
          <div className="mb-3">
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--max-text-secondary)' }}>Быстрые примеры:</p>
            <div className="flex flex-wrap gap-1.5">
              {['💧 Течёт труба', '🌳 Упало дерево', '⚡ Нет света', '🧹 Грязно в подъезде', '🚪 Сломана дверь'].map(ex => (
                <button key={ex} onClick={() => setInput(ex.slice(2))} className="px-3 py-1.5 rounded-full text-xs" style={{ background: 'var(--max-background)', border: '1px solid var(--max-border)' }}>
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${msg.role === 'user' ? 'max-bubble max-bubble-outgoing' : 'max-bubble max-bubble-incoming'}`}>
              <p className="text-sm whitespace-pre-line">{msg.content}</p>
              {msg.photoUrl && <img src={msg.photoUrl} alt="" className="mt-2 rounded-xl max-h-48 object-cover" />}
              <p className="text-[10px] mt-1 text-right" style={{ color: 'var(--max-text-tertiary)' }}>{new Date(msg.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>
        ))}

        {/* Address + Confirm block */}
        {pendingFusion && (
          <div className="max-bubble max-bubble-incoming max-w-[90%]">
            <div className="mb-2">
              <label className="text-xs font-medium block mb-1">📍 Адрес:</label>
              <div className="flex gap-2">
                <input type="text" value={address} onChange={e => setAddress(e.target.value)} maxLength={LIMITS.address} placeholder="Введите адрес" className="flex-1 max-input text-xs" />
                <button onClick={async () => {
                  try {
                    const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 }));
                    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`, { headers: { 'Accept-Language': 'ru' } });
                    const data = await r.json();
                    setAddress(data.display_name || '');
                  } catch { alert('Геопозиция недоступна — введите адрес вручную'); }
                }} className="px-2 py-1 rounded-lg text-xs" style={{ background: 'var(--max-primary-light)', color: 'var(--max-primary)' }}>
                  <MapPin className="w-3 h-3 inline" /> GPS
                </button>
              </div>
              <label className="flex items-center gap-1 mt-1 text-xs">
                <input type="checkbox" checked={saveAddress} onChange={e => setSaveAddress(e.target.checked)} />
                <span style={{ color: 'var(--max-text-secondary)' }}>Сохранить как мой адрес</span>
              </label>
            </div>
            <div className="flex gap-2">
              <button onClick={handleConfirm} disabled={!address || processing} className="flex-1 max-btn max-btn-primary text-xs py-2">
                {processing ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />} Подтвердить
              </button>
              <button onClick={() => { setEditCategory(pendingFusion.category || ''); setEditSubcategory(pendingFusion.subcategory || ''); setShowEdit(true); }} className="max-btn max-btn-secondary text-xs py-2">
                <Edit className="w-3 h-3" /> Изменить
              </button>
              <button onClick={() => { setPendingFusion(null); addMsg('ai', 'Заявка отменена.'); }} className="max-btn max-btn-secondary text-xs py-2">
                Отмена
              </button>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Photo preview */}
      {photoPreview && (
        <div className="shrink-0 px-4 py-2 flex items-center gap-2" style={{ background: 'var(--max-background)', borderTop: '1px solid var(--max-border)' }}>
          <div className="relative">
            <img src={photoPreview} alt="" className="w-14 h-14 rounded-lg object-cover" />
            <button onClick={() => { setPhoto(null); setPhotoPreview(null); }} className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'var(--max-error)' }}>
              <X className="w-3 h-3 text-white" />
            </button>
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium">{photo?.name}</p>
            <p className="text-[10px]" style={{ color: 'var(--max-text-secondary)' }}>{photo ? `${(photo.size / 1024).toFixed(1)} KB` : ''}</p>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="shrink-0 border-t px-3 py-2" style={{ background: 'var(--max-background)', borderColor: 'var(--max-border)' }}>
        <div className="flex gap-2 items-end">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => {
            const f = e.target.files?.[0];
            if (f) { setPhoto(f); setPhotoPreview(URL.createObjectURL(f)); }
          }} />
          <button onClick={() => fileRef.current?.click()} className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: photo ? 'var(--max-primary)' : 'var(--max-surface)', color: photo ? 'white' : 'var(--max-text-secondary)' }}>
            <Camera className="w-4 h-4" />
          </button>
          <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} maxLength={LIMITS.description} placeholder="Опишите проблему..." rows={1} className="flex-1 max-input text-sm resize-none" style={{ minHeight: '36px', maxHeight: '100px' }} />
          <button onClick={handleSend} disabled={processing || (!input.trim() && !photo)} className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 disabled:opacity-40" style={{ background: 'var(--max-primary)' }}>
            {processing ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Send className="w-4 h-4 text-white" />}
          </button>
        </div>
      </div>

      {/* Edit Modal */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setShowEdit(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Редактировать заявку</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium block mb-1">Категория</label>
                <select value={editCategory} onChange={e => { setEditCategory(e.target.value); setEditSubcategory(''); }} className="w-full max-input text-sm">
                  <option value="">Выберите</option>
                  {Object.values(TAXONOMY).map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
              </div>
              {editCategory && (
                <div>
                  <label className="text-xs font-medium block mb-1">Подкатегория</label>
                  <select value={editSubcategory} onChange={e => setEditSubcategory(e.target.value)} className="w-full max-input text-sm">
                    <option value="">Выберите</option>
                    {Object.values(TAXONOMY[editCategory]?.subcategories || {}).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowEdit(false)} className="flex-1 max-btn max-btn-secondary">Отмена</button>
              <button onClick={() => { setPendingFusion({ ...pendingFusion, category: editCategory, subcategory: editSubcategory }); setShowEdit(false); }} className="flex-1 max-btn max-btn-primary">Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ====== RESIDENT INCIDENTS ======
function ResidentIncidents({ profile, incidents, onUpdate }: { profile: Profile; incidents: any[]; onUpdate: () => void }) {
  const active = incidents.filter(i => i.status === 'AVAILABLE' || i.status === 'ASSIGNED');
  const archived = incidents.filter(i => i.status === 'RESOLVED' || i.status === 'CANCELLED');
  const [showArchived, setShowArchived] = useState(false);

  return (
    <div className="h-full overflow-y-auto p-4 space-y-3" style={{ background: 'var(--max-surface)' }}>
      {incidents.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm" style={{ color: 'var(--max-text-secondary)' }}>У вас пока нет заявок</p>
        </div>
      )}
      {active.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold mb-2" style={{ color: 'var(--max-text-secondary)' }}>Активные</h3>
          {active.map(inc => <IncidentCard key={inc.id} incident={inc} profile={profile} onUpdate={onUpdate} />)}
        </div>
      )}
      {archived.length > 0 && (
        <div>
          <button onClick={() => setShowArchived(!showArchived)} className="text-xs font-semibold mb-2 flex items-center gap-1" style={{ color: 'var(--max-text-secondary)' }}>
            Архив ({archived.length}) {showArchived ? '▲' : '▼'}
          </button>
          {showArchived && archived.map(inc => <IncidentCard key={inc.id} incident={inc} profile={profile} onUpdate={onUpdate} />)}
        </div>
      )}
    </div>
  );
}

function IncidentCard({ incident, profile, onUpdate }: { incident: any; profile: Profile; onUpdate: () => void }) {
  const cat = getCategory(incident.category || '');
  const sub = incident.category && incident.subcategory ? getSubcategory(incident.category, incident.subcategory) : null;
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [reviewError, setReviewError] = useState('');

  const handleReview = async () => {
    if (rating === 0) return;
    try {
      await reviewIncident(incident.id, profile.id, rating, comment || undefined);
      onUpdate();
    } catch (e: any) {
      setReviewError(e.message === 'already_reviewed' ? 'Вы уже оценили эту заявку' : e.message);
    }
  };

  return (
    <div className="rounded-2xl p-4 mb-2" style={{ background: 'var(--max-background)', border: '1px solid var(--max-border)' }}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{cat?.icon || '📋'}</span>
          <div>
            <p className="text-sm font-semibold">#{incident.id} {cat?.name}</p>
            <p className="text-xs" style={{ color: 'var(--max-text-secondary)' }}>{sub?.name}</p>
          </div>
        </div>
        <span className={`max-badge ${incident.status === 'RESOLVED' ? 'max-badge-success' : incident.status === 'CANCELLED' ? 'max-badge-error' : incident.status === 'ASSIGNED' ? 'max-badge-warning' : 'max-badge-primary'}`}>
          {STATUS_LABELS[incident.status]}
        </span>
      </div>
      <p className="text-xs mb-1" style={{ color: 'var(--max-text-secondary)' }}>📍 {incident.address}</p>
      {incident.master_name && <p className="text-xs" style={{ color: 'var(--max-text-secondary)' }}>👷 {incident.master_name}</p>}
      {incident.report && <p className="text-xs mt-1 p-2 rounded-lg" style={{ background: 'var(--max-surface)' }}>📝 {incident.report}</p>}
      {incident.review && (
        <div className="flex items-center gap-1 mt-1">
          {[1,2,3,4,5].map(s => <Star key={s} className={`w-3 h-3 ${s <= incident.review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />)}
        </div>
      )}
      {incident.status === 'RESOLVED' && !incident.review && (
        <div className="mt-3 pt-2" style={{ borderTop: '1px solid var(--max-border)' }}>
          <p className="text-xs font-medium mb-1">Оцените работу:</p>
          <div className="flex gap-1 mb-2">
            {[1,2,3,4,5].map(s => (
              <button key={s} onClick={() => setRating(s)}>
                <Star className={`w-5 h-5 ${s <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
              </button>
            ))}
          </div>
          <textarea value={comment} onChange={e => setComment(e.target.value)} maxLength={LIMITS.reviewComment} placeholder="Комментарий (необязательно)" rows={2} className="w-full max-input text-xs resize-none mb-2" />
          <div className="flex items-center justify-between">
            <CharCounter value={comment} max={LIMITS.reviewComment} />
            <button onClick={handleReview} disabled={rating === 0} className="max-btn max-btn-primary text-xs py-1 px-3">Отправить</button>
          </div>
          {reviewError && <p className="text-xs mt-1" style={{ color: 'var(--max-error)' }}>{reviewError}</p>}
        </div>
      )}
    </div>
  );
}

// ====== MASTER VIEW ======
function MasterView({ profile }: { profile: Profile }) {
  const [tab, setTab] = useState<MasterTab>('available');
  const [incidents, setIncidents] = useState<any[]>([]);
  const [masters, setMasters] = useState<any[]>([]);

  useEffect(() => {
    const load = () => {
      getIncidents({}).then(setIncidents).catch(() => {});
      getMasters().then(setMasters).catch(() => {});
    };
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  const myIncidents = incidents.filter(i => i.master_id === profile.id);
  const availableForMe = incidents.filter(i => {
    if (i.status !== 'AVAILABLE') return false;
    const req = getWorkerTypeForCategory(i.category, i.subcategory);
    return profile.worker_type === req || profile.worker_type === 'UNIVERSAL' || (!i.category && profile.worker_type === 'UNIVERSAL');
  });

  const myMasterData = masters.find(m => m.id === profile.id);

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 px-4 py-3" style={{ background: 'var(--max-background)', borderBottom: '1px solid var(--max-border)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--max-warning)' }}>
            <Wrench className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">{profile.name}</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#E6F9E6', color: 'var(--max-success)' }}>Онлайн</span>
            </div>
            <p className="text-xs" style={{ color: 'var(--max-text-secondary)' }}>
              {WORKER_NAMES[profile.worker_type || '']}
              {myMasterData?.rating_avg ? ` • ${myMasterData.rating_avg} (${myMasterData.review_count} отзывов)` : ' • Нет отзывов'}
            </p>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={() => setTab('available')} className="flex-1 py-2 rounded-xl text-xs font-medium" style={{ background: tab === 'available' ? 'var(--max-primary)' : 'var(--max-surface)', color: tab === 'available' ? 'white' : 'var(--max-text-secondary)' }}>
            Новые ({availableForMe.length})
          </button>
          <button onClick={() => setTab('my')} className="flex-1 py-2 rounded-xl text-xs font-medium" style={{ background: tab === 'my' ? 'var(--max-primary)' : 'var(--max-surface)', color: tab === 'my' ? 'white' : 'var(--max-text-secondary)' }}>
            Мои ({myIncidents.length})
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ background: 'var(--max-surface)' }}>
        {(tab === 'available' ? availableForMe : myIncidents).length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm" style={{ color: 'var(--max-text-secondary)' }}>
              {tab === 'available' ? 'Новых заявок по вашей специальности пока нет' : 'У вас пока нет заявок в работе'}
            </p>
          </div>
        )}
        {(tab === 'available' ? availableForMe : myIncidents).map(inc => (
          <MasterIncidentCard key={inc.id} incident={inc} profile={profile} onUpdate={() => getIncidents({}).then(setIncidents)} />
        ))}
      </div>
    </div>
  );
}

function MasterIncidentCard({ incident, profile, onUpdate }: { incident: any; profile: Profile; onUpdate: () => void }) {
  const cat = getCategory(incident.category || '');
  const sub = incident.category && incident.subcategory ? getSubcategory(incident.category, incident.subcategory) : null;
  const [showResolve, setShowResolve] = useState(false);
  const [report, setReport] = useState('');
  const [error, setError] = useState('');

  const handleAssign = async () => {
    try {
      await assignIncident(incident.id, profile.id);
      onUpdate();
    } catch (e: any) {
      setError(e.message === 'already_assigned' ? 'Заявку уже взяли' : e.message === 'wrong_specialty' ? 'Не ваша специальность' : e.message);
    }
  };

  const handleResolve = async () => {
    try {
      await resolveIncident(incident.id, profile.id, report || undefined);
      setShowResolve(false);
      onUpdate();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--max-background)', border: '1px solid var(--max-border)' }}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{cat?.icon || '📋'}</span>
          <div>
            <p className="text-sm font-semibold">{cat?.name || 'Не определено'}</p>
            <p className="text-xs" style={{ color: 'var(--max-text-secondary)' }}>{sub?.name}</p>
          </div>
        </div>
        <span className={`max-badge ${incident.severity === 'CRITICAL' ? 'max-badge-error' : incident.severity === 'HIGH' ? 'max-badge-warning' : 'max-badge-primary'}`}>
          {SEVERITY_LABELS[incident.severity || 'MEDIUM']}
        </span>
      </div>
      {incident.severity === 'CRITICAL' && (
        <div className="flex items-center gap-2 p-2 rounded-lg mb-2" style={{ background: '#FFE6E6' }}>
          <AlertTriangle className="w-4 h-4" style={{ color: 'var(--max-error)' }} />
          <p className="text-xs font-medium" style={{ color: 'var(--max-error)' }}>Критическая ситуация</p>
        </div>
      )}
      <p className="text-sm mb-2 line-clamp-2">{incident.text || 'Без описания'}</p>
      <p className="text-xs mb-2" style={{ color: 'var(--max-text-secondary)' }}>📍 {incident.address}</p>
      <p className="text-[10px]" style={{ color: 'var(--max-text-tertiary)' }}>{new Date(incident.created_at).toLocaleString('ru-RU')}</p>

      {incident.status === 'AVAILABLE' && (
        <button onClick={handleAssign} className="w-full max-btn max-btn-primary text-xs py-2 mt-3">Взять заявку</button>
      )}
      {incident.status === 'ASSIGNED' && incident.master_id === profile.id && (
        <button onClick={() => setShowResolve(true)} className="w-full max-btn max-btn-primary text-xs py-2 mt-3">Выполнить</button>
      )}
      {incident.status === 'RESOLVED' && (
        <div className="mt-2 p-2 rounded-lg" style={{ background: '#E6F9E6' }}>
          <p className="text-xs font-medium" style={{ color: 'var(--max-success)' }}>✅ Выполнено</p>
          {incident.report && <p className="text-xs mt-1" style={{ color: 'var(--max-text-secondary)' }}>{incident.report}</p>}
          {incident.review && (
            <div className="flex items-center gap-1 mt-1">
              {[1,2,3,4,5].map(s => <Star key={s} className={`w-3 h-3 ${s <= incident.review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />)}
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs mt-2" style={{ color: 'var(--max-error)' }}>{error}</p>}

      {showResolve && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setShowResolve(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-3">Отчёт о работе</h3>
            <div className="relative">
              <textarea value={report} onChange={e => setReport(e.target.value)} maxLength={LIMITS.report} placeholder="Опишите выполненную работу (необязательно)" rows={4} className="w-full max-input text-sm resize-none" />
              <div className="absolute right-2 bottom-2"><CharCounter value={report} max={LIMITS.report} /></div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowResolve(false)} className="flex-1 max-btn max-btn-secondary">Отмена</button>
              <button onClick={handleResolve} className="flex-1 max-btn max-btn-primary">Выполнить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ====== SETTINGS MODAL ======
function SettingsModal({ profile, onClose, onUpdate }: { profile: Profile; onClose: () => void; onUpdate: (p: Profile) => void }) {
  const [name, setName] = useState(profile.name);
  const [address, setAddress] = useState(profile.default_address || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateUser(profile.id, { name, default_address: address });
      onUpdate(updated);
      onClose();
    } catch {}
    setSaving(false);
  };

  const handleLogout = () => {
    clearUserId();
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">Настройки</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium block mb-1">Имя</label>
            <div className="relative">
              <input type="text" value={name} onChange={e => setName(e.target.value)} maxLength={LIMITS.name} className="w-full max-input text-sm" />
              <div className="absolute right-2 top-2"><CharCounter value={name} max={LIMITS.name} /></div>
            </div>
          </div>
          {profile.role === 'resident' && (
            <div>
              <label className="text-xs font-medium block mb-1">Адрес по умолчанию</label>
              <div className="relative">
                <input type="text" value={address} onChange={e => setAddress(e.target.value)} maxLength={LIMITS.address} className="w-full max-input text-sm" />
                <div className="absolute right-2 top-2"><CharCounter value={address} max={LIMITS.address} /></div>
              </div>
            </div>
          )}
          <div className="p-2 rounded-xl" style={{ background: 'var(--max-surface)' }}>
            <p className="text-xs" style={{ color: 'var(--max-text-secondary)' }}>Роль: {profile.role === 'resident' ? 'Житель' : 'Мастер'}</p>
            {profile.worker_type && <p className="text-xs" style={{ color: 'var(--max-text-secondary)' }}>Специальность: {WORKER_NAMES[profile.worker_type]}</p>}
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={handleLogout} className="max-btn max-btn-secondary flex-1"><LogOut className="w-3 h-3" /> Выйти</button>
          <button onClick={handleSave} disabled={saving} className="max-btn max-btn-primary flex-1">{saving ? '...' : 'Сохранить'}</button>
        </div>
      </div>
    </div>
  );
}

export default App;