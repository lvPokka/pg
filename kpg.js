/**
 * kp-graphql-client.js  —  Lampa plugin: source «KPG»
 *
 * Источник данных для Lampa на базе graphql.kinopoisk.ru.
 * Архитектура повторяет оригинальный client-plugin.js (KP source),
 * но вместо kinopoiskapiunofficial.tech использует официальный GraphQL API.
 *
 * Установка: вставить URL файла в поле «Плагины» в настройках Lampa.
 */
(function () {
  'use strict';

  // ─────────────────────────────────────────────────────────────
  // Константы
  // ─────────────────────────────────────────────────────────────

  var SOURCE_NAME = 'KPG';
  var SOURCE_TITLE = 'KPG';

  /**
   * URL вашего PHP-прокси (см. proxy.php).
   * Загрузите proxy.php на ваш сайт и вставьте сюда полный URL, например:
   *   'https://example.com/proxy.php'
   * Пока пустой — плагин пробует прямой запрос, при CORS-ошибке упадёт.
   */
  var PROXY_URL = 'https://pokkahub.duckdns.org/lampaProxy.php';

  var GRAPHQL_DIRECT = 'https://graphql.kinopoisk.ru/graphql/?operationName={op}';

  // Статистика для умного переключения прямой/прокси (аналог оригинального плагина)
  var _totalReq = 0;  // всего прямых попыток
  var _goodProxy = 0;  // успехов через прокси
  var _failProxy = 0;  // ошибок через прокси

  /** Заголовки из kinopapi/templates/headers/default.txt */
  var DEFAULT_HEADERS = {
    'accept': 'application/json',
    'accept-encoding': 'identity',
    'accept-language': 'ru,en;q=0.9',
    'content-type': 'application/json',
    'origin': 'https://www.kinopoisk.ru',
    'priority': 'u=1, i',
    'referer': 'https://www.kinopoisk.ru/',
    'sec-ch-ua': '"Chromium";v="130", "YaBrowser";v="24.12", "Not?A_Brand";v="99", "Yowser";v="2.5"',
    'sec-ch-ua-full-version-list': '"Chromium";v="130.0.6723.170", "YaBrowser";v="24.12.3.781", "Not?A_Brand";v="99.0.0.0", "Yowser";v="2.5"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-ch-ua-platform-version': '10.0.0',
    'sec-ch-ua-wow64': '?0',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-site',
    'service-id': '25',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 YaBrowser/24.12.0.0 Safari/537.36',
    'x-preferred-language': 'ru',
  };

  var CLIENT_CONTEXT = {
    clientName: 'web',
    paymentType: 'NATIVE',
    context: [{ name: 'point_of_sale', value: 'filmPage' }],
  };

  // ─────────────────────────────────────────────────────────────
  // GraphQL-запросы (из kinopapi/templates/bodies/*/*.json)
  // ─────────────────────────────────────────────────────────────

  var GQL = {};

  /* SuggestSearch */
  GQL.SuggestSearch = 'query SuggestSearch($keyword: String!, $yandexCityId: Int, $limit: Int) { suggest(keyword: $keyword) { top(yandexCityId: $yandexCityId, limit: $limit) { topResult { global { ...SuggestMovieItem ...SuggestPersonItem __typename } __typename } movies { movie { ...SuggestMovieItem __typename } __typename } persons { person { ...SuggestPersonItem __typename } __typename } cinemas { cinema { id ctitle: title city { id name geoId __typename } __typename } __typename } movieLists { movieList { id cover { avatarsUrl __typename } name url __typename } __typename } __typename } __typename } } fragment SuggestMovieItem on Movie { id contentId title { russian original __typename } rating { kinopoisk { isActive value __typename } __typename } poster { avatarsUrl fallbackUrl __typename } viewOption { buttonText isAvailableOnline: isWatchable(filter: {anyDevice: false, anyRegion: false}) purchasabilityStatus contentPackageToBuy { billingFeatureName __typename } type availabilityAnnounce { groupPeriodType announcePromise availabilityDate type __typename } __typename } ... on Film { type productionYear __typename } ... on TvSeries { releaseYears { end start __typename } __typename } ... on TvShow { releaseYears { end start __typename } __typename } ... on MiniSeries { releaseYears { end start __typename } __typename } __typename } fragment SuggestPersonItem on Person { id name originalName birthDate poster { avatarsUrl fallbackUrl __typename } __typename }';

  /* FilmBaseInfo */
  GQL.FilmBaseInfo = 'query FilmBaseInfo($filmId: Long!, $isAuthorized: Boolean!, $clientContext: BillingFeatureClientContextInput!, $checkSilentInvoiceAvailability: Boolean!, $actorsLimit: Int, $voiceOverActorsLimit: Int, $relatedMoviesLimit: Int) { film(id: $filmId) { id contentId type isTvOnly shortDescription synopsis title { russian english original __typename } productionYear genres { id name slug __typename } countries { id name __typename } restriction { age mpaa __typename } mainTrailer { id title preview { avatarsUrl fallbackUrl __typename } duration streamUrl __typename } cover { image { avatarsUrl fallbackUrl __typename } __typename } poster { avatarsUrl fallbackUrl __typename } rating { imdb { value isActive count __typename } kinopoisk { value isActive count __typename } russianCritics { value isActive count __typename } worldwideCritics { value count isActive __typename } reviewCount { value __typename } __typename } duration actors: members(limit: $actorsLimit, role: [ACTOR, CAMEO, UNCREDITED]) { items { person { id name originalName __typename } __typename } total __typename } directors: members(role: DIRECTOR, limit: 4) { items { person { id name originalName __typename } __typename } __typename } writers: members(role: WRITER, limit: 4) { items { person { id name originalName __typename } __typename } __typename } producers: members(role: PRODUCER, limit: 4) { items { person { id name originalName __typename } __typename } __typename } tagline viewOption { type purchasabilityStatus buttonText isAvailableOnline: isWatchable(filter: {anyDevice: false, anyRegion: false}) availabilityAnnounce { availabilityDate groupPeriodType type announcePromise __typename } __typename } worldPremiere { incompleteDate { accuracy date __typename } __typename } distribution { rusRelease: releases(types: [CINEMA], rerelease: false, countryId: 2, limit: 1) { items { date { accuracy date __typename } __typename } __typename } __typename } sequelsPrequels: relatedMovies(limit: $relatedMoviesLimit, type: [BEFORE, AFTER, REMAKE], orderBy: PREMIERE_DATE_ASC) { items { relationType movie { id title { russian english original __typename } countries { id name __typename } poster { avatarsUrl fallbackUrl __typename } genres { id name slug __typename } rating { kinopoisk { value isActive count __typename } __typename } ... on Film { productionYear __typename } ... on TvSeries { releaseYears { start end __typename } __typename } __typename } __typename } __typename } boxOffice { budget { amount currency { symbol __typename } __typename } worldBox { amount currency { symbol __typename } __typename } __typename } __typename } } ';

  /* TvSeriesBaseInfo */
  GQL.TvSeriesBaseInfo = 'query TvSeriesBaseInfo($tvSeriesId: Long!, $isAuthorized: Boolean!, $clientContext: BillingFeatureClientContextInput!, $checkSilentInvoiceAvailability: Boolean!, $actorsLimit: Int, $voiceOverActorsLimit: Int, $relatedMoviesLimit: Int) { tvSeries(id: $tvSeriesId) { id contentId title { russian original __typename } productionYear shortDescription synopsis releaseYears { start end __typename } genres { id name slug __typename } countries { id name __typename } seasons { total __typename } restriction { age mpaa __typename } cover { image { avatarsUrl fallbackUrl __typename } __typename } poster { avatarsUrl fallbackUrl __typename } rating { imdb { value isActive count __typename } kinopoisk { value isActive count __typename } russianCritics { value isActive count __typename } worldwideCritics { value count isActive __typename } reviewCount { value __typename } __typename } seriesDuration totalDuration actors: members(limit: $actorsLimit, role: [ACTOR, CAMEO, UNCREDITED]) { items { person { id name originalName __typename } __typename } total __typename } directors: members(role: DIRECTOR, limit: 4) { items { person { id name originalName __typename } __typename } __typename } writers: members(role: WRITER, limit: 4) { items { person { id name originalName __typename } __typename } __typename } producers: members(role: PRODUCER, limit: 4) { items { person { id name originalName __typename } __typename } __typename } tagline mainTrailer { id title preview { avatarsUrl fallbackUrl __typename } duration streamUrl __typename } viewOption { type purchasabilityStatus buttonText isAvailableOnline: isWatchable(filter: {anyDevice: false, anyRegion: false}) availabilityAnnounce { availabilityDate groupPeriodType type announcePromise __typename } __typename } sequelsPrequels: relatedMovies(limit: $relatedMoviesLimit, type: [BEFORE, AFTER, REMAKE], orderBy: PREMIERE_DATE_ASC) { items { relationType movie { id title { russian english original __typename } countries { id name __typename } poster { avatarsUrl fallbackUrl __typename } genres { id name slug __typename } rating { kinopoisk { value isActive count __typename } __typename } ... on Film { productionYear __typename } ... on TvSeries { releaseYears { start end __typename } __typename } __typename } __typename } __typename } __typename } } ';

  /* TvSeriesEpisodes */
  GQL.TvSeriesEpisodes = 'query TvSeriesEpisodes($tvSeriesId: Long!, $episodesLimit: Int = 200) { tvSeries(id: $tvSeriesId) { id episodesCount releasedEpisodes: episodes(released: true, limit: $episodesLimit, orderBy: SEASON_NUMBER_EPISODE_NUMBER_ASC) { items { id number releaseDate { accuracy date __typename } season { number __typename } title { russian original __typename } __typename } __typename } __typename } } ';

  /* FilmSimilarMovies */
  GQL.FilmSimilarMovies = 'query FilmSimilarMovies($filmId: Long!, $similarMoviesLimit: Int = 10) { film(id: $filmId) { id userRecommendations(limit: $similarMoviesLimit) { items { movie { id title { russian english original __typename } countries { id name __typename } poster { avatarsUrl fallbackUrl __typename } genres { id name slug __typename } rating { kinopoisk { value isActive count __typename } __typename } ... on Film { productionYear __typename } ... on TvSeries { releaseYears { start end __typename } __typename } __typename } __typename } __typename } __typename } } ';

  /* TvSeriesSimilarMovies */
  GQL.TvSeriesSimilarMovies = 'query TvSeriesSimilarMovies($tvSeriesId: Long!, $similarMoviesLimit: Int = 10) { tvSeries(id: $tvSeriesId) { id userRecommendations(limit: $similarMoviesLimit) { items { movie { id title { russian english original __typename } countries { id name __typename } poster { avatarsUrl fallbackUrl __typename } genres { id name slug __typename } rating { kinopoisk { value isActive count __typename } __typename } ... on Film { productionYear __typename } ... on TvSeries { releaseYears { start end __typename } __typename } __typename } __typename } __typename } __typename } } ';

  /* PersonPreviewCard */
  GQL.PersonPreviewCard = 'query PersonPreviewCard($personId: Long!, $rolesLimit: Int = 10, $bestMoviesLimit: Int = 30) { person(id: $personId) { id poster { avatarsUrl fallbackUrl __typename } name originalName birthDate birthPlace deathDate sex roles(limit: $rolesLimit, isCareer: true) { items { role { title { russian __typename } __typename } __typename } __typename } bestFilms: bestMovies(limit: $bestMoviesLimit, type: FILM) { items { movie { id title { russian original __typename } poster { avatarsUrl fallbackUrl __typename } rating { kinopoisk { value isActive __typename } __typename } ... on Film { productionYear __typename } __typename } __typename } __typename } bestSeries: bestMovies(limit: $bestMoviesLimit, type: SERIES) { items { movie { id title { russian original __typename } poster { avatarsUrl fallbackUrl __typename } rating { kinopoisk { value isActive __typename } __typename } ... on TvSeries { releaseYears { start end __typename } __typename } __typename } __typename } __typename } __typename } } ';

  // ─────────────────────────────────────────────────────────────
  // Сетевой уровень
  // ─────────────────────────────────────────────────────────────

  var cache = {};
  var CACHE_SIZE = 100;
  var CACHE_TIME = 1000 * 60 * 60; // 1 час

  function getCache(key) {
    var res = cache[key];
    if (res) {
      var cutoff = new Date().getTime() - CACHE_TIME;
      if (res.timestamp > cutoff) return res.value;
      for (var k in cache) {
        if (cache[k] && cache[k].timestamp <= cutoff) delete cache[k];
      }
    }
    return null;
  }

  function setCache(key, value) {
    var now = new Date().getTime();
    var keys = Object.keys(cache);
    if (keys.length >= CACHE_SIZE) {
      var oldest = keys.reduce(function (a, b) {
        return (cache[a] && cache[a].timestamp || 0) < (cache[b] && cache[b].timestamp || 0) ? a : b;
      });
      delete cache[oldest];
    }
    cache[key] = { timestamp: now, value: value };
  }

  var _fetchFn = (typeof globalThis !== 'undefined' && globalThis.fetch) ||
    (typeof window !== 'undefined' && window.fetch) || null;

  /**
   * Базовый fetch-POST на GraphQL.
   * url     — полный URL (прямой или через прокси)
   * headers — заголовки (прямые включают KP-специфику; прокси — только content-type)
   */
  function _doFetch(url, headers, bodyStr, oncomplete, onerror) {
    _fetchFn(url, { method: 'POST', headers: headers, body: bodyStr })
      .then(function (resp) {
        if (!resp.ok) {
          var err = new Error('HTTP ' + resp.status);
          err.status = resp.status;
          throw err;
        }
        return resp.json();
      })
      .then(function (json) {
        if (json && json.data) {
          oncomplete(json.data);
        } else {
          // GraphQL вернул errors вместо data
          var e = new Error('GraphQL error');
          e.gql = json;
          onerror(e);
        }
      })
      .catch(onerror);
  }

  /**
   * Попытка через PHP CORS-прокси (proxy.php).
   * Прокси сам проставит нужные KP-заголовки, нам достаточно передать тело.
   * URL: https://example.com/proxy.php?operationName=SuggestSearch
   */
  function _viaProxy(operationName, bodyStr, oncomplete, onerror) {
    if (!PROXY_URL) {
      onerror(new Error('PROXY_URL not set'));
      return;
    }
    // proxy.php принимает operationName как query-параметр
    var proxyUrl = PROXY_URL.replace(/\/$/, '') +
      '?operationName=' + operationName;
    // Прокси принимает только content-type — остальное добавит сам
    _doFetch(proxyUrl, { 'content-type': 'application/json' }, bodyStr,
      function (data) {
        _goodProxy++;
        oncomplete(data);
      },
      function (err) {
        _failProxy++;
        onerror(err);
      }
    );
  }

  /**
   * Определяем, стоит ли сразу идти через прокси.
   * Логика аналогична оригинальному плагину:
   * если прокси уже показал себя надёжнее прямых запросов — используем его первым.
   */
  function _preferProxy() {
    return PROXY_URL && _totalReq >= 3 && _goodProxy > _failProxy;
  }

  /**
   * Главная точка входа для всех GraphQL-запросов.
   * Алгоритм:
   *   1. Кэш → сразу возвращаем.
   *   2. Если прокси «зарекомендовал» себя → сразу через прокси.
   *   3. Иначе → прямой запрос.
   *      3a. Прямой упал с CORS/сетевой ошибкой → пробуем прокси.
   *      3b. Прокси тоже упал → onerror.
   */
  function gqlRequest(operationName, variables, oncomplete, onerror) {
    var cacheKey = operationName + ':' + JSON.stringify(variables);
    var cached = getCache(cacheKey);
    if (cached) {
      setTimeout(function () { oncomplete(cached); }, 10);
      return;
    }

    if (!_fetchFn) {
      if (onerror) onerror(new Error('fetch not available'));
      return;
    }

    var bodyStr = JSON.stringify({
      operationName: operationName,
      variables: variables,
      query: GQL[operationName],
    });

    function succeed(data) {
      setCache(cacheKey, data);
      oncomplete(data);
    }

    function tryProxy(originalErr) {
      if (!PROXY_URL) {
        if (onerror) onerror(originalErr);
        return;
      }
      _viaProxy(operationName, bodyStr, succeed, function (proxyErr) {
        console.warn('[KPG] proxy also failed:', proxyErr);
        if (onerror) onerror(proxyErr || originalErr);
      });
    }

    // --- Если прокси уже «горячий» — идём через него сразу
    if (_preferProxy()) {
      _viaProxy(operationName, bodyStr, succeed, function (err) {
        // Прокси подвёл — пробуем напрямую
        var directUrl = GRAPHQL_DIRECT.replace('{op}', operationName);
        _doFetch(directUrl, DEFAULT_HEADERS, bodyStr, succeed, function (e) {
          if (onerror) onerror(e);
        });
      });
      return;
    }

    // --- Прямой запрос (первая попытка)
    _totalReq++;
    var directUrl = GRAPHQL_DIRECT.replace('{op}', operationName);
    _doFetch(directUrl, DEFAULT_HEADERS, bodyStr, succeed, function (err) {
      // Прямой упал → пробуем прокси
      console.warn('[KPG] direct failed (' + (err && err.message) + '), trying proxy...');
      tryProxy(err);
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Конвертеры GraphQL → Lampa
  // ─────────────────────────────────────────────────────────────

  function posterUrl(poster, size) {
    if (!poster || !poster.avatarsUrl) return poster && poster.fallbackUrl || '';
    var base = poster.avatarsUrl;
    if (base.indexOf('//') === 0) base = 'https:' + base;
    return base + '/' + (size || '600x900');
  }

  function getYear(movie) {
    if (movie.productionYear) return movie.productionYear;
    if (movie.releaseYears && movie.releaseYears.length) return movie.releaseYears[0].start;
    return '';
  }

  function getLampaType(gqlTypename) {
    var t = (gqlTypename || '').toLowerCase();
    if (t === 'film' || t === 'video') return 'movie';
    return 'tv'; // tvseries, tvshow, miniseries
  }

  /**
   * Конвертация минимального объекта фильма (из списков/suggest) → элемент Lampa.
   * Аналог convertElem в оригинальном плагине.
   */
  function convertMovie(m) {
    if (!m) return null;
    var typename = m.__typename || '';
    var type = getLampaType(typename);
    var kp_id = m.id || 0;
    var kp_rating = (m.rating && m.rating.kinopoisk && m.rating.kinopoisk.value) || 0;
    var title = (m.title && (m.title.russian || m.title.original)) || '';
    var orig_title = (m.title && (m.title.original || m.title.russian || m.title.english)) || '';
    var year = getYear(m);
    var img = posterUrl(m.poster, '360x540');
    var bg = posterUrl(m.cover && m.cover.image || m.poster, '1024x576');

    var genres = (m.genres || []).map(function (g) {
      return { id: g.id || 0, name: g.name || g.slug || '', url: 'genre' };
    });
    var countries = (m.countries || []).map(function (c) {
      return { name: c.name || '' };
    });

    var result = {
      source: SOURCE_NAME,
      type: type,
      adult: false,
      id: SOURCE_NAME + '_' + kp_id,
      title: title,
      original_title: orig_title,
      overview: m.synopsis || m.shortDescription || '',
      img: img,
      background_image: bg || img,
      genres: genres,
      production_companies: [],
      production_countries: countries,
      vote_average: kp_rating,
      vote_count: (m.rating && m.rating.kinopoisk && m.rating.kinopoisk.count) || 0,
      kinopoisk_id: kp_id,
      kp_rating: kp_rating,
      imdb_id: '',
      imdb_rating: (m.rating && m.rating.imdb && m.rating.imdb.value) || 0,
      tagline: m.tagline || '',
      duration: m.duration || m.seriesDuration || 0,
    };

    // Дата выхода
    if (type === 'tv') {
      result.name = title;
      result.original_name = orig_title;
      result.first_air_date = (m.releaseYears && m.releaseYears[0] && m.releaseYears[0].start + '') || (year + '');
      result.last_air_date = (m.releaseYears && m.releaseYears[0] && m.releaseYears[0].end + '') || '';
    } else {
      result.release_date = year + '';
    }

    return result;
  }

  /**
   * Конвертация полного ответа FilmBaseInfo / TvSeriesBaseInfo → Lampa card.
   */
  function convertFullMovie(m, type) {
    var card = convertMovie(m);
    if (!card) return null;
    card.type = type;

    // Тип: movie/tv уточняем из typename
    card.type = getLampaType(m.__typename || (type === 'tv' ? 'tvseries' : 'film'));

    // Краткое / полное описание
    card.overview = m.synopsis || m.shortDescription || '';

    // Ограничения
    if (m.restriction) {
      card.age_rating = m.restriction.age || '';
      card.mpaa_rating = m.restriction.mpaa || '';
    }

    // Трейлер
    if (m.mainTrailer) {
      card.trailer = {
        id: m.mainTrailer.id,
        title: m.mainTrailer.title || '',
        url: m.mainTrailer.streamUrl || '',
        duration: m.mainTrailer.duration || 0,
        img: posterUrl(m.mainTrailer.preview, '480x270'),
      };
    }

    // Актёры / режиссёры → persons
    var cast = [];
    var crew = [];
    ((m.actors && m.actors.items) || []).forEach(function (item) {
      var p = item.person;
      if (p) cast.push({ id: p.id, name: p.name || p.originalName || '', url: 'person', img: '', job: 'Actor' });
    });
    ((m.directors && m.directors.items) || []).forEach(function (item) {
      var p = item.person;
      if (p) crew.push({ id: p.id, name: p.name || p.originalName || '', url: 'person', img: '', job: 'Director' });
    });
    ((m.writers && m.writers.items) || []).forEach(function (item) {
      var p = item.person;
      if (p) crew.push({ id: p.id, name: p.name || p.originalName || '', url: 'person', img: '', job: 'Writer' });
    });
    ((m.producers && m.producers.items) || []).forEach(function (item) {
      var p = item.person;
      if (p) crew.push({ id: p.id, name: p.name || p.originalName || '', url: 'person', img: '', job: 'Producer' });
    });
    if (cast.length || crew.length) {
      card.persons = { cast: cast, crew: crew };
    }

    // Сиквелы/приквелы → collection
    var relatives = (m.sequelsPrequels && m.sequelsPrequels.items) || [];
    if (relatives.length) {
      card.collection = {
        results: relatives.map(function (item) { return convertMovie(item.movie); }).filter(Boolean),
      };
    }

    // Бюджет / сборы
    if (m.boxOffice) {
      var bo = m.boxOffice;
      card.budget = bo.budget ? { amount: bo.budget.amount, currency: (bo.budget.currency && bo.budget.currency.symbol) || '$' } : null;
      card.worldwide_gross = bo.worldBox ? { amount: bo.worldBox.amount, currency: (bo.worldBox.currency && bo.worldBox.currency.symbol) || '$' } : null;
    }

    // Дата мировой премьеры (более точная, чем просто год)
    if (m.worldPremiere && m.worldPremiere.incompleteDate && m.worldPremiere.incompleteDate.date) {
      var pd = m.worldPremiere.incompleteDate.date;
      if (card.type === 'tv') card.first_air_date = pd;
      else card.release_date = pd;
    }

    // Количество сезонов (для сериалов)
    if (m.seasons && m.seasons.total) {
      card.number_of_seasons = m.seasons.total;
    }

    return card;
  }

  /**
   * Конвертация suggest-ответа → массив Lampa-карточек.
   */
  function convertSuggest(suggestData) {
    var results = [];
    var seen = {};

    function addMovie(movie) {
      if (!movie || !movie.id || seen[movie.id]) return;
      seen[movie.id] = true;
      var card = convertMovie(movie);
      if (card) results.push(card);
    }

    var top = suggestData && suggestData.suggest && suggestData.suggest.top;
    if (!top) return results;

    // topResult
    if (top.topResult && top.topResult.global && top.topResult.global.__typename !== 'Person') {
      addMovie(top.topResult.global);
    }

    // movies
    (top.movies || []).forEach(function (item) { addMovie(item.movie); });

    return results;
  }

  /**
   * Конвертация эпизодов в сезоны для Lampa.
   */
  function convertEpisodesToSeasons(episodes) {
    var seasonsMap = {};
    (episodes || []).forEach(function (ep) {
      var sNum = ep.season && ep.season.number || 1;
      if (!seasonsMap[sNum]) seasonsMap[sNum] = [];
      seasonsMap[sNum].push({
        season_number: sNum,
        episode_number: ep.number,
        name: (ep.title && (ep.title.russian || ep.title.original)) ||
          ('S' + sNum + ' E' + ep.number),
        overview: '',
        air_date: ep.releaseDate && ep.releaseDate.date || '',
      });
    });

    return Object.keys(seasonsMap).sort(function (a, b) { return +a - +b; }).map(function (sNum) {
      var eps = seasonsMap[sNum];
      return {
        season_number: +sNum,
        episode_count: eps.length,
        episodes: eps,
        name: (typeof Lampa !== 'undefined' && Lampa.Lang ? Lampa.Lang.translate('torrent_serial_season') : 'Сезон') + ' ' + sNum,
        overview: '',
      };
    });
  }

  /**
   * Конвертация PersonPreviewCard → Lampa person.
   */
  function convertPerson(p) {
    if (!p) return {};

    var roles = (p.roles && p.roles.items || []).map(function (r) {
      return r.role && r.role.title && r.role.title.russian || '';
    }).filter(Boolean);

    function mapBestMovies(list) {
      return ((list && list.items) || []).map(function (item) {
        var m = item.movie;
        if (!m) return null;
        return convertMovie(m);
      }).filter(Boolean);
    }

    var films = mapBestMovies(p.bestFilms);
    var series = mapBestMovies(p.bestSeries);

    var knownFor = [];
    if (films.length) {
      knownFor.push({ name: 'Фильмы', credits: films.sort(function (a, b) { return b.vote_average - a.vote_average; }) });
    }
    if (series.length) {
      knownFor.push({ name: 'Сериалы', credits: series.sort(function (a, b) { return b.vote_average - a.vote_average; }) });
    }

    return {
      person: {
        id: p.id,
        name: p.name || p.originalName || '',
        url: 'person',
        img: posterUrl(p.poster, '300x400'),
        gender: p.sex === 'MALE' ? 2 : p.sex === 'FEMALE' ? 1 : 0,
        birthday: p.birthDate || '',
        place_of_birth: p.birthPlace || '',
        deathday: p.deathDate || '',
        known_for_department: roles.join(', ') || '',
        biography: '',
      },
      credits: { knownFor: knownFor },
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Методы источника (Lampa Source API)
  // ─────────────────────────────────────────────────────────────

  /**
   * Поиск по названию — вызывается из search / discovery.
   */
  function searchByKeyword(keyword, oncomplete, onerror) {
    gqlRequest('SuggestSearch', { keyword: keyword, yandexCityId: 0, limit: 10 }, function (data) {
      var results = convertSuggest(data);
      oncomplete({
        results: results,
        url: 'suggest',
        page: 1,
        total_pages: 1,
        total_results: results.length,
        more: false,
      });
    }, onerror || function () { });
  }

  /**
   * Загрузка полной карточки фильма или сериала по kinopoisk id.
   * Пробует сначала FilmBaseInfo, при ошибке — TvSeriesBaseInfo.
   */
  function loadFullCard(kp_id, oncomplete, onerror) {
    var baseVars = {
      isAuthorized: false,
      actorsLimit: 20,
      voiceOverActorsLimit: 5,
      relatedMoviesLimit: 14,
      clientContext: CLIENT_CONTEXT,
      checkSilentInvoiceAvailability: false,
    };

    // Пробуем FilmBaseInfo
    gqlRequest('FilmBaseInfo', Object.assign({ filmId: kp_id }, baseVars), function (data) {
      var raw = data && data.film;
      if (raw && raw.id) {
        var card = convertFullMovie(raw, 'movie');
        // Если сериал — догружаем эпизоды
        if (card.type === 'tv' || raw.isTvOnly) {
          card.type = 'tv';
          loadEpisodes(kp_id, card, oncomplete, onerror);
        } else {
          // Похожие
          loadSimilarFilm(kp_id, card, oncomplete, onerror);
        }
      } else {
        // Пробуем TvSeriesBaseInfo
        loadAsTvSeries(kp_id, baseVars, oncomplete, onerror);
      }
    }, function () {
      loadAsTvSeries(kp_id, baseVars, oncomplete, onerror);
    });
  }

  function loadAsTvSeries(kp_id, baseVars, oncomplete, onerror) {
    gqlRequest('TvSeriesBaseInfo', Object.assign({ tvSeriesId: kp_id }, baseVars), function (data) {
      var raw = data && data.tvSeries;
      if (raw && raw.id) {
        var card = convertFullMovie(raw, 'tv');
        card.type = 'tv';
        loadEpisodes(kp_id, card, function (card) {
          loadSimilarTv(kp_id, card, oncomplete, onerror);
        }, onerror);
      } else {
        if (onerror) onerror();
      }
    }, onerror);
  }

  function loadEpisodes(kp_id, card, oncomplete, onerror) {
    gqlRequest('TvSeriesEpisodes', { tvSeriesId: kp_id, episodesLimit: 500 }, function (data) {
      var raw = data && data.tvSeries;
      if (raw && raw.releasedEpisodes && raw.releasedEpisodes.items) {
        card.seasons = convertEpisodesToSeasons(raw.releasedEpisodes.items);
        card.number_of_seasons = card.seasons.length;
        card.number_of_episodes = (raw.episodesCount || 0);
      }
      oncomplete(card);
    }, function () { oncomplete(card); });
  }

  function loadSimilarFilm(kp_id, card, oncomplete, onerror) {
    gqlRequest('FilmSimilarMovies', { filmId: kp_id, similarMoviesLimit: 12 }, function (data) {
      var items = data && data.film && data.film.userRecommendations && data.film.userRecommendations.items || [];
      if (items.length) {
        card.simular = { results: items.map(function (i) { return convertMovie(i.movie); }).filter(Boolean) };
      }
      oncomplete(card);
    }, function () { oncomplete(card); });
  }

  function loadSimilarTv(kp_id, card, oncomplete, onerror) {
    gqlRequest('TvSeriesSimilarMovies', { tvSeriesId: kp_id, similarMoviesLimit: 12 }, function (data) {
      var items = data && data.tvSeries && data.tvSeries.userRecommendations && data.tvSeries.userRecommendations.items || [];
      if (items.length) {
        card.simular = { results: items.map(function (i) { return convertMovie(i.movie); }).filter(Boolean) };
      }
      oncomplete(card);
    }, function () { oncomplete(card); });
  }

  // ─────────────────────────────────────────────────────────────
  // Реализация Lampa Source
  // ─────────────────────────────────────────────────────────────

  var KPG = {

    SOURCE_NAME: SOURCE_NAME,
    SOURCE_TITLE: SOURCE_TITLE,

    /**
     * Главная страница — возвращаем Suggest для пустого запроса.
     * KP GraphQL не имеет открытых коллекций топ-фильмов без авторизации,
     * поэтому показываем несколько жанровых «витрин» через поиск.
     */
    main: function (params, oncomplete, onerror) {
      var showcases = [
        { keyword: 'боевик', title: 'Боевики' },
        { keyword: 'комедия', title: 'Комедии' },
        { keyword: 'триллер', title: 'Триллеры' },
        { keyword: 'мелодрама', title: 'Мелодрамы' },
        { keyword: 'анимация', title: 'Мультфильмы' },
      ];
      var parts_limit = 5;
      var parts_data = showcases.map(function (sc) {
        return function (call) {
          searchByKeyword(sc.keyword, function (json) {
            json.title = sc.title;
            call(json);
          }, call);
        };
      });

      function loadPart(partLoaded, partEmpty) {
        Lampa.Api.partNext(parts_data, parts_limit, partLoaded, partEmpty);
      }

      loadPart(oncomplete, onerror);
      return loadPart;
    },

    /**
     * Список по URL — перенаправляем на search, если URL содержит query.
     */
    list: function (params, oncomplete, onerror) {
      var query = params.query || params.keyword || '';
      if (!query) { if (onerror) onerror(); return; }
      searchByKeyword(decodeURIComponent(query), oncomplete, onerror);
    },

    /**
     * Категальный просмотр.
     */
    category: function (params, oncomplete, onerror) {
      var keyword = params.url || params.genres || 'кино';
      var parts_limit = 3;
      var parts_data = [function (call) {
        searchByKeyword(keyword, function (json) {
          json.title = keyword;
          call(json);
        }, call);
      }];

      function loadPart(partLoaded, partEmpty) {
        Lampa.Api.partNext(parts_data, parts_limit, partLoaded, partEmpty);
      }

      loadPart(oncomplete, onerror);
      return loadPart;
    },

    /**
     * Полная карточка.
     */
    full: function (params, oncomplete, onerror) {
      var kp_id = '';

      if (params.card && params.card.source === SOURCE_NAME) {
        kp_id = params.card.kinopoisk_id;
        if (!kp_id && params.card.id) {
          kp_id = (params.card.id + '').replace(SOURCE_NAME + '_', '');
          params.card.kinopoisk_id = kp_id;
        }
      }

      if (!kp_id) { if (onerror) onerror(); return; }

      loadFullCard(+kp_id, function (card) {
        var status = new Lampa.Status(4);
        status.onComplite = oncomplete;
        status.append('movie', card);
        status.append('persons', card.persons || null);
        status.append('collection', card.collection || null);
        status.append('simular', card.simular || null);
      }, onerror);
    },

    /**
     * Поиск (вызывается из строки поиска Lampa).
     */
    search: function (params, oncomplete) {
      var title = decodeURIComponent(params.query || '');
      var status = new Lampa.Status(1);

      status.onComplite = function (data) {
        var results = (data.query && data.query.results) || [];
        var items = [];

        var movies = results.filter(function (e) { return e.type === 'movie'; });
        var tvs = results.filter(function (e) { return e.type === 'tv'; });

        if (movies.length) items.push({ results: movies, title: Lampa.Lang.translate('menu_movies'), type: 'movie', url: 'suggest', page: 1, total_pages: 1, more: false });
        if (tvs.length) items.push({ results: tvs, title: Lampa.Lang.translate('menu_tv'), type: 'tv', url: 'suggest', page: 1, total_pages: 1, more: false });

        oncomplete(items);
      };

      searchByKeyword(title, function (json) {
        status.append('query', json);
      }, status.error.bind(status));
    },

    /**
     * Discovery — описывает поведение при поиске через интерфейс Lampa.
     */
    discovery: function () {
      return {
        title: SOURCE_TITLE,
        search: KPG.search,
        params: { align_left: true, object: { source: SOURCE_NAME } },
        onMore: function (params) {
          Lampa.Activity.push({
            url: 'suggest',
            title: Lampa.Lang.translate('search') + ' - ' + params.query,
            component: 'category_full',
            page: 1,
            query: encodeURIComponent(params.query),
            source: SOURCE_NAME,
          });
        },
        onCancel: function () { cache = {}; },
      };
    },

    /**
     * Персона.
     */
    person: function (params, oncomplete) {
      var person_id = params.id || 0;
      if (!person_id) { oncomplete({}); return; }

      gqlRequest('PersonPreviewCard', { personId: +person_id, rolesLimit: 10, bestMoviesLimit: 30 }, function (data) {
        var raw = data && data.person;
        oncomplete(convertPerson(raw));
      }, function () { oncomplete({}); });
    },

    /**
     * Сезоны — берём уже загруженные данные из tv-карточки.
     */
    seasons: function (tv, from, oncomplete) {
      var status = new Lampa.Status(from.length);
      status.onComplite = oncomplete;

      from.forEach(function (seasonNum) {
        var seasons = (tv.seasons || []).filter(function (s) {
          return s.season_number === seasonNum;
        });
        if (seasons.length) {
          status.append('' + seasonNum, seasons[0]);
        } else {
          status.error();
        }
      });
    },

    /**
     * Меню — нет жанровых фильтров без авторизации, возвращаем пустой список.
     */
    menu: function (params, oncomplete) {
      oncomplete([]);
    },

    menuCategory: function (params, oncomplete) {
      oncomplete([]);
    },

    /**
     * Сброс кэша и статистики прокси.
     */
    clear: function () {
      cache = {};
      _totalReq = 0;
      _goodProxy = 0;
      _failProxy = 0;
    },

    isDebug: function () { return false; },
    kpFilters: function (params, oncomplete) { oncomplete([], [], {}, {}); },
  };

  // ─────────────────────────────────────────────────────────────
  // Регистрация плагина в Lampa
  // ─────────────────────────────────────────────────────────────

  function startPlugin() {
    window.kpg_source_plugin = true;

    function addPlugin() {
      if (Lampa.Api.sources[KPG.SOURCE_NAME]) {
        Lampa.Noty.show('Уже установлен источник ' + KPG.SOURCE_NAME);
        return;
      }

      Lampa.Api.sources[KPG.SOURCE_NAME] = KPG;
      Object.defineProperty(Lampa.Api.sources, KPG.SOURCE_NAME, {
        get: function () { return KPG; },
      });

      // Добавляем источник в список выбора
      var sources = {};
      if (Lampa.Params.values && Lampa.Params.values['source']) {
        Object.assign(sources, Lampa.Params.values['source']);
        sources[KPG.SOURCE_NAME] = KPG.SOURCE_TITLE;
      } else {
        var known = ['tmdb', 'cub', 'pub', 'filmix', KPG.SOURCE_NAME];
        known.forEach(function (name) {
          if (Lampa.Api.sources[name]) sources[name] = name.toUpperCase();
        });
      }

      Lampa.Params.select('source', sources, 'tmdb');
    }

    if (window.appready) {
      addPlugin();
    } else {
      Lampa.Listener.follow('app', function (e) {
        if (e.type === 'ready') addPlugin();
      });
    }
  }

  if (!window.kpg_source_plugin) startPlugin();

})();
