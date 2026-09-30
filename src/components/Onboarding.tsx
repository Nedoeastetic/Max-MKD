import { useState } from 'react';
import { createUser } from '../api';
import { setUserId } from '../session';
import { LIMITS, CharCounter } from '../limits';
import { WORKER_NAMES } from '../taxonomy';

interface Props {
  onComplete: (userId: string) => void;
}

export function Onboarding({ onComplete }: Props) {
  const [step, setStep] = useState<'role' | 'name' | 'specialty' | 'address'>('role');
  const [role, setRole] = useState<'resident' | 'master' | null>(null);
  const [name, setName] = useState('');
  const [workerType, setWorkerType] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRoleSelect = (r: 'resident' | 'master') => {
    setRole(r);
    setStep('name');
  };

  const handleNameSubmit = () => {
    if (name.length < 1 || name.length > LIMITS.name) {
      setError(`Имя должно быть от 1 до ${LIMITS.name} символов`);
      return;
    }
    setError('');
    setStep(role === 'master' ? 'specialty' : 'address');
  };

  const handleSpecialtySelect = (wt: string) => {
    setWorkerType(wt);
    handleCreate('master', wt);
  };

  const handleAddressSubmit = (skip: boolean) => {
    handleCreate('resident', undefined, skip ? undefined : address);
  };

  const handleCreate = async (r: string, wt?: string, addr?: string) => {
    setLoading(true);
    setError('');
    try {
      const user = await createUser({
        role: r,
        name,
        worker_type: wt,
        default_address: addr
      });
      setUserId(user.id);
      onComplete(user.id);
    } catch (e: any) {
      setError(e.message || 'Ошибка создания профиля');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex items-center justify-center p-4" style={{ background: 'var(--max-surface)' }}>
      <div className="max-w-md w-full">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--max-primary)' }}>
            <span className="text-white text-2xl font-bold">АД</span>
          </div>
          <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--max-text-primary)' }}>
            Аварийный диспетчер МКД
          </h1>
          <p className="text-sm" style={{ color: 'var(--max-text-secondary)' }}>
            {step === 'role' && 'Выберите вашу роль'}
            {step === 'name' && 'Как вас зовут?'}
            {step === 'specialty' && 'Выберите специальность'}
            {step === 'address' && 'Укажите адрес по умолчанию'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl text-sm" style={{ background: '#FFE6E6', color: 'var(--max-error)' }}>
            {error}
          </div>
        )}

        {step === 'role' && (
          <div className="space-y-3">
            <button onClick={() => handleRoleSelect('resident')} className="w-full p-4 rounded-2xl border-2 transition-all hover:scale-[1.02]" style={{ background: 'var(--max-background)', borderColor: 'var(--max-border)' }}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'var(--max-primary-light)' }}>
                  <span className="text-2xl">👤</span>
                </div>
                <div className="text-left">
                  <h3 className="font-semibold" style={{ color: 'var(--max-text-primary)' }}>Житель</h3>
                  <p className="text-xs" style={{ color: 'var(--max-text-secondary)' }}>Отправлять обращения о проблемах</p>
                </div>
              </div>
            </button>
            <button onClick={() => handleRoleSelect('master')} className="w-full p-4 rounded-2xl border-2 transition-all hover:scale-[1.02]" style={{ background: 'var(--max-background)', borderColor: 'var(--max-border)' }}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: '#FFF4E6' }}>
                  <span className="text-2xl">🔧</span>
                </div>
                <div className="text-left">
                  <h3 className="font-semibold" style={{ color: 'var(--max-text-primary)' }}>Мастер</h3>
                  <p className="text-xs" style={{ color: 'var(--max-text-secondary)' }}>Выполнять заявки жителей</p>
                </div>
              </div>
            </button>
          </div>
        )}

        {step === 'name' && (
          <div className="space-y-3">
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={LIMITS.name}
                placeholder="Ваше имя"
                className="w-full px-4 py-3 rounded-xl border text-sm"
                style={{ borderColor: 'var(--max-border)', background: 'var(--max-background)', paddingRight: '3.5rem' }}
                autoFocus
              />
              <div className="absolute right-3 top-3">
                <CharCounter value={name} max={LIMITS.name} />
              </div>
            </div>
            <button onClick={handleNameSubmit} disabled={loading} className="w-full max-btn max-btn-primary py-3">
              {loading ? '...' : 'Далее'}
            </button>
            <button onClick={() => setStep('role')} className="w-full text-sm text-center" style={{ color: 'var(--max-text-secondary)' }}>
              ← Назад
            </button>
          </div>
        )}

        {step === 'specialty' && (
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(WORKER_NAMES).map(([key, label]) => (
              <button
                key={key}
                onClick={() => handleSpecialtySelect(key)}
                disabled={loading}
                className="p-3 rounded-xl border text-sm font-medium transition-all hover:scale-[1.02]"
                style={{ background: 'var(--max-background)', borderColor: 'var(--max-border)' }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {step === 'address' && (
          <div className="space-y-3">
            <div className="relative">
              <input
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                maxLength={LIMITS.address}
                placeholder="ул. Примерная, д. 1"
                className="w-full px-4 py-3 rounded-xl border text-sm"
                style={{ borderColor: 'var(--max-border)', background: 'var(--max-background)', paddingRight: '3.5rem' }}
                autoFocus
              />
              <div className="absolute right-3 top-3">
                <CharCounter value={address} max={LIMITS.address} />
              </div>
            </div>
            <button onClick={() => handleAddressSubmit(false)} disabled={loading || !address} className="w-full max-btn max-btn-primary py-3">
              {loading ? '...' : 'Сохранить'}
            </button>
            <button onClick={() => handleAddressSubmit(true)} disabled={loading} className="w-full max-btn max-btn-secondary py-3">
              Пропустить
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
