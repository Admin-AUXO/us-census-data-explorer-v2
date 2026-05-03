const METRIC_META = {
  population_density: { label: 'Population Density', category: 'market_size', format: 'number' },
  housing_density: { label: 'Housing Density', category: 'housing_market', format: 'number' },
  prosperity_index: { label: 'Prosperity Index', category: 'executive_signal', format: 'score' },
  affluence_index: { label: 'Affluence Index', category: 'purchasing_power', format: 'score' },
  market_momentum_index: { label: 'Market Momentum', category: 'composite_scores', format: 'score' },
  cost_pressure_index: { label: 'Cost Pressure', category: 'risk', format: 'score' },
  talent_depth_index: { label: 'Talent Depth', category: 'workforce', format: 'score' },
  executive_growth_score: { label: 'Executive Growth Score', category: 'composite_scores', format: 'score' },
  consumer_demand_index: { label: 'Consumer Demand', category: 'purchasing_power', format: 'score' },
  senior_services_index: { label: 'Senior Services Index', category: 'healthcare', format: 'score' },
  logistics_access_index: { label: 'Logistics Access', category: 'operational_readiness', format: 'score' }
}

const LEGACY_FIELD_MAP = {
  rental_yield: 'gross_rental_yield',
  computer_access_pct: 'computer_access_rate',
  broadband_access_pct: 'broadband_access_rate',
  vehicle_availability_pct: 'vehicle_availability_rate',
  private_insurance_pct: 'private_insurance_rate',
  public_insurance_pct: 'public_insurance_rate',
  no_vehicle_pct: 'no_vehicle_rate'
}

const GEO_FIELDS = new Set([
  'state',
  'state_name',
  'state_fips',
  'state_abbr',
  'county',
  'county_name',
  'county_fips',
  'zcta5',
  'NAME',
  'land_area_sq_km',
  'water_area_sq_km',
  'census_region',
  'census_division',
  'urban_rural',
  'urban_area_name',
  'cbsa_code',
  'aiannh_name',
  'congressional_district',
  'cd116'
])

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value))

const round = (value, digits = 2) => {
  if (!Number.isFinite(value)) return null
  return Number(value.toFixed(digits))
}

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null
  const numeric = Number.parseFloat(value)
  return Number.isFinite(numeric) ? numeric : null
}

const normalize = (value, min, max) => {
  if (!Number.isFinite(value) || max <= min) return null
  return clamp(((value - min) / (max - min)) * 100)
}

const logNormalize = (value, min, max) => {
  if (!Number.isFinite(value) || value <= 0 || max <= min) return null
  return normalize(Math.log(value), Math.log(min), Math.log(max))
}

const averageDefined = (values) => {
  const valid = values.filter((value) => Number.isFinite(value))
  if (!valid.length) return null
  return valid.reduce((sum, value) => sum + value, 0) / valid.length
}

const getYearKeys = (row) => {
  const years = new Set()
  Object.keys(row || {}).forEach((key) => {
    const match = key.match(/_(\d{4})$/)
    if (match) {
      years.add(match[1])
    }
  })
  return [...years].sort()
}

const getMetric = (row, key, year) => toNumber(row[`${key}_${year}`])
const getFirstMetric = (row, year, keys) => {
  for (const key of keys) {
    const value = getMetric(row, key, year)
    if (value !== null) return value
  }
  return null
}

const setMetric = (row, key, year, value, digits = 2) => {
  const rounded = round(value, digits)
  if (rounded !== null) {
    row[`${key}_${year}`] = rounded
  }
}

const DISTRIBUTION_SCORE_METRICS = [
  'prosperity_index',
  'affluence_index',
  'market_momentum_index',
  'cost_pressure_index',
  'talent_depth_index',
  'executive_growth_score',
  'consumer_demand_index',
  'senior_services_index',
  'logistics_access_index',
  'housing_affordability_index',
  'market_opportunity_score'
]

