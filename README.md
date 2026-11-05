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

部署完成後，開啟 `/api/weather`，應收到 JSON；完整成功時 `unavailable` 為 `[]`。再確認首頁實況時間、七日預報和逐小時圖表。此專案已於 2026-11-05 部署至 Vercel，公開首頁及正式 API 均已驗證；五個資料來源均成功回應。

## 實際資料來源

| 資料 | 來源 | 備註 |
| --- | --- | --- |
| 氣溫、今日最高／最低、濕度、風速／風向、天氣描述、體感評級 | SMG `c_actual_brief.xml` | 體感為官方文字評級，沒有虛構體感溫度 |
| 今日文字預報 | SMG `c_forecast.xml` | 按澳門日期選擇有效預報 |
| 七日高低溫、濕度、文字預報 | SMG 七日 RSS | 直接解析官方日期和數值 |
| 各類警告狀態 | SMG 警告 RSS | 解析表格；區分沒有警告、生效及無法確認 |
| 未來 12 小時氣溫、降雨機率 | Open-Meteo Forecast API | 澳門座標 22.1987, 113.5439；模型預報，並非 SMG 觀測 |
| 空氣質量、紫外線 | 尚未接入 | 顯示「—／未提供」 |

來源網址完整列於 `lib/weather.js` 和 API 回應 `sourceUrls`。網頁有來源與 Open-Meteo CC BY 4.0 標示。Open-Meteo 免費接口的非商業用途與用量限制請參閱 https://open-meteo.com/en/terms 與 https://open-meteo.com/en/pricing；商業服務需改用其授權方案。

## 更新與失敗處理

瀏覽器每 5 分鐘更新；Vercel CDN 對完整成功回應快取 5 分鐘，可在重新驗證時使用短暫舊快取。各來源平行請求，8 秒逾時。部分來源失敗時保留其餘資料並回傳 `unavailable`，部分失敗與完全失敗不快取；完全失敗回傳 503。

頁面同時標示官方實況時間及取得時間。實況超過 90 分鐘會提示可能過期；重新整理失敗時顯示上次資料並提示。未取得數值不以模擬資料填補。手動天氣場景僅改變動畫，標示「場景預覽」，不改變數據。

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

9 項測試覆蓋實況欄位、澳門日期、七日 RSS、警告生效判讀、無效資料、逐小時資料、部分失敗、503／405 與前端語法。`test/fixtures` 為 2026-11-05 抓取的真實資料快照，只供測試，正式 API 不讀取快照。

參考 Vercel Node.js Function 文件：https://vercel.com/docs/functions/runtimes/node-js
