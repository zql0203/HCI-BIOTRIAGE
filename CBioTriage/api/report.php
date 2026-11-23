<?php
// Staff-only actions on one report: mark handled / reopen (POST) or delete permanently (DELETE).
require __DIR__ . '/_lib.php';
start_staff_session();
if (empty($_SESSION['staff'])) json_out(401, ['error' => 'Staff sign-in required.']);
$method = $_SERVER['REQUEST_METHOD'];
$file = data_dir() . '/reports.json';

function audit_log($action, $id) {
    update_json(data_dir() . '/audit.json', function (array &$a) use ($action, $id) {
        $a[] = ['ts' => time(), 'action' => $action, 'id' => $id];
        if (count($a) > 500) $a = array_slice($a, -500);
    });
}
function valid_id($id) { return is_string($id) && preg_match('/^[0-9a-fA-F-]{8,40}$/', $id); }

if ($method === 'POST') {
    $in = body_json();
    $id = $in['id'] ?? '';
    if (!valid_id($id)) json_out(400, ['error' => 'Invalid report ID.']);
    $handled = !empty($in['handled']);
    $found = update_json($file, function (array &$rows) use ($id, $handled) {
        foreach ($rows as &$r) {
            if (($r['id'] ?? '') === $id) { $r['handled'] = $handled; $r['handled_at'] = $handled ? time() : null; return true; }
        }
        return false;
    });
    if (!$found) json_out(404, ['error' => 'Report not found. It may already be deleted.']);
    audit_log($handled ? 'handled' : 'reopened', $id);
    json_out(200, ['id' => $id, 'handled' => $handled]);
}

if ($method === 'DELETE') {
    $id = $_GET['id'] ?? '';
    if (!valid_id($id)) json_out(400, ['error' => 'Invalid report ID.']);
    $found = update_json($file, function (array &$rows) use ($id) {
        $n = count($rows);
        $rows = array_values(array_filter($rows, function ($r) use ($id) { return ($r['id'] ?? '') !== $id; }));
        return count($rows) < $n;
    });
    if (!$found) json_out(404, ['error' => 'Report not found. It may already be deleted.']);
    audit_log('deleted', $id); // only the ID and time are kept, not the report contents
    json_out(200, ['id' => $id, 'deleted' => true]);
}

header('Allow: POST, DELETE');
json_out(405, ['error' => 'Method not allowed.']);
