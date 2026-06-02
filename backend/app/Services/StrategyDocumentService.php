<?php

namespace App\Services;

use App\Models\Strategy;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class StrategyDocumentService
{
    /**
     * @throws \InvalidArgumentException
     */
    public function store(int $brandId, UploadedFile $file, ?int $strategyId = null): string
    {
        $ext = strtolower($file->getClientOriginalExtension() ?: $file->extension() ?: 'bin');
        $allowed = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'gif', 'webp'];
        if (! in_array($ext, $allowed, true)) {
            throw new \InvalidArgumentException('Format non supporté (PDF, Office ou image).');
        }

        if ($strategyId) {
            $dir = "strategy-documents/{$brandId}/{$strategyId}";
            Storage::disk('public')->deleteDirectory($dir);
        } else {
            $dir = "strategy-documents/{$brandId}/drafts/".Str::uuid();
        }

        $filename = 'document.'.($ext === 'jpeg' ? 'jpg' : $ext);
        $path = $file->storeAs($dir, $filename, 'public');
        $url = Storage::disk('public')->url($path);

        if ($strategyId) {
            Strategy::query()
                ->where('brand_id', $brandId)
                ->whereKey($strategyId)
                ->update(['document_path' => $url]);
        }

        return $url;
    }
}
