<?php
/**
 * ==============================================================================
 * Dynamic Open Graph (WhatsApp / Facebook / Social) Meta Renderer
 * ==============================================================================
 * Injecteert per gedeelde Logboek-aantekening (/logboek?v=...) of Soundtrack
 * (/music?v=...) automatisch het bijbehorende plaatje, titel en omschrijving
 * in index.html voordat deze aan WhatsApp / Facebook / browser wordt gestuurd.
 */

header("Content-Type: text/html; charset=UTF-8");
header("Cache-Control: no-cache, no-store, must-revalidate");
header("Pragma: no-cache");
header("Expires: 0");

$indexPath = dirname(__DIR__) . '/index.html';
if (!file_exists($indexPath)) {
    http_response_code(404);
    echo "index.html niet gevonden.";
    exit;
}

$html = file_get_contents($indexPath);
$scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host = $_SERVER['HTTP_HOST'] ?? 'paulvangeenen.nl';
$origin = $scheme . '://' . $host;
$reqUri = $_SERVER['REQUEST_URI'] ?? '/';
$path = strtolower(parse_url($reqUri, PHP_URL_PATH) ?: '/');

function getPdoConnection(): ?PDO {
    $db_host = getenv('DB_HOST') ?: '127.0.0.1';
    $db_name = getenv('DB_NAME') ?: 'paulw6_Music';
    $db_user = getenv('DB_USER') ?: 'paulw6_Music';
    $db_pass = getenv('DB_PASS') ?: 'MusicWasMyFirstLove1965!';
    $db_port = 3306;

    foreach (array_unique([$db_host, '127.0.0.1', 'localhost;port=3306', 'localhost']) as $candidateHost) {
        try {
            $dsn = (strpos($candidateHost, ';') !== false)
                ? "mysql:host={$candidateHost};dbname={$db_name};charset=utf8mb4"
                : "mysql:host={$candidateHost};port={$db_port};dbname={$db_name};charset=utf8mb4";
            return new PDO($dsn, $db_user, $db_pass, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_TIMEOUT => 2
            ]);
        } catch (PDOException $e) {}
    }
    return null;
}

function decodeLogboekV(string $code): ?int {
    $b64 = strtr($code, '-_', '+/');
    $pad = strlen($b64) % 4;
    if ($pad > 0) $b64 .= str_repeat('=', 4 - $pad);
    $decoded = base64_decode($b64, true);
    if ($decoded === false) return null;

    $salt = 0x5e8a4d29;
    $raw = '';
    $len = strlen($decoded);
    for ($i = 0; $i < $len; $i++) {
        $mask = ((($i + 1) * 41) + ($salt >> ($i % 8))) & 0xff;
        $raw .= chr(ord($decoded[$i]) ^ $mask);
    }
    if (str_starts_with($raw, 'lb~')) {
        $idStr = substr($raw, 3);
        if (ctype_digit($idStr)) return (int)$idStr;
    }
    return null;
}

function decodeMusicV(string $code): ?string {
    $b64 = strtr($code, '-_', '+/');
    $pad = strlen($b64) % 4;
    if ($pad > 0) $b64 .= str_repeat('=', 4 - $pad);
    $decoded = base64_decode($b64, true);
    if ($decoded === false) return null;

    $salt = 0x7a3c9b14;
    $raw = '';
    $len = strlen($decoded);
    for ($i = 0; $i < $len; $i++) {
        $mask = ((($i + 1) * 37) + ($salt >> ($i % 8))) & 0xff;
        $raw .= chr(ord($decoded[$i]) ^ $mask);
    }
    $parts = explode('~', $raw);
    if (count($parts) === 2 && $parts[0] !== '') {
        return $parts[0];
    }
    return null;
}

function formatDutchDate(string $datumStr): string {
    $parts = explode('-', $datumStr);
    if (count($parts) !== 3) return $datumStr;
    $months = [
        1 => 'januari', 2 => 'februari', 3 => 'maart', 4 => 'april', 5 => 'mei', 6 => 'juni',
        7 => 'juli', 8 => 'augustus', 9 => 'september', 10 => 'oktober', 11 => 'november', 12 => 'december'
    ];
    $y = (int)$parts[0];
    $m = (int)$parts[1];
    $d = (int)$parts[2];
    if (!$y || !isset($months[$m]) || !$d) return $datumStr;
    return "{$d} {$months[$m]} {$y}";
}

function encodeUrlPath(string $relPath): string {
    $trimmed = ltrim($relPath, '/');
    $segments = explode('/', $trimmed);
    $encoded = array_map(fn($s) => rawurlencode(rawurldecode($s)), $segments);
    return '/' . implode('/', $encoded);
}

