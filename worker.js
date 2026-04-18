/**
 * Cloudflare Worker — CORS-прокси для graphql.kinopoisk.ru
 *
 * Деплой:
 *   1. Зайти на https://dash.cloudflare.com → Workers & Pages → Create
 *   2. Вставить этот код в редактор и нажать «Deploy»
 *   3. Скопировать URL вида https://kpg-proxy.YOUR_NAME.workers.dev
 *   4. Вставить этот URL в переменную PROXY_URL в kp-graphql-client.js
 *
 * Worker принимает POST и OPTIONS на любой путь.
 * Пробрасывает запрос на graphql.kinopoisk.ru с нужными заголовками.
 * Добавляет CORS-заголовки в ответ, чтобы браузер не блокировал.
 */

const TARGET_ORIGIN = 'https://graphql.kinopoisk.ru';

/** Заголовки, которые нужно пробросить на KP (аналог default.txt) */
const KP_HEADERS = {
  'accept':                     'application/json',
  'accept-language':            'ru,en;q=0.9',
  'content-type':               'application/json',
  'origin':                     'https://www.kinopoisk.ru',
  'referer':                    'https://www.kinopoisk.ru/',
  'sec-fetch-dest':             'empty',
  'sec-fetch-mode':             'cors',
  'sec-fetch-site':             'same-site',
  'service-id':                 '25',
  'user-agent':                 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 YaBrowser/24.12.0.0 Safari/537.36',
  'x-preferred-language':       'ru',
};

/** CORS-заголовки для ответа браузеру */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, service-id, x-preferred-language',
  'Access-Control-Max-Age':       '86400',
};

export default {
  async fetch(request, env, ctx) {
    // Preflight OPTIONS — сразу отвечаем
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return new Response('Only POST is supported', {
        status: 405,
        headers: { ...CORS_HEADERS, 'Content-Type': 'text/plain' },
      });
    }

    // Берём параметры из URL (operationName)
    const url = new URL(request.url);
    const targetUrl = TARGET_ORIGIN + '/graphql/' + url.search; // ?operationName=...

    let body;
    try {
      body = await request.text();
    } catch {
      return new Response('Bad request body', { status: 400, headers: CORS_HEADERS });
    }

    let kpResponse;
    try {
      kpResponse = await fetch(targetUrl, {
        method:  'POST',
        headers: KP_HEADERS,
        body:    body,
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const responseBody = await kpResponse.arrayBuffer();

    return new Response(responseBody, {
      status:  kpResponse.status,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': kpResponse.headers.get('Content-Type') || 'application/json',
        'X-Proxied-Status': String(kpResponse.status),
      },
    });
  },
};
