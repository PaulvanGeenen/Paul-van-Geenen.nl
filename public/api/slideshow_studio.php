<?php
/**
 * ==============================================================================
 * Paul van Geenen.nl - Slideshow Studio API
 * ==============================================================================
 * - Scant /@music mappen op tracks, Engelse SRT-bestanden, .txt songteksten en
 *   bestaande slideshow/portrait & slideshow/landscape media
 * - Parst SRT-regels (timestamp + Engelse tekst) en koppelt sectiekopjes
 *   ([verse], [chorus], [bridge], ...) uit de bijbehorende .txt
 * - Slaat geüploade afbeeldingen of video's op in:
 *     /@music/<trackfolder>/slideshow/portrait/<MM_SS> - <Engelse regel>.<ext>
 *     /@music/<trackfolder>/slideshow/landscape/<MM_SS> - <Engelse regel>.<ext>
 *   en maakt automatisch zowel slideshow/portrait als slideshow/landscape aan.
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

$musicBaseDir = realpath(__DIR__ . '/../@music');
if (!$musicBaseDir || !is_dir($musicBaseDir)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Map /@music niet gevonden op de server.']);
    exit;
}

const ALLOWED_IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
const ALLOWED_VIDEO_EXTS = ['mp4', 'mov', 'webm', 'm4v'];

function isAllowedMediaExt(string $ext): bool {
    $e = strtolower($ext);
    return in_array($e, ALLOWED_IMAGE_EXTS, true) || in_array($e, ALLOWED_VIDEO_EXTS, true);
}

function getMediaType(string $ext): string {
    return in_array(strtolower($ext), ALLOWED_VIDEO_EXTS, true) ? 'video' : 'image';
}

function encodeUrlPath(string $relativePath): string {
    $parts = explode('/', str_replace('\\', '/', $relativePath));
    $encoded = array_map('rawurlencode', $parts);
    return '/@music/' . implode('/', $encoded);
}

/**
 * Resolve and validate a track folder directly inside /@music (prevents path traversal).
 */
function resolveTrackFolder(string $baseDir, string $folder): ?array {
    $clean = trim(str_replace(['\\', "\0"], ['/', ''], $folder), '/');
    if ($clean === '' || strpos($clean, '/') !== false || $clean === '.' || $clean === '..' || $clean[0] === '_' || $clean[0] === '.') {
        return null;
    }
    $fullPath = realpath($baseDir . '/' . $clean);
    if (!$fullPath || !is_dir($fullPath)) {
        return null;
    }
    $normBase = rtrim(str_replace('\\', '/', $baseDir), '/');
    $normFull = rtrim(str_replace('\\', '/', $fullPath), '/');
    if (strpos($normFull, $normBase . '/') !== 0) {
        return null;
    }
    return ['folder' => $clean, 'path' => $fullPath];
}

/**
 * Find the best English SRT file in a track folder.
 */
function findEnglishSrt(string $trackPath): ?string {
    $entries = @scandir($trackPath);
    if (!$entries) return null;

    $srtFiles = [];
    foreach ($entries as $entry) {
        if ($entry === '.' || $entry === '..') continue;
        if (is_file($trackPath . '/' . $entry) && preg_match('/\.srt$/i', $entry)) {
            $srtFiles[] = $entry;
        }
    }
    if (empty($srtFiles)) return null;

    // 1. Prefer *_EN.srt or * EN.srt or *.en.srt
    foreach ($srtFiles as $f) {
        if (preg_match('/([_\s.\-]en)\.srt$/i', $f)) {
            return $f;
        }
    }
    // 2. Any .srt that is NOT *_NL.srt
    foreach ($srtFiles as $f) {
        if (!preg_match('/([_\s.\-]nl)\.srt$/i', $f)) {
            return $f;
        }
    }
    // 3. Fallback to first .srt
    return $srtFiles[0];
}

function findTrackTxt(string $trackPath): ?string {
    $entries = @scandir($trackPath);
    if (!$entries) return null;
    foreach ($entries as $entry) {
        if ($entry === '.' || $entry === '..') continue;
        if (is_file($trackPath . '/' . $entry) && preg_match('/\.txt$/i', $entry)) {
            return $entry;
        }
    }
    return null;
}

function findTrackAudio(string $trackPath): ?string {
    $entries = @scandir($trackPath);
    if (!$entries) return null;
    foreach ($entries as $entry) {
        if ($entry === '.' || $entry === '..') continue;
        if (is_file($trackPath . '/' . $entry) && preg_match('/\.(mp3|wav|m4a|ogg)$/i', $entry)) {
            return $entry;
        }
    }
    return null;
}

