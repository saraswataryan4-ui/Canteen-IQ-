import type {
  AssistantRecommendation,
  MenuItem,
  RecommendedBundleItem,
} from '../types';

export interface RawModelRecommendedItem {
  menuItemId?: string;
  id?: string;
  name?: string;
  item?: string;
  quantity?: number;
  qty?: number;
}

export interface ValidatedAssistantPayload {
  recommendation?: AssistantRecommendation;
  droppedInvalidItems: number;
  adjustedQuantities: number;
}

/**
 * Deterministic application-side validation of Gemma 4 model recommendations.
 * - Matches items strictly against the authoritative CanteenIQ menu catalog.
 * - Rejects unknown/hallucinated items and unavailable/out-of-stock items.
 * - Enforces positive integer quantities clamped to current available stock.
 * - Computes unit prices, line totals, and total cost exclusively from the app's menu data.
 */
export function validateModelRecommendations(
  rawItems: RawModelRecommendedItem[] | undefined | null,
  menuCatalog: Pick<
    MenuItem,
    'id' | 'name' | 'price' | 'prepMinutes' | 'stock' | 'isAvailable'
  >[],
  prepNoteFromModel?: string
): ValidatedAssistantPayload {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return {
      recommendation: undefined,
      droppedInvalidItems: 0,
      adjustedQuantities: 0,
    };
  }

  let droppedInvalidItems = 0;
  let adjustedQuantities = 0;
  const mergedQuantities = new Map<string, number>();

  for (const raw of rawItems) {
    if (!raw || typeof raw !== 'object') {
      droppedInvalidItems += 1;
      continue;
    }

    const rawId =
      typeof raw.menuItemId === 'string'
        ? raw.menuItemId
        : typeof raw.id === 'string'
        ? raw.id
        : '';
    const rawName =
      typeof raw.name === 'string'
        ? raw.name
        : typeof raw.item === 'string'
        ? raw.item
        : '';

    const candidateId = rawId.trim().toLowerCase();
    const candidateName = rawName.trim().toLowerCase();

    const matchedMenu = menuCatalog.find(
      (m) =>
        (candidateId && m.id.toLowerCase() === candidateId) ||
        (candidateName && m.name.toLowerCase() === candidateName) ||
        (candidateId && m.name.toLowerCase() === candidateId)
    );

    if (!matchedMenu) {
      droppedInvalidItems += 1;
      continue;
    }

    if (!matchedMenu.isAvailable || matchedMenu.stock <= 0) {
      droppedInvalidItems += 1;
      continue;
    }

    const rawQtyValue = raw.quantity ?? raw.qty;
    const parsedQty = Number(rawQtyValue);
    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      droppedInvalidItems += 1;
      continue;
    }

    const roundedQty = Math.floor(parsedQty);
    if (roundedQty !== parsedQty) {
      adjustedQuantities += 1;
    }

    const prevQty = mergedQuantities.get(matchedMenu.id) ?? 0;
    const desiredTotalQty = prevQty + Math.max(1, roundedQty);
    const maxAllowed = Math.min(matchedMenu.stock, 10);
    const clampedQty = Math.min(desiredTotalQty, maxAllowed);

    if (clampedQty < desiredTotalQty) {
      adjustedQuantities += 1;
    }

    if (clampedQty > 0) {
      mergedQuantities.set(matchedMenu.id, clampedQty);
    }
  }

  if (mergedQuantities.size === 0) {
    return {
      recommendation: undefined,
      droppedInvalidItems,
      adjustedQuantities,
    };
  }

  const validatedItems: RecommendedBundleItem[] = [];
  let totalCost = 0;
  let maxPrep = 0;
  let totalUnits = 0;
  let hasMissingPrep = false;

  for (const [menuItemId, quantity] of mergedQuantities.entries()) {
    const authoritativeItem = menuCatalog.find((m) => m.id === menuItemId);
    if (!authoritativeItem) continue;

    const unitPrice = authoritativeItem.price;
    const lineTotal = unitPrice * quantity;
    totalCost += lineTotal;
    totalUnits += quantity;

    const validPrep =
      typeof authoritativeItem.prepMinutes === 'number' &&
      Number.isFinite(authoritativeItem.prepMinutes) &&
      authoritativeItem.prepMinutes > 0
        ? authoritativeItem.prepMinutes
        : null;

    if (validPrep === null) {
      hasMissingPrep = true;
    } else if (validPrep > maxPrep) {
      maxPrep = validPrep;
    }

    validatedItems.push({
      menuItemId: authoritativeItem.id,
      name: authoritativeItem.name,
      unitPrice,
      quantity,
      lineTotal,
      stockAvailable: authoritativeItem.stock,
      estimatedPrepMinutes: validPrep,
    });
  }

  const estimatedPrepMinutes = hasMissingPrep
    ? null
    : maxPrep + Math.max(0, totalUnits - 1);

  const cleanPrepNote =
    typeof prepNoteFromModel === 'string' && prepNoteFromModel.trim().length > 0
      ? prepNoteFromModel.trim()
      : estimatedPrepMinutes !== null
      ? `Estimated prep time: ~${estimatedPrepMinutes} mins (sample menu estimate; verified prices & stock checked by CanteenIQ).`
      : 'Prep-time estimate is unverified for one or more items — please confirm timing at the counter.';

  return {
    recommendation: {
      items: validatedItems,
      totalCost,
      estimatedPrepMinutes,
      prepDisclaimer: cleanPrepNote,
    },
    droppedInvalidItems,
    adjustedQuantities,
  };
}
