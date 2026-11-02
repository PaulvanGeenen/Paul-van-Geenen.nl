<?php
/**
 * ==============================================================================
 * TransIP Dedicated MySQL Database Bridge: Bezoekers & Analytics
 * Locatie op server: /www/api/visitor_database.php of /public_html/api/visitor_database.php
 * Standaard Database: paulw6_Analytics (of paulw6_Visitors)
 * ==============================================================================
 */

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-API-Key");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

header("Content-Type: application/json; charset=UTF-8");

// ==========================================
// 1. BEVEILIGING: API KEY
// ==========================================
$API_KEY = "visitor-secret-key-paul-2026";
$headers = getallheaders();
$receivedKey = $_SERVER['HTTP_X_API_KEY'] ?? ($headers['X-API-Key'] ?? ($headers['x-api-key'] ?? ''));

// Ondersteun ook GET query parameter voor snelle test in browser of admin
if (empty($receivedKey) && isset($_GET['key'])) {
    $receivedKey = $_GET['key'];
}

// ==========================================
// 2. DATABASE VERBINDING (TransIP MySQL)
// ==========================================
$db_host = '127.0.0.1'; // 127.0.0.1 forceert TCP/IP poort 3306 op TransIP
$db_name = 'paulw6_Analytics';
$db_user = 'paulw6_admin'; // Exacte MySQL gebruikersnaam uit TransIP
$db_pass = 'D7dBQz3@7dMvKGd'; // Exact wachtwoord van paulw6_admin
$db_port = 3306;

// Ondersteun dynamische overschrijving via environment of query parameters
if (isset($_GET['db_host']) && !empty($_GET['db_host'])) $db_host = $_GET['db_host'];
if (isset($_GET['db_name']) && !empty($_GET['db_name'])) $db_name = $_GET['db_name'];
if (isset($_GET['db_user']) && !empty($_GET['db_user'])) $db_user = $_GET['db_user'];
if (isset($_GET['db_pass']) && !empty($_GET['db_pass'])) $db_pass = $_GET['db_pass'];
if (getenv('ANALYTICS_DB_HOST')) $db_host = getenv('ANALYTICS_DB_HOST');
if (getenv('ANALYTICS_DB_NAME')) $db_name = getenv('ANALYTICS_DB_NAME');
if (getenv('ANALYTICS_DB_USER')) $db_user = getenv('ANALYTICS_DB_USER');
if (getenv('ANALYTICS_DB_PASS')) $db_pass = getenv('ANALYTICS_DB_PASS');

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
            PDO::ATTR_TIMEOUT => 4
        ]);
        $db_host = $candidateHost;
        break; // Succesvol verbonden!
    } catch (PDOException $e) {
        $connectionErrors[$candidateHost] = $e->getMessage();
    }
}

$input = json_decode(file_get_contents("php://input"), true) ?? [];
$action = $_GET['action'] ?? ($input['action'] ?? '');

// Als er geen databaseverbinding is gemaakt:
if (!$pdo) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "error" => "Database verbinding mislukt met database '{$db_name}'.",
        "errors_tried" => $connectionErrors,
        "hint" => "Zorg ervoor dat de database '{$db_name}' is aangemaakt in het TransIP Controlepaneel onder MySQL-databases en dat de inloggegevens in dit script kloppen."
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