function findTrackCover(string $trackPath): ?string {
    $entries = @scandir($trackPath);
    if (!$entries) return null;
    $fallback = null;
    foreach ($entries as $entry) {
        if ($entry === '.' || $entry === '..') continue;
        if (!is_file($trackPath . '/' . $entry)) continue;
        if (!preg_match('/\.(jpg|jpeg|png|webp)$/i', $entry)) continue;
        $lower = strtolower($entry);
        if (strpos($lower, 'barcode') !== false || strpos($lower, 'qr') !== false) continue;
        if (strpos($lower, 'portrait') === false && strpos($lower, 'landscape') === false) {
            return $entry;
        }
        if ($fallback === null) $fallback = $entry;
    }
    return $fallback;
}

/**
 * Parse SRT timestamp "HH:MM:SS,mmm" to float seconds.
 */
function parseSrtTimeToSeconds(string $ts): float {
    if (!preg_match('/(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/', trim($ts), $m)) {
        return 0.0;
    }
    $h = (int)$m[1];
    $min = (int)$m[2];
    $sec = (int)$m[3];
    $ms = (int)str_pad($m[4], 3, '0', STR_PAD_RIGHT);
    return ($h * 3600) + ($min * 60) + $sec + ($ms / 1000.0);
}

/**
 * Format seconds to "MM_SS" (flooring to whole seconds, e.g. 12.83 -> "00_12").
 */
function formatMmSs(float $seconds): string {
    $totalSec = max(0, (int)floor($seconds));
    $mins = (int)floor($totalSec / 60);
    $secs = $totalSec % 60;
    return sprintf('%02d_%02d', $mins, $secs);
}

/**
 * Normalize lyric text for fuzzy matching between .srt and .txt
 */
function normalizeLyricForMatch(string $text): string {
    $t = mb_strtolower($text, 'UTF-8');
    $t = str_replace(["’", "‘", "`", "´"], "'", $t);
    $t = preg_replace('/[^\p{L}\p{N}\s]+/u', ' ', $t);
    $t = preg_replace('/\s+/u', ' ', $t);
    return trim($t);
}

/**
 * Parse SRT content into an array of cues.
 */
function parseSrtContent(string $raw): array {
    // Strip UTF-8 BOM
    $raw = preg_replace('/^\xEF\xBB\xBF/', '', $raw);
    $raw = str_replace(["\r\n", "\r"], "\n", $raw);
    $blocks = preg_split('/\n{2,}/', trim($raw));
    $cues = [];
    $seq = 1;

    foreach ($blocks as $block) {
        $lines = array_values(array_filter(array_map('trim', explode("\n", trim($block))), fn($l) => $l !== ''));
        if (count($lines) < 2) continue;

        $timeLineIdx = -1;
        foreach ($lines as $idx => $line) {
            if (strpos($line, '-->') !== false) {
                $timeLineIdx = $idx;
                break;
            }
        }
        if ($timeLineIdx === -1) continue;

        $timeParts = explode('-->', $lines[$timeLineIdx]);
        if (count($timeParts) < 2) continue;

        $startSec = parseSrtTimeToSeconds($timeParts[0]);
        $endSec = parseSrtTimeToSeconds($timeParts[1]);
        $textLines = array_slice($lines, $timeLineIdx + 1);
        $text = trim(preg_replace('/\s+/u', ' ', implode(' ', $textLines)));
        if ($text === '') continue;

        $cues[] = [
            'index' => $seq++,
            'startSeconds' => round($startSec, 3),
            'endSeconds' => round($endSec, 3),
            'mmSs' => formatMmSs($startSec),
            'text' => $text,
        ];
    }

    return $cues;
}

/**
 * Parse .txt lyrics sections ([verse], [chorus], [bridge], etc.)
 * Returns ordered list of ['sectionId' => int, 'sectionLabel' => string, 'sectionType' => string, 'norm' => string]
 */
