// Таксономия: 8 категорий, 25 подкатегорий

export interface Subcategory {
  id: string;
  name: string;
  workerType: string;
  priority: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  workerType: string;
  subcategories: Record<string, Subcategory>;
}

export const TAXONOMY: Record<string, Category> = {
  WATER_SUPPLY: {
    id: 'WATER_SUPPLY', name: 'Водоснабжение', icon: '💧', workerType: 'PLUMBER',
    subcategories: {
      PIPE_LEAK: { id: 'PIPE_LEAK', name: 'Протечка трубы', workerType: 'PLUMBER', priority: 'HIGH' },
      NO_WATER: { id: 'NO_WATER', name: 'Отсутствие воды', workerType: 'PLUMBER', priority: 'MEDIUM' },
      DIRTY_WATER: { id: 'DIRTY_WATER', name: 'Грязная вода', workerType: 'PLUMBER', priority: 'MEDIUM' },
      LOW_PRESSURE: { id: 'LOW_PRESSURE', name: 'Низкий напор', workerType: 'PLUMBER', priority: 'LOW' }
    }
  },
  ELECTRICITY: {
    id: 'ELECTRICITY', name: 'Электроснабжение', icon: '⚡', workerType: 'ELECTRICIAN',
    subcategories: {
      NO_LIGHT_STAIRWELL: { id: 'NO_LIGHT_STAIRWELL', name: 'Нет света на лестнице', workerType: 'ELECTRICIAN', priority: 'MEDIUM' },
      EXPOSED_WIRES: { id: 'EXPOSED_WIRES', name: 'Оголённые провода', workerType: 'ELECTRICIAN', priority: 'CRITICAL' },
      ELECTRICAL_PANEL: { id: 'ELECTRICAL_PANEL', name: 'Проблема с электрощитом', workerType: 'ELECTRICIAN', priority: 'HIGH' }
    }
  },
  HEATING: {
    id: 'HEATING', name: 'Отопление', icon: '🔥', workerType: 'PLUMBER',
    subcategories: {
      NO_HEATING: { id: 'NO_HEATING', name: 'Нет отопления', workerType: 'PLUMBER', priority: 'HIGH' },
      RADIATOR_LEAK: { id: 'RADIATOR_LEAK', name: 'Протечка батареи', workerType: 'PLUMBER', priority: 'HIGH' },
      LOW_TEMPERATURE: { id: 'LOW_TEMPERATURE', name: 'Низкая температура', workerType: 'PLUMBER', priority: 'MEDIUM' }
    }
  },
  CLEANING: {
    id: 'CLEANING', name: 'Уборка', icon: '🧹', workerType: 'CLEANER',
    subcategories: {
      DIRTY_STAIRWELL: { id: 'DIRTY_STAIRWELL', name: 'Грязный подъезд', workerType: 'CLEANER', priority: 'LOW' },
      DIRTY_ENTRANCE: { id: 'DIRTY_ENTRANCE', name: 'Грязь у входа', workerType: 'CLEANER', priority: 'LOW' },
      TRASH_OVERFLOW: { id: 'TRASH_OVERFLOW', name: 'Переполнены мусорные баки', workerType: 'CLEANER', priority: 'MEDIUM' }
    }
  },
  YARD: {
    id: 'YARD', name: 'Двор', icon: '🌳', workerType: 'LANDSCAPER',
    subcategories: {
      FALLEN_TREE: { id: 'FALLEN_TREE', name: 'Упавшее дерево', workerType: 'LANDSCAPER', priority: 'HIGH' },
      DAMAGED_BENCH: { id: 'DAMAGED_BENCH', name: 'Повреждена лавочка', workerType: 'MAINTENANCE', priority: 'LOW' },
      DAMAGED_PLAYGROUND: { id: 'DAMAGED_PLAYGROUND', name: 'Повреждена детская площадка', workerType: 'MAINTENANCE', priority: 'HIGH' },
      ROAD_DAMAGE: { id: 'ROAD_DAMAGE', name: 'Повреждено дорожное покрытие', workerType: 'MAINTENANCE', priority: 'MEDIUM' }
    }
  },
  DOOR: {
    id: 'DOOR', name: 'Двери и замки', icon: '🚪', workerType: 'LOCKSMITH',
    subcategories: {
      BROKEN_ENTRY_DOOR: { id: 'BROKEN_ENTRY_DOOR', name: 'Сломана входная дверь', workerType: 'LOCKSMITH', priority: 'MEDIUM' },
      BROKEN_LOCK: { id: 'BROKEN_LOCK', name: 'Сломан замок', workerType: 'LOCKSMITH', priority: 'MEDIUM' },
      BROKEN_INTERCOM: { id: 'BROKEN_INTERCOM', name: 'Не работает домофон', workerType: 'ELECTRICIAN', priority: 'LOW' }
    }
  },
  ELEVATOR: {
    id: 'ELEVATOR', name: 'Лифт', icon: '🛗', workerType: 'UNIVERSAL',
    subcategories: {
      ELEVATOR_NOT_WORKING: { id: 'ELEVATOR_NOT_WORKING', name: 'Лифт не работает', workerType: 'UNIVERSAL', priority: 'HIGH' },
      ELEVATOR_NOISE: { id: 'ELEVATOR_NOISE', name: 'Шум и стуки в лифте', workerType: 'UNIVERSAL', priority: 'MEDIUM' }
    }
  },
  ROOF: {
    id: 'ROOF', name: 'Крыша', icon: '🏠', workerType: 'MAINTENANCE',
    subcategories: {
      ROOF_LEAK: { id: 'ROOF_LEAK', name: 'Протечка крыши', workerType: 'MAINTENANCE', priority: 'HIGH' },
      DAMAGED_ROOF: { id: 'DAMAGED_ROOF', name: 'Повреждена кровля', workerType: 'MAINTENANCE', priority: 'MEDIUM' }
    }
  }
};

