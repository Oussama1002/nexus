<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SocialComplaint;
use App\Models\SocialComplaintUpdate;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SocialComplaintController extends Controller
{
    private const STATUSES = ['nouvelle', 'en_cours', 'transmise', 'resolue', 'cloturee'];

    private const REASONS = ['retard', 'defectueux', 'remboursement', 'service', 'autre'];

    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 25), 1), 100);

        $q = SocialComplaint::query()->with('brand:id,name')->withCount('updates')->orderByDesc('received_at')->orderByDesc('id');
        ApiBrandContext::scopeBrand($q, $brandId);

        if ($status = $request->query('status')) {
            $q->where('status', $status);
        }
        if ($reason = $request->query('reason')) {
            $q->where('reason', $reason);
        }
        if ($platform = $request->query('platform')) {
            $q->where('platform', $platform);
        }
        if ($search = trim((string) $request->query('search', ''))) {
            $s = '%'.str_replace(['%', '_'], ['\\%', '\\_'], $search).'%';
            $q->where(fn ($w) => $w->where('customer_name', 'like', $s)->orWhere('description', 'like', $s));
        }

        return ApiResponse::success($q->paginate($perPage), 'Réclamations réseaux sociaux.');
    }

    /** Compteurs par statut (alimentent le tableau de bord / rapports CM, §1-2). */
    public function stats(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $base = SocialComplaint::query();
        ApiBrandContext::scopeBrand($base, $brandId);

        $byStatus = (clone $base)->selectRaw('status, COUNT(*) as c')->groupBy('status')->pluck('c', 'status');

        return ApiResponse::success([
            'total' => (int) (clone $base)->count(),
            'nouvelle' => (int) ($byStatus['nouvelle'] ?? 0),
            'en_cours' => (int) ($byStatus['en_cours'] ?? 0),
            'transmise' => (int) ($byStatus['transmise'] ?? 0),
            'resolue' => (int) ($byStatus['resolue'] ?? 0),
            'cloturee' => (int) ($byStatus['cloturee'] ?? 0),
        ], 'Statistiques réclamations.');
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $row = SocialComplaint::query()
            ->with(['brand:id,name', 'updates.user:id,name'])
            ->when($brandId !== null, fn ($q) => $q->where('brand_id', $brandId))
            ->findOrFail($id);

        return ApiResponse::success($row, 'Réclamation.');
    }

    public function store(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $this->validated($request);
        $data['brand_id'] = $brandId;
        $data['created_by'] = $request->user()?->id;
        $data['updated_by'] = $request->user()?->id;

        $row = SocialComplaint::query()->create($data);
        AuditLogger::log($request, 'social_complaint.create', $row, null, $row->toArray());

        return ApiResponse::success($row->fresh('brand:id,name'), 'Réclamation enregistrée.', 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = SocialComplaint::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $row->toArray();

        $row->fill($this->validated($request, true));
        $row->updated_by = $request->user()?->id;
        $row->save();

        AuditLogger::log($request, 'social_complaint.update', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh('brand:id,name'), 'Réclamation mise à jour.');
    }

    /** Ajoute une entrée au suivi (action/réponse datée), avec changement de statut optionnel. */
    public function addUpdate(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = SocialComplaint::query()->where('brand_id', $brandId)->findOrFail($id);

        $data = $request->validate([
            'note' => ['required', 'string', 'max:2000'],
            'status' => ['nullable', Rule::in(self::STATUSES)],
        ]);

        $update = SocialComplaintUpdate::query()->create([
            'social_complaint_id' => $row->id,
            'user_id' => $request->user()?->id,
            'note' => $data['note'],
            'status_after' => $data['status'] ?? null,
        ]);

        if (! empty($data['status'])) {
            $row->status = $data['status'];
            $row->updated_by = $request->user()?->id;
            $row->save();
        }

        return ApiResponse::success($update->load('user:id,name'), 'Suivi ajouté.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = SocialComplaint::query()->where('brand_id', $brandId)->findOrFail($id);
        $row->updates()->delete();
        $row->delete();

        AuditLogger::log($request, 'social_complaint.delete', null, ['id' => (int) $id], null);

        return ApiResponse::success(null, 'Réclamation supprimée.');
    }

    /** @return array<string, mixed> */
    private function validated(Request $request, bool $partial = false): array
    {
        $req = $partial ? 'sometimes' : 'nullable';

        return $request->validate([
            'platform' => [$req, 'string', 'max:40'],
            'channel' => [$req, Rule::in(['dm', 'comment'])],
            'customer_name' => [$req, 'string', 'max:191'],
            'customer_link' => [$req, 'string', 'max:2048'],
            'received_at' => [$req, 'date'],
            'reason' => [$req, Rule::in(self::REASONS)],
            'description' => [$req, 'string', 'max:5000'],
            'screenshot_url' => [$req, 'string', 'max:2048'],
            'status' => [$req, Rule::in(self::STATUSES)],
            'assigned_to_text' => [$req, 'string', 'max:191'],
        ]);
    }
}
