<?php
/**
 * ==============================================================================
 * Paul van Geenen.nl - Social Media Post Bridge (Schrijverspagina Facebook & Instagram)
 * ==============================================================================
 * Ondersteunt:
 * - Enkele en meervoudige foto's (Facebook Multi-Photo Albums & Instagram Carousels)
 * - Foto's rechtstreeks uploaden of kiezen uit Bestandsbeheer (/storage/)
 * - Automatische Instagram aspect ratio adapter
 * - Configuratie van Schrijvers-Facebook Page ID, Instagram ID & Meta Token vanuit /beheer
 */

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-API-Key");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

header("Content-Type: application/json; charset=UTF-8");

$siteUrl = 'https://paulvangeenen.nl';

// Database connection (TransIP MySQL paulw6_Music)
$db_host = getenv('DB_HOST') ?: '127.0.0.1';
$db_name = getenv('DB_NAME') ?: 'paulw6_Music';
$db_user = getenv('DB_USER') ?: 'paulw6_Music';
$db_pass = getenv('DB_PASS') ?: 'MusicWasMyFirstLove1965!';
$db_port = 3306;

$hostCandidates = array_unique([$db_host, '127.0.0.1', 'localhost;port=3306', 'localhost']);
$pdo = null;

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
    } catch (PDOException $e) {}
}

$fbPageId = '';
$igUserId = '';
$metaToken = '';
$fbPageName = 'Paul van Geenen - Schrijver & Componist';

