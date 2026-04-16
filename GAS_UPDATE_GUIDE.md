# Hướng dẫn cập nhật GAS Script để đồng bộ cột Project

## Vấn đề
Script cũ không đọc field `project` từ payload → cột F (Project) luôn trống hoặc sai.

## Các thay đổi trong `Code_Fixed_UPDATED.gs`

### 1. Đọc project từ payload (dòng ~70)
```js
const project = cleanText(data.project || data.Project || "UrGift");
```

### 2. Ghi project vào sheet (dòng ~90)
```js
setCellByHeader(rowData, headerMap, "Project", project);
```

### 3. Alias header (dòng ~209)
```js
"project": ["project", "du an"]
```

## Cách deploy

1. Mở Google Sheet: https://docs.google.com/spreadsheets/d/1VdycOwMxhEY62_Ws3QAXYIydvsKftsSh3EEyNdMbrJM
2. **Extensions > Apps Script**
3. Xóa toàn bộ code cũ, paste nội dung file `Code_Fixed_UPDATED.gs`
4. **Deploy > Manage deployments > Edit (bút chì) > New version > Deploy**
5. Giữ nguyên URL cũ (không cần đổi URL trong PWA)
