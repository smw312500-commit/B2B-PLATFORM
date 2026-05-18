import productionTerms from "../data/production_terms2.json";
import productionConfig from "../data/production_config2.json";

export const PRODUCTION_TERMS = productionTerms;
export const PRODUCTION_CONFIG = productionConfig;

const WORK_TYPE_TO_PROCESS_KEY = {
  컨버팅: "converting",
  "스티커 컨버팅": "sticker_converting",
};

const WORK_TYPE_TO_PRODUCT_LABEL = {
  컨버팅: "케어라벨",
  "스티커 컨버팅": "스티커라벨",
};

const PROCESS_OUTPUT_KEY = {
  converting: "converting_roll",
  sticker_converting: "sticker_converting_roll",
};

const PROCESS_KEY_TO_PRODUCT_TYPE = {
  converting: "CARE_LABEL",
  sticker_converting: "STICKER_LABEL",
};

const RAW_MATERIAL_LABEL_BY_KEY = {
  fabric: productionTerms.raw_materials.fabric.label_ko,
  chip: productionTerms.raw_materials.chip.label_ko,
  sticker_paper: productionTerms.raw_materials.sticker_paper.label_ko,
};

export const FIRST_PROCESS_TYPE_OPTIONS = Object.values(
  productionTerms.first_process,
).map((process) => process.label_ko);

export function getProcessKeyFromWorkType(workTypeLabel) {
  return WORK_TYPE_TO_PROCESS_KEY[workTypeLabel] ?? null;
}

export function getProducedUnitsForWorkItem(workTypeLabel, rollQty) {
  const processKey = getProcessKeyFromWorkType(workTypeLabel);

  if (!processKey || !Number.isFinite(rollQty) || rollQty <= 0) {
    return 0;
  }

  const outputKey = PROCESS_OUTPUT_KEY[processKey];
  const unitsPerRoll = productionConfig.material_capacity_per_roll[outputKey] ?? 0;
  return rollQty * unitsPerRoll;
}

export function getRawMaterialUsageForWorkItem(workTypeLabel, rollQty) {
  const processKey = getProcessKeyFromWorkType(workTypeLabel);
  const usagePerRoll = productionConfig.raw_material_usage_per_roll?.[processKey];

  if (!processKey || !usagePerRoll || !Number.isFinite(rollQty) || rollQty <= 0) {
    return {
      원단: 0,
      칩: 0,
      스티커지: 0,
    };
  }

  const result = {
    원단: 0,
    칩: 0,
    스티커지: 0,
  };

  Object.entries(usagePerRoll).forEach(([materialKey, amountPerRoll]) => {
    const label = RAW_MATERIAL_LABEL_BY_KEY[materialKey];
    if (!label) {
      return;
    }

    result[label] += amountPerRoll * rollQty;
  });

  return result;
}

export function summarizeCompletedUnitsByProductType(workInventory) {
  return workInventory.reduce(
    (summary, item) => {
      const processKey = getProcessKeyFromWorkType(item.type);
      const productType = PROCESS_KEY_TO_PRODUCT_TYPE[processKey];
      if (!productType) {
        return summary;
      }

      summary[productType] =
        (summary[productType] ?? 0) +
        getProducedUnitsForWorkItem(item.type, item.qty);
      return summary;
    },
    {
      케어라벨: 0,
      스티커라벨: 0,
    },
  );
}
