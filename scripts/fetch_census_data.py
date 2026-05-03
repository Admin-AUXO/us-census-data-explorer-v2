#!/usr/bin/env python3
"""
Enhanced Census Data Fetcher - Comprehensive ACS 5-Year data with executive metrics
"""

import argparse
import csv
import time
import json
import re
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests

OUTPUT_DIR = Path("public/data")
MANIFEST_PATH = OUTPUT_DIR / "manifest.json"
ZCTA_COUNTY_RELATIONSHIP_URL = "https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt"
ZCTA_COUNTY_RELATIONSHIP_PATH = OUTPUT_DIR / "tab20_zcta520_county20_natl.txt"
DERIVED_COLUMNS = [
    "homeownership_rate", "renter_rate", "housing_vacancy_rate", "vacant_for_rent",
    "mortgaged_rate", "free_clear_rate", "price_to_income_ratio", "rent_burden",
    "gross_rental_yield", "rent_burden_30plus_rate", "premium_housing_rate", "high_end_housing_rate",
    "unemployment_rate", "employment_rate", "labor_force_participation",
    "drive_alone_rate", "work_from_home_rate",
    "poverty_rate", "population_65plus_pct",
    "bachelors_degree_rate", "masters_plus_rate", "college_educated_rate", "hs_graduation_rate",
    "computer_access_rate", "smartphone_access_rate", "broadband_access_rate",
    "cellular_internet_rate", "no_internet_rate", "digital_access_score",
    "vehicle_availability_rate", "no_vehicle_rate",
    "insured_rate", "private_insurance_rate", "public_insurance_rate",
    "low_income_hh_pct", "middle_income_hh_pct", "upper_middle_income_hh_pct",
    "high_income_hh_pct", "affluent_hh_pct",
    "gini_index", "commute_time_index", "housing_affordability_index",
    "market_opportunity_score", "economic_resilience_score", "consumer_spending_power",
    "population_density", "housing_density", "prosperity_index", "affluence_index",
    "market_momentum_index", "cost_pressure_index", "talent_depth_index",
    "executive_growth_score", "consumer_demand_index", "senior_services_index",
    "logistics_access_index"
]

STATE_FIPS_MAP = {
    "01": "Alabama", "02": "Alaska", "04": "Arizona", "05": "Arkansas",
    "06": "California", "08": "Colorado", "09": "Connecticut", "10": "Delaware",
    "11": "DC", "12": "Florida", "13": "Georgia", "15": "Hawaii",
    "16": "Idaho", "17": "Illinois", "18": "Indiana", "19": "Iowa",
    "20": "Kansas", "21": "Kentucky", "22": "Louisiana", "23": "Maine",
    "24": "Maryland", "25": "Massachusetts", "26": "Michigan", "27": "Minnesota",
    "28": "Mississippi", "29": "Missouri", "30": "Montana", "31": "Nebraska",
    "32": "Nevada", "33": "New Hampshire", "34": "New Jersey", "35": "New Mexico",
    "36": "New York", "37": "North Carolina", "38": "North Dakota", "39": "Ohio",
    "40": "Oklahoma", "41": "Oregon", "42": "Pennsylvania", "44": "Rhode Island",
    "45": "South Carolina", "46": "South Dakota", "47": "Tennessee", "48": "Texas",
    "49": "Utah", "50": "Vermont", "51": "Virginia", "53": "Washington",
    "54": "West Virginia", "55": "Wisconsin", "56": "Wyoming", "72": "Puerto Rico"
}