const applyBellCurveScores = (rows) => {
  const years = [...new Set(rows.flatMap(getYearKeys))].sort()

  DISTRIBUTION_SCORE_METRICS.forEach((metric) => {
    years.forEach((year) => {
      const key = `${metric}_${year}`
      const values = rows
        .map((row) => toNumber(row[key]))
        .filter(Number.isFinite)
        .sort((left, right) => left - right)

      if (values.length < 5) return

      const mean = values.reduce((sum, value) => sum + value, 0) / values.length
      const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length
      const stdev = Math.sqrt(variance) || 1
      const percentileByValue = new Map()

      for (let index = 0; index < values.length; index += 1) {
        const value = values[index]
        let lastIndex = index
        while (lastIndex + 1 < values.length && values[lastIndex + 1] === value) {
          lastIndex += 1
        }
        percentileByValue.set(value, ((index + lastIndex + 2) / 2) / values.length)
        index = lastIndex
      }

      rows.forEach((row) => {
        const value = toNumber(row[key])
        if (!Number.isFinite(value)) return
        const percentile = percentileByValue.get(value) || 0.5
        const zScore = (value - mean) / stdev
        const shapedScore = (50 + (zScore * 13)) * 0.72 + (percentile * 100) * 0.28
        setMetric(row, metric, year, clamp(shapedScore, 5, 95), 1)
      })
    })
  })

  return rows
}

