<?php
/**
 * ==============================================================================
 * Paul van Geenen.nl - File & Media Manager API
 * ==============================================================================
 * Biedt een veilig bestandssysteem voor het beheer:
 * - Mappen aanmaken, navigeren & verwijderen
 * - Bestanden uploaden, bekijken, downloaden & verwijderen
 * - Veilig afgeschermd binnen /public/storage/
 */

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-API-Key");
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Pragma: no-cache");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$siteUrl = 'https://paulvangeenen.nl';

$storageRoot = realpath(__DIR__ . '/../storage');
if (!$storageRoot) {
    $dir = __DIR__ . '/../storage';
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
    $storageRoot = realpath($dir);
}

// Zorg dat de standaard hoofdmappen altijd aanwezig zijn
$defaultFolders = ['Boek Fotos', 'Social Media Fotos', 'Gedeelde Documenten'];
foreach ($defaultFolders as $df) {
    $dfPath = $storageRoot . '/' . $df;
    if (!is_dir($dfPath)) {
        @mkdir($dfPath, 0755, true);
    }
}

function resolveSafePath(string $subpath, string $root): ?string {
    $subpath = str_replace(["\0", "\\"], ['', '/'], $subpath);
    $parts = explode('/', $subpath);
    $safeParts = [];
    foreach ($parts as $p) {
        $p = trim($p);
        if ($p === '' || $p === '.') continue;
        if ($p === '..') return null;
        $safeParts[] = $p;
    }
    $relative = implode('/', $safeParts);
    return $root . ($relative !== '' ? '/' . $relative : '');
}

function formatBytes(int $bytes, int $precision = 1): string {
    $units = ['B', 'KB', 'MB', 'GB', 'TB'];
    $bytes = max($bytes, 0);
    $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
    $pow = min($pow, count($units) - 1);
    $bytes /= pow(1024, $pow);
    return round($bytes, $precision) . ' ' . $units[$pow];
}

function deleteRecursively(string $target): bool {
    if (!file_exists($target)) return true;
    if (!is_dir($target)) return @unlink($target);
    $items = scandir($target);
    if ($items === false) return false;
    foreach ($items as $item) {
        if ($item === '.' || $item === '..') continue;
        $path = $target . '/' . $item;
        if (is_dir($path)) {
            deleteRecursively($path);
        } else {
            @unlink($path);
        }
    }
    return @rmdir($target);
}

$action = $_GET['action'] ?? ($_POST['action'] ?? 'list');

// 1. DOWNLOAD BESTAND
if ($action === 'download') {
    $relPath = trim((string)($_GET['path'] ?? ''));
    $fullPath = resolveSafePath($relPath, $storageRoot);
    if (!$fullPath || !is_file($fullPath) || !file_exists($fullPath)) {
        header("Content-Type: application/json; charset=UTF-8");
        http_response_code(404);
        echo json_encode(['error' => 'Bestand niet gevonden.']);
        exit;
    }
    $filename = basename($fullPath);
    $filesize = filesize($fullPath);
    header('Content-Description: File Transfer');
    header('Content-Type: application/octet-stream');
    header('Content-Disposition: attachment; filename="' . addslashes($filename) . '"');
    header('Expires: 0');
    header('Cache-Control: must-revalidate');
    header('Pragma: public');
    header('Content-Length: ' . $filesize);
    readfile($fullPath);
    exit;
}

header("Content-Type: application/json; charset=UTF-8");

