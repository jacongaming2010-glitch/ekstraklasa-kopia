/*
 * Warstwa autosave + synchronizacji realtime dla symulatora.
 * Ładowana PRZED bundlem aplikacji — podmienia fetch/setInterval,
 * dokłada wskaźnik zapisu, kolejkę offline, ponawianie i realtime.
 */
(function () {
  var URL_STATE = "/api/public/state";
  var SESSION_KEY = "ek-sync-session";
  var APP_SESSION_KEY = "ekstraklasa-session-v1";

  function sessionId() {
    try {
      var v = localStorage.getItem(SESSION_KEY);
      if (!v) {
        v =
          (self.crypto && self.crypto.randomUUID && self.crypto.randomUUID()) ||
          "s_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem(SESSION_KEY, v);
      }
      return v;
    } catch (e) {
      return "s_anon";
    }
  }

  function actor() {
    var role = "guest";
    var club = null;
    try {
      var raw = localStorage.getItem(APP_SESSION_KEY);
      if (raw) {
        var s = JSON.parse(raw);
        role = s.role || "guest";
        club = s.userClubId || null;
      }
    } catch (e) {}
    return { role: role, club: club, name: role === "admin" ? "Admin" : club || "Gość", sessionId: sessionId() };
  }

  /* ---------- wskaźnik statusu ---------- */
  var el = null;
  var state = { status: "idle", lastSync: null, online: navigator.onLine, pending: 0 };

  function mount() {
    if (el || !document.body) return;
    el = document.createElement("div");
    el.setAttribute("data-ek-sync", "");
    el.style.cssText =
      "position:fixed;right:10px;bottom:10px;z-index:99999;font:12px/1.35 ui-sans-serif,system-ui,sans-serif;" +
      "background:rgba(9,12,20,.92);color:#e2e8f0;border:1px solid rgba(255,255,255,.12);border-radius:10px;" +
      "padding:7px 10px;box-shadow:0 6px 20px rgba(0,0,0,.45);pointer-events:none;max-width:280px;backdrop-filter:blur(6px)";
    document.body.appendChild(el);
    render();
  }

  function hhmmss(d) {
    return d
      ? d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      : "—";
  }

  function render() {
    if (!el) return;
    var line;
    if (!state.online) line = "🔌 Brak połączenia — zmiany zostaną zsynchronizowane po ponownym połączeniu.";
    else if (state.status === "saving") line = "🟡 Zapisywanie…";
    else if (state.status === "error") line = "🔴 Błąd zapisu — ponawiam próbę…";
    else if (state.status === "conflict") line = "🟠 Wykryto nowszą wersję — pobieram aktualne dane…";
    else if (state.status === "unauth") line = "🔒 Zaloguj się, aby zapisywać zmiany";
    else if (state.status === "forbidden") line = "🔒 Twoja rola nie pozwala na zapis (tylko podgląd)";
    else if (state.status === "saved") line = "🟢 Zapisano automatycznie";
    else line = "🟢 Połączono";
    el.innerHTML =
      '<div style="font-weight:600">' +
      line +
      "</div>" +
      '<div style="opacity:.65;margin-top:2px">Ostatnia synchronizacja: ' +
      hhmmss(state.lastSync) +
      (state.pending ? " · oczekujące: " + state.pending : "") +
      "</div>";
  }

  function set(status) {
    state.status = status;
    if (status === "saved") state.lastSync = new Date();
    render();
  }

  window.addEventListener("online", function () {
    state.online = true;
    render();
    flush();
    pullNow();
  });
  window.addEventListener("offline", function () {
    state.online = false;
    render();
  });
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", mount);
  else mount();

  /* ---------- kolejka zapisów z ponawianiem ---------- */
  var queued = null; // ostatni (batchowany) payload czekający na wysyłkę
  var retryTimer = null;
  var attempts = 0;
  var nativeFetch = window.fetch.bind(window);

  function flush() {
    if (!queued || retryTimer) return;
    var payload = queued;
    queued = null;
    state.pending = 0;
    send(payload);
  }

  function scheduleRetry(payload) {
    queued = payload;
    state.pending = 1;
    attempts += 1;
    var delay = Math.min(15000, 1000 * Math.pow(2, Math.min(attempts, 4)));
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = setTimeout(function () {
      retryTimer = null;
      if (state.online) flush();
      else scheduleRetry(queued || payload);
    }, delay);
    render();
  }

  function bearer() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf("sb-") === 0 && k.indexOf("-auth-token") !== -1) {
          var v = JSON.parse(localStorage.getItem(k));
          if (v && v.access_token) return "Bearer " + v.access_token;
        }
      }
    } catch (e) {}
    return null;
  }

  function send(payload) {
    set("saving");
    var headers = { "Content-Type": "application/json" };
    var tok = bearer();
    if (tok) headers["Authorization"] = tok;
    return nativeFetch(URL_STATE, {
      method: "PUT",
      headers: headers,
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        if (res.status === 401 || res.status === 403) {
          attempts = 0;
          set(res.status === 401 ? "unauth" : "forbidden");
          return res;
        }
        if (res.status === 409) {
          attempts = 0;
          set("conflict");
          pullNow();
          return res;
        }
        if (!res.ok) throw new Error("http " + res.status);
        attempts = 0;
        set("saved");
        return res;
      })
      .catch(function (err) {
        set("error");
        scheduleRetry(payload);
        throw err;
      });
  }

  /* ---------- przechwycenie zapisów aplikacji ---------- */
  window.fetch = function (input, init) {
    var url = typeof input === "string" ? input : input && input.url;
    var method = ((init && init.method) || (input && input.method) || "GET").toUpperCase();
    if (url && url.indexOf(URL_STATE) !== -1 && method === "PUT" && init && init.body) {
      var payload;
      try {
        payload = JSON.parse(init.body);
      } catch (e) {
        payload = null;
      }
      if (payload) {
        payload.actor = actor();
        // Debounce/batching: nowa zmiana zastępuje oczekującą (ostatni stan wygrywa),
        // dzięki czemu seria szybkich edycji to jeden zapis.
        if (retryTimer || !state.online) {
          scheduleRetry(payload);
          return Promise.resolve(
            new Response(JSON.stringify({ queued: true }), {
              status: 202,
              headers: { "content-type": "application/json" },
            }),
          );
        }
        return send(payload).catch(function () {
          return new Response(JSON.stringify({ queued: true }), {
            status: 202,
            headers: { "content-type": "application/json" },
          });
        });
      }
    }
    return nativeFetch(input, init);
  };

  /* ---------- szybszy pull + wyzwalanie z realtime ---------- */
  var pullFn = null;
  var nativeSetInterval = window.setInterval.bind(window);
  window.setInterval = function (fn, delay) {
    if (delay === 2500 && typeof fn === "function") {
      pullFn = fn;
      return nativeSetInterval(function () {
        fn();
        if (state.online) state.lastSync = state.lastSync || new Date();
        render();
      }, 2000);
    }
    return nativeSetInterval(fn, delay);
  };

  var pullCooldown = 0;
  function pullNow() {
    var now = Date.now();
    if (!pullFn || now - pullCooldown < 300) return;
    pullCooldown = now;
    try {
      pullFn();
      state.lastSync = new Date();
      render();
    } catch (e) {}
  }
  window.__ekPullNow = pullNow;

  /* ---------- Supabase Realtime ---------- */
  var SUPABASE_URL = "https://rdplimboimifssmbxzyz.supabase.co";
  var SUPABASE_KEY = "sb_publishable_GWz1lYr0imPMnNFpdJHx4Q_gN7cbFRo";
  import("https://esm.sh/@supabase/supabase-js@2")
    .then(function (mod) {
      var client = mod.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      client
        .channel("game_state_live")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "game_state" },
          function () {
            pullNow();
          },
        )
        .subscribe();
    })
    .catch(function () {
      /* brak realtime — pozostaje odpytywanie co 2 s */
    });
})();
