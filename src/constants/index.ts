export const INCOME_CATEGORIES = [
  { value: 'SALARY', label: 'Salario' },
  { value: 'BUSINESS', label: 'Negocio' },
  { value: 'INVESTMENTS', label: 'Inversiones' },
  { value: 'FREELANCE', label: 'Freelance' },
  { value: 'OTHER', label: 'Otros' },
]

export const EXPENSE_CATEGORIES = [
  { value: 'HOUSING', label: 'Vivienda' },
  { value: 'FOOD', label: 'Alimentación' },
  { value: 'TRANSPORT', label: 'Transporte' },
  { value: 'UTILITIES', label: 'Servicios' },
  { value: 'ENTERTAINMENT', label: 'Entretenimiento' },
  { value: 'EDUCATION', label: 'Educación' },
  { value: 'HEALTH', label: 'Salud' },
  { value: 'DEBT', label: 'Deudas' },
  { value: 'OTHER', label: 'Otros' },
]

export const FREQUENCIES = [
  { value: 'ONCE', label: 'Única vez', monthlyFactor: 0 },
  { value: 'WEEKLY', label: 'Semanal', monthlyFactor: 52 / 12 },
  { value: 'BIWEEKLY', label: 'Quincenal', monthlyFactor: 26 / 12 },
  { value: 'MONTHLY', label: 'Mensual', monthlyFactor: 1 },
  { value: 'QUARTERLY', label: 'Trimestral', monthlyFactor: 1 / 3 },
  { value: 'YEARLY', label: 'Anual', monthlyFactor: 1 / 12 },
] as const

export const RISK_PROFILES = [
  { value: 'CONSERVATIVE', label: 'Conservador' },
  { value: 'MODERATE', label: 'Moderado' },
  { value: 'AGGRESSIVE', label: 'Agresivo' },
]

export const ASSET_TYPES = ['STOCK', 'ETF', 'FUND', 'BOND', 'CETES', 'REIT', 'CRYPTO', 'OTHER']
export const BROKER_TYPES = ['BROKER', 'BANK', 'EXCHANGE', 'GOVERNMENT', 'OTHER']
export const TRANSACTION_TYPES = ['BUY', 'SELL', 'DIVIDEND', 'INTEREST', 'FEE', 'DEPOSIT', 'WITHDRAWAL', 'SPLIT', 'TRANSFER']
export const CURRENCIES = ['MXN', 'USD', 'EUR', 'GBP', 'CAD', 'JPY']
export const PRIORITIES = [
  { value: 'LOW', label: 'Baja' },
  { value: 'MEDIUM', label: 'Media' },
  { value: 'HIGH', label: 'Alta' },
]

export const SCORING_MODEL_VERSION = 'quant-v1'
export const RECOMMENDATION_MODEL_VERSION = 'reco-v1'