function parseTxtSections(string $raw): array {
    $raw = preg_replace('/^\xEF\xBB\xBF/', '', $raw);
    $raw = str_replace(["\r\n", "\r"], "\n", $raw);
    $lines = explode("\n", $raw);

    $entries = [];
    $currentType = '';
    $currentLabel = '';
    $currentSectionId = 0;
    $typeCounts = [];
    $inLyrics = false;
    $hasLyricsMarker = (stripos($raw, 'Lyrics:') !== false);

    foreach ($lines as $rawLine) {
        $line = trim($rawLine);
        if ($line === '') continue;

        if (preg_match('/^Style\s*:/i', $line)) {
            continue;
        }
        if (preg_match('/^Lyrics\s*:/i', $line)) {
            $inLyrics = true;
            continue;
        }
        if ($hasLyricsMarker && !$inLyrics && !preg_match('/^\[[^\]]+\]$/', $line)) {
            continue;
        }

        if (preg_match('/^\[([^\]]+)\]$/', $line, $m)) {
            $inLyrics = true;
            $rawTag = trim($m[1]);
            $baseType = strtolower(preg_replace('/\s*\d+\s*$/', '', $rawTag));
            if (!isset($typeCounts[$baseType])) {
                $typeCounts[$baseType] = 0;
            }
            $typeCounts[$baseType]++;
            $currentSectionId++;
            $currentType = $baseType;
            // Format nice label: e.g. "Verse 1", "Chorus 1", "Bridge"
            if (preg_match('/\d+$/', $rawTag)) {
                $currentLabel = ucwords(strtolower($rawTag));
            } else {
                $currentLabel = ucwords($baseType) . ' ' . $typeCounts[$baseType];
            }
            continue;
        }

        $norm = normalizeLyricForMatch($line);
        if ($norm === '') continue;

        $entries[] = [
            'sectionId' => $currentSectionId,
            'sectionType' => $currentType ?: 'verse',
            'sectionLabel' => $currentLabel ?: 'Songtekst',
            'norm' => $norm,
        ];
    }

    return $entries;
}

/**
 * Attach section metadata from .txt to parsed SRT cues in order.
 */
function enrichCuesWithSections(array $cues, array $txtEntries): array {
    if (empty($txtEntries)) {
        return array_map(function ($cue) {
            $cue['sectionId'] = 1;
            $cue['sectionType'] = 'lyrics';
            $cue['sectionLabel'] = 'Songtekst';
            return $cue;
        }, $cues);
    }

    $cursor = 0;
    $totalTxt = count($txtEntries);
    $lastSectionId = $txtEntries[0]['sectionId'] ?: 1;
    $lastSectionType = $txtEntries[0]['sectionType'] ?: 'verse';
    $lastSectionLabel = $txtEntries[0]['sectionLabel'] ?: 'Verse 1';

    foreach ($cues as &$cue) {
        $cueNorm = normalizeLyricForMatch($cue['text']);
        $matchedIdx = -1;

        // Search forward from cursor (window of 10 lines first, then full scan)
        $bestScore = 0.0;
        $searchEnd = min($totalTxt, $cursor + 10);
        for ($i = $cursor; $i < $searchEnd; $i++) {
            $tNorm = $txtEntries[$i]['norm'];
            if ($tNorm === $cueNorm) {
                $matchedIdx = $i;
                $bestScore = 100.0;
                break;
            }
            if ($cueNorm !== '' && $tNorm !== '' && (strpos($tNorm, $cueNorm) !== false || strpos($cueNorm, $tNorm) !== false)) {
                $matchedIdx = $i;
                $bestScore = 90.0;
                break;
            }
            similar_text($cueNorm, $tNorm, $pct);
            if ($pct > $bestScore && $pct >= 62.0) {
                $bestScore = $pct;
                $matchedIdx = $i;
            }
        }

        if ($matchedIdx !== -1) {
            $lastSectionId = $txtEntries[$matchedIdx]['sectionId'] ?: $lastSectionId;
            $lastSectionType = $txtEntries[$matchedIdx]['sectionType'] ?: $lastSectionType;
            $lastSectionLabel = $txtEntries[$matchedIdx]['sectionLabel'] ?: $lastSectionLabel;
            $cursor = $matchedIdx + 1;
        }

        $cue['sectionId'] = $lastSectionId;
        $cue['sectionType'] = $lastSectionType;
        $cue['sectionLabel'] = $lastSectionLabel;
    }
    unset($cue);

    return $cues;
}

/**
 * Scan slideshow/portrait or slideshow/landscape and return a map keyed by MM_SS.
 */