DATASETS = {
    "demographics_income": {
        "name": "Demographics & Income",
        "source_file": "core_demographics_income_2014_2024",
        "variables": [
            ("B01003_001E", "total_population"),
            ("B01002_001E", "median_age"),
            ("B19013_001E", "median_household_income"),
            ("B19301_001E", "per_capita_income"),
            ("B19025_001E", "aggregate_income"),
            ("B17001_002E", "below_poverty_line"),
            ("B17001_001E", "poverty_denominator"),
            ("B19083_001E", "gini_index"),
            # Income brackets
            ("B19001_002E", "income_less_10k"),
            ("B19001_003E", "income_10k_15k"),
            ("B19001_004E", "income_15k_20k"),
            ("B19001_005E", "income_20k_25k"),
            ("B19001_006E", "income_25k_30k"),
            ("B19001_007E", "income_30k_35k"),
            ("B19001_008E", "income_35k_40k"),
            ("B19001_009E", "income_40k_45k"),
            ("B19001_010E", "income_45k_50k"),
            ("B19001_011E", "income_50k_60k"),
            ("B19001_012E", "income_60k_75k"),
            ("B19001_013E", "income_75k_100k"),
            ("B19001_014E", "income_100k_125k"),
            ("B19001_015E", "income_125k_150k"),
            ("B19001_016E", "income_150k_200k"),
            ("B19001_017E", "income_200k_more"),
            # Age demographics
            ("B09001_001E", "households_with_children"),
            ("B09005_001E", "family_households"),
            ("B09016_001E", "own_children_under18"),
            ("B09021_001E", "own_children_6_17"),
        ]
    },
    "housing": {
        "name": "Housing & Households",
        "source_file": "core_housing_2014_2024",
        "variables": [
            ("B25001_001E", "total_housing_units"),
            ("B25002_002E", "occupied_housing_units"),
            ("B25002_003E", "vacant_housing_units"),
            ("B25003_001E", "housing_tenure_total"),
            ("B25003_002E", "owner_occupied"),
            ("B25003_003E", "renter_occupied"),
            ("B25077_001E", "median_home_value"),
            ("B25064_001E", "median_gross_rent"),
            ("B25035_001E", "median_year_built"),
            ("B25041_001E", "median_rooms"),
            ("B25081_002E", "units_mortgaged"),
            ("B25081_003E", "units_free_clear"),
            ("B25070_001E", "rent_burden_total"),
            ("B25070_002E", "rent_less_10pct"),
            ("B25070_003E", "rent_10_15pct"),
            ("B25070_004E", "rent_15_20pct"),
            ("B25070_005E", "rent_20_25pct"),
            ("B25070_006E", "rent_25_30pct"),
            ("B25070_007E", "rent_30_35pct"),
            ("B25070_008E", "rent_35_40pct"),
            ("B25070_009E", "rent_40_50pct"),
            ("B25070_010E", "rent_50pct_more"),
        ]
    },
    "education_employment": {
        "name": "Education & Employment",
        "source_file": "core_education_employment_2014_2024",
        "variables": [
            ("B15003_001E", "total_pop_25plus"),
            ("B15003_017E", "education_hs_diploma"),
            ("B15003_018E", "education_some_college"),
            ("B15003_019E", "education_associates"),
            ("B15003_020E", "education_associates2"),
            ("B15003_021E", "education_bachelors"),
            ("B15003_022E", "education_masters"),
            ("B15003_023E", "education_professional"),
            ("B15003_024E", "education_doctorate"),
            ("B23025_002E", "in_labor_force"),
            ("B23025_003E", "employed"),
            ("B23025_004E", "unemployed"),
            ("B23025_005E", "not_in_labor_force"),
            ("B08013_001E", "mean_travel_time_work"),
            ("B08014_002E", "commuters_car_alone"),
            ("B08014_003E", "commuters_carpool"),
            ("B08014_004E", "commuters_public_transit"),
            ("B08014_005E", "commuters_walk"),
            ("B08014_006E", "commuters_other"),
            ("B08014_007E", "commuters_work_home"),
        ]
    },
    "real_estate": {
        "name": "Real Estate & Housing",
        "source_file": "industry_realestate_2018_2024",
        "variables": [
            ("B01003_001E", "total_population"),
            ("B01002_001E", "median_age"),
            ("B19013_001E", "median_household_income"),
            ("B19301_001E", "per_capita_income"),
            ("B25001_001E", "total_housing_units"),
            ("B25002_003E", "vacant_units"),
            ("B25003_002E", "owner_occupied"),
            ("B25003_003E", "renter_occupied"),
            ("B25077_001E", "median_home_value"),
            ("B25064_001E", "median_gross_rent"),
            ("B25035_001E", "median_year_built"),
            ("B25081_002E", "mortgaged"),
            ("B25081_003E", "free_clear"),
            ("B25075_001E", "value_total"),
            ("B25075_025E", "value_1m_plus"),
            ("B25075_023E", "value_500k_750k"),
            ("B25075_022E", "value_400k_500k"),
            ("B25075_021E", "value_350k_400k"),
            ("B25075_020E", "value_300k_350k"),
            ("B25075_019E", "value_250k_300k"),
            ("B25075_018E", "value_200k_250k"),
        ]
    },
    "ecommerce": {
        "name": "E-Commerce & Digital",
        "source_file": "industry_ecommerce_2014_2024",
        "variables": [
            ("B01003_001E", "total_population"),
            ("B01002_001E", "median_age"),
            ("B25010_001E", "avg_household_size"),
            ("B25003_001E", "total_households"),
            ("B28001_001E", "computer_households"),
            ("B28001_002E", "computer_desktop"),
            ("B28001_003E", "computer_laptop"),
            ("B28001_004E", "computer_smartphone"),
            ("B28002_001E", "internet_households"),
            ("B28002_002E", "internet_broadband"),
            ("B28002_003E", "internet_dialup"),
            ("B28002_004E", "internet_cellular"),
            ("B28002_005E", "internet_satellite"),
            ("B28002_006E", "internet_other"),
            ("B28002_007E", "internet_none"),
            ("B08201_001E", "vehicle_households"),
            ("B08201_002E", "vehicle_0"),
            ("B08201_003E", "vehicle_1"),
            ("B08201_004E", "vehicle_2"),
            ("B08201_005E", "vehicle_3plus"),
            ("B19013_001E", "median_household_income"),
            ("B19301_001E", "per_capita_income"),
            ("B25064_001E", "median_gross_rent"),
        ]
    },
    "finance_healthcare": {
        "name": "Finance & Healthcare",
        "source_file": "industry_finance_healthcare_2014_2024",
        "variables": [
            ("B01003_001E", "total_population"),
            ("B01002_001E", "median_age"),
            ("B01001_020E", "pop_65plus_male"),
            ("B01001_021E", "pop_65plus_female"),
            ("B19013_001E", "median_household_income"),
            ("B19301_001E", "per_capita_income"),
            ("B17001_002E", "below_poverty_line"),
            ("B17001_001E", "poverty_denominator"),
            ("B19083_001E", "gini_index"),
            ("B27001_001E", "health_insurance_total"),
            ("B27001_002E", "health_insurance_male"),
            ("B27001_003E", "health_insurance_no_male"),
            ("B27001_004E", "health_insurance_female"),
            ("B27001_005E", "health_insurance_no_female"),
            ("B27002_001E", "private_insurance"),
            ("B27003_001E", "public_insurance"),
        ]
    }
}