// 2. OVERZICHT MAP / BESTANDEN
if ($action === 'list') {
    $relPath = trim((string)($_GET['path'] ?? ''));
    $targetDir = resolveSafePath($relPath, $storageRoot);

    if (!$targetDir || !is_dir($targetDir)) {
        if ($relPath === '') {
            $targetDir = $storageRoot;
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'Map bestaat niet.']);
            exit;
        }
    }

    $rawItems = scandir($targetDir);
    $folders = [];
    $files = [];

    $imageExts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'];
    $docExts = ['pdf', 'doc', 'docx', 'txt', 'rtf', 'xls', 'xlsx'];
    $audioExts = ['mp3', 'wav', 'm4a', 'flac'];
    $videoExts = ['mp4', 'mov', 'webm'];
    $archiveExts = ['zip', 'rar', '7z', 'tar', 'gz'];

    $protectedRoots = ['Boek Fotos', 'Social Media Fotos', 'Gedeelde Documenten'];

    if ($rawItems !== false) {
        foreach ($rawItems as $item) {
            if ($item === '.' || $item === '..' || str_starts_with($item, '.')) continue;
            $itemFullPath = $targetDir . '/' . $item;
            $itemRelPath = ltrim(str_replace($storageRoot, '', $itemFullPath), '/\\');
            $itemRelPath = str_replace('\\', '/', $itemRelPath);

            $isDir = is_dir($itemFullPath);
            $size = $isDir ? 0 : (@filesize($itemFullPath) ?: 0);
            $modified = @filemtime($itemFullPath) ?: time();
            $ext = strtolower(pathinfo($item, PATHINFO_EXTENSION));

            $isProtected = in_array($itemRelPath, $protectedRoots, true);

            $type = 'other';
            if ($isDir) {
                $type = 'folder';
            } elseif (in_array($ext, $imageExts, true)) {
                $type = 'image';
            } elseif (in_array($ext, $docExts, true)) {
                $type = 'document';
            } elseif (in_array($ext, $audioExts, true)) {
                $type = 'audio';
            } elseif (in_array($ext, $videoExts, true)) {
                $type = 'video';
            } elseif (in_array($ext, $archiveExts, true)) {
                $type = 'archive';
            }

            $fileInfo = [
                'name' => $item,
                'path' => $itemRelPath,
                'isDir' => $isDir,
                'isProtected' => $isProtected,
                'type' => $type,
                'extension' => $ext,
                'size' => $size,
                'sizeFormatted' => $isDir ? '-' : formatBytes($size),
                'modified' => date('c', $modified),
                'modifiedFormatted' => date('d-m-Y H:i', $modified),
                'url' => $isDir ? null : ($siteUrl . '/storage/' . implode('/', array_map('rawurlencode', explode('/', $itemRelPath)))),
            ];

            if ($isDir) {
                $sub = @scandir($itemFullPath);
                $subCount = 0;
                if ($sub !== false) {
                    foreach ($sub as $s) {
                        if ($s !== '.' && $s !== '..' && !str_starts_with($s, '.')) $subCount++;
                    }
                }
                $fileInfo['itemCount'] = $subCount;
                $folders[] = $fileInfo;
            } else {
                $files[] = $fileInfo;
            }
        }
    }

    usort($folders, fn($a, $b) => strcasecmp($a['name'], $b['name']));
    usort($files, fn($a, $b) => strcasecmp($a['name'], $b['name']));

    $breadcrumbs = [['name' => 'Hoofdmap', 'path' => '']];
    if ($relPath !== '') {
        $parts = explode('/', trim($relPath, '/'));
        $accum = '';
        foreach ($parts as $p) {
            $accum = $accum === '' ? $p : $accum . '/' . $p;
            $breadcrumbs[] = ['name' => $p, 'path' => $accum];
        }
    }

    echo json_encode([
        'currentPath' => $relPath,
        'breadcrumbs' => $breadcrumbs,
        'folders' => $folders,
        'files' => $files,
        'totalItems' => count($folders) + count($files),
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// 3. NIEUWE MAP AANMAKEN
if ($action === 'mkdir') {
    $parentPath = trim((string)($_POST['path'] ?? ''));
    $folderName = trim((string)($_POST['name'] ?? ''));

    if (empty($folderName)) {
        http_response_code(400);
        echo json_encode(['error' => 'Geef een mapnaam op.']);
        exit;
    }

    $folderName = preg_replace('/[^\p{L}\p{N}\s\-_()]/u', '', $folderName);
    $folderName = trim($folderName);
    if (empty($folderName)) {
        http_response_code(400);
        echo json_encode(['error' => 'Ongeldige mapnaam.']);
        exit;
    }

    $parentDir = resolveSafePath($parentPath, $storageRoot);
    if (!$parentDir || !is_dir($parentDir)) {
        http_response_code(400);
        echo json_encode(['error' => 'Bovenliggende map bestaat niet.']);
        exit;
    }

    $newFolder = $parentDir . '/' . $folderName;
    if (file_exists($newFolder)) {
        http_response_code(400);
        echo json_encode(['error' => 'Er bestaat al een map of bestand met deze naam.']);
        exit;
    }

    if (!@mkdir($newFolder, 0755, true)) {
        http_response_code(500);
        echo json_encode(['error' => 'Kon map niet aanmaken op de server.']);
        exit;
    }

    $relPath = ltrim(str_replace($storageRoot, '', $newFolder), '/\\');
    echo json_encode(['success' => true, 'path' => str_replace('\\', '/', $relPath), 'name' => $folderName]);
    exit;
}

// 4. BESTAND(EN) UPLOADEN
if ($action === 'upload') {
    $targetRelPath = trim((string)($_POST['path'] ?? ''));
    $targetDir = resolveSafePath($targetRelPath, $storageRoot);

    if (!$targetDir || !is_dir($targetDir)) {
        http_response_code(400);
        echo json_encode(['error' => 'Doelmap bestaat niet.']);
        exit;
    }

    $rawFiles = $_FILES['files'] ?? ($_FILES['file'] ?? null);
    if (!$rawFiles) {
        http_response_code(400);
        echo json_encode(['error' => 'Geen bestanden ontvangen.']);
        exit;
    }

    $normalized = [];
    if (is_array($rawFiles['name'])) {
        $count = count($rawFiles['name']);
        for ($i = 0; $i < $count; $i++) {
            if ($rawFiles['error'][$i] === UPLOAD_ERR_OK && !empty($rawFiles['name'][$i])) {
                $normalized[] = [
                    'name' => $rawFiles['name'][$i],
                    'tmp_name' => $rawFiles['tmp_name'][$i],
                    'size' => $rawFiles['size'][$i],
                ];
            }
        }
    } else {
        if ($rawFiles['error'] === UPLOAD_ERR_OK && !empty($rawFiles['name'])) {
            $normalized[] = [
                'name' => $rawFiles['name'],
                'tmp_name' => $rawFiles['tmp_name'],
                'size' => $rawFiles['size'],
            ];
        }
    }

    if (empty($normalized)) {
        http_response_code(400);
        echo json_encode(['error' => 'Geen geldige bestanden ontvangen of uploadfout.']);
        exit;
    }

    $disallowedExts = ['php', 'phtml', 'php3', 'php4', 'php5', 'php7', 'phps', 'phar', 'cgi', 'pl', 'py', 'sh', 'exe', 'bat', 'cmd', 'vbs', 'htaccess'];
    $maxFileSize = 50 * 1024 * 1024; // 50 MB per bestand

    $saved = [];
    $errors = [];

    foreach ($normalized as $f) {
        $origName = $f['name'];
        $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));

        if (in_array($ext, $disallowedExts, true)) {
            $errors[] = "Bestand {$origName} is niet toegestaan om veiligheidsredenen.";
            continue;
        }

        if ($f['size'] > $maxFileSize) {
            $errors[] = "Bestand {$origName} is te groot (maximaal 50 MB).";
            continue;
        }

        $base = pathinfo($origName, PATHINFO_FILENAME);
        $baseSafe = preg_replace('/[^\p{L}\p{N}\s\-_.]/u', '', $base);
        $baseSafe = trim(str_replace(' ', '_', $baseSafe)) ?: 'bestand';
        $finalName = $baseSafe . '.' . $ext;

        $destPath = $targetDir . '/' . $finalName;
        if (file_exists($destPath)) {
            $finalName = $baseSafe . '_' . date('Ymd_His') . '_' . mt_rand(10, 99) . '.' . $ext;
            $destPath = $targetDir . '/' . $finalName;
        }

        if (move_uploaded_file($f['tmp_name'], $destPath)) {
            $rel = ltrim(str_replace($storageRoot, '', $destPath), '/\\');
            $rel = str_replace('\\', '/', $rel);
            $saved[] = [
                'name' => $finalName,
                'path' => $rel,
                'size' => $f['size'],
                'sizeFormatted' => formatBytes($f['size']),
                'url' => $siteUrl . '/storage/' . implode('/', array_map('rawurlencode', explode('/', $rel))),
            ];
        } else {
            $errors[] = "Kon {$origName} niet opslaan op de server.";
        }
    }

    echo json_encode([
        'success' => count($saved) > 0,
        'uploaded' => $saved,
        'errors' => $errors,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// 5. VERWIJDEREN (BESTAND OF MAP)
if ($action === 'delete') {
    $targetRelPath = trim((string)($_POST['path'] ?? ''));
    if ($targetRelPath === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Hoofdmap kan niet worden verwijderd.']);
        exit;
    }

    $protectedRoots = ['Boek Fotos', 'Social Media Fotos', 'Gedeelde Documenten'];
    if (in_array(trim($targetRelPath, '/\\'), $protectedRoots, true)) {
        http_response_code(403);
        echo json_encode(['error' => 'Deze hoofdmap is beveiligd tegen verwijdering.']);
        exit;
    }

    $target = resolveSafePath($targetRelPath, $storageRoot);
    if (!$target || !file_exists($target)) {
        http_response_code(404);
        echo json_encode(['error' => 'Item niet gevonden.']);
        exit;
    }

    if (deleteRecursively($target)) {
        echo json_encode(['success' => true, 'path' => $targetRelPath]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Kon bestand of map niet verwijderen.']);
    }
    exit;
}

// 6. HERNOEMEN
if ($action === 'rename') {
    $targetRelPath = trim((string)($_POST['path'] ?? ''));
    $newName = trim((string)($_POST['newName'] ?? ''));

    if ($targetRelPath === '' || empty($newName)) {
        http_response_code(400);
        echo json_encode(['error' => 'Ongeldige gegevens voor hernoemen.']);
        exit;
    }

    $target = resolveSafePath($targetRelPath, $storageRoot);
    if (!$target || !file_exists($target)) {
        http_response_code(404);
        echo json_encode(['error' => 'Item niet gevonden.']);
        exit;
    }

    $isDir = is_dir($target);
    $parent = dirname($target);

    if ($isDir) {
        $safeName = preg_replace('/[^\p{L}\p{N}\s\-_()]/u', '', $newName);
        $safeName = trim($safeName);
    } else {
        $ext = strtolower(pathinfo($newName, PATHINFO_EXTENSION));
        $base = pathinfo($newName, PATHINFO_FILENAME);
        $safeBase = preg_replace('/[^\p{L}\p{N}\s\-_.]/u', '', $base);
        $safeName = trim(str_replace(' ', '_', $safeBase)) . ($ext ? '.' . $ext : '');
    }

    if (empty($safeName)) {
        http_response_code(400);
        echo json_encode(['error' => 'Ongeldige nieuwe naam.']);
        exit;
    }

    $newFullPath = $parent . '/' . $safeName;
    if (file_exists($newFullPath)) {
        http_response_code(400);
        echo json_encode(['error' => 'Er bestaat al een item met deze naam.']);
        exit;
    }

    if (@rename($target, $newFullPath)) {
        $rel = ltrim(str_replace($storageRoot, '', $newFullPath), '/\\');
        echo json_encode(['success' => true, 'newName' => $safeName, 'newPath' => str_replace('\\', '/', $rel)]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Hernoemen mislukt.']);
    }
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Ongeldige actie.']);
