<?php
/**
 * ==============================================================================
 * TransIP Dedicated MySQL Database Bridge & Music Catalog Gateway
 * Locatie op server: /www/api/music_database.php of /public_html/api/music_database.php
 * Database: paulw6_Music
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
$API_KEY = "music-secret-key-paul-2026";
$headers = getallheaders();
$receivedKey = $_SERVER['HTTP_X_API_KEY'] ?? ($headers['X-API-Key'] ?? ($headers['x-api-key'] ?? ''));

// Ondersteun ook GET query parameter voor snelle test in browser
if (empty($receivedKey) && isset($_GET['key'])) {
    $receivedKey = $_GET['key'];
}

if ($receivedKey !== $API_KEY) {
    http_response_code(401);
    echo json_encode(["success" => false, "error" => "Unauthorized: Ongeldige API Key."]);
    exit;
}

// ==========================================
// 2. DATABASE VERBINDING (TransIP MySQL)
// ==========================================
$db_host = '127.0.0.1'; // 127.0.0.1 forceert TCP/IP poort 3306 (voorkomt SQLSTATE[HY000] [2002] socket errors op TransIP)
$db_name = 'paulw6_Music';
$db_user = 'paulw6_Music';
$db_pass = 'MusicWasMyFirstLove1965!';
$db_port = 3306;

// Ondersteun overschrijving via parameters of environment
if (isset($_GET['db_host']) && !empty($_GET['db_host'])) $db_host = $_GET['db_host'];
if (isset($_GET['db_name']) && !empty($_GET['db_name'])) $db_name = $_GET['db_name'];
if (isset($_GET['db_user']) && !empty($_GET['db_user'])) $db_user = $_GET['db_user'];
if (isset($_GET['db_pass']) && !empty($_GET['db_pass'])) $db_pass = $_GET['db_pass'];
if (getenv('DB_HOST')) $db_host = getenv('DB_HOST');
if (getenv('DB_NAME')) $db_name = getenv('DB_NAME');
if (getenv('DB_USER')) $db_user = getenv('DB_USER');
if (getenv('DB_PASS')) $db_pass = getenv('DB_PASS');

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
        $db_host = $candidateHost;
        break; // Succesvol verbonden!
    } catch (PDOException $e) {
        $connectionErrors[$candidateHost] = $e->getMessage();
    }
}

if (!$pdo) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "error" => "Database verbinding mislukt met database '{$db_name}'.",
        "errors_tried" => $connectionErrors,
        "hint" => "Op TransIP moet de database host meestal '127.0.0.1' zijn of de hostname die in het TransIP Controlepaneel bij de MySQL Database staat (bijv. '127.0.0.1' of 'paulw6.mysql.transip.net')."
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

$input = json_decode(file_get_contents("php://input"), true) ?? [];
$action = $_GET['action'] ?? ($input['action'] ?? '');

// ==========================================
// 3. ONDERSTEUNING VOOR DIRECTE SQL QUERIES
// ==========================================
if (isset($input['sql']) && !empty(trim($input['sql']))) {
    $sql = trim($input['sql']);
    $params = $input['params'] ?? [];
    try {
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        if (stripos($sql, 'SELECT') === 0 || stripos($sql, 'SHOW') === 0 || stripos($sql, 'DESCRIBE') === 0 || stripos($sql, 'EXPLAIN') === 0) {
            $data = $stmt->fetchAll();
            echo json_encode(["success" => true, "data" => $data]);
        } else {
            echo json_encode([
                "success" => true,
                "affected_rows" => $stmt->rowCount(),
                "last_insert_id" => $pdo->lastInsertId()
            ]);
        }
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
    exit;
}

// Default action als er niets is opgegeven
if (empty($action)) {
    $action = 'get_catalog';
}

// Helper functie: Vind fysieke map op server
function getMusicBasePath() {
    $candidates = [
        dirname(__DIR__) . '/@music',
        $_SERVER['DOCUMENT_ROOT'] . '/@music',
        dirname(__DIR__) . '/public/@music',
        '/www/@music',
        '/public_html/@music'
    ];
    foreach ($candidates as $dir) {
        if (is_dir($dir)) return realpath($dir);
    }
    return dirname(__DIR__) . '/@music';
}

// Helper functie: Scan bestanden in een specifieke track-map volgens de conventie
function resolveTrackFiles($folderName, $title) {
    $baseDir = getMusicBasePath();
    $dirPath = $baseDir . '/' . $folderName;
    $actualFolderName = $folderName;

    // Als de opgegeven mapnaam niet bestaat, probeer alternatieven (bijv. met/zonder voorloopnummer)
    if (!is_dir($dirPath) && is_dir($baseDir)) {
        $cleanName = preg_replace('/^\d+\s*/', '', $folderName);
        $candidates = [
            $cleanName,
            str_replace("'", "", $folderName),
            str_replace("'", "", $cleanName)
        ];
        
        // Zoek ook in alle mappen van baseDir naar een match
        $allDirs = scandir($baseDir);
        foreach ($allDirs as $d) {
            if ($d === '.' || $d === '..') continue;
            if (is_dir($baseDir . '/' . $d)) {
                $dClean = strtolower(preg_replace('/[^\w]/', '', $d));
                $tClean = strtolower(preg_replace('/[^\w]/', '', $title));
                $fClean = strtolower(preg_replace('/[^\w]/', '', $folderName));
                if ($dClean === $fClean || strpos($dClean, $tClean) !== false) {
                    $candidates[] = $d;
                }
            }
        }

        foreach ($candidates as $cand) {
            if (is_dir($baseDir . '/' . $cand)) {
                $dirPath = $baseDir . '/' . $cand;
                $actualFolderName = $cand;
                break;
            }
        }
    }

    $encodedFolder = rawurlencode($actualFolderName);
    $urlBase = '/@music/' . $encodedFolder;

    $result = [
        'actualFolder' => $actualFolderName,
        'mp3' => $urlBase . '/' . rawurlencode($title) . '.mp3',
        'audiobook' => null,
        'reflection' => null,
        'videoMov' => null,
        'coverJpg' => null,
        'portraitJpg' => null,
        'landscapeJpg' => null,
        'thumbnailJpg' => null,
        'subtitles' => []
    ];

    if (!is_dir($dirPath)) {
        // Fallback als map (nog) niet fysiek bestaat
        $result['coverJpg'] = $urlBase . '/' . rawurlencode($title) . '.jpg';
        $result['portraitJpg'] = $urlBase . '/' . rawurlencode($title) . '.jpg';
        $result['landscapeJpg'] = $urlBase . '/' . rawurlencode($title) . '%20landscape.jpg';
        $result['thumbnailJpg'] = $urlBase . '/' . rawurlencode($title) . '.jpg';
        return $result;
    }

    $files = scandir($dirPath);

    // Eerst mp3 bestandsnaam opsporen om gelijknamige albumcover te vinden
    $mp3BaseName = null;
    foreach ($files as $f) {
        if ($f === '.' || $f === '..') continue;
        if (preg_match('/\.mp3$/i', $f)) {
            $result['mp3'] = $urlBase . '/' . rawurlencode($f);
            $mp3BaseName = strtolower(pathinfo($f, PATHINFO_FILENAME));
            break;
        }
    }

    foreach ($files as $f) {
        if ($f === '.' || $f === '..') continue;
        $fLower = strtolower($f);
        $fileUrl = $urlBase . '/' . rawurlencode($f);
        $baseName = strtolower(pathinfo($f, PATHINFO_FILENAME));

        // Gelijknamige albumcover (.jpg / .jpeg / .png / .webp) van mp3
        if ($mp3BaseName && $baseName === $mp3BaseName && preg_match('/\.(jpg|jpeg|png|webp)$/i', $f)) {
            $result['coverJpg'] = $fileUrl;
            if (empty($result['thumbnailJpg'])) {
                $result['thumbnailJpg'] = $fileUrl;
            }
        }
        // MP3 (als nog niet gevonden)
        else if (preg_match('/\.mp3$/i', $f)) {
            $result['mp3'] = $fileUrl;
        }
        // Audiobook
        else if (strpos($fLower, 'audiobook') !== false) {
            $result['audiobook'] = $fileUrl;
        }
        // Reflectie / Reflection
        else if (strpos($fLower, 'reflectie') !== false || strpos($fLower, 'reflection') !== false) {
            $result['reflection'] = $fileUrl;
        }
        // Video MOV of MP4
        else if (preg_match('/\.(mov|mp4)$/i', $f)) {
            $result['videoMov'] = $fileUrl;
        }
        // Portrait afbeelding
        else if ((strpos($fLower, 'portrait') !== false || strpos($fLower, 'staand') !== false) && preg_match('/\.(jpg|jpeg|png|webp)$/i', $f)) {
            $result['portraitJpg'] = $fileUrl;
        }
        // Landscape afbeelding
        else if ((strpos($fLower, 'landscape') !== false || strpos($fLower, 'liggend') !== false) && preg_match('/\.(jpg|jpeg|png|webp)$/i', $f)) {
            $result['landscapeJpg'] = $fileUrl;
        }
        // Thumbnail afbeelding
        else if ((strpos($fLower, 'thumbnail') !== false || strpos($fLower, 'thumb') !== false) && preg_match('/\.(jpg|jpeg|png|webp)$/i', $f)) {
            $result['thumbnailJpg'] = $fileUrl;
        }
        // Subtitles
        else if (preg_match('/-en\.srt$/i', $f)) {
            $result['subtitles']['EN'] = $fileUrl;
        }
        else if (preg_match('/-nl\.srt$/i', $f)) {
            $result['subtitles']['NL'] = $fileUrl;
        }
        else if (preg_match('/-gb\.srt$/i', $f)) {
            $result['subtitles']['GB'] = $fileUrl;
        }
        else if (preg_match('/\.srt$/i', $f)) {
            $result['subtitles']['DEFAULT'] = $fileUrl;
        }
    }

    if (empty($result['portraitJpg']) && !empty($result['coverJpg'])) {
        $result['portraitJpg'] = $result['coverJpg'];
    }

    if (empty($result['subtitles'])) {
        unset($result['subtitles']);
    }

    return $result;
}