class CensusFetcher:
    def __init__(self, api_key: str | None = None, year: int = 2022, max_workers: int = 8):
        self.api_key = api_key
        self.year = year
        self.base_url = f"https://api.census.gov/data/{year}/acs/acs5"
        self.session = requests.Session()
        self.session.headers["User-Agent"] = "CensusExplorer/1.0"
        self.max_workers = max(1, max_workers)

    def set_year(self, year: int):
        self.year = year
        self.base_url = f"https://api.census.gov/data/{year}/acs/acs5"

    def request_json(self, params: dict, timeout: int = 60, attempts: int = 4):
        delay = 1
        last_error = None
        for attempt in range(1, attempts + 1):
            try:
                resp = self.session.get(self.base_url, params=params, timeout=timeout)
                if resp.status_code == 429:
                    time.sleep(delay)
                    delay = min(delay * 2, 30)
                    continue
                resp.raise_for_status()
                return resp.json()
            except Exception as exc:
                last_error = exc
                if attempt == attempts:
                    break
                time.sleep(delay)
                delay = min(delay * 2, 30)
        raise last_error

    def fetch_states(self, variables: list) -> list:
        var_list = ["NAME"] + [v[0] for v in variables]
        params = {"get": ",".join(var_list), "for": "state:*"}
        if self.api_key:
            params["key"] = self.api_key
        try:
            data = self.request_json(params, timeout=60)
        except Exception as exc:
            print(f"    Error: {exc}")
            return []
        return data[1:]

    def fetch_counties_for_state(self, state_fips: str, variables: list) -> list:
        var_list = ["NAME"] + [v[0] for v in variables]
        params = {
            "get": ",".join(var_list),
            "for": "county:*",
            "in": f"state:{state_fips}"
        }
        if self.api_key:
            params["key"] = self.api_key
        data = self.request_json(params, timeout=30)
        return data[1:]

    def fetch_counties_by_state(self, variables: list) -> list:
        all_data = []
        print(f"    Fetching counties with {self.max_workers} workers...")
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            futures = {
                executor.submit(self.fetch_counties_for_state, state_fips, variables): state_fips
                for state_fips in STATE_FIPS_MAP.keys()
            }
            for future in as_completed(futures):
                state_fips = futures[future]
                try:
                    rows = future.result()
                    all_data.extend(rows)
                    print(f"    State {state_fips}: {len(rows):,} counties", end="\r")
                except Exception as exc:
                    print(f"    Error state {state_fips}: {exc}")
        print(f"    Total counties: {len(all_data):,}")
        return all_data

    def fetch_zctas(self, variables: list, batch_size: int = 5000) -> list:
        all_data = []
        offset = 0
        var_list = ["NAME"] + [v[0] for v in variables]

        print(f"    Fetching ZCTAs...")
        while True:
            params = {
                "get": ",".join(var_list),
                "for": "zip code tabulation area:*",
                "offset": offset,
                "limit": batch_size
            }
            if self.api_key:
                params["key"] = self.api_key
            try:
                data = self.request_json(params, timeout=120)
                if len(data) <= 1:
                    break

                all_data.extend(data[1:])
                print(f"    ZCTAs: {len(all_data):,}", end="\r")
                offset += batch_size

                if len(data[1:]) < batch_size:
                    break
                time.sleep(0.3)

            except Exception as e:
                print(f"    Error: {e}")
                break

        print(f"\n    Total: {len(all_data):,} ZCTAs")
        return all_data