export const enrichRowsWithExecutiveMetrics = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) return rows

  const enrichedRows = rows.map((sourceRow) => {
    const row = { ...sourceRow }
    const area = toNumber(row.land_area_sq_km)
    const years = getYearKeys(row)

    years.forEach((year) => {
      const population = getMetric(row, 'total_population', year)
      const housingUnits = getMetric(row, 'total_housing_units', year)
      const medianIncome = getMetric(row, 'median_household_income', year)
      const perCapitaIncome = getMetric(row, 'per_capita_income', year)
      const ownerOccupied = getFirstMetric(row, year, ['owner_occupied'])
      const renterOccupied = getFirstMetric(row, year, ['renter_occupied'])
      const vacantUnits = getFirstMetric(row, year, ['vacant_housing_units', 'vacant_units'])
      const medianHomeValue = getMetric(row, 'median_home_value', year)
      const medianRent = getMetric(row, 'median_gross_rent', year)
      const unitsMortgaged = getFirstMetric(row, year, ['units_mortgaged', 'mortgaged'])
      const unitsFreeClear = getFirstMetric(row, year, ['units_free_clear', 'free_clear'])
      const laborForceCount = getMetric(row, 'in_labor_force', year)
      const employedCount = getMetric(row, 'employed', year)
      const unemployedCount = getMetric(row, 'unemployed', year)
      const pop25Plus = getMetric(row, 'total_pop_25plus', year)
      const bachelors = getFirstMetric(row, year, ['education_bachelors', 'bachelors_degree'])
      const masters = getMetric(row, 'education_masters', year)
      const professional = getMetric(row, 'education_professional', year)
      const doctorate = getMetric(row, 'education_doctorate', year)
      const hsDiploma = getMetric(row, 'education_hs_diploma', year)
      const someCollege = getFirstMetric(row, year, ['education_some_college', 'education_associates', 'education_associates2'])
      const povertyCount = getMetric(row, 'below_poverty_line', year)
      const computerHouseholds = getMetric(row, 'computer_households', year)
      const computerDesktop = getMetric(row, 'computer_desktop', year)
      const computerLaptop = getMetric(row, 'computer_laptop', year)
      const computerSmartphone = getMetric(row, 'computer_smartphone', year)
      const internetHouseholds = getMetric(row, 'internet_households', year)
      const internetBroadband = getMetric(row, 'internet_broadband', year)
      const internetCellular = getMetric(row, 'internet_cellular', year)
      const internetNone = getMetric(row, 'internet_none', year)
      const vehicleHouseholds = getMetric(row, 'vehicle_households', year)
      const noVehicleHouseholds = getFirstMetric(row, year, ['vehicle_0'])
      const insuredPopulation = getFirstMetric(row, year, ['health_insurance_total', 'insured'])
      const privateInsurance = getMetric(row, 'private_insurance', year)
      const publicInsuranceCount = getMetric(row, 'public_insurance', year)
      const pop65plus = (getMetric(row, 'pop_65plus_male', year) || 0) + (getMetric(row, 'pop_65plus_female', year) || 0)
      const workFromHome = getMetric(row, 'work_from_home_rate', year)

      if (housingUnits !== null && housingUnits > 0) {
        setMetric(row, 'homeownership_rate', year, (ownerOccupied || 0) / housingUnits, 4)
        setMetric(row, 'renter_rate', year, (renterOccupied || 0) / housingUnits, 4)
        setMetric(row, 'housing_vacancy_rate', year, (vacantUnits || 0) / housingUnits, 4)
      }

      if (ownerOccupied !== null && ownerOccupied > 0) {
        setMetric(row, 'mortgaged_rate', year, (unitsMortgaged || 0) / ownerOccupied, 4)
        setMetric(row, 'free_clear_rate', year, (unitsFreeClear || 0) / ownerOccupied, 4)
      }

      if (medianIncome !== null && medianIncome > 0) {
        if (medianHomeValue !== null && medianHomeValue > 0) {
          setMetric(row, 'price_to_income_ratio', year, medianHomeValue / medianIncome, 2)
        }
        if (medianRent !== null && medianRent > 0) {
          const annualRent = medianRent * 12
          setMetric(row, 'rent_burden', year, annualRent / medianIncome, 4)
          setMetric(row, 'consumer_spending_power', year, Math.max(0, medianIncome - annualRent), 0)
        }
      }

      if (medianHomeValue !== null && medianHomeValue > 0 && medianRent !== null && medianRent > 0) {
        setMetric(row, 'gross_rental_yield', year, ((medianRent * 12) / medianHomeValue) * 100, 2)
      }

      if (laborForceCount !== null && laborForceCount > 0) {
        setMetric(row, 'unemployment_rate', year, (unemployedCount || 0) / laborForceCount, 4)
        setMetric(row, 'employment_rate', year, (employedCount || 0) / laborForceCount, 4)
      }

      if (population !== null && population > 0) {
        if (laborForceCount !== null) {
          setMetric(row, 'labor_force_participation', year, laborForceCount / population, 4)
        }
        if (povertyCount !== null) {
          setMetric(row, 'poverty_rate', year, povertyCount / population, 4)
        }
        if (insuredPopulation !== null) {
          setMetric(row, 'insured_rate', year, insuredPopulation / population, 4)
        }
        if (pop65plus > 0) {
          setMetric(row, 'population_65plus_pct', year, pop65plus / population, 4)
        }
      }

      if (pop25Plus !== null && pop25Plus > 0) {
        const mastersPlus = (masters || 0) + (professional || 0) + (doctorate || 0)
        const collegeEducated = (bachelors || 0) + mastersPlus
        setMetric(row, 'bachelors_degree_rate', year, (bachelors || 0) / pop25Plus, 4)
        setMetric(row, 'masters_plus_rate', year, mastersPlus / pop25Plus, 4)
        setMetric(row, 'college_educated_rate', year, collegeEducated / pop25Plus, 4)
        setMetric(row, 'hs_graduation_rate', year, ((hsDiploma || 0) + (someCollege || 0) + (bachelors || 0) + mastersPlus) / pop25Plus, 4)
      }

      if (computerHouseholds !== null && computerHouseholds > 0) {
        const computerAccess = (computerDesktop || 0) + (computerLaptop || 0) + (computerSmartphone || 0)
        setMetric(row, 'computer_access_rate', year, computerAccess / computerHouseholds, 4)
        setMetric(row, 'smartphone_access_rate', year, (computerSmartphone || 0) / computerHouseholds, 4)
      }

      if (internetHouseholds !== null && internetHouseholds > 0) {
        setMetric(row, 'broadband_access_rate', year, (internetBroadband || 0) / internetHouseholds, 4)
        setMetric(row, 'cellular_internet_rate', year, (internetCellular || 0) / internetHouseholds, 4)
        setMetric(row, 'no_internet_rate', year, (internetNone || 0) / internetHouseholds, 4)
        const computerAccessRate = getMetric(row, 'computer_access_rate', year)
        const broadbandAccessRate = getMetric(row, 'broadband_access_rate', year)
        if (computerAccessRate !== null || broadbandAccessRate !== null) {
          const digitalAccessScore = ((computerAccessRate || 0.5) * 0.4 + (broadbandAccessRate || 0.5) * 0.6) * 100
          setMetric(row, 'digital_access_score', year, digitalAccessScore, 1)
        }
      }

      if (vehicleHouseholds !== null && vehicleHouseholds > 0) {
        setMetric(row, 'vehicle_availability_rate', year, (vehicleHouseholds - (noVehicleHouseholds || 0)) / vehicleHouseholds, 4)
        setMetric(row, 'no_vehicle_rate', year, (noVehicleHouseholds || 0) / vehicleHouseholds, 4)
      }

      if (insuredPopulation !== null && insuredPopulation > 0) {
        if (privateInsurance !== null) {
          setMetric(row, 'private_insurance_rate', year, privateInsurance / insuredPopulation, 4)
        }
        if (publicInsuranceCount !== null) {
          setMetric(row, 'public_insurance_rate', year, publicInsuranceCount / insuredPopulation, 4)
        }
      }

      const employmentRate = getMetric(row, 'employment_rate', year)
      const laborForce = getMetric(row, 'labor_force_participation', year)
      const povertyRate = getMetric(row, 'poverty_rate', year)
      const collegeRate = getMetric(row, 'college_educated_rate', year)
      const digitalScore = getMetric(row, 'digital_access_score', year)
      const publicInsurance = getMetric(row, 'public_insurance_rate', year)
      const vehicleAvailability = getMetric(row, 'vehicle_availability_rate', year)
      const broadbandRate = getMetric(row, 'broadband_access_rate', year)
      const affluentShare = getMetric(row, 'affluent_hh_pct', year)
      const rentBurden = getMetric(row, 'rent_burden', year)
      const priceIncomeRatio = getMetric(row, 'price_to_income_ratio', year)
      const elderlyShare = getMetric(row, 'population_65plus_pct', year)
      const gini = getMetric(row, 'gini_index', year)
      const ownershipAffordability = priceIncomeRatio !== null ? 100 - clamp((priceIncomeRatio / 8) * 100) : null
      const rentalAffordability = rentBurden !== null ? 100 - clamp((rentBurden / 0.36) * 100) : null
      setMetric(row, 'housing_affordability_index', year, averageDefined([ownershipAffordability, rentalAffordability]), 1)

      const marketOpportunityScore = (
        (normalize(medianIncome, 45000, 130000) ?? 45) * 0.26 +
        (logNormalize(population, 50000, 10000000) ?? 45) * 0.22 +
        (digitalScore ?? 50) * 0.14 +
        ((collegeRate !== null ? collegeRate * 100 : 32)) * 0.16 +
        ((employmentRate !== null ? employmentRate * 100 : 94)) * 0.12 +
        ((renterOccupied !== null && housingUnits ? (renterOccupied / housingUnits) * 100 : 32)) * 0.10
      )
      setMetric(row, 'market_opportunity_score', year, marketOpportunityScore, 1)

      const resilienceScore = (
        (employmentRate !== null ? employmentRate * 100 : 95) * 0.35 +
        (laborForce !== null ? laborForce * 100 : 65) * 0.25 +
        ((povertyRate !== null ? 1 - povertyRate : 0.85) * 100) * 0.25 +
        ((100 - ((gini || 0.41) * 100))) * 0.15
      )
      setMetric(row, 'economic_resilience_score', year, clamp(resilienceScore), 1)

      const opportunityScore = getMetric(row, 'market_opportunity_score', year)
      const resilienceScoreMetric = getMetric(row, 'economic_resilience_score', year)
      const affordabilityScore = getMetric(row, 'housing_affordability_index', year)
      const spendingPower = getMetric(row, 'consumer_spending_power', year)

      if (population !== null && area && area > 0) {
        setMetric(row, 'population_density', year, population / area)
      }

      if (housingUnits !== null && area && area > 0) {
        setMetric(row, 'housing_density', year, housingUnits / area)
      }

      const prosperityIndex = averageDefined([
        normalize(medianIncome, 35000, 140000),
        normalize(perCapitaIncome, 18000, 80000),
        employmentRate !== null ? employmentRate * 100 : null,
        povertyRate !== null ? (1 - povertyRate) * 100 : null
      ])
      setMetric(row, 'prosperity_index', year, prosperityIndex, 1)

      const affluenceIndex = averageDefined([
        normalize(medianIncome, 40000, 160000),
        normalize(perCapitaIncome, 20000, 90000),
        affluentShare !== null ? affluentShare * 100 : null
      ])
      setMetric(row, 'affluence_index', year, affluenceIndex, 1)

      const marketMomentumIndex = averageDefined([opportunityScore, resilienceScoreMetric, digitalScore])
      setMetric(row, 'market_momentum_index', year, marketMomentumIndex, 1)

      const costPressureIndex = averageDefined([
        priceIncomeRatio !== null ? clamp((priceIncomeRatio / 12) * 100) : null,
        rentBurden !== null ? clamp(rentBurden * 100 * 2.2) : null,
        affordabilityScore !== null ? 100 - affordabilityScore : null
      ])
      setMetric(row, 'cost_pressure_index', year, costPressureIndex, 1)

      const talentDepthIndex = averageDefined([
        collegeRate !== null ? collegeRate * 100 : null,
        laborForce !== null ? laborForce * 100 : null,
        employmentRate !== null ? employmentRate * 100 : null
      ])
      setMetric(row, 'talent_depth_index', year, talentDepthIndex, 1)

      const executiveGrowthScore = averageDefined([
        prosperityIndex,
        marketMomentumIndex,
        talentDepthIndex,
        costPressureIndex !== null ? 100 - costPressureIndex : null
      ])
      setMetric(row, 'executive_growth_score', year, executiveGrowthScore, 1)

      const consumerDemandIndex = averageDefined([
        normalize(medianIncome, 45000, 150000),
        normalize(spendingPower, 25000, 100000),
        digitalScore,
        logNormalize(population, 25000, 10000000),
        housingUnits !== null ? logNormalize(housingUnits, 10000, 4500000) : null
      ])
      setMetric(row, 'consumer_demand_index', year, consumerDemandIndex, 1)

      const seniorServicesIndex = averageDefined([
        elderlyShare !== null ? elderlyShare * 100 : null,
        publicInsurance !== null ? publicInsurance * 100 : null,
        resilienceScoreMetric
      ])
      setMetric(row, 'senior_services_index', year, seniorServicesIndex, 1)

      const logisticsAccessIndex = averageDefined([
        vehicleAvailability !== null ? vehicleAvailability * 100 : null,
        broadbandRate !== null ? broadbandRate * 100 : null,
        workFromHome !== null ? workFromHome * 100 : null,
        digitalScore
      ])
      setMetric(row, 'logistics_access_index', year, logisticsAccessIndex, 1)
    })

    return row
  })

  return applyBellCurveScores(enrichedRows)
}

