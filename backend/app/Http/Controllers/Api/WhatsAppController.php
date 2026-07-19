<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\WhatsAppCloudService;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WhatsAppController extends Controller
{
    public function __construct(
        private readonly WhatsAppCloudService $whatsapp,
    ) {}

    /**
     * List the WhatsApp Business phone numbers registered under the brand's WABA
     * so they can be imported into the settings (fills Phone ID + number).
     */
    public function phoneNumbers(Request $request): JsonResponse
    {
        try {
            $brandId = (int) ApiBrandContext::resolveBrandId($request);
            $numbers = $this->whatsapp->fetchPhoneNumbers($brandId);

            return ApiResponse::success(
                ['numbers' => $numbers],
                sprintf('%d numéro(s) WhatsApp récupéré(s).', count($numbers)),
            );
        } catch (\RuntimeException $e) {
            return ApiResponse::error($e->getMessage(), null, 422);
        }
    }
}
