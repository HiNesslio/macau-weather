# 資料來源與部署說明

靜態網頁搭配 Vercel Node.js Function `/api/weather`。已取代原本 Cloudflare Pages Function；無需資料庫。

- 正式網站：https://macau-weather.vercel.app
- 正式 API：https://macau-weather.vercel.app/api/weather
- GitHub：https://github.com/HiNesslio/macau-weather
- Vercel 已連接 GitHub 的 `main` 分支。

## 部署到 Vercel

將本資料夾上傳到 Git 儲存庫後，在 Vercel 匯入：

- **Root Directory**：若儲存庫保留外層資料夾，選 `macau-weather-live`；若直接上傳本資料夾內的檔案，使用儲存庫根目錄。
- **Framework Preset**：Other。
- **Build Command**：`npm run build`。
- **Output Directory**：`public`。
- **Node.js**：22.x。
- 此版本使用的公開資料接口不需要 API Key。

`vercel.json` 已包含建置、輸出、函數執行時間及安全標頭設定。只將 `index.html` 複製至公開靜態目錄，API 由根目錄 `api/weather.js` 執行。

部署完成後，開啟 `/api/weather`，應收到 JSON；完整成功時 `unavailable` 為 `[]`。再確認首頁實況時間、七日預報和逐小時圖表。此專案已於 2026-11-05 部署至 Vercel，公開首頁及正式 API 均已驗證；首版五個資料來源已驗證；目前已擴充為九個來源。

## 實際資料來源

| 資料 | 來源 | 備註 |
| --- | --- | --- |
| 氣溫、已錄高低溫、濕度、風速／風向、天氣描述、體感評級 | SMG `c_actual_brief.xml` | 體感為官方文字評級，沒有虛構體感溫度 |
| 今日文字預報 | SMG `c_forecast.xml` | 按澳門日期選擇有效預報 |
| 當日及七日高低溫、濕度、文字預報 | SMG `c_7daysforecast.xml` | 按 `ValidFor` 及 Type 1／2 解析預測最高／最低溫 |
| 各類警告狀態 | SMG 警告 RSS | 解析表格；區分沒有警告、生效及無法確認 |
| 未來 12 小時氣溫、降雨機率 | Open-Meteo Forecast API | 澳門座標 22.1987, 113.5439；模型預報，並非 SMG 觀測 |
| 即時紫外線 | SMG `c_actualUVI.xml` | 顯示讀數、級別及觀測時間，0 為有效值 |
| 六站空氣污染物濃度 | SMG `latestAirConcentration.json` | PM2.5、PM10、NO₂、O₃、SO₂、CO；不是 AQI |
| 空氣質量指數預報 | SMG `c_foreiqa.xml` | 路邊、高密度住宅區、一般性；保留有效日期 |
| 各區完整氣象站實況 | SMG `c_actualweather.xml` | 氣溫、濕度、風速、陣風、風向、露點、海平面氣壓；缺值不補零 |

來源網址完整列於 `lib/weather.js` 和 API 回應 `sourceUrls`。網頁有來源與 Open-Meteo CC BY 4.0 標示。Open-Meteo 免費接口的非商業用途與用量限制請參閱 https://open-meteo.com/en/terms 與 https://open-meteo.com/en/pricing；商業服務需改用其授權方案。

## 更新與失敗處理

瀏覽器每 5 分鐘更新；Vercel CDN 對完整成功回應快取 5 分鐘，可在重新驗證時使用短暫舊快取。各來源平行請求，8 秒逾時。部分來源失敗時保留其餘資料並回傳 `unavailable`，部分失敗與完全失敗不快取；完全失敗回傳 503。

頁面同時標示官方實況時間及取得時間。實況超過 90 分鐘會提示可能過期；重新整理失敗時顯示上次資料並提示。未取得數值不以模擬資料填補。天氣場景由 SMG 實況描述自動決定，今日／明日文字預報不會被當成當下天氣；沒有實況描述時使用中性天空。已移除手動天氣、日夜、輪播及 URL 覆寫，只保留動畫暫停。日夜依 Open-Meteo 日出日落資料每分鐘更新，缺少日出日落時以澳門經緯度估算太陽高度。

警告 RSS 的發布時間可能是最近一次狀態變更時間，不能單憑時間判定警告是否生效。程式保留各警告的官方文字和時間；實際警告以氣象局公告為準。

## 本機預覽及驗證

```sh
npm ci
npm run dev
```

開啟 http://localhost:3000（同時提供網頁與 API）。不要直接雙擊 HTML，因為 API 需要伺服器執行。

```sh
npm test
npm run build
```

30 項測試覆蓋實況欄位、澳門日期、七日 XML、警告、無效資料、逐小時資料、部分失敗、503／405、UV 零值、空氣濃度與單位、AQI 有效日期、各站小數精度、自動場景更新、日出日落、跨日、首次載入失敗與更新失敗。`test/fixtures` 為 2026-11-05 至 2026-11-06 抓取的真實資料快照，只供測試，正式 API 不讀取快照。

參考 Vercel Node.js Function 文件：https://vercel.com/docs/functions/runtimes/node-js

## 城市環境資料目錄

新增資料均由使用者指定的政府開放平台「城市環境」分類確認：