export const normalizeCensusRows = (rows, level, defaultYear = '2022') => {
  if (!Array.isArray(rows) || rows.length === 0) return rows

  return rows.map((sourceRow) => {
    const row = { ...sourceRow }

    if (level === 'state') {
      row.state_name = row.state_name || row.state || row.NAME || null
    }

    if (level === 'county') {
      const countyLabel = row.county_name || row.county || row.NAME || ''
      row.county_name = row.county_name || countyLabel.split(',')[0]?.trim() || null
      row.state_name = row.state_name || countyLabel.split(',')[1]?.trim() || null
    }

    if (level === 'zcta5') {
      row.zcta5 = row.zcta5 || row.NAME || null
    }

    Object.entries(LEGACY_FIELD_MAP).forEach(([legacyKey, nextKey]) => {
      if (row[legacyKey] !== undefined && row[nextKey] === undefined) {
        row[nextKey] = row[legacyKey]
      }
    })

    Object.keys(row).forEach((key) => {
      if (key.match(/_\d{4}$/) || GEO_FIELDS.has(key)) {
        return
      }

      const metricKey = LEGACY_FIELD_MAP[key] || key
      const numericValue = toNumber(row[key])
      if (numericValue === null) {
        return
      }

      const normalizedValue = metricKey.includes('_rate') && numericValue > 1 && numericValue <= 100
        ? numericValue / 100
        : numericValue

      row[`${metricKey}_${defaultYear}`] = row[`${metricKey}_${defaultYear}`] ?? normalizedValue
    })

    return row
  })
}

export const getExecutiveMetricMeta = (metricBase) => METRIC_META[metricBase] || null

export const getExecutiveMetricCatalog = (manifest) => {
  const catalog = new Map()

  Object.entries(manifest?.derived_metrics || {}).forEach(([key, value]) => {
    catalog.set(key, {
      key,
      label: value.label || value.description || key,
      category: value.category || 'derived',
      format: value.format || 'number'
    })
  })

  Object.values(manifest?.industry_configs || {}).forEach((config) => {
    config.smart_metrics?.forEach((metric) => {
      catalog.set(metric.key, {
        key: metric.key,
        label: metric.label,
        category: metric.category || 'curated',
        format: metric.format || 'number'
      })
    })
  })

  Object.entries(METRIC_META).forEach(([key, value]) => {
    catalog.set(key, { key, ...value })
  })

  return catalog
}
