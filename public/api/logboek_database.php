<?php
/**
 * ==============================================================================
 * Logboek MySQL Database Bridge
 * Locatie op server: /www/api/logboek_database.php
 * Database: paulw6_Music
 * Tabel: logboek (id, datum, foto, tekst, created_at, updated_at)
 * ==============================================================================
 */

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-API-Key");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

header("Content-Type: application/json; charset=UTF-8");

$API_KEY = "music-secret-key-paul-2026";
$action = $_GET['action'] ?? '';

$headers = function_exists('getallheaders') ? getallheaders() : [];
$receivedKey = $_SERVER['HTTP_X_API_KEY'] ?? ($headers['X-API-Key'] ?? ($headers['x-api-key'] ?? ($_GET['key'] ?? '')));

// Public read-only action: get_logboek; write actions require API key
$publicActions = ['get_logboek'];
if (!in_array($action, $publicActions, true) && $receivedKey !== $API_KEY) {
    http_response_code(401);
    echo json_encode(["success" => false, "error" => "Unauthorized: Ongeldige API Key."]);
    exit;
}

// Database connection (TransIP MySQL)
$db_host = getenv('DB_HOST') ?: '127.0.0.1';
$db_name = getenv('DB_NAME') ?: 'paulw6_Music';
$db_user = getenv('DB_USER') ?: 'paulw6_Music';
$db_pass = getenv('DB_PASS') ?: 'MusicWasMyFirstLove1965!';
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
            PDO::ATTR_TIMEOUT => 3
        ]);
        break;
    } catch (PDOException $e) {
        $connectionErrors[$candidateHost] = $e->getMessage();
    }
}

if (!$pdo) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "error" => "Database verbinding mislukt.",
        "details" => $connectionErrors
    ]);
    exit;
}

// Ensure table exists
try {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS logboek (
            id INT AUTO_INCREMENT PRIMARY KEY,
            datum DATE NOT NULL,
            foto VARCHAR(512) NULL DEFAULT NULL,
            tekst TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_datum (datum, id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "error" => "Kon logboek tabel niet aanmaken: " . $e->getMessage()]);
    exit;
}

if ($action === 'get_logboek') {
    try {
        $stmt = $pdo->query("SELECT id, datum, foto, tekst, created_at, updated_at FROM logboek ORDER BY datum DESC, id DESC");
        $entries = $stmt->fetchAll();
        echo json_encode([
            "success" => true,
            "entries" => $entries
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
    exit;
}

if ($action === 'save_entry') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        http_response_code(400);
        echo json_encode(["success" => false, "error" => "Ongeldige JSON payload."]);
        exit;
    }

    $id = isset($input['id']) && is_numeric($input['id']) ? (int)$input['id'] : null;
    $datum = trim($input['datum'] ?? '');
    $foto = isset($input['foto']) && trim((string)$input['foto']) !== '' ? trim((string)$input['foto']) : null;
    $tekst = trim($input['tekst'] ?? '');

    if ($datum === '' || $tekst === '') {
        http_response_code(400);
        echo json_encode(["success" => false, "error" => "Datum en tekst zijn verplicht."]);
        exit;
    }

    try {
        if ($id) {
            $stmt = $pdo->prepare("UPDATE logboek SET datum = ?, foto = ?, tekst = ? WHERE id = ?");
            $stmt->execute([$datum, $foto, $tekst, $id]);
        } else {
            $stmt = $pdo->prepare("INSERT INTO logboek (datum, foto, tekst) VALUES (?, ?, ?)");
            $stmt->execute([$datum, $foto, $tekst]);
            $id = (int)$pdo->lastInsertId();
        }
        echo json_encode(["success" => true, "id" => $id]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
    exit;
}

if ($action === 'delete_entry') {
    $input = json_decode(file_get_contents('php://input'), true);
    $id = isset($input['id']) && is_numeric($input['id']) ? (int)$input['id'] : null;
    if (!$id) {
        http_response_code(400);
        echo json_encode(["success" => false, "error" => "Geen geldig ID opgegeven."]);
        exit;
    }

    try {
        $stmt = $pdo->prepare("DELETE FROM logboek WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(["success" => true]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
    exit;
}

if ($action === 'upload_photo') {
    $input = json_decode(file_get_contents('php://input'), true);
    $dataUrl = $input['dataUrl'] ?? '';

    if (!preg_match('/^data:image\/(jpeg|jpg|png|webp|gif);base64,(.+)$/i', $dataUrl, $matches)) {
        http_response_code(400);
        echo json_encode(["success" => false, "error" => "Ongeldig afbeeldingsformaat (gebruik JPG, PNG, WebP of GIF)."]);
        exit;
    }

    $ext = strtolower($matches[1]);
    if ($ext === 'jpeg') $ext = 'jpg';
    $binary = base64_decode($matches[2]);
    if ($binary === false) {
        http_response_code(400);
        echo json_encode(["success" => false, "error" => "Kon afbeelding niet decoderen."]);
        exit;
    }

    $uploadDir = dirname(__DIR__) . '/images/logboek';
    if (!is_dir($uploadDir)) {
        if (!mkdir($uploadDir, 0755, true)) {
            http_response_code(500);
            echo json_encode(["success" => false, "error" => "Kon uploadmap /images/logboek niet aanmaken."]);
            exit;
        }
    }

    $filename = 'logboek_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
    $targetPath = $uploadDir . '/' . $filename;
    if (file_put_contents($targetPath, $binary) === false) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => "Kon afbeelding niet opslaan op de server."]);
        exit;
    }

    echo json_encode([
        "success" => true,
        "url" => "/images/logboek/" . $filename
    ], JSON_UNESCAPED_SLASHES);
    exit;
}

http_response_code(400);
echo json_encode(["success" => false, "error" => "Onbekende actie."]);
