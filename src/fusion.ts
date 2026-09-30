// Fusion логика для объединения результатов text и vision анализа

import { getPriorityForSubcategory, SEVERITY_ORDER } from './taxonomy';

export interface FusionInput {
  textResult?: any;
  visionResult?: any;
  mode: 'TEXT_ONLY' | 'IMAGE_ONLY' | 'TEXT_AND_IMAGE';
}

export interface FusionOutput {
  classificationResult: 'KNOWN_INCIDENT' | 'NEEDS_CLARIFICATION' | 'NOT_INCIDENT';
  category: string | null;
  subcategory: string | null;
  severity: string | null;
  confidence: number;
  level: 'HIGH' | 'MEDIUM' | 'LOW';
  needsReview?: boolean;
}

export function fuse(input: FusionInput): FusionOutput {
  const { textResult, visionResult, mode } = input;

  // TEXT_ONLY
  if (mode === 'TEXT_ONLY') {
    if (!textResult || !textResult.category || textResult.confidence < 0.3) {
      return {
        classificationResult: 'NOT_INCIDENT',
        category: null,
        subcategory: null,
        severity: null,
        confidence: textResult?.confidence || 0,
        level: 'LOW'
      };
    }
    return {
      classificationResult: 'KNOWN_INCIDENT',
      category: textResult.category,
      subcategory: textResult.subcategory,
      severity: getPriorityForSubcategory(textResult.category, textResult.subcategory),
      confidence: textResult.confidence,
      level: 'HIGH'
    };
  }

  // IMAGE_ONLY
  if (mode === 'IMAGE_ONLY') {
    if (!visionResult || visionResult.classificationResult === 'NOT_INCIDENT') {
      return {
        classificationResult: 'NOT_INCIDENT',
        category: null,
        subcategory: null,
        severity: null,
        confidence: visionResult?.confidence || 0,
        level: 'LOW'
      };
    }
    return {
      classificationResult: 'NEEDS_CLARIFICATION',
      category: visionResult.category,
      subcategory: null,
      severity: visionResult.visualSeverity || getPriorityForSubcategory(visionResult.category, null),
      confidence: visionResult.confidence,
      level: 'MEDIUM'
    };
  }

  // TEXT_AND_IMAGE
  if (!textResult || !visionResult) {
    return {
      classificationResult: 'NOT_INCIDENT',
      category: null,
      subcategory: null,
      severity: null,
      confidence: 0,
      level: 'LOW'
    };
  }

  const txCat = textResult.category;
  const vCat = visionResult.category;
  const txCats = (textResult.top3 || []).map((t: any) => t.category).filter(Boolean);
  const vCats = (visionResult.top3 || []).map((t: any) => t.category).filter(Boolean);

  const avgConfidence = (textResult.confidence + visionResult.confidence) / 2;
  const visualSev = visionResult.visualSeverity;
  const textSev = getPriorityForSubcategory(txCat, textResult.subcategory);
  const maxSevIdx = Math.max(SEVERITY_ORDER.indexOf(textSev), SEVERITY_ORDER.indexOf(visualSev || 'MEDIUM'));
  const severity = SEVERITY_ORDER[maxSevIdx] || 'MEDIUM';

  // Rule 1: HIGH — top-1 совпадают
  if (txCat && vCat && txCat === vCat) {
    return {
      classificationResult: 'KNOWN_INCIDENT',
      category: txCat,
      subcategory: textResult.subcategory,
      severity,
      confidence: avgConfidence,
      level: 'HIGH'
    };
  }

  // Rule 2: MEDIUM — категория текста в top3 vision
  if (txCat && vCats.includes(txCat)) {
    return {
      classificationResult: 'KNOWN_INCIDENT',
      category: txCat,
      subcategory: textResult.subcategory,
      severity,
      confidence: avgConfidence,
      level: 'MEDIUM',
      needsReview: true
    };
  }

  // Rule 3: MEDIUM — категория vision в top3 текста
  if (vCat && txCats.includes(vCat)) {
    return {
      classificationResult: 'KNOWN_INCIDENT',
      category: vCat,
      subcategory: textResult.subcategory,
      severity,
      confidence: avgConfidence,
      level: 'MEDIUM',
      needsReview: true
    };
  }

  // Rule 4: LOW — нет пересечений
  return {
    classificationResult: 'NEEDS_CLARIFICATION',
    category: txCat || vCat,
    subcategory: textResult.subcategory,
    severity,
    confidence: avgConfidence,
    level: 'LOW'
  };
}
