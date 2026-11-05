# 澳門天氣 · Vercel 實時資料版

靜態網頁搭配 Vercel Node.js Function `/api/weather`。已取代原本 Cloudflare Pages Function；無需資料庫。

- 正式網站：https://macau-weather.vercel.app
- 正式 API：https://macau-weather.vercel.app/api/weather
- GitHub：https://github.com/HiNesslio/macau-weather
- Vercel 已連接 GitHub 的 `main` 分支，推送更新會自動部署。

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
| 氣溫、今日最高／最低、濕度、風速／風向、天氣描述、體感評級 | SMG `c_actual_brief.xml` | 體感為官方文字評級，沒有虛構體感溫度 |
| 今日文字預報 | SMG `c_forecast.xml` | 按澳門日期選擇有效預報 |
| 七日高低溫、濕度、文字預報 | SMG 七日 RSS | 直接解析官方日期和數值 |
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

19 項測試覆蓋實況欄位、澳門日期、七日 RSS、警告、無效資料、逐小時資料、部分失敗、503／405、UV 零值、空氣濃度與單位、AQI 有效日期、各站小數精度、自動場景更新、日出日落、跨日、首次載入失敗與更新失敗。`test/fixtures` 為 2026-11-05 抓取的真實資料快照，只供測試，正式 API 不讀取快照。

參考 Vercel Node.js Function 文件：https://vercel.com/docs/functions/runtimes/node-js

## 城市環境資料目錄

新增資料均由使用者指定的政府開放平台「城市環境」分類確認：

- 即時紫外線：https://data.gov.mo/Detail?id=2c13addd-a91b-436a-a3e2-84ec895b68b6
- 污染物濃度：https://data.gov.mo/Detail?id=8d089bb5-5b2d-4b56-9f47-efbc35fe8870
- AQI 預報：https://data.gov.mo/Detail?id=4591e04c-e63e-467e-af72-d40c20210a42
- 完整實時天氣：https://data.gov.mo/Detail?id=712bf9fa-2ec1-4762-aa55-2cdaf23dd563

污染物單位依 SMG 官方定義：PM2.5、PM10、NO₂、O₃、SO₂ 為 µg/m³，CO 為 mg/m³。參考：https://cms.smg.gov.mo/uploads/tinymce/sitecontent/CCAA/IQA/New_Definition_of_Air_Quality_Index.pdf 。本頁顯示每小時濃度，沒有將它們自行換算成即時 AQI。

## 天空 Render

`assets/clouds/` 四張 WebP 來自使用者提供的 `Desktop/weather/`，依該包 `RENDER_TUTORIAL.md` 的四層 Canvas 2D 參數實作：5／11／22／42 px/s、無縫平鋪、預縮放快取、天氣參數緩動與日夜雲色。原包聲明素材可自由使用、修改與商用，不含 Apple 專有素材。雨絲、雷電等沿用原有渲染。遵守減少動態效果，背景分頁及離開首屏時暫停。

桌面 1280px 與手機 390px 已實際驗證，頁面沒有橫向溢出；數據表可獨立橫向捲動。設計說明及自檢畫面位於 `docs/`；未進行獨立評分。