def calc_derived(vars_list: list, values: list, yr: int) -> dict:
    """Calculate comprehensive derived metrics."""
    derived = {}

    def get(var_id):
        for i, v in enumerate(vars_list):
            if v[0] == var_id:
                val = values[i] if i < len(values) else None
                return float(val) if val and val != '' else None
        return None

    # Basic population and housing
    pop = get("B01003_001E") or 0
    housing = get("B25001_001E") or 0
    area = get("ALAND") or 0
    owner = get("B25003_002E") or 0
    renter = get("B25003_003E") or 0
    vacant = get("B25002_003E") or 0
    income = get("B19013_001E") or 0
    per_capita_income = get("B19301_001E") or 0
    home_val = get("B25077_001E") or 0
    rent = get("B25064_001E") or 0
    labor = get("B23025_002E") or 0
    employed = get("B23025_003E") or 0
    unemployed = get("B23025_004E") or 0
    poverty = get("B17001_002E") or 0
    pop_25 = get("B15003_001E") or 0
    bachelors = get("B15003_021E") or 0
    masters = get("B15003_022E") or 0
    doctorate = get("B15003_024E") or 0
    hs_diploma = get("B15003_017E") or 0
    some_college = get("B15003_018E") or 0
    gini = get("B19083_001E") or 0
    pop_65_m = get("B01001_020E") or 0
    pop_65_f = get("B01001_021E") or 0
    computer_hh = get("B28001_001E") or 0
    computer_access = get("B28001_002E") or 0
    laptop = get("B28001_003E") or 0
    smartphone = get("B28001_004E") or 0
    internet_hh = get("B28002_001E") or 0
    broadband = get("B28002_002E") or 0
    cellular = get("B28002_004E") or 0
    no_internet = get("B28002_007E") or 0
    vehicle_hh = get("B08201_001E") or 0
    no_vehicle = get("B08201_002E") or 0
    insured = get("B27001_001E") or 0
    private_ins = get("B27002_001E") or 0
    public_ins = get("B27003_001E") or 0
    mortgaged = get("B25081_002E") or 0
    free_clear = get("B25081_003E") or 0
    avg_hh_size = get("B25010_001E") or 0
    mean_travel = get("B08013_001E") or 0
    work_home = get("B08014_007E") or 0
    commuters = get("B08014_002E") or 0

    # Income distribution
    income_10k = get("B19001_002E") or 0
    income_25k = sum([get(f"B19001_{i:03d}E") or 0 for i in range(3, 7)])
    income_50k = sum([get(f"B19001_{i:03d}E") or 0 for i in range(7, 12)])
    income_75k = sum([get(f"B19001_{i:03d}E") or 0 for i in range(12, 14)])
    income_100k = sum([get(f"B19001_{i:03d}E") or 0 for i in range(14, 17)])
    income_150k = get("B19001_016E") or 0
    income_200k = get("B19001_017E") or 0

    # Housing value distribution
    value_200k_plus = sum([get(f"B25075_{i:03d}E") or 0 for i in range(18, 26)])
    value_500k_plus = sum([get(f"B25075_{i:03d}E") or 0 for i in range(23, 26)])
    value_1m_plus = get("B25075_025E") or 0

    # Rent burden categories
    rent_30plus = sum([get(f"B25070_{i:03d}E") or 0 for i in range(7, 11)])

    try:
        # Core housing metrics
        if housing > 0:
            derived[f"homeownership_rate_{yr}"] = round(owner / housing, 4)
            derived[f"renter_rate_{yr}"] = round(renter / housing, 4)
            derived[f"housing_vacancy_rate_{yr}"] = round(vacant / housing, 4)
            derived[f"vacant_for_rent_{yr}"] = round(vacant / housing, 4)

        if owner > 0 and mortgaged > 0:
            derived[f"mortgaged_rate_{yr}"] = round(mortgaged / owner, 4)
            derived[f"free_clear_rate_{yr}"] = round(free_clear / owner, 4)

        # Affordability metrics
        if income > 0 and income < 9999999:
            if home_val > 0 and home_val < 9999999:
                derived[f"price_to_income_ratio_{yr}"] = round(home_val / income, 2)
            if rent > 0 and rent < 9999999:
                derived[f"rent_burden_{yr}"] = round(rent / income, 4)

        if home_val > 0 and home_val < 9999999 and rent > 0 and rent < 9999999:
            derived[f"gross_rental_yield_{yr}"] = round((rent * 12) / home_val * 100, 2)

        if rent_30plus > 0 and internet_hh > 0:
            derived[f"rent_burden_30plus_rate_{yr}"] = round(rent_30plus / internet_hh, 4)

        # Premium housing indicators
        if value_200k_plus > 0 and housing > 0:
            derived[f"premium_housing_rate_{yr}"] = round(value_200k_plus / housing, 4)
        if value_500k_plus > 0 and housing > 0:
            derived[f"high_end_housing_rate_{yr}"] = round(value_500k_plus / housing, 4)

        # Employment metrics
        if labor > 0:
            derived[f"unemployment_rate_{yr}"] = round(unemployed / labor, 4)
            derived[f"employment_rate_{yr}"] = round(employed / labor, 4)
            derived[f"labor_force_participation_{yr}"] = round(labor / pop, 4)

        if commuters > 0:
            derived[f"drive_alone_rate_{yr}"] = round(commuters / (commuters + work_home), 4)
            derived[f"work_from_home_rate_{yr}"] = round(work_home / (commuters + work_home), 4)

        # Population metrics
        if pop > 0:
            derived[f"poverty_rate_{yr}"] = round(poverty / pop, 4)
            pop_65 = pop_65_m + pop_65_f
            derived[f"population_65plus_pct_{yr}"] = round(pop_65 / pop, 4)

        # Education metrics
        if pop_25 > 0:
            derived[f"bachelors_degree_rate_{yr}"] = round(bachelors / pop_25, 4)
            derived[f"masters_plus_rate_{yr}"] = round((masters + doctorate) / pop_25, 4)
            derived[f"college_educated_rate_{yr}"] = round((bachelors + masters + doctorate) / pop_25, 4)
            derived[f"hs_graduation_rate_{yr}"] = round((hs_diploma + some_college + bachelors + masters + doctorate) / pop_25, 4)

        # Digital access metrics
        if computer_hh > 0:
            derived[f"computer_access_rate_{yr}"] = round(computer_access / computer_hh, 4)
            derived[f"smartphone_access_rate_{yr}"] = round(smartphone / computer_hh, 4)

        if internet_hh > 0:
            derived[f"broadband_access_rate_{yr}"] = round(broadband / internet_hh, 4)
            derived[f"cellular_internet_rate_{yr}"] = round(cellular / internet_hh, 4)
            derived[f"no_internet_rate_{yr}"] = round(no_internet / internet_hh, 4)
            # Composite digital score
            digital = (computer_access / computer_hh * 0.4 + broadband / internet_hh * 0.6) * 100 if computer_hh > 0 else 50
            derived[f"digital_access_score_{yr}"] = round(digital, 1)

        # Vehicle access metrics
        if vehicle_hh > 0:
            derived[f"vehicle_availability_rate_{yr}"] = round((vehicle_hh - no_vehicle) / vehicle_hh, 4)
            derived[f"no_vehicle_rate_{yr}"] = round(no_vehicle / vehicle_hh, 4)

        # Healthcare metrics
        if pop > 0:
            derived[f"insured_rate_{yr}"] = round(insured / pop, 4)

        if insured > 0:
            derived[f"private_insurance_rate_{yr}"] = round(private_ins / insured, 4)
            derived[f"public_insurance_rate_{yr}"] = round(public_ins / insured, 4)

        # Income distribution metrics
        total_hh = income_10k + income_25k + income_50k + income_75k + income_100k + income_150k + income_200k
        if total_hh > 0:
            derived[f"low_income_hh_pct_{yr}"] = round(income_25k / total_hh, 4)
            derived[f"middle_income_hh_pct_{yr}"] = round(income_50k / total_hh, 4)
            derived[f"upper_middle_income_hh_pct_{yr}"] = round(income_75k / total_hh, 4)
            derived[f"high_income_hh_pct_{yr}"] = round((income_100k + income_150k + income_200k) / total_hh, 4)
            derived[f"affluent_hh_pct_{yr}"] = round((income_150k + income_200k) / total_hh, 4)

        # Gini index
        if gini > 0:
            derived[f"gini_index_{yr}"] = round(gini, 4)

        # Travel time metric
        if mean_travel > 0:
            derived[f"commute_time_index_{yr}"] = round(mean_travel / 30, 4)  # Normalized to 30 min

        if pop > 0 and area > 0:
            derived[f"population_density_{yr}"] = round(pop / area, 2)

        if housing > 0 and area > 0:
            derived[f"housing_density_{yr}"] = round(housing / area, 2)

        prosperity = [
            min(100, income / 140000 * 100) if income > 0 else None,
            min(100, per_capita_income / 80000 * 100) if per_capita_income > 0 else None,
            derived.get(f"employment_rate_{yr}", 0) * 100,
            (1 - derived.get(f"poverty_rate_{yr}", 0.15)) * 100
        ]
        prosperity = [value for value in prosperity if value is not None]
        if prosperity:
            derived[f"prosperity_index_{yr}"] = round(sum(prosperity) / len(prosperity), 1)

        affluence = [
            min(100, income / 160000 * 100) if income > 0 else None,
            min(100, per_capita_income / 90000 * 100) if per_capita_income > 0 else None,
            derived.get(f"affluent_hh_pct_{yr}", 0) * 100
        ]
        affluence = [value for value in affluence if value is not None]
        if affluence:
            derived[f"affluence_index_{yr}"] = round(sum(affluence) / len(affluence), 1)

        momentum_parts = [
            derived.get(f"market_opportunity_score_{yr}"),
            derived.get(f"economic_resilience_score_{yr}"),
            derived.get(f"digital_access_score_{yr}")
        ]
        momentum_parts = [value for value in momentum_parts if value is not None]
        if momentum_parts:
            derived[f"market_momentum_index_{yr}"] = round(sum(momentum_parts) / len(momentum_parts), 1)

        cost_pressure_parts = [
            min(100, (derived.get(f"price_to_income_ratio_{yr}", 0) / 12) * 100),
            min(100, derived.get(f"rent_burden_{yr}", 0) * 220),
            100 - derived.get(f"housing_affordability_index_{yr}", 50)
        ]
        derived[f"cost_pressure_index_{yr}"] = round(sum(cost_pressure_parts) / len(cost_pressure_parts), 1)

        talent_parts = [
            derived.get(f"college_educated_rate_{yr}", 0) * 100,
            derived.get(f"labor_force_participation_{yr}", 0) * 100,
            derived.get(f"employment_rate_{yr}", 0) * 100
        ]
        derived[f"talent_depth_index_{yr}"] = round(sum(talent_parts) / len(talent_parts), 1)

        price_to_income = derived.get(f"price_to_income_ratio_{yr}", 5)
        rent_bur = derived.get(f"rent_burden_{yr}", 0.3)
        affordability = 100 - min(100, (price_to_income / 10) * 100 * 0.5 + (rent_bur / 0.5) * 100 * 0.5)
        derived[f"housing_affordability_index_{yr}"] = round(max(0, affordability), 1)

        # Market opportunity score (composite)
        income_score = min(100, income / 100000 * 100) if income > 0 else 0
        digital_score = derived.get(f"digital_access_score_{yr}", 50)
        education_score = derived.get(f"college_educated_rate_{yr}", 0.3) * 100
        employment_score = derived.get(f"employment_rate_{yr}", 0.95) * 100
        mos = income_score * 0.30 + digital_score * 0.25 + education_score * 0.25 + employment_score * 0.20
        derived[f"market_opportunity_score_{yr}"] = round(mos, 1)

        # Economic resilience score
        employment = derived.get(f"employment_rate_{yr}", 0.95) * 100
        labor_score = derived.get(f"labor_force_participation_{yr}", 0.65) * 100
        poverty_score = (1 - derived.get(f"poverty_rate_{yr}", 0.15)) * 100
        resilience = employment * 0.35 + labor_score * 0.25 + poverty_score * 0.25 + (100 - gini * 100) * 0.15
        derived[f"economic_resilience_score_{yr}"] = round(max(0, min(100, resilience)), 1)

        # Consumer spending power index
        spending_power = income * (1 - rent_bur) if rent_bur < 1 else income * 0.7
        derived[f"consumer_spending_power_{yr}"] = round(spending_power, 0)

        demand_parts = [
            min(100, income / 150000 * 100) if income > 0 else None,
            min(100, spending_power / 100000 * 100) if spending_power > 0 else None,
            derived.get(f"digital_access_score_{yr}"),
            min(100, pop / 1000000 * 100) if pop > 0 else None
        ]
        demand_parts = [value for value in demand_parts if value is not None]
        if demand_parts:
            derived[f"consumer_demand_index_{yr}"] = round(sum(demand_parts) / len(demand_parts), 1)

        senior_parts = [
            derived.get(f"population_65plus_pct_{yr}", 0) * 100,
            derived.get(f"public_insurance_rate_{yr}", 0) * 100,
            derived.get(f"economic_resilience_score_{yr}")
        ]
        senior_parts = [value for value in senior_parts if value is not None]
        if senior_parts:
            derived[f"senior_services_index_{yr}"] = round(sum(senior_parts) / len(senior_parts), 1)

        logistics_parts = [
            derived.get(f"vehicle_availability_rate_{yr}", 0) * 100,
            derived.get(f"broadband_access_rate_{yr}", 0) * 100,
            derived.get(f"work_from_home_rate_{yr}", 0) * 100,
            derived.get(f"digital_access_score_{yr}")
        ]
        logistics_parts = [value for value in logistics_parts if value is not None]
        if logistics_parts:
            derived[f"logistics_access_index_{yr}"] = round(sum(logistics_parts) / len(logistics_parts), 1)

        growth_parts = [
            derived.get(f"prosperity_index_{yr}"),
            derived.get(f"market_momentum_index_{yr}"),
            derived.get(f"talent_depth_index_{yr}"),
            100 - derived.get(f"cost_pressure_index_{yr}", 50)
        ]
        growth_parts = [value for value in growth_parts if value is not None]
        if growth_parts:
            derived[f"executive_growth_score_{yr}"] = round(sum(growth_parts) / len(growth_parts), 1)

    except Exception as e:
        print(f"    Derived calc error: {e}")

    return derived


