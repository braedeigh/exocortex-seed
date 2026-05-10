# Food Data Sources — Research Notes

*April 18, 2026*

## 1. USDA FoodData Central (PRIORITY — first integration)
- **Data:** ~380k foods, full macro/micronutrient composition, food components, portions. 5 datasets: Foundation (lab-analyzed), SR Legacy, FNDDS, Branded (largest), Experimental
- **Access:** Free REST API at `api.nal.usda.gov/fdc/v1/`. Free API key required. Endpoints: `/food/{fdcId}`, `/foods/search`, `/foods/list`. JSON responses. Bulk download as CSV/JSON (~2GB)
- **Rate limits:** 1,000 requests/hour per key (can request higher)
- **Quality:** Gold standard for US foods. Foundation foods are lab-analyzed. Branded data from manufacturer labels (variable quality)
- **Missing:** No histamine, pesticide, or environmental data
- **Python:** `python-usda` (unofficial, not actively maintained). Easy to hit directly with `requests`

## 2. SIGHI Histamine List
- **Data:** ~300 foods rated 0-3 for histamine compatibility, plus flags for biogenic amines and DAO inhibitors
- **Access:** PDF download from `histaminintoleranz.ch`. No API
- **Digitized:** Community projects on GitHub have scraped/entered it into CSV/JSON. Search `sighi-list` or `histamine-food-list`. Quality varies, needs verification against PDF. Copyright by SIGHI, redistribution legally gray
- **Python:** No library. Load community CSV with pandas

## 3. EWG Dirty Dozen / Clean Fifteen
- **Data:** Annual ranking of ~46 produce items by pesticide residue load
- **Access:** No API. Annual webpage at `ewg.org/foodnews`. BUT the underlying USDA Pesticide Data Program (PDP) data IS downloadable as raw CSVs from `ams.usda.gov/datasets/pdp`
- **Granularity:** EWG rankings are item-level only. PDP raw data is very granular — specific pesticide x food x sample
- **Python:** No wrapper. Scrape EWG or use USDA PDP CSVs directly

## 4. Open Food Facts
- **Data:** ~3M products. Barcodes, ingredients, Nutri-Score, NOVA classification, allergens, labels/certifications, packaging, origins, categories
- **Access:** Free REST API (`world.openfoodfacts.org/api/v2/product/{barcode}`). Full MongoDB dump (~7GB). No API key needed
- **Quality:** Crowdsourced = inconsistent. OCR errors in ingredients common. Origin/supply chain data on ~10-15% of products. Best for packaged/branded goods
- **Python:** `openfoodfacts` (official pip package)

## 5. EFSA OpenFoodTox
- **Data:** Chemical hazard data — reference points (ADI, ARfD, NOAEL) for ~5,000 substances. Links substances to food categories
- **Access:** Excel/CSV download from `efsa.europa.eu/en/data-report/chemical-hazards-database`. No API. Updated periodically
- **Python:** No wrapper. Load with pandas

## 6. Other Sources

### Carbon / Water Footprint
- **Poore & Nemecek (2018)** — lifecycle GHG/water/land use for ~40 food products. Supplementary data downloadable. The canonical dataset
- **SU-EATABLE LIFE** database — additional environmental data
- **Our World in Data** — food footprint datasets as CSVs on GitHub

### Price Data
- USDA ERS Food Price Outlook — US quarterly averages
- BLS CPI average food prices — monthly
- No good real-time consumer price API exists. Receipt scanning is the path

### Supply Chain / Origin
- No good open database. Open Food Facts has partial data
- FAOSTAT — country-level production/trade stats (bulk CSV). `faostat` Python package (unofficial)
- Manual notes + Cricket extraction from journal is the realistic path

### Food Chemistry
- **FooDB** (foodb.ca) — 28k compounds, 1k foods. Bioactive compounds, detailed chemistry. Downloadable CSVs. No API. Good complement to USDA for compound-level data

## Build Order

1. **USDA nutrition** → attach to catalog items (free API, huge coverage, highest immediate value)
2. **SIGHI histamine** → merge with food guide safe/hurts/unsure (small CSV, high personal value for MCAS)
3. **EWG/PDP pesticides** → flag produce items (CSV download, mostly static)
4. **Open Food Facts** → barcode scanning for packaged goods (API + Python package)
5. **Carbon footprint** → Poore & Nemecek (small static dataset, easy to add)
6. **FooDB / OpenFoodTox** → deep chemistry layer (later, when needed)
7. **Price tracking** → receipt photos + manual entry (no good external source)
8. **Supply chain** → Open Food Facts partial + manual notes + Cricket