function scanSlideshowDir(string $trackPath, string $folderName, string $orientation): array {
    $subDir = $trackPath . '/slideshow/' . $orientation;
    if (!is_dir($subDir)) return [];

    $items = [];
    $entries = @scandir($subDir);
    if (!$entries) return [];

    foreach ($entries as $entry) {
        if ($entry === '.' || $entry === '..') continue;
        $fullPath = $subDir . '/' . $entry;
        if (!is_file($fullPath)) continue;

        $ext = strtolower(pathinfo($entry, PATHINFO_EXTENSION));
        if (!isAllowedMediaExt($ext)) continue;

        if (preg_match('/^(\d{2}_\d{2})\b/', $entry, $m)) {
            $mmSs = $m[1];
            $mtime = @filemtime($fullPath) ?: time();
            $items[$mmSs] = [
                'mmSs' => $mmSs,
                'filename' => $entry,
                'url' => encodeUrlPath($folderName . '/slideshow/' . $orientation . '/' . $entry) . '?v=' . $mtime,
                'type' => getMediaType($ext),
                'ext' => $ext,
                'size' => @filesize($fullPath) ?: 0,
                'updatedAt' => date('c', $mtime),
            ];
        }
    }

    return $items;
}

/**
 * Sanitize an English SRT lyric line for safe cross-platform filenames (Windows + Linux + URLs),
 * preserving the full readable sentence.
 */
function sanitizeLyricFilenamePart(string $text): string {
    $clean = trim(preg_replace('/\s+/u', ' ', $text));
    // Remove filesystem-illegal characters: \ / : * ? " < > | and control chars
    $clean = preg_replace('/[\\\\\/:*?"<>|\x00-\x1F]/u', '', $clean);
    $clean = preg_replace('/\s+/u', ' ', $clean);
    // Trim trailing dots/spaces (Windows disallows filenames ending in dot or space)
    $clean = trim($clean, " .\t\n\r\0\x0B");
    // Cap length safely for filesystems (255 byte limit)
    if (mb_strlen($clean, 'UTF-8') > 160) {
        $clean = rtrim(mb_substr($clean, 0, 160, 'UTF-8'), " .");
    }
    return $clean !== '' ? $clean : 'slide';
}

// ==========================================
// ROUTER
// ==========================================
$action = $_GET['action'] ?? $_POST['action'] ?? 'list_tracks';

// 1. LIST ALL TRACKS IN /@music
if ($action === 'list_tracks') {
    $entries = @scandir($musicBaseDir);
    $tracks = [];

    if ($entries) {
        foreach ($entries as $entry) {
            if ($entry === '.' || $entry === '..' || $entry[0] === '_' || $entry[0] === '.') continue;
            $fullPath = $musicBaseDir . '/' . $entry;
            if (!is_dir($fullPath)) continue;

            $srtFile = findEnglishSrt($fullPath);
            $txtFile = findTrackTxt($fullPath);
            $audioFile = findTrackAudio($fullPath);
            $coverFile = findTrackCover($fullPath);

            $portraitItems = scanSlideshowDir($fullPath, $entry, 'portrait');
            $landscapeItems = scanSlideshowDir($fullPath, $entry, 'landscape');

            // Extract leading track number if present for sorting/display
            $trackNum = null;
            $displayTitle = $entry;
            if (preg_match('/^(\d+)\s+(.+)$/', $entry, $m)) {
                $trackNum = (int)$m[1];
                $displayTitle = trim($m[2]);
            }

            $tracks[] = [
                'folder' => $entry,
                'trackNumber' => $trackNum,
                'title' => $displayTitle,
                'hasSrt' => $srtFile !== null,
                'srtFile' => $srtFile,
                'hasTxt' => $txtFile !== null,
                'audioUrl' => $audioFile ? encodeUrlPath($entry . '/' . $audioFile) : null,
                'coverUrl' => $coverFile ? encodeUrlPath($entry . '/' . $coverFile) : null,
                'portraitCount' => count($portraitItems),
                'landscapeCount' => count($landscapeItems),
            ];
        }
    }

    // Sort: highest track number first or natural order? Natural order descending for numbered tracks (newest first) or ascending?
    // Keep natural ascending order so 001..142 matches the folder list the user knows.
    usort($tracks, fn($a, $b) => strnatcasecmp($a['folder'], $b['folder']));

    echo json_encode([
        'success' => true,
        'tracks' => $tracks,
    ]);
    exit;
}