- 即時紫外線：https://data.gov.mo/Detail?id=2c13addd-a91b-436a-a3e2-84ec895b68b6
- 污染物濃度：https://data.gov.mo/Detail?id=8d089bb5-5b2d-4b56-9f47-efbc35fe8870
- AQI 預報：https://data.gov.mo/Detail?id=4591e04c-e63e-467e-af72-d40c20210a42
- 完整實時天氣：https://data.gov.mo/Detail?id=712bf9fa-2ec1-4762-aa55-2cdaf23dd563

污染物單位依 SMG 官方定義：PM2.5、PM10、NO₂、O₃、SO₂ 為 µg/m³，CO 為 mg/m³。參考：https://cms.smg.gov.mo/uploads/tinymce/sitecontent/CCAA/IQA/New_Definition_of_Air_Quality_Index.pdf 。本頁顯示每小時濃度，沒有將它們自行換算成即時 AQI。

## 天空 Render

`assets/clouds/` 四張 PNG 來自使用者新提供的 `apple-weather-cloud-kit.zip`，依該包 `RENDER_TUTORIAL.md` 的四層 Canvas 2D 參數實作：5／11／22／42 px/s、無縫平鋪、預縮放快取、天氣參數緩動與日夜雲色。原包聲明素材可自由使用、修改與商用，不含 Apple 專有素材。雨絲、雷電等沿用原有渲染。遵守減少動態效果，背景分頁及離開首屏時暫停。

桌面 1280px 與手機 390px 已實際驗證，頁面沒有橫向溢出；數據表可獨立橫向捲動。設計說明及自檢畫面位於 `docs/`；未進行獨立評分。

## 即時警告與首屏資訊

`/api/warnings` 直接平行讀取 https://xml.smg.gov.mo/ 所列六個獨立警告 XML：熱帶氣旋、暴雨、季候風、雷暴、風暴潮、海嘯。此接口獨立於一般天氣更新，瀏覽器每 60 秒及回到前景時查詢，完整成功回應只快取 30 秒，不使用 stale-while-revalidate；部分失敗不快取。

官方 `Status` 定義：0 沒有警告、1 現正懸掛、2 除下、3 沒有警告下的預報。發布／發出時間是公告變更時間，不當成讀取失敗。警告生效時置頂顯示信號名稱、官方圖示、發出時間、原文摘要及官方公告連結。未知或失敗不視為無警告；先前生效的信號若未能重新確認，保留並顯示「狀態待確認」，收到明確取消狀態才移除。

颱風與黃／紅／黑暴雨圖示使用未改動的 SMG 官方原圖，存於 `assets/warnings/`。核實來源：

- 熱帶氣旋信號圖示：https://www.smg.gov.mo/zh/subpage/28/page/326
- 暴雨信號之意義：https://www.smg.gov.mo/zh/subpage/33/page/85

優先採用 XML 的 `IconURL`；已核實信號使用本機官方原圖，其他警告使用 XML 所供圖示。圖示失敗時保留文字與通用提醒圖形。沒有生效警告時只顯示安靜的一行狀態。

即時詳情已移到天空首屏，按降雨機率、風速、濕度、紫外線排列。刪除重複導讀、段落標題及頁尾宣傳文字，保留單位、觀測時間、資料來源及預報標示。

30 項測試包含新增的警告生效／取消／預告、黃紅黑雨級別、官方圖示網址、部分來源失敗、舊警告確認失敗和獨立警告更新。桌面 1280px、手機 390px 已檢查；無警告時四項即時詳情全部位於手機首屏。`docs/screenshots/warning-scenario-mobile.jpg` 為明確標記的本機測試情境，並非真實警告；正式網站只讀官方實際狀態。

## 七日溫度區間與日出日落

七日預報使用共同最高最低溫刻度計算溫度條的相對位置；條內每個顏色則按實際攝氏溫度用固定色階映射（低溫藍、高溫橙），不同日期的同一溫度會保持一致的顏色。逐日官方天氣描述及相對濕度在手機和桌面均保留為可見簡報。新版 CSS 是唯一七日列表樣式來源，已移除舊七欄版的右邊框。

日出及日落以同一組精簡、柔和配色的 SVG 天氣圖示呈現，保留真實來源時間及日照進度。

### 原有資料結構及缺值規則


七日預報改為逐日列表，每日溫度區間條均使用七日預測值的全局最低／最高溫作共同刻度。當日有有效實測氣溫且落於當日預測範圍內時，顯示目前氣溫圓點。官方濕度及文字描述保留；未有將濕度當作降雨機率。資料不可用時顯示「—」。

日出日落使用現有 Open-Meteo `hourly.solar` 資料（`daily=sunrise,sunset`），按照澳門日期選取並以 `Asia/Macau` 24 小時制顯示。進度條顯示日照進程與日出前、日落後狀態。若來源失效，標記資料暫缺，不把天空動畫的估算日照混作官方時間。

## 當日預測高低溫

`dailyForecast` 直接使用 `https://xml.smg.gov.mo/c_7daysforecast.xml` 中 `ValidFor` 等於澳門當日日期的一筆資料，依 `Temperature/Type` 的 1／2 取得最高／最低。不以第一筆資料位置或其他日期代替。原有 `current.high`／`low` 欄位同步回傳這組預測值，並以 `current.extrema.kind = forecast_daily` 標明語義；原簡報的實測高低溫另存 `observedHigh`／`observedLow`，兩者不混用。
