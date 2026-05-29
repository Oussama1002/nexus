<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\WhatsAppCloudService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;

class WhatsAppWebhookController extends Controller
{
    public function __construct(private readonly WhatsAppCloudService $wa) {}

    /** Meta sends GET with hub.challenge — we echo it back if the verify token matches a brand. */
    public function verify(Request $request): Response
    {
        $mode = (string) $request->query('hub_mode', $request->query('hub.mode', ''));
        $token = (string) $request->query('hub_verify_token', $request->query('hub.verify_token', ''));
        $challenge = (string) $request->query('hub_challenge', $request->query('hub.challenge', ''));

        if ($mode === 'subscribe' && $this->wa->findBrandIdByVerifyToken($token)) {
            return response($challenge, 200)->header('Content-Type', 'text/plain');
        }

        Log::warning('whatsapp.webhook.verify_failed', [
            'mode' => $mode,
            'has_token' => $token !== '',
        ]);

        return response('Forbidden', 403)->header('Content-Type', 'text/plain');
    }

    /** Meta POSTs message events. We must respond 200 quickly. */
    public function receive(Request $request): JsonResponse
    {
        $payload = $request->all();

        try {
            $count = $this->wa->ingestWebhook($payload);
            Log::info('whatsapp.webhook.received', ['stored' => $count]);
        } catch (\Throwable $e) {
            Log::error('whatsapp.webhook.ingest_failed', [
                'error' => $e->getMessage(),
            ]);
        }

        return ApiResponse::success(['received' => true], 'ok');
    }
}