def write_csv(filepath: Path, headers: list, rows: list):
    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        writer.writerows(rows)
    print(f"    Saved: {filepath.name} ({len(rows):,} rows)")


def write_compact_json(filepath: Path, headers: list, rows: list, *, level: str, years: list[int]):
    dictionaries: dict[str, list] = {}
    encoded_rows = []
    for row in rows:
        encoded = []
        for header, value in zip(headers, row):
            if isinstance(value, str) and value:
                dictionary = dictionaries.setdefault(header, [])
                try:
                    encoded.append(dictionary.index(value))
                except ValueError:
                    dictionary.append(value)
                    encoded.append(len(dictionary) - 1)
            else:
                encoded.append(value)
        encoded_rows.append(encoded)

    payload = {
        "format": "columnar-v2",
        "level": level,
        "year": max(years),
        "years": years,
        "columns": headers,
        "dictionaries": dictionaries,
        "rows": encoded_rows,
    }
    filepath.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    print(f"    Saved: {filepath.name} ({len(rows):,} rows)")


INTEGER_RE = re.compile(r"^-?\d+$")


def coerce_value(value):
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return value
    if not isinstance(value, str):
        return value

    trimmed = value.strip()
    if trimmed == "":
        return None
    if INTEGER_RE.match(trimmed):
        try:
            numeric = int(trimmed)
            return None if numeric <= -999999 else numeric
        except ValueError:
            return trimmed
    try:
        numeric = float(trimmed)
        return None if numeric <= -999999 else numeric
    except ValueError:
        return trimmed