function findTrackCoverUrl(string $foldername, string $title, ?string $albumCover, string $origin): ?string {
    $wwwDir = dirname(__DIR__);
    $trackDir = $wwwDir . '/@music/' . $foldername;

    if (is_dir($trackDir)) {
        $files = @scandir($trackDir) ?: [];
        $baseUrl = $origin . '/@music/' . rawurlencode($foldername);

        $titleLower = strtolower(trim($title));
        $exactMatch = null;
        $portraitMatch = null;
        $landscapeMatch = null;
        $anyJpg = null;

        foreach ($files as $f) {
            if ($f === '.' || $f === '..') continue;
            $ext = strtolower(pathinfo($f, PATHINFO_EXTENSION));
            if (!in_array($ext, ['jpg', 'jpeg', 'webp'], true)) continue;

            $fLower = strtolower($f);
            $nameNoExt = strtolower(pathinfo($f, PATHINFO_FILENAME));
            if ($nameNoExt === $titleLower) {
                $exactMatch = $baseUrl . '/' . rawurlencode($f);
            } elseif (str_contains($fLower, 'portrait') || str_contains($fLower, 'staand')) {
                if (!$portraitMatch) $portraitMatch = $baseUrl . '/' . rawurlencode($f);
            } elseif (str_contains($fLower, 'landscape') || str_contains($fLower, 'liggend')) {
                if (!$landscapeMatch) $landscapeMatch = $baseUrl . '/' . rawurlencode($f);
            } else {
                if (!$anyJpg) $anyJpg = $baseUrl . '/' . rawurlencode($f);
            }
        }

        if ($exactMatch) return $exactMatch;
        if ($portraitMatch) return $portraitMatch;
        if ($landscapeMatch) return $landscapeMatch;
        if ($anyJpg) return $anyJpg;
    }

    if (!empty($albumCover)) {
        if (str_starts_with($albumCover, 'http')) return $albumCover;
        return $origin . encodeUrlPath($albumCover);
    }

    return null;
}

function applyOgMeta(string $html, ?string $title, ?string $description, ?string $imageUrl, string $pageUrl): string {
    $esc = fn(string $v) => htmlspecialchars($v, ENT_QUOTES | ENT_HTML5, 'UTF-8');

    if ($title !== null && $title !== '') {
        $t = $esc($title);
        $html = preg_replace('/<title>.*?<\/title>/is', "<title>{$t}</title>", $html);
        $html = preg_replace('/<meta\s+name="title"\s+content="[^"]*"\s*\/?>/i', "<meta name=\"title\" content=\"{$t}\" />", $html);
        $html = preg_replace('/<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i', "<meta property=\"og:title\" content=\"{$t}\" />", $html);
        $html = preg_replace('/<meta\s+itemprop="name"\s+content="[^"]*"\s*\/?>/i', "<meta itemprop=\"name\" content=\"{$t}\" />", $html);
        $html = preg_replace('/<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/i', "<meta name=\"twitter:title\" content=\"{$t}\" />", $html);
    }

    if ($description !== null && $description !== '') {
        $d = $esc($description);
        $html = preg_replace('/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i', "<meta name=\"description\" content=\"{$d}\" />", $html);
        $html = preg_replace('/<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i', "<meta property=\"og:description\" content=\"{$d}\" />", $html);
        $html = preg_replace('/<meta\s+itemprop="description"\s+content="[^"]*"\s*\/?>/i', "<meta itemprop=\"description\" content=\"{$d}\" />", $html);
        $html = preg_replace('/<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/i', "<meta name=\"twitter:description\" content=\"{$d}\" />", $html);
    }

    $u = $esc($pageUrl);
    $html = preg_replace('/<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i', "<meta property=\"og:url\" content=\"{$u}\" />", $html);
    $html = preg_replace('/<meta\s+name="twitter:url"\s+content="[^"]*"\s*\/?>/i', "<meta name=\"twitter:url\" content=\"{$u}\" />", $html);

    if ($imageUrl !== null && $imageUrl !== '') {
        $img = $esc($imageUrl);
        $ext = strtolower(pathinfo(parse_url($imageUrl, PHP_URL_PATH) ?: '', PATHINFO_EXTENSION));
        $mime = ($ext === 'png') ? 'image/png' : (($ext === 'webp') ? 'image/webp' : 'image/jpeg');

        $html = preg_replace('/<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/i', "<meta property=\"og:image\" content=\"{$img}\" />", $html);
        $html = preg_replace('/<meta\s+property="og:image:secure_url"\s+content="[^"]*"\s*\/?>/i', "<meta property=\"og:image:secure_url\" content=\"{$img}\" />", $html);
        $html = preg_replace('/<meta\s+property="og:image:type"\s+content="[^"]*"\s*\/?>/i', "<meta property=\"og:image:type\" content=\"{$mime}\" />", $html);
        $html = preg_replace('/<meta\s+property="og:image:width"\s+content="[^"]*"\s*\/?>/i', '', $html);
        $html = preg_replace('/<meta\s+property="og:image:height"\s+content="[^"]*"\s*\/?>/i', '', $html);
        $html = preg_replace('/<meta\s+itemprop="image"\s+content="[^"]*"\s*\/?>/i', "<meta itemprop=\"image\" content=\"{$img}\" />", $html);
        $html = preg_replace('/<link\s+rel="image_src"\s+href="[^"]*"\s*\/?>/i', "<link rel=\"image_src\" href=\"{$img}\" />", $html);
        $html = preg_replace('/<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/?>/i', "<meta name=\"twitter:image\" content=\"{$img}\" />", $html);
    }

    return $html;
}

