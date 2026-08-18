/*
 * Warstwa synchronizacji dla symulatora.
 * Ładowana PRZED bundlem aplikacji.
 *
 * Aplikacja wysyła akcje na /api/action i logi na /api/audit-logs oraz
 * łączy się z WebSocketem /ws — te endpointy nie istnieją na serwerze
 * (stąd "Błąd serwera HTTP 404"). Ta warstwa mapuje je na realne API:
 *   POST /api/action        -> PUT  /api/public/state (pełny snapshot z localStorage)
 *   GET  /api/audit-logs    -> GET  /api/public/audit-logs
 *   POST /api/audit-logs/clear -> POST /api/public/audit-logs/clear
 *   WebSocket /ws           -> Supabase Realtime na tabeli game_state
 */
(function () {
  var URL_STATE = "/api/public/state";
  var SESSION_KEY = "ek-sync-session";
  var APP_SESSION_KEY = "ekstraklasa-session-v1";
  var SUPABASE_URL = "https://oquxtxnrvibgzclnmwgo.supabase.co";
  var SUPABASE_KEY = "sb_publishable_FN2oXf1iHkQx0zfgGGEQVA_1HJ_q7tl";

  var nativeFetch = window.fetch.bind(window);
  var NativeWebSocket = window.WebSocket;
  var version = 0;

  /* ---------- pomocnicze ---------- */
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
    return {
      role: role,
      club: club,
      name: role === "admin" ? "Admin" : club || "Gość",
      sessionId: sessionId(),
    };
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

  // Klucz snapshotu aplikacji — bierzemy najwyższą wersję ekstraklasa-sim-vNN.
  function stateKey() {
    var best = null;
    var bestN = -1;
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        var m = k && k.match(/^ekstraklasa-sim-v(\d+)$/);
        if (m && Number(m[1]) > bestN) {
          bestN = Number(m[1]);
          best = k;
        }
      }
    } catch (e) {}
    return best;
  }

  function readSnapshot() {
    var k = stateKey();
    if (!k) return null;
    try {
      return localStorage.getItem(k);
    } catch (e) {
      return null;
    }
  }

  function json(data, status) {
    return new Response(JSON.stringify(data), {
      status: status || 200,
      headers: { "content-type": "application/json" },
    });
  }

  /* ---------- wskaźnik statusu ---------- */
  var el = null;
  var ui = { status: "idle", lastSync: null, online: navigator.onLine };

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
    return d ? d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";
  }

  function render() {
    if (!el) return;
    var line;
    if (!ui.online) line = "🔌 Brak połączenia — zapiszę po powrocie sieci.";
    else if (ui.status === "saving") line = "🟡 Zapisywanie…";
    else if (ui.status === "error") line = "🔴 Błąd zapisu — ponawiam próbę…";
    else if (ui.status === "unauth") line = "🔒 Zaloguj się, aby zapisywać zmiany";
    else if (ui.status === "forbidden") line = "🔒 Twoja rola nie pozwala na zapis (tylko podgląd)";
    else if (ui.status === "saved") line = "🟢 Zapisano — widzą to wszyscy";
    else line = "🟢 Połączono";
    el.innerHTML =
      '<div style="font-weight:600">' +
      line +
      "</div>" +
      '<div style="opacity:.65;margin-top:2px">Wersja save: v' +
      version +
      " · " +
      hhmmss(ui.lastSync) +
      "</div>";
  }

  function set(status) {
    ui.status = status;
    if (status === "saved") ui.lastSync = new Date();
    render();
  }

  window.addEventListener("online", function () {
    ui.online = true;
    render();
    queueSave("reconnect");
  });
  window.addEventListener("offline", function () {
    ui.online = false;
    render();
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();

  /* ---------- zapis pełnego stanu ---------- */
  function putState(stateObj, kind) {
    var headers = { "Content-Type": "application/json" };
    var tok = bearer();
    if (tok) headers["Authorization"] = tok;
    return nativeFetch(URL_STATE, {
      method: "PUT",
      headers: headers,
      body: JSON.stringify({ revision: version, state: stateObj, kind: kind, actor: actor() }),
    }).then(function (res) {
      return res
        .json()
        .catch(function () {
          return {};
        })
        .then(function (body) {
          return { status: res.status, body: body };
        });
    });
  }

  var saving = false;
  var pendingKind = null;

  // Snapshot trafia do localStorage w efekcie po renderze — czekamy na zmianę.
  function waitForSnapshot(before) {
    return new Promise(function (resolve) {
      var tries = 0;
      (function tick() {
        var now = readSnapshot();
        if ((now && now !== before) || tries > 20) return resolve(now);
        tries += 1;
        setTimeout(tick, 60);
      })();
    });
  }

  function saveNow(kind, before) {
    saving = true;
    set("saving");
    return waitForSnapshot(before)
      .then(function (raw) {
        if (!raw) return { status: 204, body: {} };
        var parsed;
        try {
          parsed = JSON.parse(raw);
        } catch (e) {
          return { status: 204, body: {} };
        }
        return putState(parsed, kind).then(function (r) {
          // Konflikt wersji: przyjmij wersję serwera i zapisz ponownie (ostatni wygrywa).
          if (r.status === 409 && typeof r.body.revision === "number") {
            version = r.body.revision;
            render();
            return putState(parsed, kind);
          }
          return r;
        });
      })
      .then(function (r) {
        if (r.status === 401) set("unauth");
        else if (r.status === 403) set("forbidden");
        else if (r.status >= 400) set("error");
        else {
          if (typeof r.body.version === "number") version = r.body.version;
          set("saved");
        }
        return r;
      })
      .catch(function () {
        set("error");
        return { status: 0, body: { error: "Brak połączenia — zmiana zapisana lokalnie." } };
      })
      .then(function (r) {
        saving = false;
        if (pendingKind) {
          var next = pendingKind;
          pendingKind = null;
          queueSave(next);
        }
        return r;
      });
  }

  function queueSave(kind) {
    if (saving) {
      pendingKind = kind;
      return Promise.resolve({ status: 202, body: { queued: true, version: version } });
    }
    return saveNow(kind, readSnapshot());
  }

  /* ---------- przechwycenie żądań aplikacji ---------- */
  window.fetch = function (input, init) {
    var url = typeof input === "string" ? input : (input && input.url) || "";
    var method = ((init && init.method) || (input && input.method) || "GET").toUpperCase();

    // Zapis akcji -> pełny snapshot na serwer
    if (url.indexOf("/api/action") !== -1 && method === "POST") {
      var kind = "state_update";
      try {
        var body = JSON.parse((init && init.body) || "{}");
        kind = body.type || kind;
      } catch (e) {}
      return queueSave(kind).then(function (r) {
        if (r.status === 401 || r.status === 403) {
          return json({ error: r.body.error || "Brak uprawnień do zapisu" }, r.status);
        }
        if (r.status === 0) return json({ error: r.body.error }, 503);
        return json({ success: true, version: version });
      });
    }

    // Historia zmian
    if (url.indexOf("/api/audit-logs/clear") !== -1) {
      return nativeFetch("/api/public/audit-logs/clear", {
        method: "POST",
        headers: bearer() ? { Authorization: bearer() } : {},
      });
    }
    if (url.indexOf("/api/audit-logs") !== -1) {
      var qs = url.indexOf("?") !== -1 ? url.slice(url.indexOf("?")) : "";
      return nativeFetch("/api/public/audit-logs" + qs, {
        headers: bearer() ? { Authorization: bearer() } : {},
      });
    }

    // Odczyt stanu — pilnujemy aktualnej wersji
    if (url.indexOf(URL_STATE) !== -1 && method === "GET") {
      return nativeFetch(input, init).then(function (res) {
        res
          .clone()
          .json()
          .then(function (d) {
            if (d && typeof d.version === "number") {
              version = d.version;
              render();
            }
          })
          .catch(function () {});
        return res;
      });
    }

    return nativeFetch(input, init);
  };

  /* ---------- zastępczy WebSocket /ws na bazie Supabase Realtime ---------- */
  function FakeSocket(url) {
    var self = this;
    this.url = url;
    this.readyState = 0;
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
    sockets.push(this);
    setTimeout(function () {
      self.readyState = 1;
      if (self.onopen) self.onopen({});
      pushUpdate("INIT");
    }, 0);
  }
  FakeSocket.prototype.send = function () {};
  FakeSocket.prototype.close = function () {
    this.readyState = 3;
    var i = sockets.indexOf(this);
    if (i !== -1) sockets.splice(i, 1);
  };
  FakeSocket.CONNECTING = 0;
  FakeSocket.OPEN = 1;
  FakeSocket.CLOSING = 2;
  FakeSocket.CLOSED = 3;

  var sockets = [];
  var lastPush = 0;

  function pushUpdate(type) {
    var now = Date.now();
    if (type !== "INIT" && now - lastPush < 400) return;
    lastPush = now;
    nativeFetch(URL_STATE)
      .then(function (r) {
        return r.json();
      })
      .then(function (d) {
        if (!d || !d.state) return;
        var v = typeof d.version === "number" ? d.version : version;
        if (type !== "INIT" && v === version) return; // brak nowszej wersji
        version = v;
        render();
        var msg = JSON.stringify({
          type: type === "INIT" ? "INIT" : "STATE_UPDATED",
          version: version,
          state: d.state,
          connectedUsersCount: 1,
        });
        sockets.forEach(function (s) {
          if (s.readyState === 1 && s.onmessage) s.onmessage({ data: msg });
        });
      })
      .catch(function () {});
  }

  window.WebSocket = function (url, protocols) {
    if (typeof url === "string" && /\/ws(\?|$)/.test(url)) return new FakeSocket(url);
    return new NativeWebSocket(url, protocols);
  };
  window.WebSocket.prototype = FakeSocket.prototype;
  window.WebSocket.OPEN = 1;
  window.WebSocket.CLOSED = 3;

  import("https://esm.sh/@supabase/supabase-js@2")
    .then(function (mod) {
      var client = mod.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      client
        .channel("game_state_live")
        .on("postgres_changes", { event: "*", schema: "public", table: "game_state" }, function () {
          pushUpdate("STATE_UPDATED");
        })
        .subscribe();
    })
    .catch(function () {});

  // Zapas: co 5 s dociągnij stan, gdy realtime nie działa.
  setInterval(function () {
    if (ui.online && !saving) pushUpdate("STATE_UPDATED");
  }, 5000);
})();