export const WORKER_NAMES: Record<string, string> = {
  PLUMBER: 'Сантехник',
  ELECTRICIAN: 'Электрик',
  CLEANER: 'Уборщик',
  LOCKSMITH: 'Слесарь',
  LANDSCAPER: 'Специалист по благоустройству',
  MAINTENANCE: 'Специалист по обслуживанию',
  UNIVERSAL: 'Универсальный мастер'
};

export const SEVERITY_LABELS: Record<string, string> = {
  LOW: 'Низкий',
  MEDIUM: 'Средний',
  HIGH: 'Высокий',
  CRITICAL: 'Критический'
};

export const SEVERITY_ORDER = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: 'Ожидает мастера',
  ASSIGNED: 'В работе',
  RESOLVED: 'Выполнена',
  CANCELLED: 'Отменена'
};

export function getCategory(id: string): Category | undefined {
  return TAXONOMY[id];
}

export function getSubcategory(categoryId: string, subcategoryId: string): Subcategory | undefined {
  return TAXONOMY[categoryId]?.subcategories[subcategoryId];
}

export function getWorkerTypeForCategory(categoryId: string | null, subcategoryId: string | null): string {
  if (!categoryId) return 'UNIVERSAL';
  const cat = TAXONOMY[categoryId];
  if (!cat) return 'UNIVERSAL';
  if (subcategoryId && cat.subcategories[subcategoryId]) {
    return cat.subcategories[subcategoryId].workerType;
  }
  return cat.workerType;
}

export function getPriorityForSubcategory(categoryId: string | null, subcategoryId: string | null): string {
  if (!categoryId) return 'MEDIUM';
  const cat = TAXONOMY[categoryId];
  if (!cat) return 'MEDIUM';
  if (subcategoryId && cat.subcategories[subcategoryId]) {
    return cat.subcategories[subcategoryId].priority;
  }
  return 'MEDIUM';
}