// Helper functie: Bepaal album cover uit /www/@music/_albums/ map of database
function resolveAlbumCover($album, $appTracks = []) {
    // 1. Expliciete cover opgeslagen in database
    if (is_array($album) && !empty($album['cover'])) {
        return $album['cover'];
    }

    $title = is_array($album) ? ($album['title'] ?? '') : (string)$album;
    $titleLower = strtolower(trim($title));

    // 2. Directe match met bestanden in /www/@music/_albums/
    if (strpos($titleLower, 'echo') !== false) {
        return '/@music/_albums/De%20Echo%20Album.jpg';
    }
    if (strpos($titleLower, 'geboorte') !== false || strpos($titleLower, 'leeuw') !== false) {
        return '/@music/_albums/De%20Geboorte%20van%20de%20Leeuw%20Album.jpg';
    }
    if (strpos($titleLower, 'krabbel') !== false) {
        return '/@music/_albums/Muzikale%20Krabbels%20Album.jpg';
    }

    // 3. Dynamische scan in _albums map
    $baseDir = getMusicBasePath();
    $albumsDir = $baseDir . '/_albums';
    if (is_dir($albumsDir)) {
        $files = scandir($albumsDir);
        $cleanTitle = preg_replace('/[^\w]/', '', $titleLower);
        foreach ($files as $f) {
            if ($f === '.' || $f === '..') continue;
            $fClean = preg_replace('/[^\w]/', '', strtolower($f));
            if (strpos($fClean, $cleanTitle) !== false || strpos($cleanTitle, $fClean) !== false) {
                return '/@music/_albums/' . rawurlencode($f);
            }
        }
    }

    // 4. Fallback op de thumbnail van het eerste nummer in het album
    if (!empty($appTracks)) {
        foreach ($appTracks as $trk) {
            if (isset($trk['album']) && strtolower($trk['album']) === $titleLower) {
                if (!empty($trk['thumbnailJpg'])) return $trk['thumbnailJpg'];
                if (!empty($trk['portraitJpg'])) return $trk['portraitJpg'];
            }
        }
    }

    return '/@music/_albums/' . rawurlencode($title . ' Album.jpg');
}