$pageUrl = $origin . $reqUri;
$pdo = getPdoConnection();

// 1. LOGBOEK (/logboek?v=... of /logboek/<id>)
if ($pdo && str_starts_with($path, '/logboek')) {
    $entryId = null;
    if (!empty($_GET['v'])) {
        $entryId = decodeLogboekV((string)$_GET['v']);
    } elseif (!empty($_GET['id']) && ctype_digit((string)$_GET['id'])) {
        $entryId = (int)$_GET['id'];
    } else {
        $segs = array_values(array_filter(explode('/', trim($path, '/'))));
        if (count($segs) >= 2) {
            if (ctype_digit($segs[1])) $entryId = (int)$segs[1];
            else $entryId = decodeLogboekV($segs[1]);
        }
    }

    try {
        if ($entryId) {
            $stmt = $pdo->prepare("SELECT id, datum, foto, tekst FROM logboek WHERE id = ? LIMIT 1");
            $stmt->execute([$entryId]);
            $entry = $stmt->fetch();
        } else {
            $entry = $pdo->query("SELECT id, datum, foto, tekst FROM logboek ORDER BY datum DESC, id DESC LIMIT 1")->fetch();
        }

        if ($entry) {
            $datumFmt = formatDutchDate((string)$entry['datum']);
            $ogTitle = "Logboek — {$datumFmt} | Paul van Geenen";
            $rawText = trim(preg_replace('/\s+/', ' ', (string)($entry['tekst'] ?? '')));
            $ogDesc = $rawText !== '' ? mb_substr($rawText, 0, 180) . (mb_strlen($rawText) > 180 ? '...' : '') : "Lees de logboek-aantekening van {$datumFmt} op paulvangeenen.nl";

            $foto = trim((string)($entry['foto'] ?? ''));
            $isVideo = (bool)preg_match('/\.(mp4|mov|webm|m4v|ogv)(\?|$)/i', $foto);
            $ogImage = null;
            if ($foto !== '' && !$isVideo) {
                $ogImage = str_starts_with($foto, 'http') ? $foto : ($origin . encodeUrlPath($foto));
            } else {
                // Fallback naar logboek cover als er alleen video of geen foto is
                $ogImage = $origin . '/images/logboek-cover-red.jpg';
            }

            $html = applyOgMeta($html, $ogTitle, $ogDesc, $ogImage, $pageUrl);
        }
    } catch (Throwable $e) {}
}

// 2. SOUNDTRACK / MUZIEKSPELER (/music?v=... of /@music?v=...)
elseif ($pdo && (str_starts_with($path, '/music') || str_starts_with($path, '/@music'))) {
    $trackIdentifier = null;
    if (!empty($_GET['v'])) {
        $trackIdentifier = decodeMusicV((string)$_GET['v']);
    } elseif (!empty($_GET['track'])) {
        $trackIdentifier = trim((string)$_GET['track']);
    } else {
        $segs = array_values(array_filter(explode('/', trim($path, '/'))));
        if (count($segs) >= 2) {
            $trackIdentifier = rawurldecode($segs[1]);
        }
    }

    if ($trackIdentifier !== null && $trackIdentifier !== '') {
        try {
            $stmt = $pdo->prepare("
                SELECT t.id, t.title, t.foldername, a.title AS album_title, a.cover AS album_cover
                FROM tracks t
                LEFT JOIN albums a ON a.id = t.album_id
                WHERE CAST(t.id AS CHAR) = ?
                   OR LOWER(t.foldername) = LOWER(?)
                   OR LOWER(t.title) = LOWER(?)
                LIMIT 1
            ");
            $stmt->execute([$trackIdentifier, $trackIdentifier, $trackIdentifier]);
            $trk = $stmt->fetch();

            if (!$trk) {
                $stmtLike = $pdo->prepare("
                    SELECT t.id, t.title, t.foldername, a.title AS album_title, a.cover AS album_cover
                    FROM tracks t
                    LEFT JOIN albums a ON a.id = t.album_id
                    WHERE LOWER(t.foldername) LIKE LOWER(?) OR LOWER(t.title) LIKE LOWER(?)
                    LIMIT 1
                ");
                $like = '%' . $trackIdentifier . '%';
                $stmtLike->execute([$like, $like]);
                $trk = $stmtLike->fetch();
            }

            if ($trk) {
                $trackTitle = trim((string)$trk['title']);
                $albumTitle = trim((string)($trk['album_title'] ?? 'SoundTrack'));
                $ogTitle = "{$trackTitle} — {$albumTitle} | Paul van Geenen";
                $ogDesc = "Luister naar \"{$trackTitle}\" uit {$albumTitle}";
                $ogImage = findTrackCoverUrl(
                    (string)$trk['foldername'],
                    $trackTitle,
                    $trk['album_cover'] ?? null,
                    $origin
                );
                $html = applyOgMeta($html, $ogTitle, $ogDesc, $ogImage, $pageUrl);
            }
        } catch (Throwable $e) {}
    }
}

echo $html;
