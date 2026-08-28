<?php

namespace App\Services\Am;

use App\Models\CmNotification;
use App\Models\User;

/**
 * Thin fan-out helper for AM events, reusing CmNotification as the shared
 * inbox. Fingerprints on `fp` in data to dedupe automated pings.
 */
class AmNotificationService
{
    public function notifyRole(string $roleSlug, ?int $brandId, string $type, string $title, string $body, array $data = []): void
    {
        $ids = User::query()
            ->whereHas('roles', fn ($q) => $q->where('slug', $roleSlug))
            ->pluck('id');
        foreach ($ids as $uid) {
            $this->notifyUser((int) $uid, $brandId, $type, $title, $body, $data);
        }
    }

    public function notifyUser(int $userId, ?int $brandId, string $type, string $title, string $body, array $data = []): void
    {
        if (isset($data['fp'])) {
            $exists = CmNotification::query()
                ->where('recipient_user_id', $userId)
                ->whereJsonContains('data', ['fp' => $data['fp']])
                ->exists();
            if ($exists) return;
        }
        CmNotification::query()->create([
            'recipient_user_id' => $userId,
            'brand_id' => $brandId,
            'type' => $type,
            'title' => $title,
            'body' => $body,
            'data' => $data,
        ]);
    }
}
