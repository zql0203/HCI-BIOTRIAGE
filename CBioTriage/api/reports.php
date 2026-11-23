<?php
require __DIR__ . '/_lib.php';
$method = $_SERVER['REQUEST_METHOD'];
$file = data_dir() . '/reports.json';

if ($method === 'POST') {
    $in = body_json();
    $id = $in['id'] ?? '';
    if (!is_string($id) || !preg_match('/^[0-9a-fA-F-]{8,40}$/', $id)) json_out(400, ['error' => 'Invalid report ID.']);
    $det = $in['details'] ?? null;
    if (!is_array($det)) json_out(400, ['error' => 'Invalid report details.']);
    $clean = [];
    foreach (['area', 'surr', 'meet', 'landmark', 'time', 'cond', 'done', 'snake'] as $k) {
        $v = $det[$k] ?? 'Unknown';
        if (!is_string($v)) json_out(400, ['error' => 'Invalid report details.']);
        $v = trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', $v));
        $clean[$k] = $v === '' ? 'Unknown' : cut($v, 300);
    }
    $lat = null; $lng = null;
    $pin = $in['pin'] ?? null;
    if ($pin !== null) {
        if (!is_array($pin) || !isset($pin['lat'], $pin['lng']) || !is_numeric($pin['lat']) || !is_numeric($pin['lng'])) json_out(400, ['error' => 'Invalid location.']);
        $lat = (float)$pin['lat']; $lng = (float)$pin['lng'];
        if ($lat < -90 || $lat > 90 || $lng < -180 || $lng > 180) json_out(400, ['error' => 'Invalid location.']);
        $lat = round($lat, 5); $lng = round($lng, 5);
    }
    $ck = client_key(); $now = time();
    $result = update_json($file, function (array &$rows) use ($id, $clean, $lat, $lng, $ck, $now) {
        foreach ($rows as $r) { if (($r['id'] ?? '') === $id) return ['id' => $id]; } // retry of the same report
        $recent = 0;
        foreach ($rows as $r) { if (($r['ck'] ?? '') === $ck && ($r['ts'] ?? 0) > $now - 600) $recent++; }
        if ($recent >= MAX_REPORTS_PER_10_MIN) return ['limited' => true];
        $rows[] = ['id' => $id, 'ts' => $now, 'ms' => (int)round(microtime(true) * 1000), 'details' => $clean, 'lat' => $lat, 'lng' => $lng, 'ck' => $ck];
        if (count($rows) > 2000) $rows = array_slice($rows, -2000);
        return ['id' => $id];
    });
    if (!empty($result['limited'])) json_out(429, ['error' => 'Too many reports from this device. Please call for help directly.']);
    json_out(201, ['id' => $result['id']]);
}

if ($method === 'GET') {
    start_staff_session();
    if (empty($_SESSION['staff'])) json_out(401, ['error' => 'Staff sign-in required.']);
    $limit = 20;
    $before = (isset($_GET['before']) && ctype_digit((string)$_GET['before'])) ? (int)$_GET['before'] : PHP_INT_MAX;
    $status = $_GET['status'] ?? 'active';
    if (!in_array($status, ['active', 'handled', 'all'], true)) $status = 'active';
    $rows = array_values(array_filter(read_json($file), function ($r) use ($before, $status) {
        if (($r['ms'] ?? 0) >= $before) return false;
        $h = !empty($r['handled']);
        return $status === 'all' || ($status === 'handled') === $h;
    }));
    usort($rows, function ($a, $b) { return ($b['ms'] ?? 0) <=> ($a['ms'] ?? 0); });
    $more = count($rows) > $limit;
    $page = array_slice($rows, 0, $limit);
    $out = [];
    foreach ($page as $r) {
        $out[] = ['id' => $r['id'], 'details' => $r['details'], 'lat' => $r['lat'], 'lng' => $r['lng'], 'handled' => !empty($r['handled']), 'submittedAt' => gmdate('Y-m-d\TH:i:s\Z', (int)$r['ts'])];
    }
    $next = ($more && $page) ? (string)$page[count($page) - 1]['ms'] : null;
    json_out(200, ['reports' => $out, 'next' => $next]);
}

header('Allow: GET, POST');
json_out(405, ['error' => 'Method not allowed.']);
