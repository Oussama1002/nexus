<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Brand;
use App\Models\WhatsAppNumber;
use App\Services\WhatsAppCloudService;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class WhatsAppController extends Controller
{
    private function resolveSettingsBrand(Request $request): int
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        if ($brandId !== null) {
            return $brandId;
        }

        return (int) Brand::query()->orderBy('id')->value('id');
    }

    public function __construct(
        private readonly WhatsAppCloudService $whatsapp,
    ) {}

    /**
     * List the WhatsApp Business phone numbers registered under the brand's WABA
     * (live from Meta) so they can be imported into the brand.
     */
    public function phoneNumbers(Request $request): JsonResponse
    {
        try {
            $brandId = $this->resolveSettingsBrand($request);
            $numbers = $this->whatsapp->fetchPhoneNumbers($brandId);

            return ApiResponse::success(
                ['numbers' => $numbers],
                sprintf('%d numéro(s) WhatsApp récupéré(s).', count($numbers)),
            );
        } catch (\RuntimeException $e) {
            return ApiResponse::error($e->getMessage(), null, 422);
        }
    }

    /** List all saved WhatsApp numbers across all brands. */
    public function listNumbers(Request $request): JsonResponse
    {
        $numbers = WhatsAppNumber::query()
            ->with('brand:id,name')
            ->orderByDesc('is_default')
            ->orderBy('brand_id')
            ->orderBy('id')
            ->get()
            ->map(fn (WhatsAppNumber $n) => $n->toSafeArray())
            ->all();

        return ApiResponse::success(['numbers' => $numbers], 'Numéros WhatsApp.');
    }

    /** Save (import) a WhatsApp number to the active brand. */
    public function addNumber(Request $request): JsonResponse
    {
        $brandId = $this->resolveSettingsBrand($request);

        $data = $request->validate([
            'phone_id' => ['required', 'string', 'max:191'],
            'waba_id' => ['nullable', 'string', 'max:191'],
            'display_number' => ['nullable', 'string', 'max:191'],
            'verified_name' => ['nullable', 'string', 'max:191'],
            'label' => ['nullable', 'string', 'max:191'],
            'api_token' => ['nullable', 'string'],
            'api_base_url' => ['nullable', 'string', 'max:191'],
        ]);

        $existing = WhatsAppNumber::query()->where('phone_id', $data['phone_id'])->first();
        if ($existing && $existing->brand_id !== $brandId) {
            return ApiResponse::error('Ce numéro (Phone ID) est déjà rattaché à une autre marque.', null, 422);
        }

        $isFirst = ! WhatsAppNumber::query()->where('brand_id', $brandId)->exists();

        $number = DB::transaction(function () use ($brandId, $data, $existing, $isFirst) {
            $payload = [
                'brand_id' => $brandId,
                'phone_id' => $data['phone_id'],
                'waba_id' => $data['waba_id'] ?? null,
                'display_number' => $data['display_number'] ?? null,
                'verified_name' => $data['verified_name'] ?? null,
                'label' => $data['label'] ?? ($data['display_number'] ?? $data['phone_id']),
                'api_base_url' => $data['api_base_url'] ?? null,
                'is_active' => true,
            ];
            if (! empty($data['api_token'])) {
                $payload['api_token'] = $data['api_token'];
            }
            if ($isFirst) {
                $payload['is_default'] = true;
            }

            if ($existing) {
                $existing->fill($payload)->save();

                return $existing;
            }

            return WhatsAppNumber::query()->create($payload);
        });

        return ApiResponse::success($number->fresh()->toSafeArray(), 'Numéro WhatsApp importé.', 201);
    }

    /** Update a saved WhatsApp number (label, active, default, token). */
    public function updateNumber(Request $request, string $id): JsonResponse
    {
        $brandId = $this->resolveSettingsBrand($request);
        $number = WhatsAppNumber::query()->where('brand_id', $brandId)->findOrFail($id);

        $data = $request->validate([
            'label' => ['nullable', 'string', 'max:191'],
            'display_number' => ['nullable', 'string', 'max:191'],
            'api_token' => ['nullable', 'string'],
            'api_base_url' => ['nullable', 'string', 'max:191'],
            'is_active' => ['nullable', 'boolean'],
            'is_default' => ['nullable', 'boolean'],
        ]);

        DB::transaction(function () use ($number, $data, $brandId) {
            if (array_key_exists('label', $data)) {
                $number->label = $data['label'];
            }
            if (array_key_exists('display_number', $data)) {
                $number->display_number = $data['display_number'];
            }
            if (array_key_exists('api_base_url', $data)) {
                $number->api_base_url = $data['api_base_url'];
            }
            if (array_key_exists('is_active', $data)) {
                $number->is_active = (bool) $data['is_active'];
            }
            if (! empty($data['api_token'])) {
                $number->api_token = $data['api_token'];
            }
            if (! empty($data['is_default'])) {
                WhatsAppNumber::query()->where('brand_id', $brandId)->update(['is_default' => false]);
                $number->is_default = true;
            }
            $number->save();
        });

        return ApiResponse::success($number->fresh()->toSafeArray(), 'Numéro WhatsApp mis à jour.');
    }

    /** Remove a saved WhatsApp number from the brand. */
    public function deleteNumber(Request $request, string $id): JsonResponse
    {
        $brandId = $this->resolveSettingsBrand($request);
        $number = WhatsAppNumber::query()->where('brand_id', $brandId)->findOrFail($id);
        $wasDefault = $number->is_default;
        $number->delete();

        // Promote another number to default if we removed the default one.
        if ($wasDefault) {
            $next = WhatsAppNumber::query()->where('brand_id', $brandId)->orderBy('id')->first();
            if ($next) {
                $next->is_default = true;
                $next->save();
            }
        }

        return ApiResponse::success(null, 'Numéro WhatsApp supprimé.');
    }
}
