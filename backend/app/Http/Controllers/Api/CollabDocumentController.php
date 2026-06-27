<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CollabProject;
use App\Models\CollabProjectDocument;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class CollabDocumentController extends Controller
{
    public function index(Request $request, string $projectId): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $project = CollabProject::query()->where('brand_id', $brandId)->findOrFail($projectId);

        $docs = CollabProjectDocument::query()
            ->where('project_id', $project->id)
            ->with('uploader:id,name')
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (CollabProjectDocument $d) => [
                'id' => $d->id,
                'original_name' => $d->original_name,
                'mime_type' => $d->mime_type,
                'size_bytes' => $d->size_bytes,
                'uploaded_by' => $d->uploader?->name ?? 'Inconnu',
                'created_at' => $d->created_at->toIso8601String(),
                'download_url' => url("api/collab-projects/{$project->id}/documents/{$d->id}/download"),
            ]);

        return ApiResponse::success($docs, 'Documents récupérés.');
    }

    public function store(Request $request, string $projectId): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $project = CollabProject::query()->where('brand_id', $brandId)->findOrFail($projectId);

        $request->validate([
            'file' => ['required', 'file', 'max:20480'],
        ]);

        $file = $request->file('file');
        $path = $file->store("collab-projects/{$project->id}/documents", 'public');

        $doc = CollabProjectDocument::query()->create([
            'project_id' => $project->id,
            'uploaded_by' => $request->user()->id,
            'original_name' => $file->getClientOriginalName(),
            'storage_path' => $path,
            'mime_type' => $file->getClientMimeType(),
            'size_bytes' => $file->getSize(),
        ]);

        return ApiResponse::success([
            'id' => $doc->id,
            'original_name' => $doc->original_name,
            'mime_type' => $doc->mime_type,
            'size_bytes' => $doc->size_bytes,
            'uploaded_by' => $request->user()->name,
            'created_at' => $doc->created_at->toIso8601String(),
            'download_url' => url("api/collab-projects/{$project->id}/documents/{$doc->id}/download"),
        ], 'Document ajouté.', 201);
    }

    public function download(Request $request, string $projectId, string $docId)
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $project = CollabProject::query()->where('brand_id', $brandId)->findOrFail($projectId);
        $doc = CollabProjectDocument::query()
            ->where('project_id', $project->id)
            ->findOrFail($docId);

        if (! Storage::disk('public')->exists($doc->storage_path)) {
            return ApiResponse::error('Fichier introuvable.', null, 404);
        }

        return Storage::disk('public')->download($doc->storage_path, $doc->original_name);
    }

    public function destroy(Request $request, string $projectId, string $docId): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $project = CollabProject::query()->where('brand_id', $brandId)->findOrFail($projectId);
        $doc = CollabProjectDocument::query()
            ->where('project_id', $project->id)
            ->findOrFail($docId);

        Storage::disk('public')->delete($doc->storage_path);
        $doc->delete();

        return ApiResponse::success(null, 'Document supprimé.');
    }
}
