import type { BiologicalSex, Micronutrients } from '../types';
import type { MicronutrientKey } from './micronutrients';

// Recommended Dietary Allowances / Adequate Intakes for adults, based on
// published NIH Office of Dietary Supplements RDA/AI tables. Values are per
// day. Where an RDA isn't established, the AI is used (e.g. manganese,
// omega-3/omega-6). These are population reference values, not medical
// advice — users can always override them.
interface RdaBand {
  minAge: number;
  maxAge: number;
  male: Record<MicronutrientKey, number>;
  female: Record<MicronutrientKey, number>;
}

const RDA_BANDS: RdaBand[] = [
  {
    minAge: 14,
    maxAge: 18,
    male: {
      calciumMg: 1300, phosphorusMg: 1250, ironMg: 11, zincMg: 11, copperMg: 0.89, manganeseMg: 2.2,
      iodineMcg: 150, seleniumMcg: 55, vitaminAMcg: 900, vitaminCMg: 75, vitaminDMcg: 15, vitaminEMg: 15,
      vitaminKMcg: 75, thiaminMg: 1.2, riboflavinMg: 1.3, niacinMg: 16, vitaminB6Mg: 1.3, folateMcg: 400,
      vitaminB12Mcg: 2.4, omega3G: 1.6, omega6G: 16,
    },
    female: {
      calciumMg: 1300, phosphorusMg: 1250, ironMg: 15, zincMg: 9, copperMg: 0.89, manganeseMg: 1.6,
      iodineMcg: 150, seleniumMcg: 55, vitaminAMcg: 700, vitaminCMg: 65, vitaminDMcg: 15, vitaminEMg: 15,
      vitaminKMcg: 75, thiaminMg: 1, riboflavinMg: 1, niacinMg: 14, vitaminB6Mg: 1.2, folateMcg: 400,
      vitaminB12Mcg: 2.4, omega3G: 1.1, omega6G: 11,
    },
  },
  {
    minAge: 19,
    maxAge: 30,
    male: {
      calciumMg: 1000, phosphorusMg: 700, ironMg: 8, zincMg: 11, copperMg: 0.9, manganeseMg: 2.3,
      iodineMcg: 150, seleniumMcg: 55, vitaminAMcg: 900, vitaminCMg: 90, vitaminDMcg: 15, vitaminEMg: 15,
      vitaminKMcg: 120, thiaminMg: 1.2, riboflavinMg: 1.3, niacinMg: 16, vitaminB6Mg: 1.3, folateMcg: 400,
      vitaminB12Mcg: 2.4, omega3G: 1.6, omega6G: 17,
    },
    female: {
      calciumMg: 1000, phosphorusMg: 700, ironMg: 18, zincMg: 8, copperMg: 0.9, manganeseMg: 1.8,
      iodineMcg: 150, seleniumMcg: 55, vitaminAMcg: 700, vitaminCMg: 75, vitaminDMcg: 15, vitaminEMg: 15,
      vitaminKMcg: 90, thiaminMg: 1.1, riboflavinMg: 1.1, niacinMg: 14, vitaminB6Mg: 1.3, folateMcg: 400,
      vitaminB12Mcg: 2.4, omega3G: 1.1, omega6G: 12,
    },
  },
  {
    minAge: 31,
    maxAge: 50,
    male: {
      calciumMg: 1000, phosphorusMg: 700, ironMg: 8, zincMg: 11, copperMg: 0.9, manganeseMg: 2.3,
      iodineMcg: 150, seleniumMcg: 55, vitaminAMcg: 900, vitaminCMg: 90, vitaminDMcg: 15, vitaminEMg: 15,
      vitaminKMcg: 120, thiaminMg: 1.2, riboflavinMg: 1.3, niacinMg: 16, vitaminB6Mg: 1.3, folateMcg: 400,
      vitaminB12Mcg: 2.4, omega3G: 1.6, omega6G: 17,
    },
    female: {
      calciumMg: 1000, phosphorusMg: 700, ironMg: 18, zincMg: 8, copperMg: 0.9, manganeseMg: 1.8,
      iodineMcg: 150, seleniumMcg: 55, vitaminAMcg: 700, vitaminCMg: 75, vitaminDMcg: 15, vitaminEMg: 15,
      vitaminKMcg: 90, thiaminMg: 1.1, riboflavinMg: 1.1, niacinMg: 14, vitaminB6Mg: 1.3, folateMcg: 400,
      vitaminB12Mcg: 2.4, omega3G: 1.1, omega6G: 12,
    },
  },
  {
    minAge: 51,
    maxAge: 70,
    male: {
      calciumMg: 1000, phosphorusMg: 700, ironMg: 8, zincMg: 11, copperMg: 0.9, manganeseMg: 2.3,
      iodineMcg: 150, seleniumMcg: 55, vitaminAMcg: 900, vitaminCMg: 90, vitaminDMcg: 15, vitaminEMg: 15,
      vitaminKMcg: 120, thiaminMg: 1.2, riboflavinMg: 1.3, niacinMg: 16, vitaminB6Mg: 1.7, folateMcg: 400,
      vitaminB12Mcg: 2.4, omega3G: 1.6, omega6G: 14,
    },
    female: {
      calciumMg: 1200, phosphorusMg: 700, ironMg: 8, zincMg: 8, copperMg: 0.9, manganeseMg: 1.8,
      iodineMcg: 150, seleniumMcg: 55, vitaminAMcg: 700, vitaminCMg: 75, vitaminDMcg: 15, vitaminEMg: 15,
      vitaminKMcg: 90, thiaminMg: 1.1, riboflavinMg: 1.1, niacinMg: 14, vitaminB6Mg: 1.5, folateMcg: 400,
      vitaminB12Mcg: 2.4, omega3G: 1.1, omega6G: 11,
    },
  },
  {
    minAge: 71,
    maxAge: 130,
    male: {
      calciumMg: 1200, phosphorusMg: 700, ironMg: 8, zincMg: 11, copperMg: 0.9, manganeseMg: 2.3,
      iodineMcg: 150, seleniumMcg: 55, vitaminAMcg: 900, vitaminCMg: 90, vitaminDMcg: 20, vitaminEMg: 15,
      vitaminKMcg: 120, thiaminMg: 1.2, riboflavinMg: 1.3, niacinMg: 16, vitaminB6Mg: 1.7, folateMcg: 400,
      vitaminB12Mcg: 2.4, omega3G: 1.6, omega6G: 14,
    },
    female: {
      calciumMg: 1200, phosphorusMg: 700, ironMg: 8, zincMg: 8, copperMg: 0.9, manganeseMg: 1.8,
      iodineMcg: 150, seleniumMcg: 55, vitaminAMcg: 700, vitaminCMg: 75, vitaminDMcg: 20, vitaminEMg: 15,
      vitaminKMcg: 90, thiaminMg: 1.1, riboflavinMg: 1.1, niacinMg: 14, vitaminB6Mg: 1.5, folateMcg: 400,
      vitaminB12Mcg: 2.4, omega3G: 1.1, omega6G: 11,
    },
  },
];

export function getRdaForAgeSex(age: number, sex: BiologicalSex): Micronutrients {
  const clampedAge = Number.isFinite(age) && age > 0 ? age : 30;
  const band = RDA_BANDS.find((b) => clampedAge >= b.minAge && clampedAge <= b.maxAge)
    ?? (clampedAge < RDA_BANDS[0].minAge ? RDA_BANDS[0] : RDA_BANDS[RDA_BANDS.length - 1]);
  return { ...band[sex] };
}