def get_geo_headers(level: str) -> list:
    if level == "state":
        return ["state_fips", "state"]
    if level == "county":
        return ["county", "state_fips", "county_fips"]
    return ["zcta5", "state_fips", "county_fips", "county", "state_name", "county_name"]


def read_county_lookup(source: str) -> dict:
    county_path = OUTPUT_DIR / f"{source}_county.csv"
    if not county_path.exists():
        return {}

    with county_path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        lookup = {}
        for row in reader:
            state_fips = str(row.get("state_fips") or "").zfill(2)
            county_fips = str(row.get("county_fips") or "").zfill(3)
            county_label = row.get("county") or ""
            county_name = county_label.split(",")[0].strip() if county_label else row.get("county_name")
            state_name = county_label.split(",")[1].strip() if "," in county_label else STATE_FIPS_MAP.get(state_fips)
            if state_fips and county_fips:
                lookup[f"{state_fips}{county_fips}"] = {
                    "state_fips": state_fips,
                    "county_fips": county_fips,
                    "county": county_label,
                    "state_name": state_name,
                    "county_name": county_name,
                }
        return lookup


def ensure_zcta_county_relationship() -> Path | None:
    if ZCTA_COUNTY_RELATIONSHIP_PATH.exists():
        return ZCTA_COUNTY_RELATIONSHIP_PATH

    try:
        print("    Fetching Census ZCTA-county relationship file...")
        response = requests.get(ZCTA_COUNTY_RELATIONSHIP_URL, timeout=120)
        response.raise_for_status()
        ZCTA_COUNTY_RELATIONSHIP_PATH.write_bytes(response.content)
        return ZCTA_COUNTY_RELATIONSHIP_PATH
    except Exception as exc:
        print(f"    ZCTA-county relationship unavailable: {exc}")
        return None


