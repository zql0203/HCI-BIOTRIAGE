<?php
require __DIR__ . '/config.php';

function json_out($code, array $data) {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function start_staff_session() {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    session_name('cmubt_staff');
    session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => $https, 'httponly' => true, 'samesite' => 'Lax']);
    session_start();
}
function body_json() {
    $raw = file_get_contents('php://input');
    if ($raw === '' || $raw === false || strlen($raw) > 20000) json_out(400, ['error' => 'Invalid request.']);
    $d = json_decode($raw, true);
    if (!is_array($d)) json_out(400, ['error' => 'Invalid request.']);
    return $d;
}
function data_dir() {
    $d = __DIR__ . '/_data';
    if (!is_dir($d)) @mkdir($d, 0775, true);
    return $d;
}
function client_key() {
    return hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '?') . '|' . SITE_SALT);
}
function cut($s, $n) {
    return function_exists('mb_substr') ? mb_substr($s, 0, $n) : substr($s, 0, $n);
}
// Read, change and save a JSON file while holding a lock, so two requests cannot overwrite each other.
function update_json($file, callable $fn) {
    $fh = @fopen($file, 'c+');
    if (!$fh) json_out(500, ['error' => 'Storage is not writable. Check the api/_data folder permissions.']);
    flock($fh, LOCK_EX);
    $s = stream_get_contents($fh);
    $data = json_decode($s === '' || $s === false ? '[]' : $s, true);
    if (!is_array($data)) $data = [];
    $result = $fn($data);
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, json_encode($data, JSON_UNESCAPED_UNICODE));
    fflush($fh);
    flock($fh, LOCK_UN);
    fclose($fh);
    return $result;
}
function read_json($file) {
    if (!is_file($file)) return [];
    $fh = @fopen($file, 'rb');
    if (!$fh) return [];
    flock($fh, LOCK_SH);
    $s = stream_get_contents($fh);
    flock($fh, LOCK_UN);
    fclose($fh);
    $d = json_decode($s, true);
    return is_array($d) ? $d : [];
}
