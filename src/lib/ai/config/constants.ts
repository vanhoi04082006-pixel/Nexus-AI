// ai/config/constants.ts — Pipeline configuration constants

export const REQ_TIMEOUT = 300000; // 5 min — slow models need time
export const MAX_RETRIES = 5;
export const INIT_DELAY = 2000;
export const BACKOFF_MULT = 2;
export const MAX_DELAY = 60000;
export const RATE_LIMIT_DELAY = 60000;
export const MAX_CONCURRENCY = 3;

export const MODEL_TIMEOUTS: Record<string, number> = {
  "nvidia/nemotron-3-ultra-550b-a55b:free": 300000,
  "nvidia/nemotron-3-super-120b-a12b:free": 240000,
  "openai/gpt-oss-120b:free": 180000,
  "google/gemma-4-31b-it:free": 120000,
  "google/gemma-4-26b-a4b-it:free": 90000,
  "qwen/qwen3-coder:free": 120000,
  "qwen/qwen3-next-80b-a3b-instruct:free": 120000,
};

export function getAdaptiveTimeout(model: string): number {
  return MODEL_TIMEOUTS[model] ?? REQ_TIMEOUT;
}

export const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export function jitteredDelay(base: number, attempt: number): number {
  const ceiling = Math.min(base * Math.pow(BACKOFF_MULT, attempt), MAX_DELAY);
  return Math.floor(Math.random() * ceiling);
}

export const JSON_INSTRUCTION = `TRA VE JSON THUAN TUY (pure JSON). He thong da bat response_format: json_object — model bat buoc tra JSON hop le. Tuyet doi KHONG dung markdown code block, KHONG comment, KHONG trailing comma. Tat ca string phai dung \\n cho xuong dong. Neu khong biet gia tri thi dung "" hoac [].`;

export const FEW_SHOT_NOTE = `
FEW-SHOT EXAMPLE (dung de huong dan):
  DUNG: "desc": "He thong quan ly nhan su cho cong ty 500 nhan vien. Nguoi dung cuoi la HR Manager va Employee. Giai quyet van de quan ly cham cong, nghi phep, luong. Quy mo: web app voi 8 module chinh."
  SAI: "desc": "Quan ly nhan su" (qua ngan, khong co chi tiet)

NEGATIVE EXAMPLE (KHONG DUOC lam):
  - KHONG dung ten chung chung nhu "User", "Course", "Student" neu du an la "quan ly benh vien" — phai dung "Bệnh nhân", "Bác sĩ", "Đơn thuốc"
  - KHONG bo trong bat ky field nao — moi field phai co noi dung day du
  - KHONG trung lap entity/module — kiem tra lai danh sach truoc khi them
  - KHONG dat ten khong phu hop voi chu de du an`;

export function compressContext(json: string, maxLen = 3000): string {
  if (json.length <= maxLen) return json;
  const head = Math.floor(maxLen * 0.6);
  const tail = Math.floor(maxLen * 0.3);
  return json.substring(0, head) + "\n...[COMPRESSED " + (json.length - head - tail) + " chars]...\n" + json.substring(json.length - tail);
}