if ($pdo) {
    $pdo->exec("CREATE TABLE IF NOT EXISTS `social_posts` (
        `id` VARCHAR(128) NOT NULL,
        `message` TEXT NOT NULL,
        `imageUrl` TEXT NULL,
        `imageUrls` LONGTEXT NULL,
        `platforms` VARCHAR(255) NOT NULL DEFAULT '[]',
        `status` VARCHAR(32) NOT NULL DEFAULT 'queued',
        `results` LONGTEXT NULL,
        `createdAt` VARCHAR(64) NOT NULL,
        PRIMARY KEY (`id`),
        INDEX `idx_social_created` (`createdAt`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `logboek_settings` (
        `setting_key` VARCHAR(64) PRIMARY KEY,
        `setting_value` TEXT NULL DEFAULT NULL,
        `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    try {
        $pdo->exec("ALTER TABLE `logboek_settings` MODIFY COLUMN `setting_value` TEXT NULL DEFAULT NULL");
    } catch (Exception $e) {}

    $stmt = $pdo->query("SELECT setting_key, setting_value FROM logboek_settings WHERE setting_key IN ('social_fb_page_id', 'social_ig_user_id', 'social_meta_token', 'social_fb_page_name')");
    foreach ($stmt->fetchAll() as $row) {
        if ($row['setting_key'] === 'social_fb_page_id') $fbPageId = trim((string)$row['setting_value']);
        if ($row['setting_key'] === 'social_ig_user_id') $igUserId = trim((string)$row['setting_value']);
        if ($row['setting_key'] === 'social_meta_token') $metaToken = trim((string)$row['setting_value']);
        if ($row['setting_key'] === 'social_fb_page_name' && !empty($row['setting_value'])) $fbPageName = trim((string)$row['setting_value']);
    }
}

$socialConfigFile = __DIR__ . '/social_config.php';
if (file_exists($socialConfigFile)) {
    $sc = require $socialConfigFile;
    if (empty($fbPageId) && !empty($sc['fb_page_id'])) $fbPageId = trim((string)$sc['fb_page_id']);
    if (empty($igUserId) && !empty($sc['ig_user_id'])) $igUserId = trim((string)$sc['ig_user_id']);
    if (empty($metaToken) && !empty($sc['meta_access_token'])) $metaToken = trim((string)$sc['meta_access_token']);
}

function graphRequest(string $url, array $params): array {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($params));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    $raw = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if ($curlErr) {
        return ['ok' => false, 'error' => $curlErr];
    }
    $decoded = json_decode((string)$raw, true);
    if ($httpCode >= 200 && $httpCode < 300 && empty($decoded['error'])) {
        return ['ok' => true, 'data' => $decoded];
    }
    $errMsg = $decoded['error']['message'] ?? ("HTTP {$httpCode}: " . (string)$raw);
    return ['ok' => false, 'error' => $errMsg];
}

function prepareInstagramImage(string $filePath, string $siteUrl): string {
    if (!file_exists($filePath) || !function_exists('getimagesize') || !function_exists('imagecreatetruecolor')) {
        return $siteUrl . '/uploads/social/' . basename($filePath);
    }
    $info = @getimagesize($filePath);
    if (!$info) {
        return $siteUrl . '/uploads/social/' . basename($filePath);
    }
    $w = (int)$info[0];
    $h = (int)$info[1];
    $mime = $info['mime'] ?? '';
    if ($w <= 0 || $h <= 0) {
        return $siteUrl . '/uploads/social/' . basename($filePath);
    }

    $ratio = $w / $h;
    if ($ratio >= 0.80 && $ratio <= 1.91 && $w >= 320) {
        $storageRoot = realpath(__DIR__ . '/../storage');
        if ($storageRoot && str_starts_with($filePath, $storageRoot)) {
            $rel = str_replace($storageRoot, '', $filePath);
            return $siteUrl . '/storage' . str_replace('\\', '/', $rel);
        }
        return $siteUrl . '/uploads/social/' . basename($filePath);
    }

    $src = null;
    if (($mime === 'image/jpeg' || $mime === 'image/jpg') && function_exists('imagecreatefromjpeg')) {
        $src = @imagecreatefromjpeg($filePath);
    } elseif ($mime === 'image/png' && function_exists('imagecreatefrompng')) {
        $src = @imagecreatefrompng($filePath);
    } elseif ($mime === 'image/webp' && function_exists('imagecreatefromwebp')) {
        $src = @imagecreatefromwebp($filePath);
    }

    if (!$src) {
        return $siteUrl . '/uploads/social/' . basename($filePath);
    }

    $targetDim = max($w, $h, 1080);
    $canvas = imagecreatetruecolor($targetDim, $targetDim);
    $bg = imagecolorallocate($canvas, 18, 16, 14);
    imagefill($canvas, 0, 0, $bg);

    $dstX = (int)(($targetDim - $w) / 2);
    $dstY = (int)(($targetDim - $h) / 2);
    imagecopy($canvas, $src, $dstX, $dstY, 0, 0, $w, $h);

    $uploadDir = __DIR__ . '/../uploads/social';
    if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);

    $igFilename = 'ig_' . date('Ymd_His') . '_' . bin2hex(random_bytes(3)) . '.jpg';
    $igPath = $uploadDir . '/' . $igFilename;
    imagejpeg($canvas, $igPath, 92);

    imagedestroy($canvas);
    imagedestroy($src);

    return $siteUrl . '/uploads/social/' . $igFilename;
}

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? ($_POST['action'] ?? '');

// Configuratie opslaan vanuit het beheerscherm
if ($method === 'POST' && $action === 'save_config') {
    $rawBody = file_get_contents('php://input');
    $json = json_decode((string)$rawBody, true) ?: $_POST;

    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['error' => 'Geen databaseverbinding.']);
        exit;
    }

    $fields = [
        'social_fb_page_id' => trim((string)($json['fbPageId'] ?? '')),
        'social_ig_user_id' => trim((string)($json['igUserId'] ?? '')),
        'social_fb_page_name' => trim((string)($json['fbPageName'] ?? 'Paul van Geenen - Schrijver & Componist')),
    ];
    if (array_key_exists('metaToken', $json) && trim((string)$json['metaToken']) !== '') {
        $fields['social_meta_token'] = trim((string)$json['metaToken']);
    }

    $stmt = $pdo->prepare("INSERT INTO logboek_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
    foreach ($fields as $k => $v) {
        $stmt->execute([$k, $v]);
    }

    echo json_encode(['success' => true]);
    exit;
}

if ($method === 'GET') {
    $posts = [];
    if ($pdo) {
        $rows = $pdo->query("SELECT * FROM `social_posts` ORDER BY `createdAt` DESC LIMIT 25")->fetchAll();
        foreach ($rows as $r) {
            $r['platforms'] = json_decode($r['platforms'] ?? '[]', true) ?: [];
            $r['results'] = json_decode($r['results'] ?? '{}', true) ?: [];
            $r['imageUrls'] = json_decode($r['imageUrls'] ?? '[]', true) ?: (!empty($r['imageUrl']) ? [$r['imageUrl']] : []);
            $posts[] = $r;
        }
    }
    echo json_encode([
        'configured' => [
            'facebook' => !empty($fbPageId) && !empty($metaToken),
            'instagram' => !empty($igUserId) && !empty($metaToken),
            'fbPageId' => $fbPageId,
            'igUserId' => $igUserId,
            'fbPageName' => $fbPageName,
            'hasToken' => !empty($metaToken),
        ],
        'posts' => $posts,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method === 'DELETE') {
    $id = $_GET['id'] ?? '';
    if (!$pdo || empty($id)) {
        http_response_code(400);
        echo json_encode(['error' => 'Ongeldig verzoek.']);
        exit;
    }
    $stmt = $pdo->prepare("DELETE FROM `social_posts` WHERE `id` = ?");
    $stmt->execute([$id]);
    echo json_encode(['success' => true, 'id' => $id]);
    exit;
}

if ($method === 'POST') {
    $message = trim((string)($_POST['message'] ?? ''));
    $platformsRaw = $_POST['platforms'] ?? '[]';
    $platforms = is_array($platformsRaw) ? $platformsRaw : (json_decode((string)$platformsRaw, true) ?: []);

    $mediaItems = [];
    $uploadDir = __DIR__ . '/../uploads/social';
    if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);

    $rawFiles = $_FILES['images'] ?? ($_FILES['image'] ?? null);
    if ($rawFiles) {
        $normalizedFiles = [];
        if (is_array($rawFiles['name'])) {
            $cnt = count($rawFiles['name']);
            for ($i = 0; $i < $cnt; $i++) {
                if ($rawFiles['error'][$i] === UPLOAD_ERR_OK && !empty($rawFiles['name'][$i])) {
                    $normalizedFiles[] = [
                        'name' => $rawFiles['name'][$i],
                        'tmp_name' => $rawFiles['tmp_name'][$i],
                        'size' => $rawFiles['size'][$i],
                    ];
                }
            }
        } else {
            if ($rawFiles['error'] === UPLOAD_ERR_OK && !empty($rawFiles['name'])) {
                $normalizedFiles[] = [
                    'name' => $rawFiles['name'],
                    'tmp_name' => $rawFiles['tmp_name'],
                    'size' => $rawFiles['size'],
                ];
            }
        }

        $allowedExt = ['jpg', 'jpeg', 'png', 'webp'];
        foreach ($normalizedFiles as $f) {
            $ext = strtolower(pathinfo($f['name'], PATHINFO_EXTENSION));
            if (!in_array($ext, $allowedExt, true) || $f['size'] > 15 * 1024 * 1024) continue;

            $filename = 'post_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
            $targetPath = $uploadDir . '/' . $filename;
            if (move_uploaded_file($f['tmp_name'], $targetPath)) {
                $mediaItems[] = [
                    'url' => $siteUrl . '/uploads/social/' . $filename,
                    'localPath' => $targetPath,
                ];
            }
        }
    }

    $chosenUrlsRaw = $_POST['imageUrls'] ?? ($_POST['imageUrl'] ?? null);
    if (!empty($chosenUrlsRaw)) {
        $chosenUrls = is_array($chosenUrlsRaw) ? $chosenUrlsRaw : (json_decode((string)$chosenUrlsRaw, true) ?: [$chosenUrlsRaw]);
        $storageRoot = realpath(__DIR__ . '/../storage');

        foreach ($chosenUrls as $u) {
            $u = trim((string)$u);
            if (empty($u)) continue;

            $local = null;
            if ($storageRoot && str_contains($u, '/storage/')) {
                $sub = explode('/storage/', $u, 2)[1] ?? '';
                $decodedSub = urldecode($sub);
                $candidate = realpath($storageRoot . '/' . $decodedSub);
                if ($candidate && file_exists($candidate) && str_starts_with($candidate, $storageRoot)) {
                    $local = $candidate;
                }
            }

            $mediaItems[] = [
                'url' => $u,
                'localPath' => $local,
            ];
        }
    }

    if (empty($message) && empty($mediaItems)) {
        http_response_code(400);
        echo json_encode(['error' => 'Vul een bericht in of kies minimaal één foto.']);
        exit;
    }
    if (empty($platforms)) {
        http_response_code(400);
        echo json_encode(['error' => 'Vink minimaal één social media kanaal aan.']);
        exit;
    }

    $allUrls = array_map(fn($m) => $m['url'], $mediaItems);
    $primaryImageUrl = $allUrls[0] ?? '';

    $results = [];
    $successCount = 0;
    $failCount = 0;

    foreach ($platforms as $platform) {
        if ($platform === 'facebook') {
            if (empty($fbPageId) || empty($metaToken)) {
                $results['facebook'] = ['status' => 'queued', 'message' => 'Facebook Schrijverspagina ID / Meta Token nog niet gekoppeld (bericht staat klaar in wachtrij).'];
            } elseif (count($mediaItems) > 0) {
                $uploadedPhotoIds = [];
                $uploadFailed = false;
                $lastErr = '';

                foreach ($mediaItems as $item) {
                    $up = graphRequest("https://graph.facebook.com/v21.0/{$fbPageId}/photos", [
                        'url' => $item['url'],
                        'published' => 'false',
                        'access_token' => $metaToken,
                    ]);
                    if ($up['ok'] && !empty($up['data']['id'])) {
                        $uploadedPhotoIds[] = ['media_fbid' => $up['data']['id']];
                    } else {
                        $uploadFailed = true;
                        $lastErr = $up['error'] ?? 'Foto uploaden naar Facebook mislukt';
                        break;
                    }
                }

                if ($uploadFailed || empty($uploadedPhotoIds)) {
                    $failCount++;
                    $results['facebook'] = ['status' => 'error', 'message' => $lastErr];
                } else {
                    $feedRes = graphRequest("https://graph.facebook.com/v21.0/{$fbPageId}/feed", [
                        'message' => $message,
                        'attached_media' => json_encode($uploadedPhotoIds),
                        'access_token' => $metaToken,
                    ]);
                    if ($feedRes['ok']) {
                        $successCount++;
                        $results['facebook'] = [
                            'status' => 'published',
                            'postId' => $feedRes['data']['id'] ?? '',
                            'photosCount' => count($uploadedPhotoIds),
                        ];
                    } else {
                        $failCount++;
                        $results['facebook'] = ['status' => 'error', 'message' => $feedRes['error']];
                    }
                }
            } else {
                $res = graphRequest("https://graph.facebook.com/v21.0/{$fbPageId}/feed", [
                    'message' => $message,
                    'access_token' => $metaToken,
                ]);
                if ($res['ok']) {
                    $successCount++;
                    $results['facebook'] = ['status' => 'published', 'postId' => $res['data']['id'] ?? ''];
                } else {
                    $failCount++;
                    $results['facebook'] = ['status' => 'error', 'message' => $res['error']];
                }
            }
        } elseif ($platform === 'instagram') {
            if (empty($igUserId) || empty($metaToken)) {
                $results['instagram'] = ['status' => 'queued', 'message' => 'Instagram ID / Meta Token nog niet gekoppeld.'];
            } elseif (empty($mediaItems)) {
                $failCount++;
                $results['instagram'] = ['status' => 'error', 'message' => 'Instagram vereist altijd minimaal één foto bij een bericht.'];
            } elseif (count($mediaItems) === 1) {
                $item = $mediaItems[0];
                $igUrl = !empty($item['localPath']) ? prepareInstagramImage($item['localPath'], $siteUrl) : $item['url'];

                $container = graphRequest("https://graph.facebook.com/v21.0/{$igUserId}/media", [
                    'image_url' => $igUrl,
                    'caption' => $message,
                    'access_token' => $metaToken,
                ]);
                if (!$container['ok'] || empty($container['data']['id'])) {
                    $failCount++;
                    $results['instagram'] = ['status' => 'error', 'message' => $container['error'] ?? 'Instagram media container mislukt'];
                } else {
                    $publish = graphRequest("https://graph.facebook.com/v21.0/{$igUserId}/media_publish", [
                        'creation_id' => $container['data']['id'],
                        'access_token' => $metaToken,
                    ]);
                    if ($publish['ok']) {
                        $successCount++;
                        $results['instagram'] = ['status' => 'published', 'postId' => $publish['data']['id'] ?? ''];
                    } else {
                        $failCount++;
                        $results['instagram'] = ['status' => 'error', 'message' => $publish['error']];
                    }
                }
            } else {
                $carouselItems = array_slice($mediaItems, 0, 10);
                $childContainerIds = [];
                $carouselErr = '';

                foreach ($carouselItems as $cItem) {
                    $cUrl = !empty($cItem['localPath']) ? prepareInstagramImage($cItem['localPath'], $siteUrl) : $cItem['url'];
                    $cRes = graphRequest("https://graph.facebook.com/v21.0/{$igUserId}/media", [
                        'image_url' => $cUrl,
                        'is_carousel_item' => 'true',
                        'access_token' => $metaToken,
                    ]);
                    if ($cRes['ok'] && !empty($cRes['data']['id'])) {
                        $childContainerIds[] = $cRes['data']['id'];
                    } else {
                        $carouselErr = $cRes['error'] ?? 'Fout bij aanmaken Instagram carousel item';
                        break;
                    }
                }

                if (count($childContainerIds) < 2) {
                    $failCount++;
                    $results['instagram'] = ['status' => 'error', 'message' => $carouselErr ?: 'Kon carrousel niet samenstellen.'];
                } else {
                    $parent = graphRequest("https://graph.facebook.com/v21.0/{$igUserId}/media", [
                        'media_type' => 'CAROUSEL',
                        'children' => implode(',', $childContainerIds),
                        'caption' => $message,
                        'access_token' => $metaToken,
                    ]);

                    if (!$parent['ok'] || empty($parent['data']['id'])) {
                        $failCount++;
                        $results['instagram'] = ['status' => 'error', 'message' => $parent['error'] ?? 'Instagram carousel hoofdcontainer mislukt'];
                    } else {
                        $pub = graphRequest("https://graph.facebook.com/v21.0/{$igUserId}/media_publish", [
                            'creation_id' => $parent['data']['id'],
                            'access_token' => $metaToken,
                        ]);
                        if ($pub['ok']) {
                            $successCount++;
                            $results['instagram'] = [
                                'status' => 'published',
                                'postId' => $pub['data']['id'] ?? '',
                                'carouselCount' => count($childContainerIds),
                            ];
                        } else {
                            $failCount++;
                            $results['instagram'] = ['status' => 'error', 'message' => $pub['error']];
                        }
                    }
                }
            }
        }
    }

    $overallStatus = 'queued';
    if ($successCount > 0 && $failCount === 0 && $successCount === count($platforms)) {
        $overallStatus = 'published';
    } elseif ($successCount > 0) {
        $overallStatus = 'partial';
    } elseif ($failCount > 0) {
        $overallStatus = 'error';
    }

    $postRecord = [
        'id' => 'soc_' . time() . '_' . mt_rand(100, 999),
        'message' => $message,
        'imageUrl' => $primaryImageUrl,
        'imageUrls' => $allUrls,
        'platforms' => $platforms,
        'status' => $overallStatus,
        'results' => $results,
        'createdAt' => date('c'),
    ];

    if ($pdo) {
        $stmt = $pdo->prepare("INSERT INTO `social_posts` (`id`, `message`, `imageUrl`, `imageUrls`, `platforms`, `status`, `results`, `createdAt`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $postRecord['id'],
            $postRecord['message'],
            $postRecord['imageUrl'],
            json_encode($postRecord['imageUrls'], JSON_UNESCAPED_UNICODE),
            json_encode($postRecord['platforms'], JSON_UNESCAPED_UNICODE),
            $postRecord['status'],
            json_encode($postRecord['results'], JSON_UNESCAPED_UNICODE),
            $postRecord['createdAt'],
        ]);
    }

    echo json_encode([
        'success' => $failCount === 0,
        'post' => $postRecord,
        'results' => $results,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Methode niet toegestaan.']);