// ==============================================================================
// ACTIE: STATUS / TEST VERBINDING
// ==============================================================================
if ($action === 'test_connection') {
    echo json_encode([
        "success" => true,
        "database" => $db_name,
        "host" => $db_host,
        "message" => "Succesvol verbonden met MySQL database '{$db_name}' op TransIP!",
        "music_folder_found" => is_dir(getMusicBasePath()),
        "music_folder_path" => getMusicBasePath()
    ]);
    exit;
}

// ==============================================================================
// ACTIE: INITIALISEER TABELLEN & SEED DATA (ALBUMS & TRACKS)
// ==============================================================================
if ($action === 'init_tables' || $action === 'reseed_tables') {
    try {
        // 1. Maak tabellen aan indien nog niet bestaan
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS albums (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                artist VARCHAR(255) DEFAULT 'Paul van Geenen',
                description TEXT,
                order_num INT NOT NULL DEFAULT 1
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");

        $pdo->exec("
            CREATE TABLE IF NOT EXISTS tracks (
                id INT AUTO_INCREMENT PRIMARY KEY,
                album_id INT NOT NULL,
                track_order INT NOT NULL DEFAULT 1,
                title VARCHAR(255) NOT NULL,
                foldername VARCHAR(255) NOT NULL,
                INDEX (album_id),
                FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");

        $force = ($action === 'reseed_tables') || isset($_GET['force']) || (isset($input['force']) && $input['force']);

        if ($force) {
            $pdo->exec("DELETE FROM tracks;");
            $pdo->exec("DELETE FROM albums;");
            $pdo->exec("ALTER TABLE tracks AUTO_INCREMENT = 1;");
            $pdo->exec("ALTER TABLE albums AUTO_INCREMENT = 1;");
        }

        // Seed standaard albums indien leeg
        $albumCount = (int)$pdo->query("SELECT COUNT(*) FROM albums")->fetchColumn();
        if ($albumCount === 0) {
            $stmtAlb = $pdo->prepare("INSERT INTO albums (id, title, artist, description, order_num) VALUES (?, ?, ?, ?, ?)");
            $stmtAlb->execute([1, 'Muzikale Krabbels', 'Paul van Geenen', 'Verhalen, melodieën en reflecties van Paul van Geenen', 1]);
            $stmtAlb->execute([2, 'De Echo', 'Paul van Geenen', 'Soundtrack en muzikale vertellingen', 2]);
            $stmtAlb->execute([3, 'De Geboorte van de Leeuw', 'Paul van Geenen', 'Soundtrack en composities', 3]);
        }

        // Seed standaard tracks exact volgens tracks.json
        $trackCount = (int)$pdo->query("SELECT COUNT(*) FROM tracks")->fetchColumn();
        if ($trackCount === 0) {
            $defaultTracks = [
                // Album 1: Muzikale Krabbels (album_id: 1)
                [1, 1, 'Leeuw', '001 Leeuw'],
                [1, 2, 'de Passant', '002 de Passant'],
                [1, 3, 'in de Leegte', '003 in de Leegte'],
                [1, 4, 'niet meer mijn wereld', '004 niet meer mijn wereld'],
                [1, 5, 'de Tumor', '006 de Tumor'],

                // Album 2: De Echo (album_id: 2)
                [2, 1, 'de Echo', '005 de Echo'],
                [2, 2, 'de Sleutel', 'de Sleutel'],
                [2, 3, 'Rumbameisje', 'Rumbameisje'],
                [2, 4, 'the Echo screams', '010 the Echo screams'],
                [2, 5, 'the Silent Code', '011 the Silent Code'],

                // Album 3: De Geboorte van de Leeuw (album_id: 3)
                [3, 1, "Milonga's Nacht", 'Milongas Nacht']
            ];

            $stmtTrk = $pdo->prepare("INSERT INTO tracks (album_id, track_order, title, foldername) VALUES (?, ?, ?, ?)");
            foreach ($defaultTracks as $t) {
                $stmtTrk->execute($t);
            }
        }

        echo json_encode([
            "success" => true,
            "message" => "Tabellen 'albums' en 'tracks' zijn succesvol geverifieerd en gevuld met de 11 nummers verdeeld over de 3 albums!"
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => "Init tables fout: " . $e->getMessage()]);
    }
    exit;
}

// ==============================================================================
// ACTIE: SCAN & IMPORT ALLE FYSIEKE MAPPEN OP DE SERVER (AUTOMATISCHE IMPORT)
// ==============================================================================
if ($action === 'scan_server_folders' || $action === 'sync_all_server_folders') {
    try {
        $baseDir = getMusicBasePath();
        if (!is_dir($baseDir)) {
            http_response_code(404);
            echo json_encode([
                "success" => false,
                "error" => "Muziekmap '@music' niet gevonden op de server.",
                "path_checked" => $baseDir
            ]);
            exit;
        }

        // Zorg dat standaard albums bestaan
        $albumMap = [];
        $albums = $pdo->query("SELECT id, title FROM albums ORDER BY order_num ASC")->fetchAll();
        if (empty($albums)) {
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS albums (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    title VARCHAR(255) NOT NULL,
                    artist VARCHAR(255) DEFAULT 'Paul van Geenen',
                    description TEXT,
                    order_num INT NOT NULL DEFAULT 1
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            ");
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS tracks (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    album_id INT NOT NULL,
                    track_order INT NOT NULL DEFAULT 1,
                    title VARCHAR(255) NOT NULL,
                    foldername VARCHAR(255) NOT NULL,
                    INDEX (album_id),
                    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            ");
            $pdo->exec("INSERT INTO albums (id, title, artist, description, order_num) VALUES 
                (1, 'Muzikale Krabbels', 'Paul van Geenen', 'Verhalen, melodieën en reflecties van Paul van Geenen', 1),
                (2, 'De Echo', 'Paul van Geenen', 'Soundtrack en muzikale vertellingen', 2),
                (3, 'De Geboorte van de Leeuw', 'Paul van Geenen', 'Soundtrack en composities', 3)");
            $albums = $pdo->query("SELECT id, title FROM albums ORDER BY order_num ASC")->fetchAll();
        }

        foreach ($albums as $a) {
            $albumMap[strtolower($a['title'])] = (int)$a['id'];
        }

        $allExistingTracks = $pdo->query("SELECT id, album_id, track_order, title, foldername FROM tracks")->fetchAll();
        $existingByFolder = [];
        foreach ($allExistingTracks as $et) {
            $existingByFolder[strtolower(trim($et['foldername']))] = $et;
        }

        $items = scandir($baseDir);
        $scannedFolders = [];
        $addedTracks = [];
        $updatedTracks = [];

        // Album toewijzingen volgens bekende catalogus
        $knownAlbumMap = [
            'leeuw' => 1,
            '001 leeuw' => 1,
            'de passant' => 1,
            '002 de passant' => 1,
            'in de leegte' => 1,
            '003 in de leegte' => 1,
            'niet meer mijn wereld' => 1,
            '004 niet meer mijn wereld' => 1,
            'de tumor' => 1,
            '006 de tumor' => 1,
            'de echo' => 2,
            '005 de echo' => 2,
            'de sleutel' => 2,
            '002 de sleutel' => 2,
            'rumbameisje' => 2,
            '003 rumbameisje' => 2,
            'the echo screams' => 2,
            '010 the echo screams' => 2,
            'the silent code' => 2,
            '011 the silent code' => 2,
            'milongas nacht' => 3,
            'milonga\'s nacht' => 3,
            '002 milongas nacht' => 3
        ];

        foreach ($items as $item) {
            if ($item === '.' || $item === '..' || !is_dir($baseDir . '/' . $item)) continue;

            $folderName = $item;
            $folderPath = $baseDir . '/' . $folderName;
            $filesInFolder = scandir($folderPath);
            $hasAudioOrMedia = false;
            $detectedFiles = [];

            foreach ($filesInFolder as $f) {
                if ($f === '.' || $f === '..') continue;
                $fLower = strtolower($f);
                if (preg_match('/\.(mp3|wav|m4a|mov|mp4|jpg|jpeg|png|srt)$/i', $f)) {
                    $detectedFiles[] = $f;
                    if (preg_match('/\.(mp3|wav|m4a|mov|mp4)$/i', $f)) {
                        $hasAudioOrMedia = true;
                    }
                }
            }

            // Bepaal titel en ordernummer uit mapnaam
            $title = $folderName;
            $orderNum = 1;
            if (preg_match('/^(\d+)\s*(.*)$/', $folderName, $matches)) {
                $orderNum = (int)$matches[1];
                $title = trim($matches[2]);
            }
            if (empty($title)) $title = $folderName;

            // Bepaal album
            $albumId = 1;
            $cleanKey = strtolower(trim($folderName));
            $cleanTitleKey = strtolower(trim($title));
            if (isset($knownAlbumMap[$cleanKey])) {
                $albumId = $knownAlbumMap[$cleanKey];
            } else if (isset($knownAlbumMap[$cleanTitleKey])) {
                $albumId = $knownAlbumMap[$cleanTitleKey];
            } else if (stripos($folderName, 'echo') !== false) {
                $albumId = 2;
            } else if (stripos($folderName, 'milonga') !== false || stripos($folderName, 'geboorte') !== false) {
                $albumId = 3;
            }

            $scannedFolders[] = [
                'folderName' => $folderName,
                'title' => $title,
                'order' => $orderNum,
                'suggestedAlbumId' => $albumId,
                'hasMedia' => $hasAudioOrMedia,
                'filesCount' => count($detectedFiles),
                'files' => $detectedFiles
            ];

            // Als action == sync_all_server_folders: voeg ontbrekende toe aan database
            if ($action === 'sync_all_server_folders' && $hasAudioOrMedia) {
                if (!isset($existingByFolder[strtolower(trim($folderName))])) {
                    $stmt = $pdo->prepare("INSERT INTO tracks (album_id, track_order, title, foldername) VALUES (?, ?, ?, ?)");
                    $stmt->execute([$albumId, $orderNum, $title, $folderName]);
                    $addedTracks[] = [
                        'id' => $pdo->lastInsertId(),
                        'album_id' => $albumId,
                        'track_order' => $orderNum,
                        'title' => $title,
                        'foldername' => $folderName
                    ];
                }
            }
        }

        $allTracksNow = $pdo->query("SELECT t.*, a.title as album_title FROM tracks t JOIN albums a ON t.album_id = a.id ORDER BY a.order_num ASC, t.track_order ASC")->fetchAll();

        echo json_encode([
            "success" => true,
            "message" => "Server scan voltooid: " . count($scannedFolders) . " fysieke mappen gevonden in @music!",
            "music_path" => $baseDir,
            "total_folders_found" => count($scannedFolders),
            "new_tracks_imported" => count($addedTracks),
            "total_tracks_in_db" => count($allTracksNow),
            "scanned_folders" => $scannedFolders,
            "added_tracks" => $addedTracks,
            "current_database_tracks" => $allTracksNow
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => "Fout bij scannen van server mappen: " . $e->getMessage()]);
    }
    exit;
}

// Zorg dat de tabel albums een 'cover' kolom heeft indien nog niet aanwezig
try {
    $pdo->exec("ALTER TABLE albums ADD COLUMN cover VARCHAR(500) NULL DEFAULT NULL;");
} catch (Exception $e) {
    // Reeds aanwezig of geen permissie nodig
}

// ==============================================================================
// ACTIE: GET_CATALOG (VOOR DE MUZIEKSPELER)
// ==============================================================================
if ($action === 'get_catalog') {
    try {
        // Haal albums op
        $stmtAlb = $pdo->query("SELECT id, title, artist, description, order_num, cover FROM albums ORDER BY order_num ASC, id ASC");
        $albums = $stmtAlb->fetchAll();

        // Haal tracks op
        $stmtTrk = $pdo->query("
            SELECT t.id, t.album_id, t.track_order, t.title, t.foldername, a.title as album_title
            FROM tracks t
            JOIN albums a ON t.album_id = a.id
            ORDER BY a.order_num ASC, t.track_order ASC, t.id ASC
        ");
        $dbTracks = $stmtTrk->fetchAll();

        $appTracks = [];
        foreach ($dbTracks as $t) {
            $orderCode = str_pad((string)$t['track_order'], 3, '0', STR_PAD_LEFT);
            $media = resolveTrackFiles($t['foldername'], $t['title']);

            $trackObj = [
                "id" => (string)$t['id'],
                "order" => $orderCode,
                "title" => $t['title'],
                "album" => $t['album_title'],
                "albumId" => (int)$t['album_id'],
                "folderName" => $t['foldername'],
                "mp3" => $media['mp3'],
                "audiobook" => $media['audiobook'],
                "reflection" => $media['reflection'],
                "videoMov" => $media['videoMov'],
                "portraitJpg" => $media['portraitJpg'],
                "landscapeJpg" => $media['landscapeJpg'],
                "thumbnailJpg" => $media['thumbnailJpg']
            ];

            if (isset($media['subtitles'])) {
                $trackObj['subtitles'] = $media['subtitles'];
            }

            $appTracks[] = $trackObj;
        }

        // Bepaal album covers
        $formattedAlbums = [];
        foreach ($albums as $alb) {
            $albumCover = resolveAlbumCover($alb, $appTracks);

            $formattedAlbums[] = [
                "id" => (string)$alb['id'],
                "title" => $alb['title'],
                "artist" => $alb['artist'] ?? 'Paul van Geenen',
                "cover" => $albumCover,
                "description" => $alb['description'] ?? '',
                "order" => (int)($alb['order_num'] ?? 1)
            ];
        }

        echo json_encode([
            "success" => true,
            "startupPortrait" => "/@music/startup%20portrait.jpg",
            "startupLandscape" => "/@music/startup%20landscape.jpg",
            "startupPortraitMov" => "/@music/startup%20portrait.mov",
            "startupLandscapeMov" => "/@music/startup%20landscape.mov",
            "albums" => $formattedAlbums,
            "tracks" => $appTracks
        ], JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
    exit;
}

// ==============================================================================
// ACTIE: GET_ADMIN_DATA (RUWE DATA MET DETECTIE-PREVIEW)
// ==============================================================================
if ($action === 'get_admin_data') {
    try {
        $albums = $pdo->query("SELECT * FROM albums ORDER BY order_num ASC, id ASC")->fetchAll();
        $tracks = $pdo->query("SELECT * FROM tracks ORDER BY album_id ASC, track_order ASC, id ASC")->fetchAll();

        foreach ($tracks as &$trk) {
            $trk['media_detected'] = resolveTrackFiles($trk['foldername'], $trk['title']);
        }

        echo json_encode([
            "success" => true,
            "albums" => $albums,
            "tracks" => $tracks
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
    exit;
}

// ==============================================================================
// ACTIE: SAVE_ALBUM (TOEVOEGEN OF BIJWERKEN)
// ==============================================================================
if ($action === 'save_album') {
    $id = isset($input['id']) && !empty($input['id']) ? (int)$input['id'] : null;
    $title = trim($input['title'] ?? '');
    $artist = trim($input['artist'] ?? 'Paul van Geenen');
    $description = trim($input['description'] ?? '');
    $cover = trim($input['cover'] ?? '');
    $order_num = (int)($input['order_num'] ?? 1);

    if (empty($title)) {
        http_response_code(400);
        echo json_encode(["success" => false, "error" => "Album titel is verplicht."]);
        exit;
    }

    try {
        if ($id) {
            $stmt = $pdo->prepare("UPDATE albums SET title = ?, artist = ?, description = ?, order_num = ?, cover = ? WHERE id = ?");
            $stmt->execute([$title, $artist, $description, $order_num, $cover, $id]);
            echo json_encode(["success" => true, "id" => $id, "message" => "Album bijgewerkt."]);
        } else {
            $stmt = $pdo->prepare("INSERT INTO albums (title, artist, description, order_num, cover) VALUES (?, ?, ?, ?, ?)");
            $stmt->execute([$title, $artist, $description, $order_num, $cover]);
            echo json_encode(["success" => true, "id" => $pdo->lastInsertId(), "message" => "Album toegevoegd."]);
        }
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
    exit;
}

// ==============================================================================
// ACTIE: DELETE_ALBUM
// ==============================================================================
if ($action === 'delete_album') {
    $id = (int)($input['id'] ?? $_GET['id'] ?? 0);
    if (!$id) {
        http_response_code(400);
        echo json_encode(["success" => false, "error" => "Geen geldig album ID opgegeven."]);
        exit;
    }
    try {
        $stmt = $pdo->prepare("DELETE FROM albums WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(["success" => true, "message" => "Album en gekoppelde tracks verwijderd."]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
    exit;
}

// ==============================================================================
// ACTIE: SAVE_TRACK (TOEVOEGEN OF BIJWERKEN)
// ==============================================================================
if ($action === 'save_track') {
    $id = isset($input['id']) && !empty($input['id']) ? (int)$input['id'] : null;
    $album_id = (int)($input['album_id'] ?? 0);
    $track_order = (int)($input['track_order'] ?? 1);
    $title = trim($input['title'] ?? '');
    $foldername = trim($input['foldername'] ?? '');

    if (empty($title) || empty($foldername) || !$album_id) {
        http_response_code(400);
        echo json_encode(["success" => false, "error" => "Album ID, titel en mapnaam zijn verplicht."]);
        exit;
    }

    try {
        if ($id) {
            $stmt = $pdo->prepare("UPDATE tracks SET album_id = ?, track_order = ?, title = ?, foldername = ? WHERE id = ?");
            $stmt->execute([$album_id, $track_order, $title, $foldername, $id]);
            echo json_encode(["success" => true, "id" => $id, "message" => "Nummer succesvol bijgewerkt."]);
        } else {
            $stmt = $pdo->prepare("INSERT INTO tracks (album_id, track_order, title, foldername) VALUES (?, ?, ?, ?)");
            $stmt->execute([$album_id, $track_order, $title, $foldername]);
            echo json_encode(["success" => true, "id" => $pdo->lastInsertId(), "message" => "Nieuw nummer succesvol toegevoegd."]);
        }
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
    exit;
}

// ==============================================================================
// ACTIE: DELETE_TRACK
// ==============================================================================
if ($action === 'delete_track') {
    $id = (int)($input['id'] ?? $_GET['id'] ?? 0);
    if (!$id) {
        http_response_code(400);
        echo json_encode(["success" => false, "error" => "Geen geldig track ID opgegeven."]);
        exit;
    }
    try {
        $stmt = $pdo->prepare("DELETE FROM tracks WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(["success" => true, "message" => "Nummer succesvol verwijderd."]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
    exit;
}

http_response_code(400);
echo json_encode(["success" => false, "error" => "Onbekende actie: {$action}"]);
