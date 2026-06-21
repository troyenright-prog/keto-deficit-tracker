export const validPhotoEstimate = () => ({
  analysisId: 'analysis-1', createdAt: '2026-06-21T00:00:00.000Z', overallConfidence: 0.72,
  summaryName: 'Chicken and avocado plate', servingDescription: '1 plate',
  items: [{
    name: 'Chicken breast', portionEstimate: '150g', confidence: 0.8,
    calories: 250, protein: 45, fat: 6, totalCarbs: 0, fibre: 0,
    sugarAlcohols: 0, netCarbs: 0, sodium: 300, potassium: 500, magnesium: 40,
  }],
  totals: {
    calories: 410, protein: 48, fat: 22, totalCarbs: 12, fibre: 8,
    sugarAlcohols: 6, netCarbs: -2, sodium: 360, potassium: 950, magnesium: 75,
  },
  assumptions: ['Chicken appears grilled without breading.'],
  warnings: ['Oil and sauce quantities are not visible.'], needsUserReview: true,
});
