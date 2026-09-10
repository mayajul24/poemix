# גזירה

PWA שמדמה שירת גזירים (cut-up poetry): כותבים או מעלים טקסט, האפליקציה "כותבת" אותו על דף, גוזרת לשורות ואז חותכת כל שורה במיקום אקראי בין מילים. השורות מתפזרות על שולחן, וגוררים אותן באצבע כדי להרכיב מהן שיר קצר.

## פיתוח

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Stack: React + TypeScript + Vite, `vite-plugin-pwa` (מותקן, עובד אופליין), `mammoth` לחילוץ טקסט מקובצי `.docx`.