// 1b. LIGHTWEIGHT SLIDESHOW LIST FOR MUSIC PLAYER (portrait & landscape sorted by seconds)
if ($action === 'get_slideshow') {
    $folder = $_GET['folder'] ?? '';
    $resolved = resolveTrackFolder($musicBaseDir, $folder);
    if (!$resolved) {
        echo json_encode([
            'success' => true,
            'hasSlideshow' => false,
            'folder' => $folder,
            'portrait' => [],
            'landscape' => [],
        ]);
        exit;
    }

    $trackPath = $resolved['path'];
    $folderName = $resolved['folder'];

    $buildList = function (array $map): array {
        $list = [];
        foreach ($map as $mmSs => $item) {
            $parts = explode('_', $mmSs);
            $secs = ((int)($parts[0] ?? 0) * 60) + (int)($parts[1] ?? 0);
            $list[] = [
                'seconds' => $secs,
                'mmSs' => $mmSs,
                'url' => $item['url'],
                'type' => $item['type'],
                'filename' => $item['filename'],
            ];
        }
        usort($list, fn($a, $b) => $a['seconds'] <=> $b['seconds']);
        return $list;
    };

    $portraitList = $buildList(scanSlideshowDir($trackPath, $folderName, 'portrait'));
    $landscapeList = $buildList(scanSlideshowDir($trackPath, $folderName, 'landscape'));

    echo json_encode([
        'success' => true,
        'hasSlideshow' => (count($portraitList) > 0 || count($landscapeList) > 0),
        'folder' => $folderName,
        'portrait' => $portraitList,
        'landscape' => $landscapeList,
    ]);
    exit;
}

// 2. GET TRACK DETAILS (SRT CUES + TXT SECTIONS + EXISTING SLIDESHOW MEDIA)
if ($action === 'get_track') {
    $folder = $_GET['folder'] ?? '';
    $resolved = resolveTrackFolder($musicBaseDir, $folder);
    if (!$resolved) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Ongeldige trackmap.']);
        exit;
    }

    $trackPath = $resolved['path'];
    $folderName = $resolved['folder'];

    $srtFile = findEnglishSrt($trackPath);
    $txtFile = findTrackTxt($trackPath);
    $audioFile = findTrackAudio($trackPath);
    $coverFile = findTrackCover($trackPath);

    $cues = [];
    if ($srtFile) {
        $srtContent = @file_get_contents($trackPath . '/' . $srtFile);
        if ($srtContent !== false) {
            $cues = parseSrtContent($srtContent);
        }
    }

    $txtEntries = [];
    if ($txtFile) {
        $txtContent = @file_get_contents($trackPath . '/' . $txtFile);
        if ($txtContent !== false) {
            $txtEntries = parseTxtSections($txtContent);
        }
    }

    $cues = enrichCuesWithSections($cues, $txtEntries);

    $portraitMap = scanSlideshowDir($trackPath, $folderName, 'portrait');
    $landscapeMap = scanSlideshowDir($trackPath, $folderName, 'landscape');

    foreach ($cues as &$cue) {
        $key = $cue['mmSs'];
        $cue['portrait'] = $portraitMap[$key] ?? null;
        $cue['landscape'] = $landscapeMap[$key] ?? null;
    }
    unset($cue);

    $displayTitle = $folderName;
    if (preg_match('/^\d+\s+(.+)$/', $folderName, $m)) {
        $displayTitle = trim($m[1]);
    }

    echo json_encode([
        'success' => true,
        'track' => [
            'folder' => $folderName,
            'title' => $displayTitle,
            'srtFile' => $srtFile,
            'txtFile' => $txtFile,
            'audioUrl' => $audioFile ? encodeUrlPath($folderName . '/' . $audioFile) : null,
            'coverUrl' => $coverFile ? encodeUrlPath($folderName . '/' . $coverFile) : null,
            'hasSlideshowDir' => is_dir($trackPath . '/slideshow'),
            'portraitCount' => count($portraitMap),
            'landscapeCount' => count($landscapeMap),
            'cues' => $cues,
        ],
    ]);
    exit;
}

