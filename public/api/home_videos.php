<?php
/**
 * ==============================================================================
 * Paul van Geenen.nl - Homepage Achtergrondvideo's API (Portrait & Landscape)
 * ==============================================================================
 * - Scant /videos/home/Portrait en /videos/home/Landscape op .mov bestanden
 * - Slaat aan/uit-status per video op in MySQL tabel `home_videos`
 * - Ondersteunt uploaden en verwijderen van .mov bestanden vanuit /beheer
 */

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-API-Key");
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Pragma: no-cache");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ==========================================
// 1. DATABASE VERBINDING (TransIP MySQL)
// ==========================================
$db_host = getenv('ANALYTICS_DB_HOST') ?: '127.0.0.1';
$db_name = getenv('ANALYTICS_DB_NAME') ?: 'paulw6_Analytics';
$db_user = getenv('ANALYTICS_DB_USER') ?: 'paulw6_admin';
$db_pass = getenv('ANALYTICS_DB_PASS') ?: 'D7dBQz3@7dMvKGd';
$db_port = 3306;

$hostCandidates = array_unique([$db_host, '127.0.0.1', 'localhost;port=3306', 'localhost']);
$pdo = null;
$connectionErrors = [];

foreach ($hostCandidates as $candidateHost) {
    try {
        $dsn = (strpos($candidateHost, ';') !== false)
            ? "mysql:host={$candidateHost};dbname={$db_name};charset=utf8mb4"
            : "mysql:host={$candidateHost};port={$db_port};dbname={$db_name};charset=utf8mb4";
        $pdo = new PDO($dsn, $db_user, $db_pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
        break;
    } catch (PDOException $e) {
        $connectionErrors[] = $e->getMessage();
    }
}

if (!$pdo) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Databaseverbinding mislukt.', 'details' => $connectionErrors]);
    exit;
}

