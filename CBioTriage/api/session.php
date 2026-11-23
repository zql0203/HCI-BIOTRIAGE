<?php
require __DIR__ . '/_lib.php';
start_staff_session();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') json_out(200, ['authenticated' => !empty($_SESSION['staff'])]);

if ($method === 'DELETE') {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 3600, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
    json_out(200, ['authenticated' => false]);
}

if ($method === 'POST') {
    $in = body_json();
    $pin = $in['pin'] ?? '';
    if (!is_string($pin) || $pin === '' || strlen($pin) > 128) json_out(400, ['error' => 'Enter the staff PIN.']);
    $ck = client_key(); $now = time(); $tf = data_dir() . '/throttle.json';
    $locked = update_json($tf, function (array &$t) use ($ck, $now) {
        foreach ($t as $k => $v) { if (($v['first'] ?? 0) < $now - 900) unset($t[$k]); }
        $e = $t[$ck] ?? null;
        return ($e && $e['count'] >= 5) ? (($e['first'] + 900) - $now) : 0;
    });
    if ($locked > 0) json_out(429, ['error' => 'Too many wrong PINs. Try again in ' . ceil($locked / 60) . ' minute(s).']);
    $ok = STAFF_PIN_HASH !== '' ? password_verify($pin, STAFF_PIN_HASH) : hash_equals(STAFF_PIN, $pin);
    update_json($tf, function (array &$t) use ($ck, $now, $ok) {
        if ($ok) { unset($t[$ck]); return; }
        $e = $t[$ck] ?? ['count' => 0, 'first' => $now];
        $e['count']++;
        $t[$ck] = $e;
    });
    if (!$ok) json_out(401, ['error' => 'Wrong PIN. Try again.']);
    session_regenerate_id(true);
    $_SESSION['staff'] = true;
    json_out(200, ['authenticated' => true]);
}

header('Allow: GET, POST, DELETE');
json_out(405, ['error' => 'Method not allowed.']);