// 3. UPLOAD / ASSIGN MEDIA TO A SLOT
if ($action === 'upload' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $folder = $_POST['folder'] ?? '';
    $orientation = strtolower(trim($_POST['orientation'] ?? ''));
    $mmSs = trim($_POST['mmSs'] ?? '');
    $lyricText = trim($_POST['lyricText'] ?? '');

    $resolved = resolveTrackFolder($musicBaseDir, $folder);
    if (!$resolved) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Ongeldige trackmap.']);
        exit;
    }
    if ($orientation !== 'portrait' && $orientation !== 'landscape') {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Orientation moet portrait of landscape zijn.']);
        exit;
    }
    if (!preg_match('/^\d{2}_\d{2}$/', $mmSs)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Ongeldige timestamp (verwacht MM_SS).']);
        exit;
    }
    if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        $code = $_FILES['file']['error'] ?? -1;
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Upload mislukt (foutcode: ' . $code . ').']);
        exit;
    }

    $origName = $_FILES['file']['name'] ?? 'file.jpg';
    $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
    if (!isAllowedMediaExt($ext)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'Alleen afbeeldingen (jpg, png, webp, gif) en video\'s (mp4, mov, webm) zijn toegestaan.'
        ]);
        exit;
    }

    $trackPath = $resolved['path'];
    $folderName = $resolved['folder'];

    // Maak automatisch slideshow/portrait EN slideshow/landscape aan zodra het eerste bestand wordt gekoppeld
    $slideshowDir = $trackPath . '/slideshow';
    $portraitDir = $slideshowDir . '/portrait';
    $landscapeDir = $slideshowDir . '/landscape';

    foreach ([$slideshowDir, $portraitDir, $landscapeDir] as $dir) {
        if (!is_dir($dir)) {
            if (!@mkdir($dir, 0755, true) && !is_dir($dir)) {
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'Kon map slideshow/' . basename($dir) . ' niet aanmaken.']);
                exit;
            }
        }
    }

    $targetDir = ($orientation === 'portrait') ? $portraitDir : $landscapeDir;

    // Verwijder eventuele bestaande bestanden voor deze timestamp (MM_SS) in deze orientatie
    $existing = @scandir($targetDir);
    if ($existing) {
        foreach ($existing as $f) {
            if ($f === '.' || $f === '..') continue;
            if (preg_match('/^' . preg_quote($mmSs, '/') . '\b/', $f) && is_file($targetDir . '/' . $f)) {
                @unlink($targetDir . '/' . $f);
            }
        }
    }

    $safeLyric = sanitizeLyricFilenamePart($lyricText);
    $finalFilename = $mmSs . ' - ' . $safeLyric . '.' . $ext;
    $targetPath = $targetDir . '/' . $finalFilename;

    if (!@move_uploaded_file($_FILES['file']['tmp_name'], $targetPath)) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Kon geüpload bestand niet opslaan op schijf.']);
        exit;
    }

    $mtime = @filemtime($targetPath) ?: time();

    echo json_encode([
        'success' => true,
        'item' => [
            'mmSs' => $mmSs,
            'orientation' => $orientation,
            'filename' => $finalFilename,
            'url' => encodeUrlPath($folderName . '/slideshow/' . $orientation . '/' . $finalFilename) . '?v=' . $mtime,
            'type' => getMediaType($ext),
            'ext' => $ext,
            'size' => @filesize($targetPath) ?: 0,
            'updatedAt' => date('c', $mtime),
        ],
    ]);
    exit;
}

// 4. DELETE MEDIA FROM A SLOT
if ($action === 'delete' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $rawBody = file_get_contents('php://input');
    $json = json_decode($rawBody, true);
    $folder = $json['folder'] ?? $_POST['folder'] ?? '';
    $orientation = strtolower(trim($json['orientation'] ?? $_POST['orientation'] ?? ''));
    $mmSs = trim($json['mmSs'] ?? $_POST['mmSs'] ?? '');

    $resolved = resolveTrackFolder($musicBaseDir, $folder);
    if (!$resolved) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Ongeldige trackmap.']);
        exit;
    }
    if ($orientation !== 'portrait' && $orientation !== 'landscape') {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Ongeldige orientation.']);
        exit;
    }
    if (!preg_match('/^\d{2}_\d{2}$/', $mmSs)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Ongeldige timestamp.']);
        exit;
    }

    $targetDir = $resolved['path'] . '/slideshow/' . $orientation;
    $deleted = [];
    if (is_dir($targetDir)) {
        $existing = @scandir($targetDir);
        if ($existing) {
            foreach ($existing as $f) {
                if ($f === '.' || $f === '..') continue;
                if (preg_match('/^' . preg_quote($mmSs, '/') . '\b/', $f) && is_file($targetDir . '/' . $f)) {
                    if (@unlink($targetDir . '/' . $f)) {
                        $deleted[] = $f;
                    }
                }
            }
        }
    }

    echo json_encode([
        'success' => true,
        'deleted' => $deleted,
    ]);
    exit;
}

http_response_code(400);
echo json_encode(['success' => false, 'error' => 'Onbekende actie.']);