// Zorg dat tabel `home_videos` altijd bestaat
$pdo->exec("
    CREATE TABLE IF NOT EXISTS home_videos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        orientation VARCHAR(20) NOT NULL,
        filename VARCHAR(255) NOT NULL,
        enabled TINYINT(1) NOT NULL DEFAULT 1,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_orient_file (orientation, filename)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");

// ==========================================
// 2. HELPERS VOOR MAPPEN & BESTANDEN
// ==========================================
$videosBaseDir = realpath(__DIR__ . '/../videos/home');
if (!$videosBaseDir) {
    $dir = __DIR__ . '/../videos/home';
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    $videosBaseDir = realpath($dir) ?: $dir;
}

function getOrientationFolderName(string $orientation): ?string {
    $norm = strtolower(trim($orientation));
    if ($norm === 'portrait') return 'Portrait';
    if ($norm === 'landscape') return 'Landscape';
    return null;
}

function getOrientationDir(string $baseDir, string $orientation): ?string {
    $folder = getOrientationFolderName($orientation);
    if (!$folder) return null;
    $dir = $baseDir . '/' . $folder;
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    return $dir;
}

function sanitizeVideoFilename(string $raw): string {
    $base = basename(str_replace(['\\', "\0"], ['/', ''], $raw));
    $base = trim($base);
    // Verwijder gevaarlijke tekens maar behoud spaties, haakjes, koppeltekens, underscores, punten
    $base = preg_replace('/[^a-zA-Z0-9._\-\s\(\)]/', '_', $base);
    return trim($base, '. ');
}

function listVideosForOrientation(PDO $pdo, string $baseDir, string $orientation, bool $onlyEnabled = false): array {
    $norm = strtolower(trim($orientation));
    $folder = getOrientationFolderName($norm);
    $dir = getOrientationDir($baseDir, $norm);
    if (!$folder || !$dir || !is_dir($dir)) return [];

    // Haal alle bekende DB-instellingen op voor deze oriëntatie
    $stmt = $pdo->prepare("SELECT filename, enabled, updated_at FROM home_videos WHERE orientation = ?");
    $stmt->execute([$norm]);
    $dbMap = [];
    foreach ($stmt->fetchAll() as $row) {
        $dbMap[$row['filename']] = [
            'enabled' => ((int)$row['enabled']) === 1,
            'updated_at' => $row['updated_at'],
        ];
    }

    $entries = @scandir($dir);
    if (!is_array($entries)) return [];

    $result = [];
    $insertStmt = $pdo->prepare("INSERT IGNORE INTO home_videos (orientation, filename, enabled) VALUES (?, ?, 1)");

    foreach ($entries as $entry) {
        if ($entry === '.' || $entry === '..') continue;
        $fullPath = $dir . '/' . $entry;
        if (!is_file($fullPath)) continue;

        $ext = strtolower(pathinfo($entry, PATHINFO_EXTENSION));
        if ($ext !== 'mov') continue;

        if (!isset($dbMap[$entry])) {
            // Nieuw ontdekt bestand: registreer standaard als AAN (enabled = 1) in MySQL
            try {
                $insertStmt->execute([$norm, $entry]);
            } catch (Exception $e) {}
            $enabled = true;
            $updatedAt = date('Y-m-d H:i:s', filemtime($fullPath) ?: time());
        } else {
            $enabled = $dbMap[$entry]['enabled'];
            $updatedAt = $dbMap[$entry]['updated_at'];
        }

        if ($onlyEnabled && !$enabled) continue;

        $encodedName = rawurlencode($entry);
        $result[] = [
            'orientation' => $norm,
            'filename' => $entry,
            'url' => "/videos/home/{$folder}/{$encodedName}",
            'size' => filesize($fullPath) ?: 0,
            'enabled' => $enabled,
            'updatedAt' => $updatedAt,
        ];
    }

    usort($result, function ($a, $b) {
        return strnatcasecmp($a['filename'], $b['filename']);
    });

    return $result;
}

// ==========================================
// 3. ROUTES / ACTIONS
// ==========================================
$action = $_GET['action'] ?? ($_POST['action'] ?? 'list');

// A. LIST (voor homepage & beheer)
if ($action === 'list') {
    $orientation = strtolower(trim((string)($_GET['orientation'] ?? 'all')));
    $onlyEnabled = isset($_GET['only_enabled']) && ($_GET['only_enabled'] === '1' || $_GET['only_enabled'] === 'true');

    if ($orientation === 'portrait' || $orientation === 'landscape') {
        $videos = listVideosForOrientation($pdo, $videosBaseDir, $orientation, $onlyEnabled);
        echo json_encode([
            'success' => true,
            'orientation' => $orientation,
            'count' => count($videos),
            'videos' => $videos,
        ]);
        exit;
    }

    $portrait = listVideosForOrientation($pdo, $videosBaseDir, 'portrait', $onlyEnabled);
    $landscape = listVideosForOrientation($pdo, $videosBaseDir, 'landscape', $onlyEnabled);
    echo json_encode([
        'success' => true,
        'portrait' => $portrait,
        'landscape' => $landscape,
    ]);
    exit;
}

// B. TOGGLE EÉN VIDEO AAN/UIT
if ($action === 'toggle') {
    $rawBody = file_get_contents('php://input');
    $body = json_decode($rawBody ?: '{}', true) ?: [];

    $orientation = strtolower(trim((string)($body['orientation'] ?? '')));
    $filename = sanitizeVideoFilename((string)($body['filename'] ?? ''));
    $enabled = !empty($body['enabled']) ? 1 : 0;

    if (!getOrientationFolderName($orientation) || $filename === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Ongeldige oriëntatie of bestandsnaam.']);
        exit;
    }

    $stmt = $pdo->prepare("
        INSERT INTO home_videos (orientation, filename, enabled)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)
    ");
    $stmt->execute([$orientation, $filename, $enabled]);

    echo json_encode([
        'success' => true,
        'orientation' => $orientation,
        'filename' => $filename,
        'enabled' => $enabled === 1,
    ]);
    exit;
}

// C. BULK TOGGLE (alles aan of uit voor een oriëntatie)
if ($action === 'bulk_toggle') {
    $rawBody = file_get_contents('php://input');
    $body = json_decode($rawBody ?: '{}', true) ?: [];

    $orientation = strtolower(trim((string)($body['orientation'] ?? '')));
    $enabled = !empty($body['enabled']) ? 1 : 0;

    if (!getOrientationFolderName($orientation)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Ongeldige oriëntatie.']);
        exit;
    }

    // Zorg eerst dat alle huidige bestanden in DB staan
    $all = listVideosForOrientation($pdo, $videosBaseDir, $orientation, false);
    $stmt = $pdo->prepare("UPDATE home_videos SET enabled = ? WHERE orientation = ?");
    $stmt->execute([$enabled, $orientation]);

    echo json_encode([
        'success' => true,
        'orientation' => $orientation,
        'enabled' => $enabled === 1,
        'affected' => count($all),
    ]);
    exit;
}

// D. UPLOAD .MOV BESTAND(EN)
if ($action === 'upload') {
    $orientation = strtolower(trim((string)($_POST['orientation'] ?? $_GET['orientation'] ?? '')));
    $folder = getOrientationFolderName($orientation);
    $dir = getOrientationDir($videosBaseDir, $orientation);

    if (!$folder || !$dir) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Kies portrait of landscape voor upload.']);
        exit;
    }

    if (empty($_FILES)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Geen bestand ontvangen.']);
        exit;
    }

    // Ondersteun zowel `file` als `files[]`
    $uploadedList = [];
    if (isset($_FILES['files'])) {
        $f = $_FILES['files'];
        if (is_array($f['name'])) {
            for ($i = 0; $i < count($f['name']); $i++) {
                $uploadedList[] = [
                    'name' => $f['name'][$i],
                    'tmp_name' => $f['tmp_name'][$i],
                    'error' => $f['error'][$i],
                    'size' => $f['size'][$i],
                ];
            }
        } else {
            $uploadedList[] = $f;
        }
    } elseif (isset($_FILES['file'])) {
        $uploadedList[] = $_FILES['file'];
    }

    $saved = [];
    $errors = [];

    $upsertStmt = $pdo->prepare("
        INSERT INTO home_videos (orientation, filename, enabled)
        VALUES (?, ?, 1)
        ON DUPLICATE KEY UPDATE enabled = 1
    ");

    foreach ($uploadedList as $file) {
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            $errors[] = ($file['name'] ?? 'bestand') . ': uploadfout (code ' . ($file['error'] ?? -1) . ').';
            continue;
        }

        $safeName = sanitizeVideoFilename((string)$file['name']);
        $ext = strtolower(pathinfo($safeName, PATHINFO_EXTENSION));
        if ($ext !== 'mov') {
            $errors[] = "{$safeName}: alleen .mov bestanden zijn toegestaan.";
            continue;
        }

        $destPath = $dir . '/' . $safeName;
        if (!move_uploaded_file($file['tmp_name'], $destPath)) {
            $errors[] = "{$safeName}: opslaan op server mislukt.";
            continue;
        }

        @chmod($destPath, 0644);
        $upsertStmt->execute([$orientation, $safeName]);

        $saved[] = [
            'orientation' => $orientation,
            'filename' => $safeName,
            'url' => "/videos/home/{$folder}/" . rawurlencode($safeName),
            'size' => filesize($destPath) ?: 0,
            'enabled' => true,
            'updatedAt' => date('Y-m-d H:i:s'),
        ];
    }

    if (empty($saved) && !empty($errors)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => implode(' ', $errors), 'errors' => $errors]);
        exit;
    }

    echo json_encode([
        'success' => true,
        'uploaded' => $saved,
        'errors' => $errors,
    ]);
    exit;
}

// E. VERWIJDER VIDEO (optioneel uit beheer)
if ($action === 'delete') {
    $rawBody = file_get_contents('php://input');
    $body = json_decode($rawBody ?: '{}', true) ?: [];

    $orientation = strtolower(trim((string)($body['orientation'] ?? '')));
    $filename = sanitizeVideoFilename((string)($body['filename'] ?? ''));
    $dir = getOrientationDir($videosBaseDir, $orientation);

    if (!$dir || $filename === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Ongeldige parameters.']);
        exit;
    }

    $fullPath = $dir . '/' . $filename;
    if (is_file($fullPath)) {
        @unlink($fullPath);
    }

    $stmt = $pdo->prepare("DELETE FROM home_videos WHERE orientation = ? AND filename = ?");
    $stmt->execute([$orientation, $filename]);

    echo json_encode(['success' => true, 'deleted' => $filename]);
    exit;
}

http_response_code(400);
echo json_encode(['success' => false, 'error' => 'Onbekende actie.']);