def read_zcta_county_lookup() -> dict:
    relationship_path = ensure_zcta_county_relationship()
    if not relationship_path:
        return {}

    with relationship_path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter="|")
        best = {}
        for row in reader:
            zcta = row.get("GEOID_ZCTA5_20")
            county_geoid = row.get("GEOID_COUNTY_20")
            if not zcta or not county_geoid:
                continue
            try:
                area = int(row.get("AREALAND_PART") or 0)
            except ValueError:
                area = 0
            if zcta not in best or area > best[zcta]["area"]:
                best[zcta] = {"county_geoid": county_geoid, "area": area}

    return {zcta: value["county_geoid"] for zcta, value in best.items()}


def enrich_zcta_rows(source: str, row_buckets: dict):
    county_lookup = read_county_lookup(source)
    zcta_lookup = read_zcta_county_lookup()
    if not county_lookup or not zcta_lookup:
        print("    ZCTA join keys skipped; county lookup or relationship file missing")
        return

    matched = 0
    for key, bucket in row_buckets.items():
        zcta = str(bucket.get("zcta5") or key[0]).zfill(5)
        county_geo = zcta_lookup.get(zcta)
        county = county_lookup.get(county_geo)
        if not county:
            continue
        bucket.update(county)
        matched += 1

    print(f"    Added ZCTA join keys: {matched:,}/{len(row_buckets):,} rows")


def get_metric_headers(vars_list: list, years: list[int]) -> list:
    headers = []
    base_headers = [name for _, name in vars_list]
    for year in years:
        headers.extend([f"{name}_{year}" for name in base_headers])
        headers.extend([f"{name}_{year}" for name in DERIVED_COLUMNS])
    return headers


