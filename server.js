import axios from "axios";

let cachedToken = null;
let tokenExpiresAt = 0;

export async function getKisAccessToken() {
  const now = Date.now();

  // 만료 1분 전까지는 기존 토큰 재사용
  if (cachedToken && now < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const baseUrl = process.env.KIS_BASE_URL;
  const appKey = process.env.KIS_APP_KEY;
  const appSecret = process.env.KIS_APP_SECRET;

  if (!baseUrl || !appKey || !appSecret) {
    throw new Error("KIS_BASE_URL, KIS_APP_KEY, KIS_APP_SECRET 환경변수를 확인하세요.");
  }

  const url = `${baseUrl}/oauth2/tokenP`;

  const response = await axios.post(
    url,
    {
      grant_type: "client_credentials",
      appkey: appKey,
      appsecret: appSecret,
    },
    {
      headers: {
        "content-type": "application/json; charset=utf-8",
      },
      timeout: 10000,
    }
  );

  const accessToken = response.data?.access_token;
  const expiresIn = Number(response.data?.expires_in || 0);

  if (!accessToken) {
    throw new Error("한투 access_token 발급 실패");
  }

  cachedToken = accessToken;
  tokenExpiresAt = Date.now() + Math.max(expiresIn, 3600) * 1000;

  return cachedToken;
}