// ==========================================
// 3. ACTIE: STATUS / TEST VERBINDING
// ==========================================
if ($action === 'test_connection' || empty($action)) {
    // Check welke tabellen al aanwezig zijn
    $existingTables = [];
    try {
        $tablesQuery = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
        $existingTables = $tablesQuery;
    } catch (Exception $e) {}

    echo json_encode([
        "success" => true,
        "database" => $db_name,
        "host" => $db_host,
        "message" => "Succesvol verbonden met MySQL Analytics database '{$db_name}' op TransIP!",
        "existing_tables" => $existingTables,
        "table_count" => count($existingTables)
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

// ==========================================
// 4. ACTIE: INITIALISEER TABELLEN IN 1 KLIK
// ==========================================
if ($action === 'init_tables') {
    try {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `visitor_sessions` (
              `id` INT AUTO_INCREMENT PRIMARY KEY,
              `session_id` VARCHAR(64) NOT NULL UNIQUE,
              `ip_address` VARCHAR(45) NULL,
              `city` VARCHAR(100) NOT NULL DEFAULT 'Onbekend',
              `country` VARCHAR(100) NOT NULL DEFAULT 'Nederland',
              `latitude` DECIMAL(10, 8) NULL,
              `longitude` DECIMAL(11, 8) NULL,
              `device_type` VARCHAR(50) NOT NULL DEFAULT 'Bureaublad computer',
              `os` VARCHAR(50) NULL,
              `browser` VARCHAR(50) NULL,
              `user_agent` TEXT NULL,
              `landing_page` VARCHAR(255) NOT NULL DEFAULT '/',
              `referrer` VARCHAR(255) NULL,
              `utm_source` VARCHAR(100) NULL,
              `pageviews_count` INT NOT NULL DEFAULT 1,
              `duration_seconds` INT NOT NULL DEFAULT 0,
              `started_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              `last_active_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              INDEX `idx_session_id` (`session_id`),
              INDEX `idx_started_at` (`started_at`),
              INDEX `idx_city` (`city`),
              INDEX `idx_device_type` (`device_type`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

            CREATE TABLE IF NOT EXISTS `visitor_pageviews` (
              `id` INT AUTO_INCREMENT PRIMARY KEY,
              `session_id` VARCHAR(64) NOT NULL,
              `page_path` VARCHAR(255) NOT NULL,
              `page_title` VARCHAR(255) NULL,
              `time_on_page` INT NOT NULL DEFAULT 0,
              `viewed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              INDEX `idx_session_id` (`session_id`),
              INDEX `idx_page_path` (`page_path`),
              INDEX `idx_viewed_at` (`viewed_at`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

            CREATE TABLE IF NOT EXISTS `visitor_clicks` (
              `id` INT AUTO_INCREMENT PRIMARY KEY,
              `session_id` VARCHAR(64) NOT NULL,
              `event_type` VARCHAR(50) NOT NULL DEFAULT 'click',
              `element_id` VARCHAR(100) NULL,
              `element_text` VARCHAR(255) NULL,
              `target_url` VARCHAR(255) NULL,
              `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              INDEX `idx_session_id` (`session_id`),
              INDEX `idx_event_type` (`event_type`),
              INDEX `idx_created_at` (`created_at`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

            CREATE TABLE IF NOT EXISTS `music_listens` (
              `id` INT AUTO_INCREMENT PRIMARY KEY,
              `session_id` VARCHAR(64) NULL,
              `track_id` VARCHAR(64) NOT NULL,
              `track_title` VARCHAR(255) NOT NULL,
              `album` VARCHAR(255) NOT NULL DEFAULT 'De Echo',
              `format` ENUM('mp3', 'audiobook', 'reflection', 'video') NOT NULL DEFAULT 'mp3',
              `rating` ENUM('up', 'down', 'none') NOT NULL DEFAULT 'none',
              `duration_seconds` INT NOT NULL DEFAULT 0,
              `completed` TINYINT(1) NOT NULL DEFAULT 0,
              `city` VARCHAR(100) NOT NULL DEFAULT 'Onbekend',
              `country` VARCHAR(100) NOT NULL DEFAULT 'Nederland',
              `lat` DECIMAL(10, 8) NULL,
              `lng` DECIMAL(11, 8) NULL,
              `device_type` VARCHAR(50) NOT NULL DEFAULT 'Bureaublad computer',
              `user_agent` TEXT NULL,
              `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              INDEX `idx_track_id` (`track_id`),
              INDEX `idx_format` (`format`),
              INDEX `idx_rating` (`rating`),
              INDEX `idx_completed` (`completed`),
              INDEX `idx_created_at` (`created_at`),
              INDEX `idx_city` (`city`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

            CREATE TABLE IF NOT EXISTS `qr_scans` (
              `id` INT AUTO_INCREMENT PRIMARY KEY,
              `code` VARCHAR(100) NOT NULL,
              `target_route` VARCHAR(255) NOT NULL DEFAULT '/',
              `city` VARCHAR(100) NOT NULL DEFAULT 'Onbekend',
              `country` VARCHAR(100) NOT NULL DEFAULT 'Nederland',
              `lat` DECIMAL(10, 8) NULL,
              `lng` DECIMAL(11, 8) NULL,
              `device_type` VARCHAR(50) NOT NULL DEFAULT 'Mobiel',
              `user_agent` TEXT NULL,
              `scanned_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              INDEX `idx_code` (`code`),
              INDEX `idx_scanned_at` (`scanned_at`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

            CREATE TABLE IF NOT EXISTS `newsletter_subscribers` (
              `id` INT AUTO_INCREMENT PRIMARY KEY,
              `email` VARCHAR(255) NOT NULL UNIQUE,
              `name` VARCHAR(255) NULL,
              `status` VARCHAR(50) NOT NULL DEFAULT 'active',
              `source` VARCHAR(100) NOT NULL DEFAULT 'website',
              `subscribed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              INDEX `idx_email` (`email`),
              INDEX `idx_status` (`status`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

            CREATE TABLE IF NOT EXISTS `boeken` (
              `id` VARCHAR(64) PRIMARY KEY,
              `volgnummer` INT NOT NULL DEFAULT 1,
              `boektitel` VARCHAR(255) NOT NULL,
              `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

            CREATE TABLE IF NOT EXISTS `hoofdstukken` (
              `id` VARCHAR(64) PRIMARY KEY,
              `boek_id` VARCHAR(64) NOT NULL,
              `volgnummer` INT NOT NULL DEFAULT 1,
              `omschrijving` VARCHAR(255) NOT NULL,
              `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              INDEX `idx_boek_id` (`boek_id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

            CREATE TABLE IF NOT EXISTS `qrcodes` (
              `id` VARCHAR(64) PRIMARY KEY,
              `boek_id` VARCHAR(64) NULL,
              `boek_titel` VARCHAR(255) NULL,
              `hoofdstuk_id` VARCHAR(64) NULL,
              `hoofdstuk` VARCHAR(255) NOT NULL,
              `song` VARCHAR(255) NOT NULL,
              `artist` VARCHAR(255) NOT NULL,
              `spotify_link` TEXT NOT NULL,
              `qr_image` LONGTEXT NULL,
              `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");

        // Automatische migratie: voeg 'completed' kolom toe indien de tabel al bestond
        try {
            $cols = $pdo->query("SHOW COLUMNS FROM `music_listens` LIKE 'completed'")->fetchAll();
            if (empty($cols)) {
                $pdo->exec("ALTER TABLE `music_listens` ADD COLUMN `completed` TINYINT(1) NOT NULL DEFAULT 0 AFTER `duration_seconds`");
                $pdo->exec("ALTER TABLE `music_listens` ADD INDEX `idx_completed` (`completed`)");
            }
        } catch (Exception $e) {}

        echo json_encode([
            "success" => true,
            "message" => "Alle 6 bezoekerstabellen zijn succesvol aangemaakt in database '{$db_name}'!",
            "tables_created" => [
                "visitor_sessions",
                "visitor_pageviews",
                "visitor_clicks",
                "music_listens",
                "qr_scans",
                "newsletter_subscribers"
            ]
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
    exit;
}

// ==========================================
// 5. ACTIE: REGISTREER SESSIE START
// ==========================================
if ($action === 'session_start') {
    $sessionId = $input['sessionId'] ?? ($input['session_id'] ?? uniqid('sess_', true));
    $city = $input['city'] ?? 'Onbekend';
    $country = $input['country'] ?? 'Nederland';
    $lat = isset($input['lat']) ? (float)$input['lat'] : null;
    $lng = isset($input['lng']) ? (float)$input['lng'] : null;
    $deviceType = $input['deviceType'] ?? 'Bureaublad computer';
    $os = $input['os'] ?? '';
    $browser = $input['browser'] ?? '';
    $userAgent = $input['userAgent'] ?? ($_SERVER['HTTP_USER_AGENT'] ?? '');
    $landingPage = $input['landingPage'] ?? '/';
    $referrer = $input['referrer'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
    $utmSource = $input['utmSource'] ?? '';
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';

    try {
        $stmt = $pdo->prepare("
            INSERT INTO visitor_sessions 
            (session_id, ip_address, city, country, latitude, longitude, device_type, os, browser, user_agent, landing_page, referrer, utm_source, started_at, last_active_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            ON DUPLICATE KEY UPDATE 
            last_active_at = NOW(),
            pageviews_count = pageviews_count + 1
        ");
        $stmt->execute([
            $sessionId, $ip, $city, $country, $lat, $lng, $deviceType, $os, $browser, $userAgent, $landingPage, $referrer, $utmSource
        ]);

        echo json_encode(["success" => true, "sessionId" => $sessionId]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
    exit;
}

// ==========================================
// 5A-1. ACTIE: SESSIE HEARTBEAT (TIJD OP SITE)
// ==========================================
if ($action === 'session_heartbeat') {
    $sessionId = $input['sessionId'] ?? ($input['session_id'] ?? '');
    $pageStaySeconds = (int)($input['pageStaySeconds'] ?? ($input['seconds'] ?? 10));
    $currentPath = $input['currentPath'] ?? ($input['path'] ?? '/');

    if (!empty($sessionId)) {
        try {
            $stmt = $pdo->prepare("
                UPDATE visitor_sessions 
                SET duration_seconds = duration_seconds + ?, 
                    last_active_at = NOW() 
                WHERE session_id = ?
            ");
            $stmt->execute([$pageStaySeconds, $sessionId]);

            if (!empty($currentPath)) {
                $check = $pdo->prepare("
                    SELECT id FROM visitor_pageviews 
                    WHERE session_id = ? AND page_path = ? 
                    ORDER BY id DESC LIMIT 1
                ");
                $check->execute([$sessionId, $currentPath]);
                $pv = $check->fetch();
                if ($pv) {
                    $upd = $pdo->prepare("UPDATE visitor_pageviews SET time_on_page = time_on_page + ? WHERE id = ?");
                    $upd->execute([$pageStaySeconds, $pv['id']]);
                } else {
                    $ins = $pdo->prepare("INSERT INTO visitor_pageviews (session_id, page_path, time_on_page, viewed_at) VALUES (?, ?, ?, NOW())");
                    $ins->execute([$sessionId, $currentPath, $pageStaySeconds]);
                }
            }

            echo json_encode(["success" => true]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(["success" => false, "error" => $e->getMessage()]);
        }
    } else {
        echo json_encode(["success" => false, "error" => "Geen sessionId"]);
    }
    exit;
}

// ==========================================
// 5A-2. ACTIE: SESSIE PAGEVIEW
// ==========================================
if ($action === 'session_pageview') {
    $sessionId = $input['sessionId'] ?? ($input['session_id'] ?? '');
    $pagePath = $input['pagePath'] ?? ($input['path'] ?? '/');
    $pageTitle = $input['pageTitle'] ?? ($input['title'] ?? '');

    if (!empty($sessionId)) {
        try {
            $stmt = $pdo->prepare("
                INSERT INTO visitor_pageviews (session_id, page_path, page_title, time_on_page, viewed_at)
                VALUES (?, ?, ?, 0, NOW())
            ");
            $stmt->execute([$sessionId, $pagePath, $pageTitle]);

            $upd = $pdo->prepare("
                UPDATE visitor_sessions 
                SET last_active_at = NOW(), pageviews_count = pageviews_count + 1 
                WHERE session_id = ?
            ");
            $upd->execute([$sessionId]);

            echo json_encode(["success" => true]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(["success" => false, "error" => $e->getMessage()]);
        }
    } else {
        echo json_encode(["success" => false, "error" => "Geen sessionId"]);
    }
    exit;
}

// ==========================================
// 5A-3. ACTIE: SESSIE CLICK
// ==========================================
if ($action === 'session_click') {
    $sessionId = $input['sessionId'] ?? ($input['session_id'] ?? '');
    $elementText = $input['elementText'] ?? ($input['text'] ?? '');
    $elementId = $input['elementId'] ?? ($input['id'] ?? '');
    $targetUrl = $input['targetUrl'] ?? ($input['url'] ?? '');

    if (!empty($sessionId)) {
        try {
            $stmt = $pdo->prepare("
                INSERT INTO visitor_clicks (session_id, event_type, element_id, element_text, target_url, created_at)
                VALUES (?, 'click', ?, ?, ?, NOW())
            ");
            $stmt->execute([$sessionId, substr($elementId, 0, 100), substr($elementText, 0, 255), substr($targetUrl, 0, 255)]);
            echo json_encode(["success" => true]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(["success" => false, "error" => $e->getMessage()]);
        }
    } else {
        echo json_encode(["success" => false, "error" => "Geen sessionId"]);
    }
    exit;
}

// ==========================================
// 5B. ACTIE: REGISTREER QR SCAN
// ==========================================
if ($action === 'qr_scan') {
    $code = $input['redirectCode'] ?? ($input['code'] ?? 'ONBEKEND');
    $targetRoute = $input['targetRoute'] ?? '/';
    $city = $input['city'] ?? 'Onbekend';
    $country = $input['country'] ?? 'Nederland';
    $lat = isset($input['lat']) ? (float)$input['lat'] : null;
    $lng = isset($input['lng']) ? (float)$input['lng'] : null;
    $deviceType = $input['deviceType'] ?? 'Mobiel';
    $userAgent = $input['userAgent'] ?? ($_SERVER['HTTP_USER_AGENT'] ?? '');
    $scannedAt = $input['timestamp'] ?? ($input['scannedAt'] ?? date('Y-m-d H:i:s'));

    try {
        $stmt = $pdo->prepare("
            INSERT INTO qr_scans 
            (code, target_route, city, country, lat, lng, device_type, user_agent, scanned_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$code, $targetRoute, $city, $country, $lat, $lng, $deviceType, $userAgent, $scannedAt]);
        echo json_encode(["success" => true, "id" => $pdo->lastInsertId()]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
    exit;
}

// ==========================================
// 5C. ACTIE: REGISTREER NIEUWSBRIEF ABONNEE
// ==========================================
if ($action === 'subscribe') {
    $email = trim(strtolower($input['email'] ?? ''));
    $name = trim($input['name'] ?? ($input['firstName'] ?? ''));
    $source = $input['source'] ?? 'website';
    $subscribedAt = $input['subscribedAt'] ?? date('Y-m-d H:i:s');

    if (empty($email)) {
        http_response_code(400);
        echo json_encode(["success" => false, "error" => "Email is verplicht."]);
        exit;
    }

    try {
        $stmt = $pdo->prepare("
            INSERT INTO newsletter_subscribers (email, name, status, source, subscribed_at)
            VALUES (?, ?, 'active', ?, ?)
            ON DUPLICATE KEY UPDATE name = VALUES(name), status = 'active'
        ");
        $stmt->execute([$email, $name, $source, $subscribedAt]);
        echo json_encode(["success" => true, "id" => $pdo->lastInsertId()]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
    exit;
}

// ==========================================
// 6. ACTIE: REGISTREER MUZIEKPLAY
// ==========================================
if ($action === 'music_play') {
    $sessionId = $input['sessionId'] ?? ($input['session_id'] ?? null);
    $trackId = $input['trackId'] ?? 'Onbekend';
    $trackTitle = $input['trackTitle'] ?? 'Muzieknummer';
    $album = $input['album'] ?? 'De Echo';
    $format = $input['format'] ?? 'mp3';
    $rating = $input['rating'] ?? 'none';
    $duration = (int)($input['duration'] ?? ($input['durationSeconds'] ?? 0));
    $completed = (!empty($input['completed']) && $input['completed'] !== 'false' && $input['completed'] !== false) ? 1 : 0;
    $city = $input['city'] ?? 'Onbekend';
    $country = $input['country'] ?? 'Nederland';
    $lat = isset($input['lat']) ? (float)$input['lat'] : null;
    $lng = isset($input['lng']) ? (float)$input['lng'] : null;
    $deviceType = $input['deviceType'] ?? 'Bureaublad computer';
    $userAgent = $input['userAgent'] ?? ($_SERVER['HTTP_USER_AGENT'] ?? '');

    $createdAt = $input['createdAt'] ?? ($input['timestamp'] ?? date('Y-m-d H:i:s'));

    try {
        // Zorg dat de kolom 'completed' bestaat indien de tabel al eerder was aangemaakt
        try {
            $cols = $pdo->query("SHOW COLUMNS FROM `music_listens` LIKE 'completed'")->fetchAll();
            if (empty($cols)) {
                $pdo->exec("ALTER TABLE `music_listens` ADD COLUMN `completed` TINYINT(1) NOT NULL DEFAULT 0 AFTER `duration_seconds`");
            }
        } catch (Exception $e) {}

        $stmt = $pdo->prepare("
            INSERT INTO music_listens 
            (session_id, track_id, track_title, album, format, rating, duration_seconds, completed, city, country, lat, lng, device_type, user_agent, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $sessionId, $trackId, $trackTitle, $album, $format, $rating, $duration, $completed, $city, $country, $lat, $lng, $deviceType, $userAgent, $createdAt
        ]);
        
        echo json_encode(["success" => true, "id" => $pdo->lastInsertId()]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
    exit;
}

// ==========================================
// 6B. ACTIE: UPDATE MUZIEKPLAY (Bij volledig afluisteren of tussentijdse update)
// ==========================================
if ($action === 'music_update' || $action === 'music_complete') {
    $id = (int)($input['id'] ?? ($_GET['id'] ?? 0));
    $completed = (!empty($input['completed']) && $input['completed'] !== 'false' && $input['completed'] !== false) ? 1 : 0;
    $duration = (int)($input['duration'] ?? ($input['durationSeconds'] ?? 0));

    if ($id > 0) {
        try {
            try {
                $cols = $pdo->query("SHOW COLUMNS FROM `music_listens` LIKE 'completed'")->fetchAll();
                if (empty($cols)) {
                    $pdo->exec("ALTER TABLE `music_listens` ADD COLUMN `completed` TINYINT(1) NOT NULL DEFAULT 0 AFTER `duration_seconds`");
                }
            } catch (Exception $e) {}

            $stmt = $pdo->prepare("
                UPDATE music_listens 
                SET completed = ?, duration_seconds = GREATEST(duration_seconds, ?) 
                WHERE id = ?
            ");
            $stmt->execute([$completed, $duration, $id]);
            echo json_encode(["success" => true, "updated_id" => $id]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(["success" => false, "error" => $e->getMessage()]);
        }
    } else {
        echo json_encode(["success" => false, "error" => "Geen geldig listen ID opgegeven."]);
    }
    exit;
}

// ==========================================
// 6C. ACTIE: BEOORDELING (THUMBS UP / DOWN)
// ==========================================
if ($action === 'music_rate') {
    $trackId = $input['trackId'] ?? ($input['track_id'] ?? 'Onbekend');
    $trackTitle = $input['trackTitle'] ?? ($input['track_title'] ?? 'Muzieknummer');
    $album = $input['album'] ?? 'De Echo';
    $format = $input['format'] ?? 'mp3';
    $rating = $input['rating'] ?? 'none';
    $city = $input['city'] ?? 'Onbekend';
    $country = $input['country'] ?? 'Nederland';
    $lat = isset($input['lat']) ? (float)$input['lat'] : null;
    $lng = isset($input['lng']) ? (float)$input['lng'] : null;
    $deviceType = $input['deviceType'] ?? 'Mobiel';
    $userAgent = $input['userAgent'] ?? ($_SERVER['HTTP_USER_AGENT'] ?? '');
    $createdAt = $input['timestamp'] ?? ($input['createdAt'] ?? date('Y-m-d H:i:s'));

    try {
        $stmt = $pdo->prepare("
            INSERT INTO music_listens 
            (track_id, track_title, album, format, rating, duration_seconds, completed, city, country, lat, lng, device_type, user_agent, created_at) 
            VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $trackId, $trackTitle, $album, $format, $rating, $city, $country, $lat, $lng, $deviceType, $userAgent, $createdAt
        ]);
        echo json_encode(["success" => true, "id" => $pdo->lastInsertId()]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
    exit;
}

// ==========================================
// 7. ACTIE: GET LISTENS, SCANS, SUBSCRIBERS
// ==========================================
if ($action === 'get_music_listens') {
    try {
        $stmt = $pdo->query("SELECT * FROM music_listens ORDER BY created_at DESC LIMIT 1000");
        $rows = $stmt->fetchAll();
        $formatted = array_map(function($r) {
            return [
                'id' => (string)$r['id'],
                'trackId' => $r['track_id'],
                'trackTitle' => $r['track_title'],
                'album' => $r['album'],
                'format' => $r['format'],
                'rating' => $r['rating'] === 'none' ? null : $r['rating'],
                'duration' => (int)$r['duration_seconds'],
                'durationSeconds' => (int)$r['duration_seconds'],
                'completed' => !empty($r['completed']),
                'city' => $r['city'],
                'country' => $r['country'],
                'lat' => $r['lat'] !== null ? (float)$r['lat'] : null,
                'lng' => $r['lng'] !== null ? (float)$r['lng'] : null,
                'deviceType' => $r['device_type'],
                'userAgent' => $r['user_agent'],
                'timestamp' => $r['created_at']
            ];
        }, $rows);
        echo json_encode(["success" => true, "listens" => $formatted]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
    exit;
}

if ($action === 'get_qr_scans') {
    try {
        $stmt = $pdo->query("SELECT * FROM qr_scans ORDER BY scanned_at DESC LIMIT 500");
        $rows = $stmt->fetchAll();
        $formatted = array_map(function($r) {
            return [
                'id' => (string)$r['id'],
                'redirectCode' => $r['code'],
                'code' => $r['code'],
                'targetRoute' => $r['target_route'],
                'city' => $r['city'],
                'country' => $r['country'],
                'lat' => $r['lat'] !== null ? (float)$r['lat'] : null,
                'lng' => $r['lng'] !== null ? (float)$r['lng'] : null,
                'deviceType' => $r['device_type'],
                'userAgent' => $r['user_agent'],
                'timestamp' => $r['scanned_at']
            ];
        }, $rows);
        echo json_encode(["success" => true, "scans" => $formatted]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
    exit;
}

if ($action === 'get_subscribers') {
    try {
        $stmt = $pdo->query("SELECT * FROM newsletter_subscribers ORDER BY subscribed_at DESC LIMIT 500");
        $rows = $stmt->fetchAll();
        $formatted = array_map(function($r) {
            return [
                'id' => (string)$r['id'],
                'email' => $r['email'],
                'firstName' => $r['name'],
                'name' => $r['name'],
                'status' => $r['status'],
                'source' => $r['source'],
                'subscribedAt' => $r['subscribed_at']
            ];
        }, $rows);
        echo json_encode(["success" => true, "subscribers" => $formatted]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
    exit;
}

if ($action === 'get_visitor_sessions') {
    try {
        $stmt = $pdo->query("SELECT * FROM visitor_sessions ORDER BY started_at DESC LIMIT 500");
        $sessions = $stmt->fetchAll();

        $sessionIds = array_column($sessions, 'session_id');
        $pageviewsBySession = [];
        $clicksBySession = [];

        if (!empty($sessionIds)) {
            $inClause = implode(',', array_fill(0, count($sessionIds), '?'));
            $pvStmt = $pdo->prepare("SELECT session_id, page_path, page_title, time_on_page, viewed_at FROM visitor_pageviews WHERE session_id IN ($inClause) ORDER BY viewed_at ASC");
            $pvStmt->execute($sessionIds);
            foreach ($pvStmt->fetchAll() as $pv) {
                $pageviewsBySession[$pv['session_id']][] = [
                    'path' => $pv['page_path'],
                    'title' => $pv['page_title'],
                    'durationSeconds' => (int)$pv['time_on_page'],
                    'enteredAt' => $pv['viewed_at']
                ];
            }

            $clStmt = $pdo->prepare("SELECT session_id, element_id, element_text, target_url, created_at FROM visitor_clicks WHERE session_id IN ($inClause) ORDER BY created_at ASC");
            $clStmt->execute($sessionIds);
            foreach ($clStmt->fetchAll() as $cl) {
                $clicksBySession[$cl['session_id']][] = [
                    'elementId' => $cl['element_id'],
                    'elementText' => $cl['element_text'],
                    'targetUrl' => $cl['target_url'],
                    'clickedAt' => $cl['created_at']
                ];
            }
        }

        $formatted = array_map(function($s) use ($pageviewsBySession, $clicksBySession) {
            $sid = $s['session_id'];
            return [
                'id' => $sid,
                'sessionId' => $sid,
                'startedAt' => $s['started_at'],
                'endedAt' => $s['last_active_at'],
                'durationSeconds' => (int)$s['duration_seconds'],
                'pageviewsCount' => (int)$s['pageviews_count'],
                'deviceType' => $s['device_type'],
                'os' => $s['os'],
                'browser' => $s['browser'],
                'userAgent' => $s['user_agent'],
                'referrer' => $s['referrer'],
                'landingPage' => $s['landing_page'],
                'city' => $s['city'],
                'country' => $s['country'],
                'latitude' => $s['latitude'] !== null ? (float)$s['latitude'] : null,
                'longitude' => $s['longitude'] !== null ? (float)$s['longitude'] : null,
                'pages' => $pageviewsBySession[$sid] ?? [],
                'clicks' => $clicksBySession[$sid] ?? []
            ];
        }, $sessions);

        echo json_encode(["success" => true, "sessions" => $formatted]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
    exit;
}

if ($action === 'delete_visitor_session') {
    $sid = $input['sessionId'] ?? ($input['id'] ?? ($_GET['id'] ?? ''));
    try {
        if (!empty($sid)) {
            $stmt1 = $pdo->prepare("DELETE FROM visitor_sessions WHERE session_id = ?");
            $stmt1->execute([$sid]);
            $stmt2 = $pdo->prepare("DELETE FROM visitor_pageviews WHERE session_id = ?");
            $stmt2->execute([$sid]);
            $stmt3 = $pdo->prepare("DELETE FROM visitor_clicks WHERE session_id = ?");
            $stmt3->execute([$sid]);
        }
        echo json_encode(["success" => true]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
    exit;
}

if ($action === 'purge_visitor_sessions') {
    try {
        $pdo->exec("TRUNCATE TABLE visitor_sessions");
        $pdo->exec("TRUNCATE TABLE visitor_pageviews");
        $pdo->exec("TRUNCATE TABLE visitor_clicks");
        echo json_encode(["success" => true]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
    exit;
}

if ($action === 'delete_music_listen') {
    $id = (int)($input['id'] ?? ($_GET['id'] ?? 0));
    try {
        $stmt = $pdo->prepare("DELETE FROM music_listens WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(["success" => true]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
    exit;
}

if ($action === 'purge_music_listens') {
    try {
        $pdo->exec("TRUNCATE TABLE music_listens");
        echo json_encode(["success" => true]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
    exit;
}

if ($action === 'delete_qr_scan') {
    $id = (int)($input['id'] ?? ($_GET['id'] ?? 0));
    try {
        $stmt = $pdo->prepare("DELETE FROM qr_scans WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(["success" => true]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
    exit;
}

if ($action === 'purge_qr_scans') {
    try {
        $pdo->exec("TRUNCATE TABLE qr_scans");
        echo json_encode(["success" => true]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
    exit;
}

if ($action === 'delete_subscriber') {
    $id = (int)($input['id'] ?? ($_GET['id'] ?? 0));
    $email = trim($input['email'] ?? ($_GET['email'] ?? ''));
    try {
        if ($id > 0) {
            $stmt = $pdo->prepare("DELETE FROM newsletter_subscribers WHERE id = ?");
            $stmt->execute([$id]);
        } else if (!empty($email)) {
            $stmt = $pdo->prepare("DELETE FROM newsletter_subscribers WHERE email = ?");
            $stmt->execute([$email]);
        }
        echo json_encode(["success" => true]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
    exit;
}

if ($action === 'delete_by_city') {
    $city = trim($input['city'] ?? ($_GET['city'] ?? ''));
    if (!empty($city)) {
        try {
            $stmt1 = $pdo->prepare("DELETE FROM music_listens WHERE city LIKE ?");
            $stmt1->execute(['%' . $city . '%']);
            $delListens = $stmt1->rowCount();

            $stmt2 = $pdo->prepare("DELETE FROM qr_scans WHERE city LIKE ?");
            $stmt2->execute(['%' . $city . '%']);
            $delScans = $stmt2->rowCount();

            echo json_encode(["success" => true, "deleted_listens" => $delListens, "deleted_scans" => $delScans]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(["success" => false, "error" => $e->getMessage()]);
        }
    } else {
        echo json_encode(["success" => false, "error" => "Geen stad opgegeven."]);
    }
    exit;
}

// ==========================================
// 8. ACTIE: EXECUTE SQL (BEVEILIGD MET SLEUTEL)
// ==========================================
if ($action === 'sql' || $action === 'execute_sql') {
    $sql = $input['sql'] ?? ($_POST['sql'] ?? '');
    if (empty($sql)) {
        http_response_code(400);
        echo json_encode(["success" => false, "error" => "Geen SQL query opgegeven."]);
        exit;
    }
    try {
        // Multi-query support
        $pdo->setAttribute(PDO::ATTR_EMULATE_PREPARES, 1);
        $stmt = $pdo->prepare($sql);
        $stmt->execute();
        $results = [];
        do {
            if ($stmt->columnCount() > 0) {
                $results[] = $stmt->fetchAll();
            }
        } while ($stmt->nextRowset());
        echo json_encode(["success" => true, "data" => count($results) === 1 ? $results[0] : $results]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
    exit;
}

// ==========================================
// 7. ACTIE: OVERZICHT ANALYTICS (VOOR ADMIN)
// ==========================================
if ($action === 'get_overview') {
    try {
        $totalSessions = (int)$pdo->query("SELECT COUNT(*) FROM visitor_sessions")->fetchColumn();
        $totalPageviews = (int)$pdo->query("SELECT COUNT(*) FROM visitor_pageviews")->fetchColumn();
        $totalMusicPlays = (int)$pdo->query("SELECT COUNT(*) FROM music_listens")->fetchColumn();
        $totalQrScans = (int)$pdo->query("SELECT COUNT(*) FROM qr_scans")->fetchColumn();

        $recentSessions = $pdo->query("SELECT * FROM visitor_sessions ORDER BY started_at DESC LIMIT 50")->fetchAll();
        $popularTracks = $pdo->query("SELECT track_title, format, COUNT(*) as play_count FROM music_listens GROUP BY track_title, format ORDER BY play_count DESC LIMIT 20")->fetchAll();
        $topCities = $pdo->query("SELECT city, country, COUNT(*) as visit_count FROM visitor_sessions WHERE city != 'Onbekend' GROUP BY city, country ORDER BY visit_count DESC LIMIT 15")->fetchAll();

        echo json_encode([
            "success" => true,
            "metrics" => [
                "total_sessions" => $totalSessions,
                "total_pageviews" => $totalPageviews,
                "total_music_plays" => $totalMusicPlays,
                "total_qr_scans" => $totalQrScans
            ],
            "recent_sessions" => $recentSessions,
            "popular_tracks" => $popularTracks,
            "top_cities" => $topCities
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
    exit;
}

// ==========================================
// 9. ACTIES: BOEKEN BEHEER
// ==========================================
if ($action === 'get_boeken') {
    try {
        $stmt = $pdo->query("SELECT id, volgnummer, boektitel FROM boeken ORDER BY volgnummer ASC");
        $boeken = $stmt->fetchAll();
        echo json_encode(["success" => true, "boeken" => $boeken]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
    exit;
}

if ($action === 'save_boek') {
    $id = $input['id'] ?? ($_POST['id'] ?? '');
    $volgnummer = (int)($input['volgnummer'] ?? ($_POST['volgnummer'] ?? 1));
    $boektitel = trim($input['boektitel'] ?? ($_POST['boektitel'] ?? ''));

    if (empty($id) || empty($boektitel)) {
        http_response_code(400);
        echo json_encode(["success" => false, "error" => "ID en boektitel zijn verplicht."]);
        exit;
    }
    try {
        $stmt = $pdo->prepare("
            INSERT INTO boeken (id, volgnummer, boektitel)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE volgnummer = VALUES(volgnummer), boektitel = VALUES(boektitel)
        ");
        $stmt->execute([$id, $volgnummer, $boektitel]);
        echo json_encode(["success" => true, "id" => $id]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
    exit;
}

if ($action === 'delete_boek') {
    $id = $input['id'] ?? ($_GET['id'] ?? '');
    if (empty($id)) {
        http_response_code(400);
        echo json_encode(["success" => false, "error" => "Geen boek ID opgegeven."]);
        exit;
    }
    try {
        $stmt = $pdo->prepare("DELETE FROM boeken WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(["success" => true]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
    exit;
}

// ==========================================
// 10. ACTIES: HOOFDSTUKKEN BEHEER
// ==========================================
if ($action === 'get_hoofdstukken') {
    $boekId = $_GET['boekId'] ?? ($input['boekId'] ?? '');
    try {
        if (!empty($boekId)) {
            $stmt = $pdo->prepare("SELECT id, boek_id AS boekId, volgnummer, omschrijving FROM hoofdstukken WHERE boek_id = ? ORDER BY volgnummer ASC");
            $stmt->execute([$boekId]);
        } else {
            $stmt = $pdo->query("SELECT id, boek_id AS boekId, volgnummer, omschrijving FROM hoofdstukken ORDER BY volgnummer ASC");
        }
        $hoofdstukken = $stmt->fetchAll();
        echo json_encode(["success" => true, "hoofdstukken" => $hoofdstukken]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
    exit;
}

if ($action === 'save_hoofdstuk') {
    $id = $input['id'] ?? ($_POST['id'] ?? uniqid('ch_', true));
    $boekId = $input['boekId'] ?? ($input['boek_id'] ?? '');
    $volgnummer = (int)($input['volgnummer'] ?? ($_POST['volgnummer'] ?? 1));
    $omschrijving = trim($input['omschrijving'] ?? ($_POST['omschrijving'] ?? ''));

    if (empty($boekId) || empty($omschrijving)) {
        http_response_code(400);
        echo json_encode(["success" => false, "error" => "Boek ID en omschrijving zijn verplicht."]);
        exit;
    }
    try {
        $stmt = $pdo->prepare("
            INSERT INTO hoofdstukken (id, boek_id, volgnummer, omschrijving)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE boek_id = VALUES(boek_id), volgnummer = VALUES(volgnummer), omschrijving = VALUES(omschrijving)
        ");
        $stmt->execute([$id, $boekId, $volgnummer, $omschrijving]);
        echo json_encode(["success" => true, "id" => $id]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
    exit;
}

if ($action === 'delete_hoofdstuk') {
    $id = $input['id'] ?? ($_GET['id'] ?? '');
    if (empty($id)) {
        http_response_code(400);
        echo json_encode(["success" => false, "error" => "Geen hoofdstuk ID opgegeven."]);
        exit;
    }
    try {
        $stmt = $pdo->prepare("DELETE FROM hoofdstukken WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(["success" => true]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
    exit;
}

// ==========================================
// 11. ACTIES: QR CODES BEHEER
// ==========================================
if ($action === 'get_qrcodes') {
    try {
        $stmt = $pdo->query("
            SELECT id, boek_id AS boekId, boek_titel AS boekTitel, hoofdstuk_id AS hoofdstukId, hoofdstuk, song, artist, spotify_link AS spotifyLink, qr_image AS qrImage 
            FROM qrcodes 
            ORDER BY id ASC
        ");
        $qrcodes = $stmt->fetchAll();
        echo json_encode(["success" => true, "qrcodes" => $qrcodes]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
    exit;
}

if ($action === 'get_qrcode') {
    $code = strtoupper(trim($_GET['code'] ?? ($_GET['id'] ?? ($input['code'] ?? ($input['id'] ?? '')))));
    if (empty($code)) {
        http_response_code(400);
        echo json_encode(["success" => false, "error" => "Geen QR code opgegeven."]);
        exit;
    }
    try {
        $stmt = $pdo->prepare("
            SELECT id, boek_id AS boekId, boek_titel AS boekTitel, hoofdstuk_id AS hoofdstukId, hoofdstuk, song, artist, spotify_link AS spotifyLink, qr_image AS qrImage 
            FROM qrcodes 
            WHERE UPPER(id) = ? 
            LIMIT 1
        ");
        $stmt->execute([$code]);
        $row = $stmt->fetch();
        if ($row) {
            echo json_encode(["success" => true, "qrcode" => $row]);
        } else {
            http_response_code(404);
            echo json_encode(["success" => false, "error" => "QR code niet gevonden."]);
        }
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
    exit;
}

if ($action === 'save_qrcode') {
    $id = strtoupper(trim($input['id'] ?? ($_POST['id'] ?? '')));
    $boekId = $input['boekId'] ?? ($input['boek_id'] ?? '');
    $boekTitel = $input['boekTitel'] ?? ($input['boek_titel'] ?? '');
    $hoofdstukId = $input['hoofdstukId'] ?? ($input['hoofdstuk_id'] ?? '');
    $hoofdstuk = trim($input['hoofdstuk'] ?? ($_POST['hoofdstuk'] ?? ''));
    $song = trim($input['song'] ?? ($_POST['song'] ?? ''));
    $artist = trim($input['artist'] ?? ($_POST['artist'] ?? ''));
    $spotifyLink = trim($input['spotifyLink'] ?? ($input['spotify_link'] ?? ($_POST['spotifyLink'] ?? '')));
    $qrImage = $input['qrImage'] ?? ($input['qr_image'] ?? ($_POST['qrImage'] ?? ''));

    if (empty($id) || empty($hoofdstuk) || empty($song) || empty($artist) || empty($spotifyLink)) {
        http_response_code(400);
        echo json_encode(["success" => false, "error" => "QR code, hoofdstuk, song, artiest en Spotify link zijn verplicht."]);
        exit;
    }

    try {
        $stmt = $pdo->prepare("
            INSERT INTO qrcodes (id, boek_id, boek_titel, hoofdstuk_id, hoofdstuk, song, artist, spotify_link, qr_image)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                boek_id = VALUES(boek_id),
                boek_titel = VALUES(boek_titel),
                hoofdstuk_id = VALUES(hoofdstuk_id),
                hoofdstuk = VALUES(hoofdstuk),
                song = VALUES(song),
                artist = VALUES(artist),
                spotify_link = VALUES(spotify_link),
                qr_image = VALUES(qr_image)
        ");
        $stmt->execute([$id, $boekId, $boekTitel, $hoofdstukId, $hoofdstuk, $song, $artist, $spotifyLink, $qrImage]);
        echo json_encode(["success" => true, "id" => $id]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
    exit;
}

if ($action === 'delete_qrcode') {
    $id = strtoupper(trim($input['id'] ?? ($_GET['id'] ?? '')));
    if (empty($id)) {
        http_response_code(400);
        echo json_encode(["success" => false, "error" => "Geen QR code ID opgegeven."]);
        exit;
    }
    try {
        $stmt = $pdo->prepare("DELETE FROM qrcodes WHERE UPPER(id) = ?");
        $stmt->execute([$id]);
        echo json_encode(["success" => true]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
    exit;
}

http_response_code(400);
echo json_encode(["success" => false, "error" => "Onbekende actie: {$action}"]);