def merge_level_rows(level: str, raw_rows: list, vars_list: list, year: int, row_buckets: dict, row_order: list):
    geo_headers = get_geo_headers(level)

    for row in raw_rows:
        raw = list(row)

        if level == "state":
            geo_values = [raw[-1], raw[0]]
            key = tuple(geo_values)
            var_values = [coerce_value(value) for value in raw[1:-1]]
        elif level == "county":
            geo_values = [raw[0], raw[-2], raw[-1]]
            key = tuple(geo_values)
            var_values = [coerce_value(value) for value in raw[1:-2]]
        else:
            geo_values = [raw[-1] if len(raw) > 1 else raw[0]]
            key = tuple(geo_values)
            var_values = [coerce_value(value) for value in raw[1:-1]]

        derived = calc_derived(vars_list, var_values, year)
        bucket = row_buckets.setdefault(key, {})
        if key not in row_order:
            row_order.append(key)

        for header, value in zip(geo_headers, geo_values):
            bucket[header] = value

        for (_, metric_name), value in zip(vars_list, var_values):
            bucket[f"{metric_name}_{year}"] = value

        for metric_name in DERIVED_COLUMNS:
            bucket[f"{metric_name}_{year}"] = derived.get(f"{metric_name}_{year}")


def has_value(value) -> bool:
    return value is not None and value != ""


def prune_empty_columns(headers: list, rows: list, geo_headers: list) -> tuple[list, list]:
    keep_indexes = []
    for index, header in enumerate(headers):
        if header in geo_headers or any(has_value(row[index]) for row in rows):
            keep_indexes.append(index)
    return [headers[index] for index in keep_indexes], [[row[index] for index in keep_indexes] for row in rows]


def write_level_outputs(source: str, level: str, vars_list: list, years: list[int], row_buckets: dict, row_order: list):
    if level == "zcta5":
        enrich_zcta_rows(source, row_buckets)

    geo_headers = get_geo_headers(level)
    metric_headers = get_metric_headers(vars_list, years)
    headers = geo_headers + metric_headers
    rows = [[row_buckets[key].get(header) for header in headers] for key in row_order]
    headers, rows = prune_empty_columns(headers, rows, geo_headers)

    filepath = OUTPUT_DIR / f"{source}_{level}.csv"
    write_compact_json(filepath.with_suffix(".json"), headers, rows, level=level, years=years)


def update_manifest_years(years: list[int]):
    if not MANIFEST_PATH.exists():
        return

    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    manifest.setdefault("metadata", {})
    manifest["metadata"]["generated_at"] = time.strftime("%Y-%m-%d")
    manifest["metadata"]["version"] = f"{min(years)}-{max(years)}"

    for dataset in manifest.get("datasets", []):
        dataset["years_available"] = years

    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Updated manifest for {min(years)}-{max(years)} release window")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--api-key")
    parser.add_argument("--year", type=int)
    parser.add_argument("--start-year", type=int)
    parser.add_argument("--end-year", type=int)
    parser.add_argument("--datasets", nargs="+", default=["all"])
    parser.add_argument("--levels", nargs="+", choices=["state", "county", "zcta5"], default=["state", "county", "zcta5"])
    parser.add_argument("--max-workers", type=int, default=8)
    args = parser.parse_args()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    if args.year:
        years = [args.year]
    else:
        start_year = args.start_year or 2014
        end_year = args.end_year or 2024
        years = list(range(start_year, end_year + 1))

    fetcher = CensusFetcher(args.api_key, years[-1], max_workers=args.max_workers)

    datasets = list(DATASETS.keys()) if "all" in args.datasets else args.datasets

    for ds_id in datasets:
        if ds_id not in DATASETS:
            continue

        cfg = DATASETS[ds_id]
        print(f"\n{'='*60}")
        print(f"Dataset: {cfg['name']}")
        print(f"{'='*60}")

        vars_list = cfg["variables"]
        source = cfg["source_file"]

        for level in args.levels:
            print(f"\n  [{level.upper()}]")
            row_buckets = {}
            row_order = []

            for year in years:
                print(f"    Year {year}")
                fetcher.set_year(year)

                if level == "state":
                    data = fetcher.fetch_states(vars_list)
                elif level == "county":
                    data = fetcher.fetch_counties_by_state(vars_list)
                else:
                    data = fetcher.fetch_zctas(vars_list)

                if not data:
                    continue

                merge_level_rows(level, data, vars_list, year, row_buckets, row_order)

            if not row_order:
                continue

            write_level_outputs(source, level, vars_list, years, row_buckets, row_order)

    print(f"\n\n{'='*60}")
    print(f"Complete! Files in: {OUTPUT_DIR.absolute()}")
    update_manifest_years(years)


if __name__ == "__main__":
    main()
